import { browserTierDetector, browserModel, browserStorage } from '@isc/adapters';
import { generateKeypair, Keypair, computeRelationalDistributions, relationalMatch, Channel, Distribution, lshHash } from '@isc/core';
import { initNode } from './network';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

import { PROTOCOL_DELEGATE, requestDelegation } from '@isc/protocol';

export interface SavedChannel extends Channel {
  distributions?: Distribution[];
}

interface ChatMessageLog {
  sender: 'self' | 'peer';
  text: string;
  timestamp: number;
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
  activeChats: { [peerId: string]: ChatMessageLog[] };
  currentChatPeerId: string | null;
} = {
  tier: 'unknown',
  keypair: null,
  modelReady: false,
  p2pNode: null,
  channels: [],
  activeChannelId: null,
  discoveredPeers: {},
  activeChats: {},
  currentChatPeerId: null,
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

    // 3. Start P2P Networking
    console.log('Starting libp2p node...');
    appState.p2pNode = await initNode(
      appState.keypair,
      (chatMsg) => {
        console.log('Received chat:', chatMsg);

        // Find who sent it by looking at connections
        // In a real implementation we would have peerId from stream metadata
        // For now, we'll store under a dummy peer or if we can infer it.
        // As a fallback, use "UnknownPeer".
        const senderId = chatMsg.channelID || 'UnknownPeer';

        if (!appState.activeChats[senderId]) {
          appState.activeChats[senderId] = [];
        }

        appState.activeChats[senderId].push({
          sender: 'peer',
          text: chatMsg.msg,
          timestamp: Date.now()
        });

        renderChatList();

        if (appState.currentChatPeerId === senderId) {
          renderChatPanel();
        }
      },
      (announcement) => {
        console.log('Received announcement:', announcement);
      }
    );

    // 4. Load Embedding Model or rely on Supernode
    // High/Mid tiers load the main model, minimal tier uses word-hash
    if (appState.tier === 'high' || appState.tier === 'mid') {
      const modelId = 'Xenova/all-MiniLM-L6-v2';
      console.log(`Loading embedding model: ${modelId}...`);
      await browserModel.load(modelId);
      appState.modelReady = true;
      console.log('Model loaded successfully.');
    } else {
      console.log(`${appState.tier} tier detected. Will use supernode delegation for embeddings.`);
      appState.modelReady = true; // "ready" via network
    }

    // Initialize UI events for chat panel
    document.getElementById('btn-close-chat')?.addEventListener('click', closeChatPanel);
    document.getElementById('btn-send-chat')?.addEventListener('click', sendActiveChatMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendActiveChatMessage();
    });

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

function renderChatList() {
  const chatListEl = document.getElementById('chat-list');
  if (!chatListEl) return;

  const peerIds = Object.keys(appState.activeChats);

  if (peerIds.length === 0) {
    chatListEl.innerHTML = '<p>No active chats.</p>';
    return;
  }

  chatListEl.innerHTML = '';

  peerIds.forEach(peerId => {
    const messages = appState.activeChats[peerId];
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];

    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.style.cursor = 'pointer';
    chatItem.style.padding = '1rem';
    chatItem.style.borderBottom = '1px solid var(--border-subtle)';
    chatItem.style.marginBottom = '0.5rem';
    chatItem.style.background = 'var(--bg-secondary)';
    chatItem.style.borderRadius = '8px';

    chatItem.addEventListener('click', () => {
      appState.currentChatPeerId = peerId;
      openChatPanel();
    });

    const header = document.createElement('div');
    header.className = 'chat-item-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '0.5rem';

    const strong = document.createElement('strong');
    strong.textContent = `Peer: ${peerId.substring(peerId.length - 8)}`;
    header.appendChild(strong);

    const time = document.createElement('span');
    time.className = 'time';
    time.style.fontSize = '0.8rem';
    time.style.color = 'var(--text-secondary)';

    const date = new Date(lastMsg.timestamp);
    time.textContent = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    header.appendChild(time);

    const p = document.createElement('p');
    p.textContent = `"${lastMsg.text.substring(0, 40)}${lastMsg.text.length > 40 ? '...' : ''}"`;
    p.style.margin = '0';
    p.style.color = 'var(--text-secondary)';

    chatItem.appendChild(header);
    chatItem.appendChild(p);

    chatListEl.appendChild(chatItem);
  });
}

function openChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (panel) {
    panel.classList.add('open');
    renderChatPanel();
  }
}

function closeChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (panel) {
    panel.classList.remove('open');
    appState.currentChatPeerId = null;
  }
}

function renderChatPanel() {
  const peerId = appState.currentChatPeerId;
  if (!peerId) return;

  const titleEl = document.getElementById('chat-peer-id');
  if (titleEl) {
    titleEl.textContent = `Peer: ${peerId.substring(peerId.length - 8)}`;
  }

  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = '';

  const messages = appState.activeChats[peerId] || [];

  messages.forEach(msg => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${msg.sender}`;
    msgDiv.textContent = msg.text;
    messagesEl.appendChild(msgDiv);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendActiveChatMessage() {
  const inputEl = document.getElementById('chat-input') as HTMLInputElement;
  const peerId = appState.currentChatPeerId;

  if (!inputEl || !peerId) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Update local state
  if (!appState.activeChats[peerId]) {
    appState.activeChats[peerId] = [];
  }

  appState.activeChats[peerId].push({
    sender: 'self',
    text,
    timestamp: Date.now()
  });

  // Clear input and update UI
  inputEl.value = '';
  renderChatPanel();
  renderChatList();

  // Send via network (in a real app, this stream needs to be dialed or re-used)
  try {
    if (appState.p2pNode) {
      // For now we just log it since full libp2p dialing to browser peers requires
      // relay resolution which is out of scope for UI simulation unless we have a target
      console.log(`Sending message to ${peerId}: ${text}`);

      /* Real implementation would look like:
      const stream = await appState.p2pNode.dialProtocol(peerId, PROTOCOL_CHAT);
      await sendChatMessage(stream, { channelID: appState.activeChannelId!, msg: text });
      */
    }
  } catch (err) {
    console.error('Failed to send message:', err);
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
  const matchesVeryClose = document.getElementById('matches-very-close')?.querySelector('.matches-container');
  const matchesNearby = document.getElementById('matches-nearby')?.querySelector('.matches-container');
  const matchesOrbiting = document.getElementById('matches-orbiting')?.querySelector('.matches-container');
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

      if (matchList && matchesVeryClose && matchesNearby && matchesOrbiting) {
        matchesVeryClose.innerHTML = '';
        matchesNearby.innerHTML = '';
        matchesOrbiting.innerHTML = '';

        if (discoveredPeerIds.length > 0) {
          discoveredPeerIds.forEach(peerId => {
            const hashesMatched = appState.discoveredPeers[peerId].length;

            // Simulating similarity score based on hashes matched for UI purposes
            // In a real implementation we would fetch the actual vector and compute cosine similarity
            const simScore = hashesMatched >= 4 ? 0.91 : hashesMatched >= 2 ? 0.75 : 0.60;
            const signalBarsText = simScore >= 0.85 ? '▐▌▐▌▐' : simScore >= 0.70 ? '▐▌▐' : '▐▌';

            const card = document.createElement('div');
            card.className = 'match-card';

            const header = document.createElement('div');
            header.className = 'match-header';

            const signalBars = document.createElement('span');
            signalBars.className = 'signal-bars';
            signalBars.textContent = signalBarsText;

            const strong = document.createElement('strong');
            strong.textContent = `Peer: ${peerId.substring(peerId.length - 8)}`;

            header.appendChild(signalBars);
            header.appendChild(strong);

            const p = document.createElement('p');
            p.textContent = '"Discovered via LSH proximity on DHT"';

            const metaDiv = document.createElement('div');
            metaDiv.className = 'match-meta';

            const spanSim = document.createElement('span');
            spanSim.textContent = `Score: ${simScore.toFixed(2)}`;
            spanSim.style.marginRight = '1rem';

            metaDiv.appendChild(spanSim);

            const btn = document.createElement('button');
            btn.className = 'btn-chat';
            btn.textContent = 'Tap to chat';
            btn.addEventListener('click', () => {
              appState.currentChatPeerId = peerId;
              if (!appState.activeChats[peerId]) {
                appState.activeChats[peerId] = [];
              }
              openChatPanel();
            });

            card.appendChild(header);
            card.appendChild(p);
            card.appendChild(metaDiv);
            card.appendChild(btn);

            if (simScore >= 0.85) {
              matchesVeryClose.appendChild(card);
            } else if (simScore >= 0.70) {
              matchesNearby.appendChild(card);
            } else {
              matchesOrbiting.appendChild(card);
            }
          });
        }

        // Hide empty sections
        (document.getElementById('matches-very-close') as HTMLElement).style.display = matchesVeryClose.childElementCount > 0 ? 'block' : 'none';
        (document.getElementById('matches-nearby') as HTMLElement).style.display = matchesNearby.childElementCount > 0 ? 'block' : 'none';
        (document.getElementById('matches-orbiting') as HTMLElement).style.display = matchesOrbiting.childElementCount > 0 ? 'block' : 'none';

        if (discoveredPeerIds.length === 0) {
          (document.getElementById('matches-orbiting') as HTMLElement).style.display = 'block';
          matchesOrbiting.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Looking for peers... (DHT queries may take a few moments)</p>';
        }
      }
    } else {
      nowHeader.innerHTML = '<p>Select or create a channel to start matching.</p>';
      if (matchList) matchList.innerHTML = '';
    }
  }
}

export async function createChannel(name: string, description: string, spread: number, relations: any[] = []) {
  if (!appState.modelReady) {
    // Model isn't fully ready yet, but allow fallback for test
    console.warn('Model not completely ready, proceeding with fallback if available');
  }

  const channel: SavedChannel = {
    id: Math.random().toString(36).substring(2, 10),
    name,
    description,
    spread,
    relations: relations.length > 0 ? relations : undefined,
  };

  const embedFn = async (text: string) => {
    if (appState.tier === 'high' || appState.tier === 'mid') {
      try {
        const result = await browserModel.embed(text);
        return result;
      } catch (e: any) {
        console.error('Browser model embedding failed, falling back:', e);
        // Provide mock embeddings if model fails to load properly in test environment
        const vec = new Array(384).fill(0).map((_, i) => Math.sin(text.length * i));
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return vec.map(v => v / (norm || 1));
      }
    } else {
      // Use delegation
      console.log('Delegating embedding request to supernode...');
      // In a real network we'd lookup a supernode. Here we dial our bootstrap node.
      try {
        const bootstrapPeerId = '12D3KooWKQDPN7rmocU385fhK23ukUNHqMHuH9Y1SSSFqHK3qsMk';
        const stream = await appState.p2pNode.dialProtocol(
          `/ip4/127.0.0.1/tcp/9090/ws/p2p/${bootstrapPeerId}`,
          PROTOCOL_DELEGATE
        );
        const res = await requestDelegation(stream, {
          requestID: Math.random().toString(),
          timestamp: Date.now(),
          text
        });
        console.log('Received delegated embedding!');
        return res.embedding;
      } catch (err) {
        console.error('Delegation failed:', err);
        throw new Error('Could not compute embedding via delegation');
      }
    }
  };

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
  const btnAddContext = document.getElementById('btn-add-context');
  const contextPicker = document.getElementById('context-picker');
  const btnConfirmContext = document.getElementById('btn-confirm-context');
  const contextList = document.getElementById('compose-context-list');

  let currentRelations: any[] = [];

  if (btnAddContext && contextPicker) {
    btnAddContext.addEventListener('click', () => {
      contextPicker.style.display = contextPicker.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (btnConfirmContext && contextList) {
    btnConfirmContext.addEventListener('click', () => {
      const tagSelect = document.getElementById('context-tag-select') as HTMLSelectElement;
      const objInput = document.getElementById('context-object-input') as HTMLInputElement;

      const tag = tagSelect.value;
      const obj = objInput.value.trim();

      if (obj) {
        currentRelations.push({ tag, object: obj });

        // Render chip
        const chip = document.createElement('div');
        chip.className = 'chip removable';
        chip.textContent = `${tagSelect.options[tagSelect.selectedIndex].text.split(' ')[0]} ${obj} ✖`;

        const relationIndex = currentRelations.length - 1;
        chip.addEventListener('click', () => {
          currentRelations.splice(relationIndex, 1);
          chip.remove();
        });

        contextList.appendChild(chip);

        // Reset picker
        objInput.value = '';
        if (contextPicker) contextPicker.style.display = 'none';
      }
    });
  }

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
        await createChannel(name, desc, spread, currentRelations);
        statusEl.textContent = 'Channel published!';

        // Reset form
        inputName.value = '';
        inputDesc.value = '';
        inputSpread.value = '30';
        currentRelations = [];
        if (contextList) contextList.innerHTML = '';

        renderChannels();

        // Switch back to "Now" tab
        const navBtnNow = document.querySelector('.nav-btn[data-tab="now"]') as HTMLButtonElement;
        if (navBtnNow) navBtnNow.click();
      } catch (err: any) {
        statusEl.textContent = 'Failed to create channel: ' + err.message;
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
