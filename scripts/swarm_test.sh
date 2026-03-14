#!/bin/bash
# Swarm testing script for ISC
# Spins up multiple virtual peers (Node instances) to test network stability and DHT operations.

NUM_PEERS=${1:-10}
echo "Starting ISC Swarm Test with $NUM_PEERS virtual peers..."

# Ensure packages are built
npx turbo run build

PIDS=()
BASE_PORT=9000

# Start peers
for i in $(seq 1 $NUM_PEERS); do
  PORT=$((BASE_PORT + i))
  # Using node directly to avoid npm overhead for each peer
  PORT=$PORT node ./apps/node/dist/index.js > /tmp/isc_node_$i.log 2>&1 &
  PID=$!
  PIDS+=($PID)
  echo "Started peer $i on port $PORT (PID $PID)"

  # Stagger startup slightly to avoid immediate port collision or DHT thundering herd
  sleep 0.5
done

echo "All $NUM_PEERS peers started. Waiting 30 seconds for network to stabilize..."
sleep 30

echo "Checking logs for successful peer connections..."
for i in $(seq 1 $NUM_PEERS); do
  CONNECTIONS=$(grep -c "Peer connected:" /tmp/isc_node_$i.log || echo "0")
  echo "Peer $i has established $CONNECTIONS connections."
done

echo "Swarm test complete. Shutting down peers..."
for PID in "${PIDS[@]}"; do
  kill $PID 2>/dev/null || true
done

echo "Cleanup finished."
