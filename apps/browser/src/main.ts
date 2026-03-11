import { browserTierDetector, browserModel, browserStorage } from '@isc/adapters';
import { generateKeypair, Keypair, computeRelationalDistributions, relationalMatch, Channel, Distribution, lshHash } from '@isc/core';
import { initNode } from './network';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

export interface SavedChannel extends Channel {
  distributions?: Distribution[];
}

// Global ISC state
export const appState: {
  tier: string;
  keypair: Keypair | null;
  modelReady: boolean;
  p2pNode: any;
  channels: SavedChannel[];
  activeChannelId: string | null;
  discoveredPeers: { [peerId: string]: string[] };
} = {
  tier: 'unknown',
  keypair: null,
  modelReady: false,
  p2pNode: null,
  channels: [],
  activeChannelId: null,
  discoveredPeers: {},
};

async function loadSavedData() {
  try {
    const savedChannels = await browserStorage.get<SavedChannel[]>('isc:channels');
    if (savedChannels && Array.isArray(savedChannels)) {
      appState.channels = savedChannels;
    }
  } catch (err) {
    console.error('Failed to load saved data:', err);
  }
}

export async function saveChannels() {
  try {
    await browserStorage.set('isc:channels', appState.channels);
  } catch (err) {
    console.error('Failed to save channels:', err);
  }
}

