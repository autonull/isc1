import { cosineSimilarity } from '@isc/core';
import { nodeModel } from '@isc/adapters';

async function main() {
  // Basic Node.js entry point representing the future supernode/server
  console.log('ISC Node Supernode Starting...');
  console.log('Initializing core protocols...');

  // Simple test to ensure we can import and run core logic
  const testSim = cosineSimilarity([1, 0], [0, 1]);
  console.log(`Self-test: orthogonal vectors similarity is ${testSim}`);

  const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  console.log(`Loading embedding model (${MODEL_ID})...`);

  try {
    await nodeModel.load(MODEL_ID);
    console.log('Model loaded successfully.');

    const testText = 'Hello, world! This is the ISC supernode.';
    const embedding = await nodeModel.embed(testText);
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));

    console.log(`Self-test: embedded test string "${testText}"`);
    console.log(`Vector length: ${embedding.length}, Norm: ${norm.toFixed(4)}`);

    console.log('Setup complete. Ready for phase 2 node functionality.');
  } catch (error) {
    console.error('Failed to initialize Node supernode:', error);
    process.exit(1);
  }
}

main();
