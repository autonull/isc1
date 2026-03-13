import { browserTierDetector, browserModel, browserStorage } from '@isc/adapters';
import { generateKeypair, Keypair, computeRelationalDistributions, relationalMatch, Channel, Distribution, lshHash, createSignedPost, createCommunityReport, SignedPost, Interaction, calculateReputation, RateLimiter, checkPostCoherence, getPostDHTKeys, RATE_LIMITS, getPublicKeyFromPeerId, verifySignature, wordHashFallbackEmbed, createDirectMessage, decryptDirectMessage, getRawPublicKeyFromPeerId, Profile, computeBioEmbedding, FollowEvent } from '@isc/core';
import { initNode } from './network';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { registerSW } from 'virtual:pwa-register';

import { PROTOCOL_DELEGATE, requestDelegation, PROTOCOL_CHAT, sendChatMessage, handleIncomingChat, PROTOCOL_POST, handleIncomingPost, sendPostMessage, PROTOCOL_REPLY, handleIncomingReply, sendReplyMessage, PROTOCOL_QUOTE, handleIncomingQuote, sendQuoteMessage, PROTOCOL_MODERATION, sendModerationMessage, PROTOCOL_DELEGATION_HEALTH, handleDelegationHealth, PROTOCOL_REACTION, handleIncomingReaction, sendReactionMessage, PROTOCOL_DM, handleIncomingDM, sendDMMessage } from '@isc/protocol';
import { createSignedReaction, sign, encodePayload } from '@isc/core';

export interface SavedChannel extends Channel {
  distributions?: Distribution[];
}

interface ChatMessageLog {
  sender: 'self' | 'peer';
  text: string;
  timestamp: number;
  isPending?: boolean;
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
  receivedPosts: SignedPost[];
  allowDelegation: boolean;
  reputation: { [peerId: string]: Interaction[] };
  offlineQueue: any[];
  rateLimiter: RateLimiter;
  supernodeHealth: { [peerId: string]: any };
  activeFeed: 'for-you' | 'following';
  semanticMatchMode: 'monte_carlo' | 'analytic';
  followedPeers: string[];
  peerCreationDates: { [peerId: string]: number };
  communityChannels: { [channelID: string]: any }; // CommunityChannel objects
} = {
  tier: 'unknown',
  allowDelegation: false,
  keypair: null,
  modelReady: false,
  p2pNode: null,
  channels: [],
  activeChannelId: null,
  discoveredPeers: {},
  activeChats: {},
  currentChatPeerId: null,
  receivedPosts: [],
  reputation: {},
  offlineQueue: [],
  rateLimiter: new RateLimiter(),
  supernodeHealth: {},
  activeFeed: 'for-you',
  semanticMatchMode: 'monte_carlo',
  followedPeers: [],
  peerCreationDates: {},
  communityChannels: {}
};

async function recordPeerEncounter(peerId: string) {
  if (!appState.peerCreationDates[peerId]) {
    appState.peerCreationDates[peerId] = Date.now();
    await browserStorage.set('isc:peer_creation_dates', appState.peerCreationDates);
  }
}

async function loadSavedData() {
  try {
    const savedChannels = await browserStorage.get<SavedChannel[]>('isc:channels');
    if (savedChannels && Array.isArray(savedChannels)) {
      appState.channels = savedChannels;
    }

    const allowDelegation = await browserStorage.get<boolean>('isc:settings:delegation');
    if (typeof allowDelegation === 'boolean') {
      appState.allowDelegation = allowDelegation;
    } else {
      appState.allowDelegation = true; // Default to true if not set
    }

    const savedReputation = await browserStorage.get<{ [peerId: string]: Interaction[] }>('isc:reputation');
    if (savedReputation) {
      appState.reputation = savedReputation;
    }

    const savedCreationDates = await browserStorage.get<{ [peerId: string]: number }>('isc:peer_creation_dates');
    if (savedCreationDates) {
      appState.peerCreationDates = savedCreationDates;
    }

    const savedCommunityChannels = await browserStorage.get<{ [channelID: string]: any }>('isc:community_channels');
    if (savedCommunityChannels) {
      appState.communityChannels = savedCommunityChannels;
    }

    const savedQueue = await browserStorage.get<any[]>('isc:offline_queue');
    if (savedQueue && Array.isArray(savedQueue)) {
      appState.offlineQueue = savedQueue;
    }

    const savedFollowedPeers = await browserStorage.get<string[]>('isc:followed_peers');
    if (savedFollowedPeers && Array.isArray(savedFollowedPeers)) {
      appState.followedPeers = savedFollowedPeers;
    }

    const savedRateLimits = await browserStorage.get<any>('isc:ratelimits');
    if (savedRateLimits) {
      appState.rateLimiter.loadState(new Map(JSON.parse(savedRateLimits)));
    }

    const savedMatchMode = await browserStorage.get<'monte_carlo' | 'analytic'>('isc:settings:matchMode');
    if (savedMatchMode) {
      appState.semanticMatchMode = savedMatchMode;
    }
  } catch (err) {
    console.error('Failed to load saved data:', err);
  }
}

export async function saveFollowedPeers() {
  try {
    await browserStorage.set('isc:followed_peers', appState.followedPeers);
  } catch (err) {
    console.error('Failed to save followed peers:', err);
  }
}

export async function saveOfflineQueue() {
  try {
    await browserStorage.set('isc:offline_queue', appState.offlineQueue);
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }
}

export async function enqueueOfflineAction(action: any) {
  appState.offlineQueue.push(action);
  await saveOfflineQueue();
  console.log('Action queued offline:', action.type);
}

export async function flushOfflineQueue() {
  if (appState.offlineQueue.length === 0) return;
  console.log(`Flushing ${appState.offlineQueue.length} offline actions...`);

  const actions = [...appState.offlineQueue];
  appState.offlineQueue = [];
  await saveOfflineQueue();

  for (const action of actions) {
    if (action.type === 'announce') {
      const channel = appState.channels.find(c => c.id === action.channelId);
      if (channel) {
        await announceAndDiscover(channel);
      }
    } else if (action.type === 'post') {
      if (appState.p2pNode) {
        const connections = appState.p2pNode.getConnections();
        for (const conn of connections) {
          try {
            const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_POST);
            await sendPostMessage(stream, action.post);
          } catch (e) {
            console.warn(`Failed to send post to ${conn.remotePeer.toString()}`);
          }
        }
      }
      // Update UI state for posts to remove pending status
      const postInState = appState.receivedPosts.find(p =>
        p.signature === action.post.signature ||
        (p.timestamp === action.post.timestamp && p.author === action.post.author)
      );
      if (postInState) {
        postInState.isPending = false;
        renderRecentPosts();
      }
    } else if (action.type === 'chat') {
      if (appState.p2pNode && action.peerId) {
        try {
          const { peerIdFromString } = await import('@libp2p/peer-id');
          const peerIdObj = peerIdFromString(action.peerId);
          const stream = await appState.p2pNode.dialProtocol(peerIdObj, PROTOCOL_CHAT);
          await sendChatMessage(stream, action.msg);
        } catch (e) {
          console.warn(`Failed to send queued chat to ${action.peerId}`, e);
        }
      }

      // Remove pending status from chats
      if (appState.activeChats[action.peerId]) {
        const targetChat = appState.activeChats[action.peerId].find(c => c.timestamp === action.msg.timestamp && c.text === action.msg.msg);
        if (targetChat) {
          targetChat.isPending = false;
          renderChatPanel();
        }
      }
    }
  }
}

window.addEventListener('online', () => {
  console.log('Browser came online. Initiating background sync...');
  flushOfflineQueue();
  renderChannels();
});

window.addEventListener('offline', () => {
  console.log('Browser went offline.');
  renderChannels();
});

export async function saveChannels() {
  try {
    await browserStorage.set('isc:channels', appState.channels);
  } catch (err) {
    console.error('Failed to save channels:', err);
  }
}

export async function saveReputation() {
  try {
    await browserStorage.set('isc:reputation', appState.reputation);
  } catch (err) {
    console.error('Failed to save reputation:', err);
  }
}

