#!/bin/bash
export PATH=/usr/bin:/bin
set -x
echo "=== INDEXER V3 ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 15 \
  -X POST "https://indexer.preprod.midnight.network/api/v3/graphql" \
  -H "Content-Type: application/json" \
  --data-binary '{"query":"{ __typename }"}' || echo FAIL_V3

echo "=== INDEXER V4 ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 15 \
  -X POST "https://indexer.preprod.midnight.network/api/v4/graphql" \
  -H "Content-Type: application/json" \
  --data-binary '{"query":"{ __typename }"}' || echo FAIL_V4

echo "=== RPC ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 15 \
  -X POST "https://rpc.preprod.midnight.network" \
  -H "Content-Type: application/json" \
  --data-binary '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}' || echo FAIL_RPC

echo "=== PROOF SERVER ==="
docker start midnight-proof-server 2>/dev/null || true
docker ps --filter name=midnight-proof-server
curl -sS -w "\nHTTP:%{http_code}\n" --max-time 3 "http://127.0.0.1:6300/" || true
