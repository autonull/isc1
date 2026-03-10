import { cosineSimilarity } from '@isc/core';

// Basic Node.js entry point representing the future supernode/server
console.log('ISC Node Supernode Starting...');
console.log('Initializing core protocols...');

// Simple test to ensure we can import and run core logic
const testSim = cosineSimilarity([1, 0], [0, 1]);
console.log(`Self-test: orthogonal vectors similarity is ${testSim}`);

console.log('Setup complete. Ready for phase 2 node functionality.');
