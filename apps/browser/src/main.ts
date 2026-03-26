import { browserTierDetector, browserModel } from '@isc/adapters';
import { generateKeypair, Keypair, computeRelationalDistributions, relationalMatch, Channel } from '@isc/core';
import { initNode } from './network';

// Global ISC state
const appState: {
  tier: string;
  keypair: Keypair | null;
  modelReady: boolean;
  p2pNode: any;
} = {
  tier: 'unknown',
  keypair: null,
  modelReady: false,
  p2pNode: null,
};

async function initISC() {
  try {
    console.log('Initializing ISC Protocol...');

    // 1. Detect Tier
    appState.tier = await browserTierDetector.detect();
    console.log(`Detected Device Tier: ${appState.tier}`);

    // 2. Generate Identity (Keypair)
    // Normally we'd check IndexedDB first to load existing keys.
    appState.keypair = await generateKeypair();
    console.log('Generated local identity (ed25519 keypair)');

    // 3. Load Embedding Model
    // High/Mid tiers load the main model, minimal tier uses word-hash
    if (appState.tier !== 'minimal') {
      const modelId = appState.tier === 'low' ? 'Xenova/gte-tiny' : 'Xenova/all-MiniLM-L6-v2';
      console.log(`Loading embedding model: ${modelId}...`);
      await browserModel.load(modelId);
      appState.modelReady = true;
      console.log('Model loaded successfully.');
    } else {
      console.log('Minimal tier detected. Skipping model load (word-hash fallback).');
      appState.modelReady = true;
    }

    // 4. Start P2P Networking
    console.log('Starting libp2p node...');
    appState.p2pNode = await initNode(appState.keypair);

    // Enable test match button
    const testBtn = document.getElementById('btn-test-match') as HTMLButtonElement;
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.textContent = 'Compute Match';
    }

  } catch (err) {
    console.error('ISC Initialization failed:', err);
  }
}

async function computeTestMatch() {
  if (!appState.modelReady) return;

  const inputA = (document.getElementById('test-input-a') as HTMLTextAreaElement).value;
  const inputB = (document.getElementById('test-input-b') as HTMLTextAreaElement).value;
  const resultSpan = document.getElementById('test-match-result');

  if (!resultSpan) return;
  resultSpan.textContent = 'Computing...';

  try {
    const embedFn = async (text: string) => await browserModel.embed(text);

    const channelA: Channel = {
      id: 'test-a',
      name: 'Test A',
      description: inputA,
      spread: 0.1,
    };

    const channelB: Channel = {
      id: 'test-b',
      name: 'Test B',
      description: inputB,
      spread: 0.1,
    };

    // Use our actual WASM-based Xenova model to embed the texts
    const distA = await computeRelationalDistributions(channelA, embedFn);
    const distB = await computeRelationalDistributions(channelB, embedFn);

    const score = relationalMatch(distA, distB, appState.tier as any, 'monte_carlo');
    resultSpan.textContent = score.toFixed(4);
  } catch (err) {
    console.error('Match failed', err);
    resultSpan.textContent = 'Error (see console)';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the ISC core modules
  initISC();

  // Test match UI logic
  const testBtn = document.getElementById('btn-test-match');
  if (testBtn) {
    testBtn.addEventListener('click', computeTestMatch);
  }

  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class to clicked
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
      }
    });
  });
});