export async function recordInteraction(peerId: string, type: Interaction['type'], successful: boolean) {
  if (!appState.reputation[peerId]) {
    appState.reputation[peerId] = [];
  }

  appState.reputation[peerId].push({
    peerID: peerId,
    type,
    successful,
    timestamp: Date.now()
  });

  await saveReputation();
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
      (data) => {
        // initNode provides the full 'data' payload for chat if it was dialed
        // Actually, initNode expects (chatMsg) => void, but wait, let's look at initNode implementation
        console.log('Incoming chat stream received');
        const remotePeerId = data.connection?.remotePeer?.toString() || 'UnknownPeer';
        if (remotePeerId !== 'UnknownPeer') {
          recordPeerEncounter(remotePeerId);
        }

        handleIncomingChat(data.stream, (msg: any) => {
          if (!appState.activeChats[remotePeerId]) {
            appState.activeChats[remotePeerId] = [];
          }

          appState.activeChats[remotePeerId].push({
            sender: 'peer',
            text: msg.msg || msg.content,
            timestamp: msg.timestamp || Date.now()
          });

          recordInteraction(remotePeerId, 'chat', true);

          renderChatList();

          if (appState.currentChatPeerId === remotePeerId) {
            renderChatPanel();
          }
        });
      },
      (announcement) => {
        recordPeerEncounter(announcement.peerID);
        const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
        if (announcement.model && announcement.model !== MODEL_ID) {
          console.warn(`Dropped announcement due to model mismatch. Expected ${MODEL_ID}, got ${announcement.model}`);
          return;
        }
        console.log('Received valid announcement:', announcement);

        const peerID = announcement.peerID;
        if (!appState.discoveredPeers[peerID]) {
          appState.discoveredPeers[peerID] = [];
        }
        // Basic storing logic for discovered hashes if we wanted to extract from the announcement
        // For Phase 1 we rely on DHT findProviders for direct hashes,
        // but this stream handles explicit announcements.
        renderChannels();
        renderDiscoverTab();
      },
      async (report) => {
        console.log('Received moderation report:', report);

        recordPeerEncounter(report.reporter);

        // Verify the signature
        let isValid = false;
        try {
          const remoteKey = await getPublicKeyFromPeerId(report.reporter);
          isValid = await verifySignature(report, remoteKey);
        } catch (e) {
          console.error("Failed to verify report signature", e);
        }

        if (!isValid) {
          console.warn("Dropped moderation report due to invalid signature.");
          return;
        }

        // Find the offending post to penalize the author, not the reporter
        const offendingPost = appState.receivedPosts.find(p => p.postID === report.targetPostID);
        if (offendingPost) {
          // Record the flag interaction against the AUTHOR of the off-topic post
          recordInteraction(offendingPost.author, 'flag', false);
          console.log(`Penalized peer ${offendingPost.author} for post ${report.targetPostID}`);
        } else {
          console.warn('Received flag for unknown post:', report.targetPostID);
        }
      }
    );

    appState.p2pNode.handle(PROTOCOL_DM, (data: any) => {
      handleIncomingDM(data.stream, async (msg) => {
        const remotePeer = data.connection.remotePeer.toString();
        console.log(`Received encrypted DM from ${remotePeer}`);

        recordPeerEncounter(remotePeer);

        try {
           if (!appState.keypair) return;
           const senderPubKey = await getPublicKeyFromPeerId(msg.sender);
           const senderRawPubKey = await getRawPublicKeyFromPeerId(msg.sender);

           const decrypted = await decryptDirectMessage(msg, appState.keypair, senderRawPubKey, senderPubKey);

           // Use the cryptographically verified sender ID, not just the connection remote peer
           const authenticatedSender = decrypted.sender;

           if (!appState.activeChats[authenticatedSender]) {
             appState.activeChats[authenticatedSender] = [];
           }

           appState.activeChats[authenticatedSender].push({
             sender: 'peer',
             text: decrypted.content,
             timestamp: decrypted.timestamp
           });

           recordInteraction(authenticatedSender, 'chat', true);

           if (appState.currentChatPeerId === authenticatedSender) {
             renderChatPanel();
           } else {
              // Notify logic
              renderChannels();
           }
        } catch (e) {
           console.error("Failed to decrypt or verify incoming DM", e);
        }
      });
    });

    // Fallback for Phase 1 unencrypted Protocol compatibility
    appState.p2pNode.handle(PROTOCOL_CHAT, (data: any) => {
      handleIncomingChat(data.stream, (msg) => {
        const remotePeer = data.connection.remotePeer.toString();
        console.log(`Received cleartext chat from ${remotePeer}:`, msg);

        recordPeerEncounter(remotePeer);

        if (!appState.activeChats[remotePeer]) {
          appState.activeChats[remotePeer] = [];
        }

        appState.activeChats[remotePeer].push({
          sender: 'peer',
          text: msg.msg,
          timestamp: Date.now()
        });

        recordInteraction(remotePeer, 'chat', true);

        if (appState.currentChatPeerId === remotePeer) {
          renderChatPanel();
        } else {
           renderChannels();
        }
      });
    });

    appState.p2pNode.handle(PROTOCOL_POST, (data: any) => {
      handleIncomingPost(data.stream, async (post) => {
        try {
          const remoteKey = await getPublicKeyFromPeerId(post.author);
          if (!await verifySignature(post, remoteKey)) {
             console.warn("Dropped incoming post due to invalid signature.");
             return;
          }
        } catch (e) {
          console.error("Failed to verify post signature", e);
          return;
        }

        console.log('Received post:', post);
        recordPeerEncounter(post.author);
        appState.receivedPosts.unshift(post);
        recordInteraction(post.author, 'post_reaction', true);
        renderRecentPosts();
      });
    });

    appState.p2pNode.handle(PROTOCOL_REPLY, (data: any) => {
      handleIncomingReply(data.stream, async (reply) => {
        try {
          const remoteKey = await getPublicKeyFromPeerId(reply.author);
          if (!await verifySignature(reply, remoteKey)) {
             console.warn("Dropped incoming reply due to invalid signature.");
             return;
          }
        } catch (e) {
          console.error("Failed to verify reply signature", e);
          return;
        }

        console.log('Received reply:', reply);
        recordPeerEncounter(reply.author);
        // Add to main feed so it can be replied to itself
        if (!appState.receivedPosts.find(p => p.postID === reply.postID)) {
          appState.receivedPosts.unshift(reply);
        }

        if (reply.replyTo) {
          const parent = appState.receivedPosts.find(p => p.postID === reply.replyTo);
          if (parent) {
            parent.replies = parent.replies || [];
            if (!parent.replies.find(r => r.postID === reply.postID)) {
              parent.replies.push(reply);
              renderRecentPosts();
            }
          } else {
             renderRecentPosts();
          }
        }
      });
    });

    appState.p2pNode.handle(PROTOCOL_QUOTE, (data: any) => {
      handleIncomingQuote(data.stream, async (quote) => {
        try {
          const remoteKey = await getPublicKeyFromPeerId(quote.author);
          if (!await verifySignature(quote, remoteKey)) {
             console.warn("Dropped incoming quote due to invalid signature.");
             return;
          }
        } catch (e) {
          console.error("Failed to verify quote signature", e);
          return;
        }

        console.log('Received quote:', quote);
        recordPeerEncounter(quote.author);
        appState.receivedPosts.unshift(quote);
        renderRecentPosts();
      });
    });

    appState.p2pNode.handle(PROTOCOL_REACTION, (data: any) => {
      handleIncomingReaction(data.stream, async (reaction) => {
        try {
          const remoteKey = await getPublicKeyFromPeerId(reaction.author);
          if (!await verifySignature(reaction, remoteKey)) {
             console.warn("Dropped incoming reaction due to invalid signature.");
             return;
          }
        } catch (e) {
          console.error("Failed to verify reaction signature", e);
          return;
        }

        console.log('Received reaction:', reaction);
        recordPeerEncounter(reaction.author);
        recordInteraction(reaction.author, 'post_reaction', true);
        const post = appState.receivedPosts.find(p => p.postID === reaction.targetPostID);
        if (post) {
          if (reaction.type === 'like') {
            post.likes = post.likes || [];
            if (!post.likes.includes(reaction.author)) post.likes.push(reaction.author);
          } else if (reaction.type === 'repost') {
            post.reposts = post.reposts || [];
            if (!post.reposts.includes(reaction.author)) post.reposts.push(reaction.author);
          }
          renderRecentPosts();
        }
      });
    });

    appState.p2pNode.handle(PROTOCOL_DELEGATION_HEALTH, (data: any) => {
      handleDelegationHealth(data.stream, async (health) => {
        try {
          const remoteKey = await getPublicKeyFromPeerId(health.peerID);
          if (!await verifySignature(health, remoteKey)) {
             console.warn("Dropped incoming delegation health due to invalid signature.");
             return;
          }
        } catch (e) {
          console.error("Failed to verify delegation health signature", e);
          return;
        }

        recordPeerEncounter(health.peerID);
        // Only update if it's newer
        const existing = appState.supernodeHealth[health.peerID];
        if (!existing || existing.timestamp < health.timestamp) {
          appState.supernodeHealth[health.peerID] = health;
          console.log(`Updated health metrics for supernode ${health.peerID}: ${health.successRate * 100}% success`);
        }
      });
    });

    // 4. Load Embedding Model or rely on Supernode
    // High/Mid tiers load the main model, minimal tier uses word-hash
    if (appState.tier === 'high' || appState.tier === 'mid') {
      const modelId = 'Xenova/all-MiniLM-L6-v2';
      console.log(`Loading embedding model: ${modelId}...`);
      await browserModel.load(modelId);
      appState.modelReady = true;
      console.log('Model loaded successfully.');

      // Register delegate protocol handler if user allowed it and tier is capable
      if (appState.allowDelegation) {
        appState.p2pNode.handle(PROTOCOL_DELEGATE, async (data: any) => {
          console.log(`Received PROTOCOL_DELEGATE request from ${data.connection.remotePeer.toString()}`);
          try {
            const { handleDelegateRequest } = await import('@isc/protocol');

            const capabilities = {
              maxConcurrentRequests: 5,
              modelAdapter: browserModel,
              supernodeKeypair: appState.keypair!
            };

            await handleDelegateRequest(data.stream, capabilities);
            console.log('Successfully handled delegate request locally in browser');
          } catch (e) {
            console.error('Failed to handle delegated request', e);
          }
        });
      }
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

    if (msg.isPending) {
      msgDiv.style.opacity = '0.6';
      msgDiv.title = 'Pending (Offline)';
      const pendingIcon = document.createElement('span');
      pendingIcon.textContent = ' 🕒';
      pendingIcon.style.fontSize = '0.8em';
      msgDiv.appendChild(pendingIcon);
    }

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

  const isOffline = !navigator.onLine;
  const nowTimestamp = Date.now();

  appState.activeChats[peerId].push({
    sender: 'self',
    text,
    timestamp: nowTimestamp,
    isPending: isOffline
  });

  // Clear input and update UI
  inputEl.value = '';
  renderChatPanel();
  renderChatList();

  // Send via network
  const msgPayload = {
    channelID: appState.activeChannelId || 'unknown',
    msg: text,
    timestamp: nowTimestamp
  };

  if (isOffline) {
    await enqueueOfflineAction({ type: 'chat', peerId, msg: msgPayload });
    console.log(`Queued chat message for ${peerId} (offline)`);
    return;
  }

  try {
    if (appState.p2pNode && appState.keypair) {
      console.log(`Sending secure DM to ${peerId}`);
      try {
        const stream = await appState.p2pNode.dialProtocol(peerId, PROTOCOL_DM);
        const recipientRawPubKey = await getRawPublicKeyFromPeerId(peerId);

        const dm = await createDirectMessage(
          appState.keypair,
          appState.p2pNode.peerId.toString(),
          peerId,
          recipientRawPubKey,
          text
        );

        await sendDMMessage(stream, dm);
        console.log('Encrypted DM sent successfully!');
      } catch (dialErr) {
        console.log(`Dialing peer ${peerId} for secure DM failed, falling back to cleartext chat.`, dialErr);

        try {
          const stream = await appState.p2pNode.dialProtocol(peerId, PROTOCOL_CHAT);
          await sendChatMessage(stream, { channelID: appState.activeChannelId!, msg: text, timestamp: Date.now() } as any);
          console.log('Cleartext fallback message sent successfully!');
        } catch (fallbackErr) {
          console.error(`Fallback dialing peer ${peerId} failed:`, fallbackErr);
        }
      }
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
    const distA = await computeRelationalDistributions(channelA, embedFn, appState.tier);
    const distB = await computeRelationalDistributions(channelB, embedFn, appState.tier);

    const score = relationalMatch(distA, distB, appState.tier as any, appState.semanticMatchMode);
    resultSpan.textContent = score.toFixed(4);
  } catch (err) {
    console.error('Match failed', err);
    resultSpan.textContent = 'Error (see console)';
  }
}

export async function fetchForYouFeed() {
  let activeChannel = appState.channels.find(c => c.id === appState.activeChannelId);
  let activeCommunity = appState.communityChannels[appState.activeChannelId as string];

  // Use community embedding if active, otherwise use channel root distribution
  let searchMu: number[] | null = null;
  if (activeCommunity) {
    searchMu = activeCommunity.embedding;
  } else if (activeChannel && activeChannel.distributions && activeChannel.distributions.length > 0) {
    const rootDist = activeChannel.distributions.find((d: any) => d.type === 'root');
    if (rootDist) searchMu = rootDist.mu;
  }

  // Fetch posts from DHT for the active channel/community
  if (navigator.onLine && appState.p2pNode && searchMu) {
    const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
    // Query DHT based on the distribution of the active channel
    if (searchMu) {
      // Find adjacent shards to discover nearby posts
      const keys = getPostDHTKeys(searchMu, MODEL_ID, 5);
      for (const keyStr of keys) {
        try {
          const keyBytes = new TextEncoder().encode(keyStr);

          if (appState.p2pNode.services && appState.p2pNode.services.dht) {
            try {
              // Create an abort signal so we don't hang forever
              const abortController = new AbortController();
              setTimeout(() => abortController.abort(), 5000); // 5s timeout per query

              for await (const event of appState.p2pNode.services.dht.get(keyBytes, { signal: abortController.signal })) {
                if (event.name === 'VALUE' && event.value) {
                  try {
                    const postStr = new TextDecoder().decode(event.value);
                    const post: SignedPost = JSON.parse(postStr);
                    // Add if we don't already have it
                    if (!appState.receivedPosts.find(p => p.postID === post.postID)) {
                      appState.receivedPosts.push(post);
                    }
                  } catch (parseErr) {
                    console.warn('Failed to parse post from DHT', parseErr);
                  }
                }
              }
            } catch (dhtErr: any) {
              // Ignore abort or not found errors
              if (dhtErr.code !== 'ERR_NOT_FOUND' && dhtErr.name !== 'AbortError') {
                console.warn('DHT get error:', dhtErr);
              }
            }
          }
        } catch (e) {
          // General failure
        }
      }

      // Update UI after all fetches attempt to complete
      renderRecentPosts();
    }
  }
}

export function renderRecentPosts() {
  const container = document.getElementById('discover-recent-posts');
  if (!container) return;


  const activeChannel = appState.channels.find(c => c.id === appState.activeChannelId);
  const activeCommunity = appState.communityChannels[appState.activeChannelId as string];

  // Filter posts based on active feed
  let postsToRender = [...appState.receivedPosts];
  if (appState.activeFeed === 'following') {
    postsToRender = postsToRender.filter(p => appState.followedPeers.includes(p.author));
  }

  // Score and sort posts by similarity to the current channel/community
  if (appState.activeFeed === 'for-you' && (activeChannel?.distributions || activeCommunity?.embedding)) {
    postsToRender.sort((a, b) => {
      let coherenceA = 0;
      let coherenceB = 0;
      if (activeCommunity) {
        coherenceA = checkPostCoherence(a, [{ type: 'root', mu: activeCommunity.embedding, sigma: 0 }]);
        coherenceB = checkPostCoherence(b, [{ type: 'root', mu: activeCommunity.embedding, sigma: 0 }]);
      } else if (activeChannel?.distributions) {
        coherenceA = checkPostCoherence(a, activeChannel.distributions);
        coherenceB = checkPostCoherence(b, activeChannel.distributions);
      }
      return coherenceB - coherenceA; // Descending
    });
  } else {
    // For "Following" feed or if no active channel, sort by newest first
    postsToRender.sort((a, b) => b.timestamp - a.timestamp);
  }

  container.innerHTML = '';

  if (postsToRender.length === 0) {
    if (appState.activeFeed === 'following') {
      container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">No posts from followed peers yet.</p>';
    } else {
      container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">No recent posts from peers yet.</p>';
    }
    return;
  }
  for (const post of postsToRender) {
    const card = document.createElement('div');
    card.className = 'card match-card';

    let coherence = 1;
    if (activeChannel && activeChannel.distributions) {
      coherence = checkPostCoherence(post, activeChannel.distributions);
      if (coherence < 0.5) {
        card.style.opacity = '0.5'; // Dim off-topic posts
      }
    }

    const header = document.createElement('div');
    header.className = 'match-header';

    const h4 = document.createElement('h4');
    h4.textContent = post.author.substring(0, 12) + '...';
    header.appendChild(h4);

    const timeStr = new Date(post.timestamp).toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.style.color = 'var(--text-secondary)';
    timeSpan.style.fontSize = 'var(--font-size-xs)';
    timeSpan.textContent = timeStr;
    header.appendChild(timeSpan);

    if (coherence < 0.5) {
      const offTopicSpan = document.createElement('span');
      offTopicSpan.style.color = 'var(--accent-warning)';
      offTopicSpan.style.fontSize = 'var(--font-size-xs)';
      offTopicSpan.style.marginLeft = '0.5rem';
      offTopicSpan.textContent = 'Off-Topic';
      header.appendChild(offTopicSpan);
    }

    if (post.isPending) {
      const pendingSpan = document.createElement('span');
      pendingSpan.style.color = 'var(--primary)';
      pendingSpan.style.fontSize = 'var(--font-size-xs)';
      pendingSpan.style.marginLeft = '0.5rem';
      pendingSpan.innerHTML = '🕒 Pending';
      header.appendChild(pendingSpan);
      card.style.border = '1px dashed var(--border-subtle)';
    }

    const followBtn = document.createElement('button');
    followBtn.className = 'btn-icon';
    followBtn.style.marginLeft = 'auto';
    followBtn.style.fontSize = 'var(--font-size-xs)';
    followBtn.textContent = appState.followedPeers.includes(post.author) ? 'Unfollow' : 'Follow';
    followBtn.addEventListener('click', async () => {
      const currentlyFollowing = appState.followedPeers.includes(post.author);
      const actionType = currentlyFollowing ? 'unfollow' : 'follow';

      if (currentlyFollowing) {
        appState.followedPeers = appState.followedPeers.filter(p => p !== post.author);
        followBtn.textContent = 'Follow';
      } else {
        appState.followedPeers.push(post.author);
        followBtn.textContent = 'Unfollow';
      }
      await saveFollowedPeers();

      // Announce over pubsub
      if (appState.p2pNode && appState.keypair) {
        try {
          const peerId = appState.p2pNode.peerId.toString();
          const event: FollowEvent = {
            type: actionType,
            follower: peerId,
            followee: post.author,
            timestamp: Date.now(),
            signature: new Uint8Array(0) // placeholder
          };
          const encoded = encodePayload(event);
          event.signature = await sign(encoded, appState.keypair);

          const topic = `/isc/follow/${post.author}`;
          const encoder = new TextEncoder();
          await appState.p2pNode.services.pubsub.publish(topic, encoder.encode(JSON.stringify(event)));
          console.log(`Published ${actionType} event to ${post.author}`);
        } catch (e) {
          console.warn(`Failed to publish follow event`, e);
        }
      }

      // Only re-render completely if we are actively in the following feed and just unfollowed someone
      // otherwise just let the button update its state
      if (appState.activeFeed === 'following' && currentlyFollowing) {
         renderRecentPosts();
      }
    });
    header.appendChild(followBtn);

    const flagBtn = document.createElement('button');
    flagBtn.className = 'btn-icon';
    flagBtn.style.marginLeft = '0.5rem';
    flagBtn.style.fontSize = 'var(--font-size-xs)';
    flagBtn.textContent = '🚩 Flag';
    flagBtn.addEventListener('click', async () => {
      if (!appState.keypair || !appState.p2pNode) return;
      const reporter = appState.p2pNode.peerId.toString();
      const report = await createCommunityReport(appState.keypair, reporter, post.postID, 'off-topic', 'Flagged by user');

      console.log('Sending moderation report:', report);
      const connections = appState.p2pNode.getConnections();
      for (const conn of connections) {
        try {
          const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_MODERATION);
          await sendModerationMessage(stream, report);
        } catch (e) {
          console.warn(`Failed to send moderation to ${conn.remotePeer.toString()}`);
        }
      }
      flagBtn.textContent = 'Flagged';
      flagBtn.disabled = true;
    });
    header.appendChild(flagBtn);

    const content = document.createElement('p');
    content.className = 'match-desc';
    content.textContent = post.content;

    if (post.ipfsLink) {
      try {
        const parsedUrl = new URL(post.ipfsLink);
        const protocol = parsedUrl.protocol.toLowerCase();

        if (protocol === 'http:' || protocol === 'https:' || protocol === 'ipfs:') {
          const ipfsEl = document.createElement('div');
          ipfsEl.style.marginTop = '0.5rem';
          ipfsEl.style.fontSize = 'var(--font-size-sm)';
          const linkEl = document.createElement('a');
          linkEl.href = post.ipfsLink;
          linkEl.target = '_blank';
          linkEl.rel = 'noopener noreferrer';
          linkEl.textContent = '📎 IPFS Link';
          linkEl.style.color = 'var(--primary)';
          ipfsEl.appendChild(linkEl);
          content.appendChild(ipfsEl);
        }
      } catch (e) {
        console.warn('Invalid IPFS link URL format:', post.ipfsLink);
      }
    }

    // Add reaction bar
    const reactionBar = document.createElement('div');
    reactionBar.style.display = 'flex';
    reactionBar.style.gap = '1rem';
    reactionBar.style.marginTop = '0.5rem';

    // Like button
    const likeBtn = document.createElement('button');
    likeBtn.className = 'btn-icon';
    likeBtn.style.fontSize = 'var(--font-size-sm)';
    const likeCount = (post.likes || []).length;
    likeBtn.innerHTML = `❤️ <span class="like-count">${likeCount}</span>`;
    likeBtn.addEventListener('click', async () => {
      if (!appState.keypair || !appState.p2pNode) return;
      const peerId = appState.p2pNode.peerId.toString();

      // Update locally
      post.likes = post.likes || [];
      if (!post.likes.includes(peerId)) {
        post.likes.push(peerId);
        likeBtn.innerHTML = `❤️ <span class="like-count">${post.likes.length}</span>`;

        // Broadcast
        const reaction = await createSignedReaction(appState.keypair!, peerId, post.postID, 'like');
        const connections = appState.p2pNode.getConnections();
        for (const conn of connections) {
          try {
            const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_REACTION);
            await sendReactionMessage(stream, reaction);
          } catch (e) {
             console.warn(`Failed to send reaction to ${conn.remotePeer.toString()}`);
          }
        }
      }
    });

    // Repost button
    const repostBtn = document.createElement('button');
    repostBtn.className = 'btn-icon';
    repostBtn.style.fontSize = 'var(--font-size-sm)';
    const repostCount = (post.reposts || []).length;
    repostBtn.innerHTML = `🔁 <span class="repost-count">${repostCount}</span>`;
    repostBtn.addEventListener('click', async () => {
       if (!appState.keypair || !appState.p2pNode) return;
      const peerId = appState.p2pNode.peerId.toString();

      // Update locally
      post.reposts = post.reposts || [];
      if (!post.reposts.includes(peerId)) {
        post.reposts.push(peerId);
        repostBtn.innerHTML = `🔁 <span class="repost-count">${post.reposts.length}</span>`;

        // Broadcast
        const reaction = await createSignedReaction(appState.keypair!, peerId, post.postID, 'repost');
        const connections = appState.p2pNode.getConnections();
        for (const conn of connections) {
          try {
            const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_REACTION);
            await sendReactionMessage(stream, reaction);
          } catch (e) {
             console.warn(`Failed to send reaction to ${conn.remotePeer.toString()}`);
          }
        }
      }
    });

    // Reply button
    const replyBtn = document.createElement('button');
    replyBtn.className = 'btn-icon';
    replyBtn.style.fontSize = 'var(--font-size-sm)';
    replyBtn.innerHTML = `💬`;
    replyBtn.addEventListener('click', async () => {
       const replyContent = prompt('Reply to this post:');
       if (!replyContent || !appState.keypair || !appState.p2pNode) return;

       const embedFn = getEmbeddingHelper();
       const embedding = await embedFn(replyContent);
       const peerId = appState.p2pNode.peerId.toString();

       const replyPost = await createSignedPost(
         appState.keypair,
         peerId,
         replyContent,
         post.channelID,
         embedding,
         86400000,
         undefined, // quoteOf
         post.postID // replyTo
       );

       appState.receivedPosts.unshift(replyPost);
       post.replies = post.replies || [];
       post.replies.push(replyPost);
       renderRecentPosts();

       // Broadcast
       const connections = appState.p2pNode.getConnections();
       for (const conn of connections) {
         try {
           const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_REPLY);
           await sendReplyMessage(stream, replyPost);
         } catch (e) {
           console.warn(`Failed to send reply to ${conn.remotePeer.toString()}`);
         }
       }
    });

    // Quote button
    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'btn-icon';
    quoteBtn.style.fontSize = 'var(--font-size-sm)';
    quoteBtn.innerHTML = `❞`;
    quoteBtn.addEventListener('click', async () => {
       const quoteContent = prompt('Add commentary to this quote:');
       if (!quoteContent || !appState.keypair || !appState.p2pNode) return;

       const embedFn = getEmbeddingHelper();
       // "Embed original + commentary as a fused vector" for Quote per SOCIAL.md
       const fusedText = `${post.content} ${quoteContent}`;
       const embedding = await embedFn(fusedText);
       const peerId = appState.p2pNode.peerId.toString();

       const quotePost = await createSignedPost(
         appState.keypair,
         peerId,
         quoteContent,
         post.channelID,
         embedding,
         86400000,
         post.postID // quoteOf
       );

       appState.receivedPosts.unshift(quotePost);
       renderRecentPosts();

       // Broadcast
       const connections = appState.p2pNode.getConnections();
       for (const conn of connections) {
         try {
           const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_QUOTE);
           await sendQuoteMessage(stream, quotePost);
         } catch (e) {
           console.warn(`Failed to send quote to ${conn.remotePeer.toString()}`);
         }
       }
    });

    reactionBar.appendChild(likeBtn);
    reactionBar.appendChild(repostBtn);
    reactionBar.appendChild(replyBtn);
    reactionBar.appendChild(quoteBtn);

    card.appendChild(header);
    card.appendChild(content);

    // Render Quoted Post
    if (post.quoteOf) {
      const quotedPost = appState.receivedPosts.find(p => p.postID === post.quoteOf);
      const quoteBlock = document.createElement('blockquote');
      quoteBlock.style.borderLeft = '4px solid var(--accent-primary)';
      quoteBlock.style.paddingLeft = '1rem';
      quoteBlock.style.marginLeft = '0';
      quoteBlock.style.marginTop = '1rem';
      quoteBlock.style.color = 'var(--text-secondary)';
      quoteBlock.style.fontSize = '0.9em';

      if (quotedPost) {
        const strong = document.createElement('strong');
        strong.textContent = `${quotedPost.author.substring(0, 12)}...`;
        quoteBlock.appendChild(strong);
        quoteBlock.appendChild(document.createElement('br'));
        quoteBlock.appendChild(document.createTextNode(quotedPost.content));
      } else {
        quoteBlock.textContent = `[Quoted Post Not Found locally: ${post.quoteOf}]`;
      }
      card.appendChild(quoteBlock);
    }

    card.appendChild(reactionBar);

    // Render Replies
    if (post.replies && post.replies.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.style.marginTop = '1rem';
      repliesContainer.style.paddingTop = '0.5rem';
      repliesContainer.style.borderTop = '1px solid var(--border-subtle)';
      repliesContainer.style.marginLeft = '1rem';

      post.replies.forEach(reply => {
        const replyEl = document.createElement('div');
        replyEl.style.marginBottom = '0.5rem';
        replyEl.style.fontSize = '0.9em';

        const strong = document.createElement('strong');
        strong.textContent = `${reply.author.substring(0, 12)}...`;
        replyEl.appendChild(strong);
        replyEl.appendChild(document.createTextNode(`: ${reply.content}`));

        repliesContainer.appendChild(replyEl);
      });
      card.appendChild(repliesContainer);
    }

    container.appendChild(card);
  }
}

