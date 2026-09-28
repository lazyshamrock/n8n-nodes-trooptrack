#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# nas-install.sh — runs ON THE NAS (ogma) as root, via Tim's sudo.
# push-n8n.sh copies this file next to the tgz in stacks/n8n/packages/
# and prints the exact command; you should not need to type it by hand:
#
#   ssh -t ogma 'sudo bash /volume1/docker/stacks/n8n/packages/nas-install.sh n8n-nodes-trooptrack-X.Y.Z.tgz'
#
# The NAS runs the stock n8nio/n8n image (no custom image). The node lives in
# the bind-mounted data dir, in two places:
#   /home/node/.n8n/custom  (N8N_CUSTOM_EXTENSIONS — gives the CUSTOM.troopTrack type)
#   /home/node/.n8n/nodes   (community-packages dir)
# stacks/n8n/packages/ is mounted read-only at /opt/n8n-packages, so a release
# = npm install /opt/n8n-packages/<tgz> into both dirs as the node user, then
# `docker restart n8n`. No recreate. Installing from the mount (not /tmp) keeps
# the file: dependency in both package.json files valid across a recreate.
#
# Rollback = run this again with the previous tgz (push-n8n.sh keeps 3).
# Output is also written to /tmp/nas-install-trooptrack.out (0600, owned by
# the sudo user) so it can be read over plain ssh.
# ------------------------------------------------------------

TGZ="${1:-}"
STACK_DIR="${STACK_DIR:-/volume1/docker/stacks/n8n}"
DOCKER="${DOCKER:-/usr/local/bin/docker}"
CONTAINER="${CONTAINER:-n8n}"
PKG_NAME="n8n-nodes-trooptrack"
# Where the compose file mounts stacks/n8n/packages/ (read-only).
MOUNT_DIR="/opt/n8n-packages"
OUT="${OUT:-/tmp/nas-install-trooptrack.out}"

: > "${OUT}"
chmod 600 "${OUT}"
[[ -n "${SUDO_USER:-}" ]] && chown "${SUDO_USER}" "${OUT}"
exec > >(tee -a "${OUT}") 2>&1

die() { echo "[ERROR] $*"; exit 1; }

[[ "${TGZ}" =~ ^${PKG_NAME}-[0-9]+\.[0-9]+\.[0-9]+\.tgz$ ]] \
  || die "usage: nas-install.sh ${PKG_NAME}-X.Y.Z.tgz (got '${TGZ}')"
SRC="${STACK_DIR}/packages/${TGZ}"
[[ -f "${SRC}" ]] || die "not found: ${SRC}"
[[ "$(id -u)" == 0 ]] || die "run with sudo (docker needs root on the NAS)"

VERSION="${TGZ#${PKG_NAME}-}"; VERSION="${VERSION%.tgz}"
echo "[INFO] $(date '+%F %T') installing ${PKG_NAME}@${VERSION} into container ${CONTAINER}"
echo "[INFO] sha256 $(sha256sum "${SRC}" | cut -d' ' -f1)"

"${DOCKER}" inspect -f '{{.State.Running}}' "${CONTAINER}" | grep -qx true \
  || die "container ${CONTAINER} is not running"

echo
echo "[STEP] Check ${CONTAINER} can read ${MOUNT_DIR}/${TGZ}"
"${DOCKER}" exec "${CONTAINER}" test -r "${MOUNT_DIR}/${TGZ}" \
  || die "${CONTAINER} cannot read ${MOUNT_DIR}/${TGZ}. Is ./packages:${MOUNT_DIR}:ro in the compose file, and was n8n recreated since (docker compose up -d n8n)?"
"${DOCKER}" exec "${CONTAINER}" ls -la "${MOUNT_DIR}/${TGZ}"

echo
echo "[STEP] npm install into custom/ and nodes/"
for DIR in /home/node/.n8n/custom /home/node/.n8n/nodes; do
  echo "--- ${DIR}"
  "${DOCKER}" exec "${CONTAINER}" sh -c "
    set -e
    [ -f '${DIR}/package.json' ] || { echo 'missing ${DIR}/package.json'; exit 1; }
    cd '${DIR}'
    rm -rf 'node_modules/${PKG_NAME}'
    npm install --no-fund --no-audit '${MOUNT_DIR}/${TGZ}'
  "
  GOT="$("${DOCKER}" exec "${CONTAINER}" node -p "require('${DIR}/node_modules/${PKG_NAME}/package.json').version")"
  [[ "${GOT}" == "${VERSION}" ]] || die "${DIR} has ${GOT}, expected ${VERSION}"
  echo "[OK] ${DIR}: ${GOT}"
done

echo
echo "[STEP] docker restart ${CONTAINER}"
SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"${DOCKER}" restart "${CONTAINER}"

# /healthz answers before the web routes are registered; /rest/settings = 200
# is the real "editor is up" signal (nas-migrate-n8n B3).
echo "[STEP] Wait for /rest/settings = 200 (up to 5 min)"
READY=false
for _ in $(seq 1 60); do
  if "${DOCKER}" exec "${CONTAINER}" wget -q -O /dev/null http://localhost:5678/rest/settings 2>/dev/null; then
    READY=true; break
  fi
  sleep 5
done
${READY} || die "n8n did not serve /rest/settings within 5 min — check: docker logs --since ${SINCE} ${CONTAINER}"
echo "[OK] n8n is serving"

echo
echo "[STEP] TroopTrack lines in the log since restart (expect none that say error)"
"${DOCKER}" logs --since "${SINCE}" "${CONTAINER}" 2>&1 | grep -i trooptrack || echo "(none)"

echo
echo "[DONE] ${PKG_NAME}@${VERSION} installed; n8n restarted and serving"
