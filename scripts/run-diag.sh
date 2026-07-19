#!/bin/bash
export PATH=/usr/bin:/bin:/usr/local/bin
export NODE_OPTIONS="--max-old-space-size=8192"
docker start midnight-proof-server 2>/dev/null || true
cd /mnt/c/Users/usuario/sereno/cli
node dist/diag-wallet.js