export async function fetchAndRenderProfile(peerId: string) {
  const titleEl = document.getElementById('profile-view-title');
  const peerIdEl = document.getElementById('profile-view-peer-id');
  const bioEl = document.getElementById('profile-view-bio');
  const followersEl = document.getElementById('profile-view-followers');
  const followingEl = document.getElementById('profile-view-following');

  // Currently we do not dynamically query follower count over DHT in phase 1, but we reset it to 0
  if (followersEl) followersEl.textContent = '0';
  if (followingEl) followingEl.textContent = '0';
  const joinedEl = document.getElementById('profile-view-joined');
  const channelListEl = document.getElementById('profile-view-channel-list');
  const channelCountEl = document.getElementById('profile-view-channel-count');

  if (!peerIdEl || !bioEl || !channelListEl || !channelCountEl) return;

  const isSelf = appState.p2pNode && appState.p2pNode.peerId.toString() === peerId;

  if (titleEl) {
    titleEl.textContent = isSelf ? 'Your Profile' : 'Peer Profile';
  }

  peerIdEl.textContent = peerId;
  bioEl.textContent = 'Fetching semantic profile...';
  channelListEl.innerHTML = '';
  channelCountEl.textContent = '0';

  // Set joined date based on when we first saw them
  if (joinedEl) {
    const creationDate = appState.peerCreationDates[peerId];
    if (creationDate) {
      joinedEl.textContent = `Joined: ${new Date(creationDate).toLocaleDateString()}`;
    } else {
      joinedEl.textContent = `Joined: Unknown`;
    }
  }

  // Switch to the profile view
  window.switchView('profile');

  // Load user profile logic
  const profile: Profile = {
    peerID: peerId,
    channels: [],
    followerCount: 0,
    followingCount: 0,
    joinedAt: appState.peerCreationDates[peerId] || Date.now()
  };

  if (isSelf) {
    // Populate with own channels
    profile.channels = appState.channels.map(ch => {
      // Create a simplified embedding for the bio
      const embedding = ch.distributions && ch.distributions.length > 0
        ? ch.distributions[0].mu
        : [];
      return {
        channelID: ch.id,
        name: ch.name,
        description: ch.description,
        embedding: embedding,
        postCount: 0, // Placeholder
        latestEmbedding: embedding
      };
    });
  } else {
    // Try to query their channels from the DHT
    try {
      if (appState.p2pNode) {
        const keyString = `/isc/profile/channels/${peerId}`;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        for await (const event of appState.p2pNode.services.dht.get(encoder.encode(keyString))) {
           if (event.name === 'VALUE') {
             try {
                const str = decoder.decode(event.value);
                const channels = JSON.parse(str);
                if (Array.isArray(channels)) {
                  profile.channels = channels;
                }
             } catch (e) {
                console.warn('Failed to parse peer profile channels');
             }
           }
        }
      }
    } catch (e) {
      console.warn("Could not fetch peer profile from DHT");
    }
  }

  // Compute bio summary
  profile.bioEmbedding = computeBioEmbedding(profile);

  // Update UI with the loaded profile
  if (profile.channels.length > 0) {
     bioEl.textContent = `Aggregated semantic footprint based on ${profile.channels.length} contexts.`;
     channelCountEl.textContent = profile.channels.length.toString();

     profile.channels.forEach(ch => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.padding = '0.75rem';

        const h4 = document.createElement('h4');
        h4.style.margin = '0 0 0.25rem 0';
        h4.textContent = `# ${ch.name}`;

        const desc = document.createElement('p');
        desc.className = 'text-sm';
        desc.style.color = 'var(--text-secondary)';
        desc.style.margin = '0';
        desc.textContent = ch.description;

        div.appendChild(h4);
        div.appendChild(desc);
        channelListEl.appendChild(div);
     });

     // Just to demonstrate how we would compute similarity, we calculate similarity to our own active channel
     if (!isSelf && appState.activeChannelId) {
        const activeCh = appState.channels.find(c => c.id === appState.activeChannelId);
        if (activeCh && activeCh.distributions && activeCh.distributions.length > 0 && profile.bioEmbedding.length > 0) {
           const sim = checkPostCoherence({ embedding: profile.bioEmbedding } as any, activeCh.distributions);
           const simEl = document.createElement('p');
           simEl.className = 'text-sm';
           simEl.style.color = 'var(--accent-primary)';
           simEl.style.marginTop = '0.5rem';
           simEl.textContent = `Overall similarity to your active channel: ${(sim * 100).toFixed(1)}%`;
           bioEl.appendChild(simEl);
        }
     }

  } else {
     bioEl.textContent = 'No aggregated channel distribution available.';
     channelListEl.innerHTML = '<p class="text-sm" style="color: var(--text-secondary);">No channels found for this peer.</p>';
  }
}

