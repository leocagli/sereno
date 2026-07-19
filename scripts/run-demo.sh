#!/bin/bash
set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/root/.local/bin
export NODE_OPTIONS="--max-old-space-size=12288"

# Ensure proof server
docker start midnight-proof-server 2>/dev/null || \
  docker run -d -p 6300:6300 --name midnight-proof-server \
    midnightntwrk/proof-server:latest midnight-proof-server -v
sleep 1

SEED="${1:-b34732e9f507a0f2cae43b716bc846519f62110a4f9c9f826cc71446e91a5017}"
AMOUNT="${2:-100}"

cd /mnt/c/Users/usuario/sereno/cli

# Prefer WSL node_modules if present, else Windows install
if [ ! -d node_modules ]; then
  npm install
fi

echo "Running Sereno demo seed=${SEED:0:8}… amount=$AMOUNT"
node dist/demo.js "$SEED" "$AMOUNT"
