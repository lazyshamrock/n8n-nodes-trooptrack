#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# push-n8n.sh
# Builds + packs the node, then installs the packed tgz into the
# running n8n container and restarts it.
#
# This script lives in /scripts below the project root.
# It always runs commands from the repo root.
#
# Run Terminal in root directory
# Command to run: ./scripts/push-n8n.sh
# Permission issues?  Run 'chmod +x ./scripts/push-n8n.sh'
# ------------------------------------------------------------

# Move to repo root (one level up from /scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Container name (override by exporting N8N_CONTAINER_NAME)
N8N_CONTAINER_NAME="${N8N_CONTAINER_NAME:-n8n-docker-n8n-1}"

# Build output directory (local). Always under repo root.
BUILDS_DIR="${BUILDS_DIR:-${REPO_ROOT}/builds}"
mkdir -p "${BUILDS_DIR}"

# Where the tgz is accessible inside the container
# This assumes your project directory is mounted to /opt/n8n-nodes-trooptrack
# and that /builds exists under that mount.
CONTAINER_TGZ_DIR="${CONTAINER_TGZ_DIR:-/opt/n8n-nodes-trooptrack/builds}"

# Where your custom nodes live inside the container
# CONTAINER_CUSTOM_DIR="${CONTAINER_CUSTOM_DIR:-/home/node/.n8n/custom}"
CONTAINER_CUSTOM_DIR="${CONTAINER_CUSTOM_DIR:-/home/node/.n8n/nodes}"

# Read name/version from package.json using Node (no jq required)
PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"

# npm pack output filename is typically: <name>-<version>.tgz
# Remove any npm scope from the filename
SANITIZED_NAME="${PKG_NAME#@*/}"
SANITIZED_NAME="${SANITIZED_NAME//@/}"
TARBALL_EXPECTED="${SANITIZED_NAME}-${PKG_VERSION}.tgz"

echo "[INFO] Repo root: ${REPO_ROOT}"
echo "[INFO] Package: ${PKG_NAME}"
echo "[INFO] Version: ${PKG_VERSION}"
echo "[INFO] Expected tarball: ${TARBALL_EXPECTED}"
echo

echo "[STEP] npm run build"
npm run build

echo
echo "[STEP] npm pack"
# Capture the actual tarball name produced by npm pack
TARBALL_ACTUAL="$(npm pack --silent --pack-destination "${BUILDS_DIR}" | tail -n 1 | tr -d '\r\n')"

if [[ -z "${TARBALL_ACTUAL}" ]]; then
  echo "[ERROR] npm pack did not return a tarball filename."
  exit 1
fi

echo "[INFO] npm pack produced: ${TARBALL_ACTUAL}"

if [[ "${TARBALL_ACTUAL}" != "${TARBALL_EXPECTED}" ]]; then
  echo "[WARN] Tarball name differs from expected (${TARBALL_EXPECTED}). Using actual (${TARBALL_ACTUAL})."
fi

# Confirm the tarball exists locally (under /builds)
LOCAL_TGZ_PATH="${BUILDS_DIR}/${TARBALL_ACTUAL}"
if [[ ! -f "${LOCAL_TGZ_PATH}" ]]; then
  echo "[ERROR] Local tarball not found: ${LOCAL_TGZ_PATH}"
  exit 1
fi

# Build the path inside the container
CONTAINER_TGZ_PATH="${CONTAINER_TGZ_DIR}/${TARBALL_ACTUAL}"

echo "[INFO] Local tgz path: ${LOCAL_TGZ_PATH}"

echo
echo "[STEP] Install tarball in container: ${N8N_CONTAINER_NAME}"
echo "[INFO] Installing from: ${CONTAINER_TGZ_PATH}"

# docker exec -it "${N8N_CONTAINER_NAME}" sh -lc \
#  "cd '${CONTAINER_CUSTOM_DIR}' && npm install '${CONTAINER_TGZ_PATH}'"

docker exec -it "${N8N_CONTAINER_NAME}" sh -lc \
  "set -e; \
   cd /home/node/.n8n/nodes; \
   rm -rf node_modules/n8n-nodes-trooptrack; \
   npm install --no-fund --no-audit '${CONTAINER_TGZ_PATH}'; \
   node -p \"require.resolve('n8n-nodes-trooptrack/package.json')\""

echo
echo "[STEP] Restart container: ${N8N_CONTAINER_NAME}"
docker restart "${N8N_CONTAINER_NAME}"

echo
echo "[DONE] Installed ${PKG_NAME}@${PKG_VERSION} into ${N8N_CONTAINER_NAME}"
