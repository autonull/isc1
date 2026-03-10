#!/usr/bin/env node
import { Command } from 'commander';
import { cosineSimilarity, lshHash } from '@isc/core';

const program = new Command();

program
  .name('isc')
  .description('ISC Monorepo CLI for embedding, matching, and testing')
  .version('0.1.0');

program
  .command('embed')
  .description('Embed text into a vector space (mock)')
  .argument('<text>', 'Text to embed')
  .action(async (text: string) => {
    console.log(`Embedding: "${text}"`);
    // Mock embedding for now since we haven't implemented the real transformers.js adapter
    const vec = new Array(384).fill(0).map((_, i) => Math.sin(text.length * i));
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    const normalized = vec.map(v => v / (norm || 1));
    console.log(`Vector length: ${normalized.length}, Norm: 1.0`);
    console.log(`[${normalized.slice(0, 5).map(n => n.toFixed(4)).join(', ')} ... ]`);
  });

program
  .command('match')
  .description('Compute cosine similarity between two texts (mock embedding)')
  .argument('<text1>', 'First text')
  .argument('<text2>', 'Second text')
  .action(async (text1: string, text2: string) => {
    // Mock embedding logic inline for CLI testing
    const embed = (text: string) => {
      const vec = new Array(384).fill(0).map((_, i) => Math.sin(text.length * i));
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return vec.map(v => v / (norm || 1));
    };

    const vec1 = embed(text1);
    const vec2 = embed(text2);

    const sim = cosineSimilarity(vec1, vec2);
    console.log(`Text 1: "${text1}"`);
    console.log(`Text 2: "${text2}"`);
    console.log(`Cosine Similarity: ${sim.toFixed(4)}`);
  });

program
  .command('lsh')
  .description('Generate LSH hashes for text (mock embedding)')
  .argument('<text>', 'Text to hash')
  .action(async (text: string) => {
    const embed = (text: string) => {
      const vec = new Array(384).fill(0).map((_, i) => Math.sin(text.length * i));
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return vec.map(v => v / (norm || 1));
    };

    const vec = embed(text);
    const hashes = lshHash(vec, 'test_seed_123', 5);
    console.log(`Text: "${text}"`);
    console.log('LSH Hashes:', hashes);
  });

program.parse();