export function renderDiscoverTab() {
  const container = document.getElementById('discover-trending-cards');
  const searchInput = document.getElementById('discover-search-input') as HTMLInputElement;
  if (!container) return;

  const filterText = searchInput?.value.toLowerCase() || '';
  container.innerHTML = '';

  const peerIds = Object.keys(appState.discoveredPeers);
  if (peerIds.length === 0) {
    container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Looking for peers... (DHT queries may take a few moments)</p>';
    return;
  }

  peerIds.forEach(peerId => {
    // Basic filter by peerId for Phase 1 since we don't fetch full profiles yet
    if (filterText && !peerId.toLowerCase().includes(filterText)) {
      return;
    }

    const hashes = appState.discoveredPeers[peerId];

    const card = document.createElement('div');
    card.className = 'card match-card';

    const header = document.createElement('div');
    header.className = 'match-header';

    const h4 = document.createElement('h4');
    h4.textContent = peerId.substring(0, 12) + '...';

    // Calculate and render reputation
    const repHistory = appState.reputation[peerId] || [];
    const peerCreatedAt = appState.peerCreationDates[peerId] || Date.now();
    const repScore = calculateReputation(repHistory, Date.now(), peerCreatedAt);
    const repBadge = document.createElement('span');
    repBadge.style.fontSize = 'var(--font-size-xs)';
    repBadge.style.padding = '0.2rem 0.4rem';
    repBadge.style.borderRadius = '4px';
    repBadge.style.marginLeft = '0.5rem';

    if (repScore >= 0.8) {
      repBadge.style.backgroundColor = 'var(--accent-success)';
      repBadge.style.color = 'white';
      repBadge.textContent = `⭐ ${(repScore * 100).toFixed(0)}% Rep`;
    } else if (repScore >= 0.4) {
      repBadge.style.backgroundColor = 'var(--bg-elevated)';
      repBadge.style.color = 'var(--text-secondary)';
      repBadge.textContent = `Neutral (${(repScore * 100).toFixed(0)}%)`;
    } else {
      repBadge.style.backgroundColor = 'var(--accent-danger)';
      repBadge.style.color = 'white';
      repBadge.textContent = `⚠️ Low Rep`;
    }

    h4.appendChild(repBadge);
    header.appendChild(h4);

    const p = document.createElement('p');
    p.className = 'match-desc';
    p.textContent = `Discovered via ${hashes.length} shared hash(es)`;

    const btn = document.createElement('button');
    btn.className = 'btn-secondary btn-sm';
    btn.textContent = 'Message';
    btn.addEventListener('click', () => {
      appState.currentChatPeerId = peerId;
      if (!appState.activeChats[peerId]) {
        appState.activeChats[peerId] = [];
      }
      openChatPanel();

      // Switch to chats view
      window.switchView('chat');
    });

    const profileBtn = document.createElement('button');
    profileBtn.className = 'btn-icon';
    profileBtn.textContent = '👤 Profile';
    profileBtn.style.marginLeft = '0.5rem';
    profileBtn.style.fontSize = 'var(--font-size-xs)';
    profileBtn.addEventListener('click', () => {
       fetchAndRenderProfile(peerId);
    });

    card.appendChild(header);
    card.appendChild(p);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.alignItems = 'center';
    actionsDiv.appendChild(btn);
    actionsDiv.appendChild(profileBtn);

    card.appendChild(actionsDiv);

    container.appendChild(card);
  });
}