async function initISC() {
  await loadSavedData();
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
    appState.p2pNode = await initNode(
      appState.keypair,
      (chatMsg) => {
        console.log('Received chat:', chatMsg);
        // Display in UI safely without innerHTML XSS risk
        const chatList = document.getElementById('chat-list');
        if (chatList) {
          if (chatList.innerHTML.includes('No active chats')) chatList.innerHTML = '';

          const chatItem = document.createElement('div');
          chatItem.className = 'chat-item';

          const header = document.createElement('div');
          header.className = 'chat-item-header';

          const strong = document.createElement('strong');
          strong.textContent = 'Peer';
          header.appendChild(strong);

          const time = document.createElement('span');
          time.className = 'time';
          time.textContent = 'Just now';
          header.appendChild(time);

          const p = document.createElement('p');
          p.textContent = `"${chatMsg.text}"`;

          chatItem.appendChild(header);
          chatItem.appendChild(p);

          chatList.appendChild(chatItem);
        }
      },
      (announcement) => {
        console.log('Received announcement:', announcement);
      }
    );

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

export function renderChannels() {
  // Update Profile ID
  const peerIdEl = document.getElementById('profile-peer-id');
  if (peerIdEl) {
    peerIdEl.textContent = appState.p2pNode?.peerId?.toString() || 'Initializing...';
  }

  // Update Settings Tab channel list
  const countEl = document.getElementById('settings-channel-count');
  const listEl = document.getElementById('settings-channel-list');

  if (countEl) countEl.textContent = appState.channels.length.toString();

  if (listEl) {
    listEl.innerHTML = '';
    appState.channels.forEach(ch => {
      const div = document.createElement('div');
      div.className = 'channel-item';

      const strong = document.createElement('strong');
      strong.textContent = `${ch.id === appState.activeChannelId ? '● ' : ''}${ch.name}`;

      const span = document.createElement('span');
      span.textContent = '- nearby';

      const btn = document.createElement('button');
      btn.dataset.id = ch.id;
      btn.textContent = 'Select';
      btn.addEventListener('click', () => {
        appState.activeChannelId = ch.id;
        renderChannels();
      });

      div.appendChild(strong);
      div.appendChild(span);
      div.appendChild(btn);
      listEl.appendChild(div);
    });
  }

  // Also start discovery when switching channels if node is ready
  const activeChannel = appState.channels.find(c => c.id === appState.activeChannelId);

  // Update Now tab
  const nowHeader = document.getElementById('now-channel-header');
  const matchList = document.getElementById('now-match-list');
  const discoveredPeerIds = Object.keys(appState.discoveredPeers);

  if (nowHeader) {
    if (activeChannel) {
      nowHeader.innerHTML = '';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'channel-title';
      const h1 = document.createElement('h1');
      const dot = document.createElement('span');
      dot.className = 'status-dot active';
      dot.textContent = '●';
      h1.appendChild(dot);
      h1.appendChild(document.createTextNode(' ' + activeChannel.name));
      titleDiv.appendChild(h1);

      const desc = document.createElement('p');
      desc.className = 'description';
      desc.textContent = `"${activeChannel.description}"`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      const nearby = document.createElement('span');
      nearby.textContent = `◉ ${discoveredPeerIds.length} nearby`;
      const spread = document.createElement('span');
      spread.textContent = `Spread: ${activeChannel.spread}`;
      meta.appendChild(nearby);
      meta.appendChild(spread);

      nowHeader.appendChild(titleDiv);
      nowHeader.appendChild(desc);
      nowHeader.appendChild(meta);

      if (matchList) {
        if (discoveredPeerIds.length > 0) {
          matchList.innerHTML = '<h3>Close Matches</h3>';
          discoveredPeerIds.forEach(peerId => {
            const hashesMatched = appState.discoveredPeers[peerId].length;
            const signalBarsText = hashesMatched >= 4 ? '▐▌▐▌▐' : hashesMatched >= 2 ? '▐▌▐' : '▐▌';

            const card = document.createElement('div');
            card.className = 'match-card';

            const header = document.createElement('div');
            header.className = 'match-header';
            const signalBars = document.createElement('span');
            signalBars.className = 'signal-bars';
            signalBars.title = `Matches ${hashesMatched} LSH hashes`;
            signalBars.textContent = signalBarsText;
            const strong = document.createElement('strong');
            strong.textContent = `Peer: ${peerId.substring(peerId.length - 8)}`;
            header.appendChild(signalBars);
            header.appendChild(strong);

            const p = document.createElement('p');
            p.textContent = '"Discovered via LSH proximity on DHT"';

            const metaDiv = document.createElement('div');
            metaDiv.className = 'match-meta';
            const span1 = document.createElement('span');
            span1.textContent = '📍 Real Peer';
            const span2 = document.createElement('span');
            span2.textContent = `🔗 Hash Matches: ${hashesMatched}`;
            metaDiv.appendChild(span1);
            metaDiv.appendChild(span2);

            const btn = document.createElement('button');
            btn.className = 'btn-chat';
            btn.textContent = 'Tap to chat';
            btn.addEventListener('click', () => alert('Chat interface placeholder'));

            card.appendChild(header);
            card.appendChild(p);
            card.appendChild(metaDiv);
            card.appendChild(btn);

            matchList.appendChild(card);
          });
        } else {
          matchList.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Looking for peers... (DHT queries may take a few moments)</p>';
        }
      }
    } else {
      nowHeader.innerHTML = '<p>Select or create a channel to start matching.</p>';
      if (matchList) matchList.innerHTML = '';
    }
  }
}

export async function createChannel(name: string, description: string, spread: number) {
  if (!appState.modelReady) throw new Error('Model not ready');

  const channel: SavedChannel = {
    id: Math.random().toString(36).substring(2, 10),
    name,
    description,
    spread,
  };

  const embedFn = async (text: string) => await browserModel.embed(text);
  channel.distributions = await computeRelationalDistributions(channel, embedFn);

  appState.channels.push(channel);
  appState.activeChannelId = channel.id;
  await saveChannels();

  await announceAndDiscover(channel);
  return channel;
}

export async function announceAndDiscover(channel: SavedChannel) {
  if (!appState.p2pNode || !channel.distributions || channel.distributions.length === 0) return;

  const rootDist = channel.distributions.find((d: any) => d.type === 'root');
  if (!rootDist) return;

  // 1. Generate LSH hashes for the root distribution
  const seed = 'isc_global_seed_v1';
  const hashes = lshHash(rootDist.mu, seed, 5); // 5 hashes for robustness

  // 2. Announce our presence for each hash
  for (const hash of hashes) {
    try {
      const keyStr = `/isc/match/${hash}`;
      const encoder = new TextEncoder();
      const keyBytes = encoder.encode(keyStr);

      // Hash the key bytes using sha256 to create a proper multihash
      const multiHash = await sha256.digest(keyBytes);

      // Create a raw CID (codec 0x55, raw)
      const cid = CID.createV1(0x55, multiHash);

      // Provide content to DHT using CID
      await appState.p2pNode.contentRouting.provide(cid);
      console.log(`Announced on DHT: ${keyStr} (CID: ${cid.toString()})`);

      // 3. Find other providers for the same CID
      const providers = appState.p2pNode.contentRouting.findProviders(cid, { timeout: 10000 });
      for await (const provider of providers) {
        const peerIdStr = provider.id.toString();

        // Skip self
        if (peerIdStr === appState.p2pNode.peerId.toString()) continue;

        console.log(`Discovered peer via DHT: ${peerIdStr} for hash: ${keyStr}`);

        if (!appState.discoveredPeers[peerIdStr]) {
          appState.discoveredPeers[peerIdStr] = [];
        }
        if (!appState.discoveredPeers[peerIdStr].includes(hash)) {
          appState.discoveredPeers[peerIdStr].push(hash);
        }

        renderChannels(); // Refresh UI to show newly discovered peer
      }
    } catch (err) {
      console.error(`DHT operation failed for hash ${hash}:`, err);
    }
  }
}

function setupCompose() {
  const btnPublish = document.getElementById('btn-publish-channel');
  const inputName = document.getElementById('compose-name') as HTMLInputElement;
  const inputDesc = document.getElementById('compose-description') as HTMLTextAreaElement;
  const inputSpread = document.getElementById('compose-spread') as HTMLInputElement;
  const statusEl = document.getElementById('compose-status');

  if (btnPublish && inputName && inputDesc && inputSpread && statusEl) {
    btnPublish.addEventListener('click', async () => {
      const name = inputName.value.trim();
      const desc = inputDesc.value.trim();
      const spread = parseInt(inputSpread.value, 10) / 100;

      if (!name || !desc) {
        statusEl.textContent = 'Please provide a name and description.';
        return;
      }

      btnPublish.textContent = 'Publishing...';
      (btnPublish as HTMLButtonElement).disabled = true;

      try {
        await createChannel(name, desc, spread);
        statusEl.textContent = 'Channel published!';

        // Reset form
        inputName.value = '';
        inputDesc.value = '';
        inputSpread.value = '30';

        renderChannels();

        // Switch back to "Now" tab
        const navBtnNow = document.querySelector('.nav-btn[data-tab="now"]') as HTMLButtonElement;
        if (navBtnNow) navBtnNow.click();
      } catch (err) {
        statusEl.textContent = 'Failed to create channel.';
        console.error(err);
      } finally {
        btnPublish.textContent = 'Publish Channel';
        (btnPublish as HTMLButtonElement).disabled = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the ISC core modules
  initISC().then(() => {
    renderChannels();
  });

  setupCompose();

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
