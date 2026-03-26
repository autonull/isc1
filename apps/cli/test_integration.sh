#!/bin/bash
set -e

echo "Building packages..."
npm install > /dev/null 2>&1
npx turbo run build > /dev/null 2>&1

echo "Starting Supernodes..."
# Start 3 Supernodes with different ports and keys to form a swarm
# Node 1 (Bootstrap)
PORT=9090 PEER_KEY_B64=CAESQBlT5Glzyad7fxjvTdhHOIiQsPOCE1EOnC6NCNMpnJ5kjmT/4mFrwuCjOYSr6+A7C9/4GLWV671llATT7cwB/Js= npm run start --workspace=@isc/node > node1_output.log 2>&1 &
NODE1_PID=$!
sleep 2

# Node 2
# For simplicity in integration testing, since dynamic valid base64 protobuf keys are hard to mock reliably,
# we can just use the same base key parsing logic but allow it to gracefully use dynamically generated ephemeral keys
# if the environment var isn't set.
PORT=9091 npm run start --workspace=@isc/node > node2_output.log 2>&1 &
NODE2_PID=$!
sleep 2

# Node 3
PORT=9092 npm run start --workspace=@isc/node > node3_output.log 2>&1 &
NODE3_PID=$!

echo "Waiting for Supernodes to initialize and connect (10s)..."
sleep 10

echo "Node 1: Creating a channel..."
node apps/cli/dist/index.js channel create "Test Channel" "Integration testing channel" > /dev/null

echo "Node 2: Simulating CLI Announcements (PROTOCOL_ANNOUNCE)..."
node apps/cli/dist/index.js announce "channel123" "I am thinking about distributed systems" > /dev/null 2>&1 || true

echo "Node 3: Simulating CLI Announcements (PROTOCOL_POST)..."
node apps/cli/dist/index.js post announce "Hello world from the CLI!" "channel123" > /dev/null 2>&1 || true

echo "Node 4: Simulating CLI query (match)..."
node apps/cli/dist/index.js match "I am thinking about distributed systems" "Distributed networks are interesting" > /dev/null 2>&1 || true

echo "Stopping Supernodes..."
kill $NODE1_PID || true
kill $NODE2_PID || true
kill $NODE3_PID || true

echo "Checking node 1 logs for events..."
cat node1_output.log

echo "Checking node 2 logs for events..."
cat node2_output.log

echo "Checking node 3 logs for events..."
cat node3_output.log