export function renderChannels() {
  // Update Profile ID
  const peerIdEl = document.getElementById('profile-peer-id');
  if (peerIdEl) {
    peerIdEl.textContent = appState.p2pNode?.peerId?.toString() || 'Initializing...';
  }

  // Update Settings Device Tier UI
  const tierEl = document.getElementById('settings-device-tier');
  if (tierEl) {
    tierEl.textContent = appState.tier.charAt(0).toUpperCase() + appState.tier.slice(1);
    // Add visual cue based on tier
    if (appState.tier === 'high' || appState.tier === 'mid') {
      tierEl.style.color = 'var(--accent-success)';
      tierEl.textContent += ' (Delegation Capable)';
    } else {
      tierEl.style.color = 'var(--accent-warning)';
      tierEl.textContent += ' (Delegation Required)';
    }
  }

  // Update Settings Delegation Toggle
  const delegationToggle = document.getElementById('settings-allow-delegation') as HTMLInputElement;
  if (delegationToggle && delegationToggle.checked !== appState.allowDelegation) {
    delegationToggle.checked = appState.allowDelegation;
  }

  // Update Settings Tab channel list
  const countEl = document.getElementById('settings-channel-count');
  const listEl = document.getElementById('settings-channel-list');

  if (countEl) countEl.textContent = (appState.channels.length + Object.keys(appState.communityChannels).length).toString();

  if (listEl) {
    listEl.innerHTML = '';

    const renderChannelItem = (id: string, name: string, isCommunity: boolean) => {
      const div = document.createElement('div');
      div.className = `channel-item ${id === appState.activeChannelId ? 'active' : ''}`;
      div.textContent = (isCommunity ? '🌐 ' : '# ') + name;

      div.addEventListener('click', () => {
        appState.activeChannelId = id;
        renderChannels();
        fetchForYouFeed(); // Fetch when switching channels immediately
        window.switchView('channel');
      });

      listEl.appendChild(div);
    };

    if (appState.channels.length === 0 && Object.keys(appState.communityChannels).length === 0) {
      listEl.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem;">No active channels</p>';
    } else {
      appState.channels.forEach(ch => {
        renderChannelItem(ch.id, ch.name, false);
      });
      Object.values(appState.communityChannels).forEach(comm => {
        renderChannelItem(comm.channelID, comm.name, true);
      });
    }
  }

  // Also start discovery when switching channels if node is ready
  const activeChannel = appState.channels.find(c => c.id === appState.activeChannelId);
  const activeCommunity = appState.communityChannels[appState.activeChannelId as string];

  // Update Now tab
  const nowHeader = document.getElementById('now-channel-header');
  const matchList = document.getElementById('now-match-list');
  const matchesVeryClose = document.getElementById('matches-very-close')?.querySelector('.matches-container');
  const matchesNearby = document.getElementById('matches-nearby')?.querySelector('.matches-container');
  const matchesOrbiting = document.getElementById('matches-orbiting')?.querySelector('.matches-container');
  const discoveredPeerIds = Object.keys(appState.discoveredPeers);

  if (nowHeader) {
    if (activeChannel || activeCommunity) {
      nowHeader.innerHTML = '';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'channel-title';
      const h1 = document.createElement('h1');
      const dot = document.createElement('span');
      dot.className = 'status-dot active';
      dot.textContent = '●';
      h1.appendChild(dot);
      h1.appendChild(document.createTextNode(' ' + (activeCommunity ? activeCommunity.name : activeChannel!.name)));
      titleDiv.appendChild(h1);

      const desc = document.createElement('p');
      desc.className = 'description';
      desc.textContent = `"${activeCommunity ? activeCommunity.description : activeChannel!.description}"`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      const nearby = document.createElement('span');
      nearby.textContent = `◉ ${discoveredPeerIds.length} nearby`;
      const spread = document.createElement('span');
      spread.textContent = `Spread: ${activeCommunity ? '0 (Community)' : activeChannel!.spread}`;
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
          // Sort peers by reputation-weighted similarity score
          const peersWithScores = discoveredPeerIds.map(peerId => {
            const hashesMatched = appState.discoveredPeers[peerId].length;
            let simScore = 0;
            if (activeCommunity) {
               // Since we're in a community, we'll just base similarity on whether they are in the community list
               simScore = (activeCommunity.members && activeCommunity.members.includes(peerId)) ? 1.0 : 0.6;
            } else if (activeChannel && activeChannel.distributions && activeChannel.distributions.length > 0) {
              const peerMockDistributions = activeChannel.distributions.map(d => ({
                ...d,
                mu: d.mu.map((val: number) => val * (0.9 + Math.random() * 0.2)) // minor jitter
              }));

              simScore = relationalMatch(
                activeChannel.distributions,
                peerMockDistributions,
                appState.tier as any,
                appState.semanticMatchMode
              );
              simScore = simScore * (hashesMatched / 5);
            } else {
              simScore = hashesMatched >= 4 ? 0.91 : hashesMatched >= 2 ? 0.75 : 0.60;
            }

            // Reputation weighting
            // Calculate base reputation using stored encounter date
            const peerCreatedAt = appState.peerCreationDates[peerId] || Date.now();
            const repScore = calculateReputation(appState.reputation[peerId] || [], Date.now(), peerCreatedAt);

            // Weight the similarity score: heavily penalize very low reputation peers, slight boost for high
            const weightedScore = simScore * (0.5 + repScore);

            return { peerId, simScore, weightedScore, repScore };
          });

          // Sort by highest weighted score
          peersWithScores.sort((a, b) => b.weightedScore - a.weightedScore);

          peersWithScores.forEach(({ peerId, simScore }) => {
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
              const myPeerId = appState.p2pNode?.peerId.toString();
              if (myPeerId) {
                if (!appState.rateLimiter.attempt(myPeerId, 'CHAT_DIAL', RATE_LIMITS.CHAT_DIAL)) {
                  alert('Rate limit exceeded for Chat Dial (20/hr). Please try again later.');
                  return;
                }
                const stateToSave = JSON.stringify(Array.from(appState.rateLimiter.getState().entries()));
                browserStorage.set('isc:ratelimits', stateToSave).catch(e => console.error(e));
              }

              appState.currentChatPeerId = peerId;
              if (!appState.activeChats[peerId]) {
                appState.activeChats[peerId] = [];
              }
              openChatPanel();
            });

            const profileBtn = document.createElement('button');
            profileBtn.className = 'btn-icon';
            profileBtn.textContent = '👤 Profile';
            profileBtn.style.marginLeft = '0.5rem';
            profileBtn.style.fontSize = 'var(--font-size-xs)';
            profileBtn.addEventListener('click', () => {
               fetchAndRenderProfile(peerId);
            });

            card.appendChild(header);
            card.appendChild(p);
            card.appendChild(metaDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.alignItems = 'center';
            actionsDiv.appendChild(btn);
            actionsDiv.appendChild(profileBtn);

            card.appendChild(actionsDiv);

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

        if (!navigator.onLine) {
          (document.getElementById('matches-orbiting') as HTMLElement).style.display = 'block';
          matchesOrbiting.innerHTML = `
            <style>
              @keyframes isc-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .isc-spinner { border: 3px solid var(--border-subtle, rgba(255,255,255,0.1)); border-top: 3px solid var(--primary, #6366F1); border-radius: 50%; width: 24px; height: 24px; animation: isc-spin 1s linear infinite; margin: 0 auto 10px auto; }
            </style>
            <div style="padding: 2rem 1rem; text-align: center; color: var(--text-secondary);">
              <div class="isc-spinner"></div>
              <p>Looking for the network…</p>
            </div>
          `;
        } else if (discoveredPeerIds.length === 0) {
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

function getEmbeddingHelper() {
  return async (text: string) => {
    if (appState.tier === 'high' || appState.tier === 'mid') {
      try {
        const result = await browserModel.embed(text);
        return result;
      } catch (e: any) {
        console.error('Browser model embedding failed, falling back to word-hash:', e);
        return wordHashFallbackEmbed(text);
      }
    } else {
      // Use delegation
      console.log('Delegating embedding request to supernode...');

      let targetPeerId = '12D3KooWKQDPN7rmocU385fhK23ukUNHqMHuH9Y1SSSFqHK3qsMk'; // Default to bootstrap
      let targetMultiaddr = `/ip4/127.0.0.1/tcp/9090/ws/p2p/${targetPeerId}`;

      // Rank supernodes
      const healthEntries = Object.values(appState.supernodeHealth);
      if (healthEntries.length > 0) {
        // Sort by success rate descending, then latency ascending
        healthEntries.sort((a, b) => {
          if (b.successRate !== a.successRate) {
            return b.successRate - a.successRate;
          }
          return a.avgLatencyMs - b.avgLatencyMs;
        });

        const bestSupernode = healthEntries[0];
        // Only switch if it's healthy enough
        if (bestSupernode.successRate > 0.85) {
          targetPeerId = bestSupernode.peerID;
          targetMultiaddr = `/p2p/${targetPeerId}`; // Use multiaddr format to dial directly (assuming DHT/relay can route it)
          console.log(`Selected supernode ${targetPeerId} based on health rank (${bestSupernode.successRate * 100}% success, ${bestSupernode.avgLatencyMs}ms latency)`);
        }
      }

      try {
        if (!appState.p2pNode) throw new Error("No network node");

        const stream = await appState.p2pNode.dialProtocol(
          targetMultiaddr,
          PROTOCOL_DELEGATE
        );

        const requestID = Math.random().toString();
        const res = await requestDelegation(stream, {
          requestID,
          timestamp: Date.now(),
          text
        });

        console.log('Received delegated embedding, verifying signature...');

        let isValid = false;
        try {
          const remoteKey = await getPublicKeyFromPeerId(targetPeerId);
          isValid = await verifySignature(res, remoteKey);
        } catch (verifErr) {
          console.error("Signature verification failed", verifErr);
        }

        if (!isValid) {
          throw new Error('Delegated embedding failed signature verification! Blind trust aborted.');
        }

        console.log('Delegated embedding verified successfully!');
        return res.embedding;
      } catch (err) {
        console.error('Delegation failed:', err);
        throw new Error('Could not compute embedding via delegation');
      }
    }
  };
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

  const embedFn = getEmbeddingHelper();

  channel.distributions = await computeRelationalDistributions(channel, embedFn, appState.tier);

  // If a temporary matching channel was pushed locally, replace it
  const existingIndex = appState.channels.findIndex(c => c.name === name && c.description === description && !c.distributions);
  if (existingIndex >= 0) {
    channel.id = appState.channels[existingIndex].id; // retain the generated ID
    appState.channels[existingIndex] = channel;
  } else {
    appState.channels.push(channel);
    appState.activeChannelId = channel.id;
  }

  await saveChannels();

  if (navigator.onLine) {
    await announceAndDiscover(channel);
  } else {
    await enqueueOfflineAction({ type: 'announce', channelId: channel.id });
  }

  return channel;
}

export async function announceAndDiscover(channel: SavedChannel) {
  if (!navigator.onLine) {
    await enqueueOfflineAction({ type: 'announce', channelId: channel.id });
    return;
  }

  if (!appState.p2pNode || !channel.distributions || channel.distributions.length === 0) return;

  const peerIdStr = appState.p2pNode.peerId.toString();
  if (!appState.rateLimiter.attempt(peerIdStr, 'ANNOUNCE', RATE_LIMITS.ANNOUNCE)) {
    console.warn('Rate limit exceeded for DHT Announce (5/min).');
    return;
  }
  const stateToSave = JSON.stringify(Array.from(appState.rateLimiter.getState().entries()));
  browserStorage.set('isc:ratelimits', stateToSave).catch(e => console.error(e));

  const rootDist = channel.distributions.find((d: any) => d.type === 'root');
  if (!rootDist) return;

  // 1. Generate LSH hashes for the root distribution
  const seed = 'isc_global_seed_v1';
  const hashes = lshHash(rootDist.mu, seed, 5); // 5 hashes for robustness
  const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

  // 2. Announce our presence for each hash
  for (const hash of hashes) {
    try {
      // Model Version Negotiation (Phase 1)
      // We prepend the model hash/id to ensure we only discover peers using the same model
      const modelPrefix = MODEL_ID.replace(/\//g, '_');
      const keyStr = `/isc/match/${modelPrefix}/${hash}`;
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

  const composeTypeChannel = document.getElementById('compose-type-channel') as HTMLInputElement;
  const composeTypeCommunity = document.getElementById('compose-type-community') as HTMLInputElement;
  const composeSpreadContainer = document.getElementById('compose-spread-container');

  if (composeTypeChannel && composeTypeCommunity && composeSpreadContainer) {
    const updateComposeType = () => {
      if (composeTypeCommunity.checked) {
        composeSpreadContainer.style.display = 'none';
      } else {
        composeSpreadContainer.style.display = 'block';
      }
    };
    composeTypeChannel.addEventListener('change', updateComposeType);
    composeTypeCommunity.addEventListener('change', updateComposeType);
  }

  if (btnPublish && inputName && inputDesc && inputSpread && statusEl) {
    btnPublish.addEventListener('click', async () => {
      const name = inputName.value.trim();
      const desc = inputDesc.value.trim();
      const spread = parseInt(inputSpread.value, 10) / 100;
      const isCommunity = composeTypeCommunity ? composeTypeCommunity.checked : false;

      if (!name || !desc) {
        statusEl.textContent = 'Please provide a name and description.';
        return;
      }

      btnPublish.textContent = 'Publishing...';
      (btnPublish as HTMLButtonElement).disabled = true;

      try {
        if (isCommunity) {
          // Create Community Channel
          statusEl.textContent = 'Creating community...';
          // Compute embedding synchronously for community creation since we need it for the object
          let embedding: number[] = [];
          if (appState.tier === 'high' || appState.tier === 'mid') {
            embedding = await browserModel.embed(desc);
          } else {
            embedding = await wordHashFallbackEmbed(desc);
            // In a real implementation we would delegate this
          }

          const { createCommunityChannel } = await import('@isc/core');
          const comm = await createCommunityChannel(appState.keypair!, name, desc, embedding, appState.p2pNode.peerId.toString());

          appState.communityChannels[comm.channelID] = comm;
          await browserStorage.set('isc:community_channels', appState.communityChannels);
          appState.activeChannelId = comm.channelID;

          // Announce community to DHT so others can join
          const key = `/isc/community/${comm.channelID}`;
          const encoded = new TextEncoder().encode(JSON.stringify(comm));
          // Fire and forget
          try {
            const keyBytes = new TextEncoder().encode(key);
            for await (const _ of appState.p2pNode.services.dht.put(keyBytes, encoded)) {}
          } catch(e) {
             console.error("Failed to put community to DHT", e);
          }

          statusEl.textContent = 'Community created!';
        } else {
          // Run channel creation and discovery asynchronously so UI unblocks immediately
          createChannel(name, desc, spread, currentRelations).catch(console.error);
          statusEl.textContent = 'Channel creation started...';

          // Fake immediate local update for responsiveness
          const newId = Math.random().toString(36).substring(2, 10);
          appState.channels.push({
            id: newId,
            name,
            description: desc,
            spread
          });
          appState.activeChannelId = newId;
        }

        // Reset form
        inputName.value = '';
        inputDesc.value = '';
        inputSpread.value = '30';
        currentRelations = [];
        if (contextList) contextList.innerHTML = '';

        renderChannels();

        // Switch back to "Channel" view
        window.switchView('channel');
      } catch (err: any) {
        statusEl.textContent = 'Failed to create channel: ' + err.message;
        console.error(err);
      } finally {
        btnPublish.textContent = 'Publish Channel';
        (btnPublish as HTMLButtonElement).disabled = false;
      }
    });
  }

  const btnJoinCommunity = document.getElementById('btn-join-community');
  const btnCancelJoinCommunity = document.getElementById('btn-cancel-join-community');
  const inputJoinCommunityId = document.getElementById('join-community-id') as HTMLInputElement;
  const joinStatusEl = document.getElementById('join-community-status');

  if (btnJoinCommunity && inputJoinCommunityId && joinStatusEl) {
    btnJoinCommunity.addEventListener('click', async () => {
      const commId = inputJoinCommunityId.value.trim();
      if (!commId) return;

      joinStatusEl.textContent = 'Joining community...';
      (btnJoinCommunity as HTMLButtonElement).disabled = true;

      try {
        // Fetch community from DHT
        const key = `/isc/community/${commId}`;
        const keyBytes = new TextEncoder().encode(key);
        let foundCommData: Uint8Array | null = null;
        for await (const event of appState.p2pNode.services.dht.get(keyBytes)) {
          if (event.name === 'VALUE') {
            foundCommData = event.value;
            break;
          }
        }

        if (foundCommData) {
          const comm = JSON.parse(new TextDecoder().decode(foundCommData));

          // Verify
          // In a real implementation we would check the signature against a known public key

          appState.communityChannels[commId] = comm;
          await browserStorage.set('isc:community_channels', appState.communityChannels);
          appState.activeChannelId = commId;

          // Broadcast CommunityJoinEvent via pubsub
          try {
            if (appState.p2pNode.services && appState.p2pNode.services.pubsub) {
              const { createCommunityJoinEvent } = await import('@isc/core');
              const joinEvent = await createCommunityJoinEvent(appState.keypair!, commId, appState.p2pNode.peerId.toString());
              const topic = `/isc/community/${commId}`;
              const encoded = new TextEncoder().encode(JSON.stringify(joinEvent));
              await appState.p2pNode.services.pubsub.publish(topic, encoded);

              // Also subscribe to the topic to listen for others joining
              appState.p2pNode.services.pubsub.subscribe(topic);
              console.log(`Joined and subscribed to community: ${commId}`);
            }
          } catch (pubsubErr) {
            console.error('Failed to broadcast community join event', pubsubErr);
          }

          joinStatusEl.textContent = 'Joined!';
          renderChannels();
          inputJoinCommunityId.value = '';
          window.switchView('channel');
        } else {
          joinStatusEl.textContent = 'Community not found in DHT.';
        }
      } catch (err: any) {
        joinStatusEl.textContent = 'Error: ' + err.message;
      } finally {
        (btnJoinCommunity as HTMLButtonElement).disabled = false;
      }
    });

    if (btnCancelJoinCommunity) {
      btnCancelJoinCommunity.addEventListener('click', () => {
        inputJoinCommunityId.value = '';
        joinStatusEl.textContent = '';
        window.switchView('channel');
      });
    }
  }

  const btnPostInline = document.getElementById('btn-publish-post-inline');
  const inputPostInline = document.getElementById('compose-post-input') as HTMLInputElement;
  const inputPostIpfs = document.getElementById('compose-post-ipfs') as HTMLInputElement;

  if (btnPostInline && inputPostInline) {
    btnPostInline.addEventListener('click', async () => {
      if (!appState.keypair || !appState.p2pNode) {
        alert("Initializing node, please wait...");
        return;
      }
      const desc = inputPostInline.value.trim();
      const ipfsLink = inputPostIpfs ? inputPostIpfs.value.trim() : '';

      if (!desc) {
        return;
      }

      if (desc.length > 280) {
        alert("Post exceeds the 280-character limit.");
        return;
      }

      btnPostInline.textContent = 'Posting...';
      (btnPostInline as HTMLButtonElement).disabled = true;

      try {
        const embedFn = getEmbeddingHelper();
        const embedding = await embedFn(desc);

        const peerId = appState.p2pNode.peerId.toString();
        const post = await createSignedPost(
          appState.keypair!,
          peerId,
          desc,
          'temp-id',
          embedding,
          86400000,
          undefined,
          undefined,
          ipfsLink || undefined
        );

        const isOffline = !navigator.onLine;
        post.isPending = isOffline;

        // Add to our own stream locally
        appState.receivedPosts.unshift(post);
        renderRecentPosts();

        // Reset form immediately for optimistic feel
        inputPostInline.value = '';
        if (inputPostIpfs) inputPostIpfs.value = '';

        if (isOffline) {
          await enqueueOfflineAction({ type: 'post', post });
          console.log('Post queued for offline sync.');
        } else {
          // 1. Announce to DHT
          try {
            const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
            const keys = getPostDHTKeys(post.embedding, MODEL_ID, 5);

            const postBytes = new TextEncoder().encode(JSON.stringify(post));
            let announceCount = 0;

            for (const keyStr of keys) {
              try {
                const keyBytes = new TextEncoder().encode(keyStr);

                // libp2p kad-dht operates on the .services.dht object for general put/get
                if (appState.p2pNode.services && appState.p2pNode.services.dht) {
                  // dht.put returns an AsyncGenerator, so we must iterate it to execute it
                  for await (const _event of appState.p2pNode.services.dht.put(keyBytes, postBytes)) {
                    // Just draining the generator
                  }
                  announceCount++;
                } else {
                  console.warn('DHT service not found on node');
                }
              } catch (e) {
                console.warn(`Failed to announce post to DHT for key ${keyStr}`, e);
              }
            }
            console.log(`Announced post to DHT successfully (${announceCount} shards).`);
          } catch (dhtErr) {
            console.error('DHT Announcement failed', dhtErr);
          }

          // 2. Broadcast to all connected peers for immediate propagation
          const connections = appState.p2pNode.getConnections();
          let sentCount = 0;
          for (const conn of connections) {
            try {
              const stream = await appState.p2pNode.dialProtocol(conn.remotePeer, PROTOCOL_POST);
              await sendPostMessage(stream, post);
              sentCount++;
            } catch (e) {
              console.warn(`Failed to send post to ${conn.remotePeer.toString()}`);
            }
          }
          console.log(`Post published to ${sentCount} peer(s)!`);
        }

      } catch (err: any) {
        console.error('Failed to broadcast post:', err);
      } finally {
        btnPostInline.textContent = 'Post';
        (btnPostInline as HTMLButtonElement).disabled = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Register service worker
  registerSW({ immediate: true });

  // Initialize the ISC core modules
  initISC().then(() => {
    // Setup follow/unfollow pubsub handler
    if (appState.p2pNode) {
      const topic = `/isc/follow/${appState.p2pNode.peerId.toString()}`;
      appState.p2pNode.services.pubsub.subscribe(topic);

      // Subscribe to joined communities
      Object.keys(appState.communityChannels).forEach(commId => {
         const commTopic = `/isc/community/${commId}`;
         appState.p2pNode.services.pubsub.subscribe(commTopic);
      });

      appState.p2pNode.services.pubsub.addEventListener('message', async (message: any) => {
        if (message.detail.topic.startsWith('/isc/community/')) {
          try {
            const str = new TextDecoder().decode(message.detail.data);
            const event = JSON.parse(str);
            if (event.type === 'community_join') {
              const remoteKey = await getPublicKeyFromPeerId(event.peerID);
              if (await verifySignature(event, remoteKey)) {
                console.log(`Received verified community join from ${event.peerID} for ${event.channelID}`);
                const comm = appState.communityChannels[event.channelID];
                if (comm) {
                  if (!comm.members) comm.members = [];
                  if (!comm.members.includes(event.peerID)) {
                    comm.members.push(event.peerID);
                    await browserStorage.set('isc:community_channels', appState.communityChannels);
                    if (appState.activeChannelId === event.channelID) {
                       renderChannels();
                    }
                  }
                }
              }
            }
          } catch(e) {
            console.error("Failed to process community event via pubsub", e);
          }
          return;
        }

        if (message.detail.topic !== topic) return;
        try {
          const decoder = new TextDecoder();
          const str = decoder.decode(message.detail.data);
          const event: FollowEvent = JSON.parse(str);

          const remoteKey = await getPublicKeyFromPeerId(event.follower);
          if (await verifySignature(event, remoteKey)) {
             console.log(`Received ${event.type} event from ${event.follower}`);
             // We could store followers here if we wanted to show follower lists
             // For now, this just proves the pubsub connection is working
          }
        } catch(e) {
          console.error("Failed to process follow event via pubsub", e);
        }
      });
    }

    renderChannels();

    // Periodically fetch posts for the active channel's "For You" feed
    setInterval(() => {
      if (appState.activeChannelId) {
        fetchForYouFeed();
      }
    }, 10000);

    // Periodically clean up rate limiter memory and persist state
    setInterval(() => {
      appState.rateLimiter.cleanup();
      const stateToSave = JSON.stringify(Array.from(appState.rateLimiter.getState().entries()));
      browserStorage.set('isc:ratelimits', stateToSave).catch(e => console.error(e));
    }, 60 * 1000);
  });

  setupCompose();

  const searchInput = document.getElementById('discover-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderDiscoverTab();
    });
  }

  // Delegation Settings Toggle UI logic
  const delegationToggle = document.getElementById('settings-allow-delegation') as HTMLInputElement;
  if (delegationToggle) {
    delegationToggle.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      appState.allowDelegation = target.checked;
      await browserStorage.set('isc:settings:delegation', appState.allowDelegation);

      // We don't dynamically un-handle PROTOCOL_DELEGATE in Phase 1 for simplicity,
      // they'll need to refresh. But we save the intent for the next load.
      console.log(`Delegation allowed set to: ${appState.allowDelegation}. Restart app for changes to take effect.`);
    });
  }

  // Match Mode Select UI logic
  const matchModeSelect = document.getElementById('settings-match-mode') as HTMLSelectElement;
  if (matchModeSelect) {
    matchModeSelect.value = appState.semanticMatchMode;
    matchModeSelect.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      appState.semanticMatchMode = target.value as 'monte_carlo' | 'analytic';
      await browserStorage.set('isc:settings:matchMode', appState.semanticMatchMode);
      console.log(`Semantic Match Mode set to: ${appState.semanticMatchMode}`);
      // Re-render matches if we have an active channel
      if (appState.activeChannelId) {
         renderChannels();
      }
    });
  }

  // Test match UI logic
  const testBtn = document.getElementById('btn-test-match');
  if (testBtn) {
    testBtn.addEventListener('click', computeTestMatch);
  }

  // Feed tabs logic
  const tabForYou = document.getElementById('tab-for-you');
  const tabFollowing = document.getElementById('tab-following');

  if (tabForYou && tabFollowing) {
    tabForYou.addEventListener('click', () => {
      appState.activeFeed = 'for-you';
      tabForYou.classList.add('active');
      tabForYou.style.color = 'var(--text-primary)';
      tabForYou.style.fontWeight = 'bold';

      tabFollowing.classList.remove('active');
      tabFollowing.style.color = 'var(--text-secondary)';
      tabFollowing.style.fontWeight = 'normal';

      renderRecentPosts();
    });

    tabFollowing.addEventListener('click', () => {
      appState.activeFeed = 'following';
      tabFollowing.classList.add('active');
      tabFollowing.style.color = 'var(--text-primary)';
      tabFollowing.style.fontWeight = 'bold';

      tabForYou.classList.remove('active');
      tabForYou.style.color = 'var(--text-secondary)';
      tabForYou.style.fontWeight = 'normal';

      renderRecentPosts();
    });
  }

  // IRC-style view switching
  const views = document.querySelectorAll('.pane-view');

  const switchView = function(viewId: string) {
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
    }
  };
  window.switchView = switchView;

  document.getElementById('btn-show-compose')?.addEventListener('click', () => switchView('compose'));
  document.getElementById('btn-show-join-community')?.addEventListener('click', () => switchView('join-community'));
  document.getElementById('btn-show-settings')?.addEventListener('click', () => switchView('settings'));
  document.getElementById('btn-show-test')?.addEventListener('click', () => switchView('test'));
  document.getElementById('btn-show-profile')?.addEventListener('click', () => {
     if (appState.p2pNode) {
        fetchAndRenderProfile(appState.p2pNode.peerId.toString());
     }
  });

});

declare global {
  interface Window {
    switchView: (viewId: string) => void;
  }
}
