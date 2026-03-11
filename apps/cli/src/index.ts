#!/usr/bin/env node
import { Command } from 'commander';
import { cosineSimilarity, lshHash } from '@isc/core';
import { nodeModel } from '@isc/adapters';

const program = new Command();

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

program
  .name('isc')
  .description('ISC Monorepo CLI for embedding, matching, and testing')
  .version('0.1.0');

program
  .command('embed')
  .description('Embed text into a vector space')
  .argument('<text>', 'Text to embed')
  .action(async (text: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);
    console.log(`Embedding: "${text}"`);

    const normalized = await nodeModel.embed(text);
    const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));

    console.log(`Vector length: ${normalized.length}, Norm: ${norm.toFixed(4)}`);
    console.log(`[${normalized.slice(0, 5).map(n => n.toFixed(4)).join(', ')} ... ]`);
  });

program
  .command('match')
  .description('Compute cosine similarity between two texts')
  .argument('<text1>', 'First text')
  .argument('<text2>', 'Second text')
  .action(async (text1: string, text2: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    const vec1 = await nodeModel.embed(text1);
    const vec2 = await nodeModel.embed(text2);

    const sim = cosineSimilarity(vec1, vec2);
    console.log(`Text 1: "${text1}"`);
    console.log(`Text 2: "${text2}"`);
    console.log(`Cosine Similarity: ${sim.toFixed(4)}`);
  });

program
  .command('lsh')
  .description('Generate LSH hashes for text')
  .argument('<text>', 'Text to hash')
  .action(async (text: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    const vec = await nodeModel.embed(text);
    const hashes = lshHash(vec, 'test_seed_123', 5);
    console.log(`Text: "${text}"`);
    console.log('LSH Hashes:', hashes);
  });

program.parse();
