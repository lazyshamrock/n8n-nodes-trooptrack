#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# push-n8n.sh (Approach A, writable /tmp staging, keep last 3 tgz)
# Auto-bumps patch version, builds, packs, copies tgz into the
# container (to a writable /tmp dir), installs into n8n custom
# extensions directory, and restarts n8n.
#
# Also prunes local ./builds to keep only the most recent N tgz files
# (default: 3). You can override with BUILDS_KEEP_COUNT.
#
# Run from repo root:
#   ./scripts/push-n8n.sh
# ------------------------------------------------------------

# Move to repo root (one level up from /scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Container name (override by exporting N8N_CONTAINER_NAME)
N8N_CONTAINER_NAME="${N8N_CONTAINER_NAME:-n8n-docker-n8n-1}"

# Local builds directory
BUILDS_DIR="${BUILDS_DIR:-${REPO_ROOT}/builds}"
mkdir -p "${BUILDS_DIR}"

# How many local tgz files to keep
BUILDS_KEEP_COUNT="${BUILDS_KEEP_COUNT:-3}"

# Where n8n may load extra packages from.
# Some installs use the community-packages folder (`/home/node/.n8n/nodes`),
# while others use `N8N_CUSTOM_EXTENSIONS` (`/home/node/.n8n/custom`).
# We detect what exists in the running container and update the active location.
CONTAINER_COMMUNITY_DIR="${CONTAINER_COMMUNITY_DIR:-/home/node/.n8n/nodes}"
CONTAINER_CUSTOM_DIR="${CONTAINER_CUSTOM_DIR:-/home/node/.n8n/custom}"

# Writable staging dir inside the container for the packed tgz
# (Your /opt mount is read-only per compose: ...:/opt/n8n-nodes-trooptrack:ro)
CONTAINER_TGZ_DIR="${CONTAINER_TGZ_DIR:-/tmp/n8n-nodes-trooptrack-builds}"

echo "[STEP] Auto-bump patch version"
npm version patch --no-git-tag-version

PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"

echo "[INFO] Package: ${PKG_NAME}"
echo "[INFO] New Version: ${PKG_VERSION}"
echo

echo "[STEP] npm run build"
npm run build

echo
echo "[STEP] npm pack"
TARBALL_ACTUAL="$(npm pack --silent --pack-destination "${BUILDS_DIR}" | tail -n 1 | tr -d '\r\n')"

if [[ -z "${TARBALL_ACTUAL}" ]]; then
  echo "[ERROR] npm pack did not return a tarball filename."
  exit 1
fi

LOCAL_TGZ_PATH="${BUILDS_DIR}/${TARBALL_ACTUAL}"

if [[ ! -f "${LOCAL_TGZ_PATH}" ]]; then
  echo "[ERROR] Local tarball not found: ${LOCAL_TGZ_PATH}"
  exit 1
fi

echo "[INFO] Local tgz path: ${LOCAL_TGZ_PATH}"

echo
echo "[STEP] Prune local tgz files in ${BUILDS_DIR} (keep last ${BUILDS_KEEP_COUNT})"
# Keep the newest N tgz files (by mtime) and delete the rest
# Works on macOS and Linux.
PRUNE_LIST="$(ls -1t "${BUILDS_DIR}"/*.tgz 2>/dev/null | tail -n +"$((BUILDS_KEEP_COUNT + 1))" || true)"
if [[ -n "${PRUNE_LIST}" ]]; then
  while IFS= read -r f; do
    [[ -n "${f}" ]] && rm -f "${f}"
  done <<< "${PRUNE_LIST}"
fi

echo
echo "[STEP] Ensure writable tgz dir exists in container: ${CONTAINER_TGZ_DIR}"
docker exec -it "${N8N_CONTAINER_NAME}" sh -lc "mkdir -p '${CONTAINER_TGZ_DIR}'"

# Cleanup container staging to avoid /tmp bloat
docker exec -it "${N8N_CONTAINER_NAME}" sh -lc "rm -f '${CONTAINER_TGZ_DIR}'/*.tgz 2>/dev/null || true"

echo
echo "[STEP] Copy tgz into container: ${N8N_CONTAINER_NAME}"
docker cp "${LOCAL_TGZ_PATH}" "${N8N_CONTAINER_NAME}:${CONTAINER_TGZ_DIR}/"

CONTAINER_TGZ_PATH="${CONTAINER_TGZ_DIR}/${TARBALL_ACTUAL}"
echo "[INFO] Container tgz path: ${CONTAINER_TGZ_PATH}"

# Verify the tgz exists inside container
docker exec -it "${N8N_CONTAINER_NAME}" sh -lc "ls -la '${CONTAINER_TGZ_PATH}'"

echo
echo "[STEP] Install tarball into n8n package directories"
docker exec -it "${N8N_CONTAINER_NAME}" sh -lc "
  set -e;
  ensure_pkg_dir() {
    target_dir=\"\$1\";
    pkg_name=\"\$2\";
    mkdir -p \"\${target_dir}\";
    if [ ! -f \"\${target_dir}/package.json\" ]; then
      printf '{\n  \"name\": \"%s\",\n  \"version\": \"1.0.0\",\n  \"type\": \"commonjs\"\n}\n' \"\${pkg_name}\" > \"\${target_dir}/package.json\";
    fi
  }

  install_into_dir() {
    target_dir=\"\$1\";
    label=\"\$2\";
    ensure_pkg_dir \"\${target_dir}\" \"\${label}\";
    echo \"Installing into \${target_dir}\";
    cd \"\${target_dir}\";
    rm -rf node_modules/'${PKG_NAME}';
    npm install --no-fund --no-audit '${CONTAINER_TGZ_PATH}';
    node -p \"require('./node_modules/${PKG_NAME}/package.json').version\"
  }

  echo \"N8N_CUSTOM_EXTENSIONS=\${N8N_CUSTOM_EXTENSIONS:-}\";

  INSTALL_CUSTOM=false
  INSTALL_COMMUNITY=false

  if [ -f '${CONTAINER_COMMUNITY_DIR}/package.json' ]; then
    INSTALL_COMMUNITY=true
  fi

  if [ -f '${CONTAINER_CUSTOM_DIR}/package.json' ] || [ \"\${N8N_CUSTOM_EXTENSIONS:-}\" = '${CONTAINER_CUSTOM_DIR}' ]; then
    INSTALL_CUSTOM=true
  fi

  # If neither location exists yet, prefer custom because that preserves
  # the legacy CUSTOM.<nodeName> workflow type used in this environment.
  if [ \"\${INSTALL_CUSTOM}\" = false ] && [ \"\${INSTALL_COMMUNITY}\" = false ]; then
    INSTALL_CUSTOM=true
  fi

  if [ \"\${INSTALL_CUSTOM}\" = true ]; then
    install_into_dir '${CONTAINER_CUSTOM_DIR}' 'custom'
  fi

  if [ \"\${INSTALL_COMMUNITY}\" = true ]; then
    install_into_dir '${CONTAINER_COMMUNITY_DIR}' 'nodes'
  fi
"

echo
echo "[STEP] Restart container: ${N8N_CONTAINER_NAME}"
docker restart "${N8N_CONTAINER_NAME}"

echo
echo "[DONE] Installed ${PKG_NAME}@${PKG_VERSION} into ${N8N_CONTAINER_NAME}"
