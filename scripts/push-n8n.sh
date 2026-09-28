#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# push-n8n.sh — release the node to production n8n on the NAS (ogma).
#
# Since 2026-09-28 production n8n runs on the NAS (LughOS PRD nas-migrate-n8n).
# The Mac container n8n-docker-n8n-1 is a stopped rollback copy: this script
# no longer touches it or Docker on the Mac at all.
#
# What it does (on the Mac, no sudo):
#   1. checks the NAS share is mounted (before bumping anything)
#   2. bumps the patch version, builds, packs into ./builds (keeps last 3)
#   3. copies the tgz + scripts/nas-install.sh into stacks/n8n/packages/
#      over SMB, byte-verifies it, prunes packages/ to the last 3 tgz
#   4. PRINTS the one sudo command Tim runs from his own terminal. That
#      command installs into the container and restarts n8n (~1–2 min down).
#
# It never restarts n8n itself: docker on the NAS needs Tim's sudo.
#
# Run from anywhere:
#   ./scripts/push-n8n.sh
# ------------------------------------------------------------

if [[ -n "${N8N_CONTAINER_NAME:-}${CONTAINER_TGZ_DIR:-}${CONTAINER_CUSTOM_DIR:-}${CONTAINER_COMMUNITY_DIR:-}" ]]; then
  echo "[ERROR] N8N_CONTAINER_NAME / CONTAINER_* are set, but the Mac-container path was removed on 2026-09-28."
  echo "        Production n8n is on the NAS. Unset them and rerun; the script prints the NAS sudo command."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

BUILDS_DIR="${BUILDS_DIR:-${REPO_ROOT}/builds}"
BUILDS_KEEP_COUNT="${BUILDS_KEEP_COUNT:-3}"
# SMB mount of the NAS's /volume1/docker (the docker-platform working copy).
PACKAGES_DIR="${PACKAGES_DIR:-/Volumes/docker/stacks/n8n/packages}"
NAS_PACKAGES_DIR="/volume1/docker/stacks/n8n/packages"

keep_newest_tgz() {
  local dir="$1" keep="$2" f
  # Newest N by mtime survive. Works on macOS and Linux.
  ls -1t "${dir}"/*.tgz 2>/dev/null | tail -n +"$((keep + 1))" | while IFS= read -r f; do
    [[ -n "${f}" ]] && rm -f "${f}"
  done
}

echo "[STEP] Preflight: NAS packages dir"
if [[ ! -d "${PACKAGES_DIR}" || ! -w "${PACKAGES_DIR}" ]]; then
  echo "[ERROR] ${PACKAGES_DIR} is not mounted or not writable."
  echo "        Mount the NAS 'docker' share (smb://ogma/docker) and rerun. Nothing was bumped."
  exit 1
fi

echo "[STEP] Auto-bump patch version"
# A failed build/pack/copy must not leave package.json bumped for a release
# that never shipped: restore both files on any non-zero exit.
VERSION_BACKUP="$(mktemp -d)"
cp package.json package-lock.json "${VERSION_BACKUP}/"
restore_version_on_failure() {
  local rc=$?
  if [[ ${rc} -ne 0 ]]; then
    cp "${VERSION_BACKUP}/package.json" "${VERSION_BACKUP}/package-lock.json" "${REPO_ROOT}/"
    echo "[ERROR] Release failed (exit ${rc}); package.json version restored."
  fi
  rm -rf "${VERSION_BACKUP}"
}
trap restore_version_on_failure EXIT
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
mkdir -p "${BUILDS_DIR}"
TARBALL="$(npm pack --silent --pack-destination "${BUILDS_DIR}" | tail -n 1 | tr -d '\r\n')"
LOCAL_TGZ="${BUILDS_DIR}/${TARBALL}"
if [[ -z "${TARBALL}" || ! -f "${LOCAL_TGZ}" ]]; then
  echo "[ERROR] npm pack did not produce a tarball (got '${TARBALL}')."
  exit 1
fi
echo "[INFO] Local tgz: ${LOCAL_TGZ}"
keep_newest_tgz "${BUILDS_DIR}" "${BUILDS_KEEP_COUNT}"

echo
echo "[STEP] Copy to NAS: ${PACKAGES_DIR}"
cp "${LOCAL_TGZ}" "${PACKAGES_DIR}/${TARBALL}"
cp "${SCRIPT_DIR}/nas-install.sh" "${PACKAGES_DIR}/nas-install.sh"
if ! cmp -s "${LOCAL_TGZ}" "${PACKAGES_DIR}/${TARBALL}" \
  || ! cmp -s "${SCRIPT_DIR}/nas-install.sh" "${PACKAGES_DIR}/nas-install.sh"; then
  echo "[ERROR] SMB copy does not match the local file. Rerun the copy; do not install."
  exit 1
fi
echo "[INFO] Byte-verified. sha256 $(shasum -a 256 "${LOCAL_TGZ}" | cut -d' ' -f1)"
# Keeps the previous releases for rollback; the backup's `config` artifact archives this dir.
keep_newest_tgz "${PACKAGES_DIR}" "${BUILDS_KEEP_COUNT}"
echo "[INFO] packages/ now holds:"
ls -1t "${PACKAGES_DIR}"/*.tgz | sed 's|.*/|    |'

echo
echo "[DONE] ${PKG_NAME}@${PKG_VERSION} is staged on the NAS but NOT installed yet."
echo
echo "Tim: run this from your own terminal (sudo prompt; restarts production n8n, ~1–2 min down):"
echo
echo "    ssh -t ogma 'sudo bash ${NAS_PACKAGES_DIR}/nas-install.sh ${TARBALL}'"
echo
echo "It waits for n8n to serve again and writes its output to /tmp/nas-install-trooptrack.out on ogma."
echo "Rollback: the same command with an older tgz from the list above."
