#!/bin/bash
set -e

echo "Building packages..."
npm install > /dev/null 2>&1
npx turbo run build > /dev/null 2>&1

echo "Starting Supernode..."
npm run start --workspace=@isc/node > node_output.log 2>&1 &
NODE_PID=$!

echo "Waiting for Supernode to initialize (10s)..."
sleep 10

echo "Creating a channel..."
node apps/cli/dist/index.js channel create "Test Channel" "Integration testing channel" > /dev/null

echo "Simulating CLI Announcements..."
# Use POST instead of announce since the CLI uses PROTOCOL_POST for broadcasting posts currently.
node apps/cli/dist/index.js post announce "Hello world from the CLI!" "channel123" > /dev/null 2>&1 || true
node apps/cli/dist/index.js post announce "Another test message" "channel123" > /dev/null 2>&1 || true

echo "Stopping Supernode..."
kill $NODE_PID || true

echo "Checking node logs for events..."
cat node_output.log
