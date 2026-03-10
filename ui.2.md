# ISC — UI Specification v2

> **Scope**: Complete use-case and interaction model for ISC across all phases, form factors, and deployment contexts. This is the single source of truth for every user-facing decision. Implementations must not deviate without updating this document.
>
> **Philosophy**: ISC is infrastructure for thought. It routes meaning, not traffic. Every pixel must serve that mission — helping minds find each other efficiently, safely, and with dignity.

---

## Design Philosophy

Ten principles that must govern every screen, interaction, copy string, and animation:

| # | Principle | UI implication |
|---|---|---|
| 1 | **Thought-first, identity-second** | Channels are the primary unit. Profiles emerge from channels, not the reverse. Discovery starts from ideas. |
| 2 | **Privacy as default physics** | Vectors travel; raw text stays local. The user must take explicit action to make anything legible beyond their device. |
| 3 | **Radical transparency** | Similarity scores, match reasons, connection paths, and reputation sources are always inspectable. No black-box ranking. |
| 4 | **Progressive disclosure** | The zero-config path works. Complexity (relations, chaos, delegation, ZK, tips) surfaces only when contextually relevant. |
| 5 | **Graceful degradation as design** | Every state — no model, no peers, offline, minimal hardware — has a complete, non-broken appearance and a clear path forward. |
| 6 | **Serendipity by geometry** | Unexpected connections are the product, not a bug. The UI must create space for surprise without manufacturing it artificially. |
| 7 | **Dignity-preserving exits** | Users can leave any conversation, community, or network without confrontation. Drift is natural; silence is not suspicious. |
| 8 | **Explainability without math** | Every algorithmic decision has a plain-English reason visible one tap away. Scores are shown; formulas are documented but hidden. |
| 9 | **Interoperability over lock-in** | Data exports, AT Protocol bridges, and open key formats are first-class features, not afterthoughts. |
| 10 | **Civilization-scale humility** | The UI must work for a researcher in Oslo, a farmer in Nigeria, an activist in Tehran, and a student on a 2G connection. No user is a second-class citizen. |

---

## Global State Model

Every view inherits this state. The persistent status bar shows the *least favorable* active state.

| State | Status bar glyph | Description |
|---|---|---|
| **Bootstrapping** | ⟳ grey | App shell loading; keypair restoring or generating |
| **Model Loading** | ⬇ animated | Embedding model downloading; shows MB/MB + ETA |
| **Connecting** | ◌ pulsing | Joining DHT; reaching bootstrap peers |
| **Idle** | ○ white | Connected; no active channels |
| **Announcing** | ● green pulsing | ≥1 channel active; DHT puts in flight |
| **Matching** | ◎ teal | Query running; candidates ranked |
| **Chatting** | ⬡ blue | ≥1 open WebRTC stream |
| **Supernode Active** | ★ gold | Serving delegation requests to peers |
| **Degraded** | △ amber | Minimal-tier or delegation-failed fallback |
| **Offline** | ✕ red | No network; actions queued |
| **Rate Limited** | ⏸ orange | Self-throttled; countdown to window reset |
| **Low Power** | 🔋 amber | Battery ≤ 20% or OS low-power mode active; background activities paused |
| **Strict Mode** | 🛡 blue | Inbound WebRTC connections paused; outbound discovery continues |

**Status bar debounce rules**: Transient states (Connecting, Matching, Rate Limited) are suppressed for the first **2 seconds** before appearing; this prevents anxious flickering during normal operation. Low Power and Strict Mode are displayed immediately and persistently until resolved.

---

## Screen Map

```
App Shell
├── 1.  Bootstrap / Onboarding
├── 2.  Channel List  (Home)
├── 3.  Channel Editor
├── 4.  Match Explorer
│       ├── 4a. Match List
│       ├── 4b. Peer Card
│       ├── 4c. Semantic Map (2D)
│       └── 4d. Thought Bridge
├── 5.  Chat
│       ├── 5a. 1:1 Chat
│       ├── 5b. Group Chat
│       ├── 5c. Direct Message (DM)
│       └── 5d. Video Call  [Phase 3]
├── 6.  Social Feed
│       ├── 6a. For You
│       ├── 6b. Following
│       └── 6c. Global Explore / Trending
├── 7.  Post Composer
├── 8.  Post Detail / Thread
├── 9.  Profile
│       ├── 9a. Own Profile
│       └── 9b. Peer Profile
├── 10. Communities
│       ├── 10a. Community List
│       ├── 10b. Community Channel
│       ├── 10c. Audio Space
│       └── 10d. Community Governance  [Phase 4]
├── 11. Places  (Idea Boards)  [Phase 3]
├── 12. Search
├── 13. Notifications
├── 14. Lightning Tips Wallet  [Phase 3]
├── 15. Model Registry  [Phase 2]
├── 16. AT Protocol Bridge  [Phase 4]
├── 17. DAO Governance  [Phase 4]
├── 18. Enterprise Admin  [Phase 4]
├── 19. Settings
│       ├── 19a. Identity & Keys
│       ├── 19b. Privacy
│       ├── 19c. Matching
│       ├── 19d. Delegation & Supernode
│       ├── 19e. Network
│       ├── 19f. Notifications
│       ├── 19g. Appearance & Accessibility
│       └── 19h. Developer / Debug
└── 20. CLI / Node Operator Dashboard
```

---

## 1. Bootstrap / Onboarding

### 1.1 First Launch (no keypair)

**Step 1 — Welcome**
Full-screen: ISC wordmark, tagline *"Meet your thought neighbors."*, **Get Started** button.

**Step 2 — Capability probe** (silent, < 200 ms)
Reads `hardwareConcurrency`, `deviceMemory`, `connection.effectiveType`. Selects tier. Shown as a single line: *"Your device: High tier — full semantic matching."* Low/Minimal: *"Limited device — a helper node will assist."*

If `saveData === true` or `effectiveType === '2g'`, model download is auto-deferred and a banner is shown throughout onboarding.

**Step 3 — Identity**
`crypto.subtle.generateKey('Ed25519')` runs. Subtle spinner. Completion: *"Your identity is ready. No account, no email, no password."*
Optional: Set a passphrase to encrypt the private key at rest. Skippable (recommended for high-risk users only; explained in plain language).

**Step 4 — Model**
Shows: model name (`all-MiniLM-L6-v2`), size (22 MB), estimated time on current connection.
- **Download now** (default on Wi-Fi)
- **Download when on Wi-Fi** (auto-queued)
- **Skip — use limited matching** (word-hash mode; permanently banner-noted)

**Step 5 — First channel prompt**
*"What are you thinking about right now?"* — large text box. No pressure to be precise. Placeholder examples cycle: *"Fermentation and microbiology…"*, *"Byzantine fault tolerance…"*, *"The ethics of large language models…"*
**→ Create my first channel** skips to Channel Editor pre-filled.
**→ Explore first** lands on Channel List (empty state) with tutorial overlay.

**Step 6 — Optional invite join**
If URL has `?peer=<peerID>&relay=<relayURL>`: skip cold-start; auto-connect to inviting peer; show *"Invited by [peerID]. Connecting…"*

### 1.2 Context-Aware Onboarding Modes

The URL param `?mode=<mode>` tailors copy and defaults:

| Mode | Entry point | Defaults changed | Example |
|---|---|---|---|
| `event` | Conference QR code | Channel pre-filled from URL param; `in_location` + `during_time` auto-added | NeurIPS attendees |
| `community` | Community invite link | Channel imported from community descriptor; auto-joins community | Private research group |
| `private` | Shared bootstrap list | Custom bootstrap peers pre-loaded; no public DHT | Enterprise / activist cell |
| `supernode` | Operator invite | Supernode mode pre-enabled; skips channel creation | Server operators |
| `import` | New device | Lands on Import Identity flow immediately | Key migration |

### 1.3 Returning User

1. Keypair and channels restored from IndexedDB / localStorage.
2. If offline > 5 min since last session: cache warming (re-announce, re-query, refresh mutes). Status shows *"Syncing…"*
3. If model update available: migration banner (see §15, Model Registry).
4. → Channel List (active state).

### 1.4 Import Identity (New Device)

**Methods** (shown as a method picker with icons):
- **QR code** — camera scans encrypted keypair blob.
- **File** — paste/upload `.isc-identity.json`.
- **Social recovery** — assemble from Shamir shards (K=3 of N=5). Each trusted peer provides their shard via a share link; shards are combined locally.
- **Hardware key** (Phase 4) — WebAuthn / YubiKey.

After import: passphrase prompt → keypair decrypted → channels re-queried from DHT → lands on Channel List.

### 1.5 Pair Device / Multi-Device Sync (Phase 2+)

**Problem addressed**: Chat history, drafts, and Places are stored in local IndexedDB and do not automatically transfer across devices. A user importing their keypair to a laptop will have their identity but none of their local content.

**Entry**: Settings → Identity & Keys → **Pair Device** · OR first-run prompt on a device that has just imported a keypair: *"Sync content from your other device? [Pair now] [Skip]"*

**Pairing flow**:
1. **Primary device** (source): Settings → Identity & Keys → Pair Device → **Show pairing QR**. A QR code is displayed encoding a one-time WebRTC offer (signed with the keypair).
2. **Secondary device** (destination): Settings → Identity & Keys → Pair Device → **Scan to receive**. Camera scans the QR; a direct WebRTC connection is established over the local network or via relay.
3. **Content negotiation**: Primary sends a manifest (item types + last-modified timestamps). Secondary shows: *"Found 12 channels, 342 messages, 8 drafts, 2 Places. [Sync all] [Choose what to sync]"*
4. **Transfer**: encrypted WebRTC data channel; progress bar with per-category counts. Encrypted with the shared keypair — no plaintext leaves the browser.
5. **Completion**: *"Sync complete. All content is now available on this device."*

**Ongoing sync** (Phase 2+): Devices with the same keypair can maintain an opt-in background sync channel (persistent WebRTC connection or periodic re-pair). New messages, drafts, and Place edits propagate within ~5 seconds. Conflicts resolved by LWW (last-write-wins) with a 1-second granularity.

**Manual sync**: If two devices are on the same LAN, ISC can auto-discover via mDNS and prompt: *"Found your other device on this network. Sync now? [Yes] [Not now]"*

**What does NOT sync**: Keypairs are never re-transmitted after pairing (they were already identical). The model file is re-downloaded independently on each device (too large to tunnel efficiently).

---

## 2. Channel List (Home)

The root screen. A **channel** is a named, embedded thought context: description + spread (σ) + up to 5 relation tags.

### 2.1 Visual States

| State | What the user sees |
|---|---|
| **Empty** | Hero prompt: *"Describe what you're thinking about."* · Large **+ New** button · Tutorial link |
| **Searching** | Each active channel has a subtly pulsing teal ring; *"Searching…"* label |
| **Matches found** | Match count badge (green for ≥0.85, teal for ≥0.70, grey for ≥0.55) |
| **Model loading** | Thin progress bar across top; channels show pending state |
| **Offline** | All badges grey; offline banner; queue depth shown |
| **Degraded** | Amber △ on affected channels; tap for explanation |
| **Low Power** | Persistent amber banner: *"🔋 Low battery — background matching paused. [Resume]"* All background DHT polling and Supernode serving paused automatically. Outbound queries only on manual refresh. |
| **Strict Mode** | Persistent blue banner: *"🛡 Strict mode on — inbound connections paused."* Tap to disable. Channels still announce; outbound Dial still works; all unsolicited inbound WebRTC dials are rejected with no indication to the caller. |

### 2.2 Channel Card

Each card (comfortable mode) shows:

```
┌──────────────────────────────────────────────────────┐
│ ● AI Ethics              [3 nearby · 5 orbiting] [▶] │
│ "Ethical implications of machine learning and…"      │
│ 📍 Tokyo  🕓 2026  🎭 reflective        σ ●●○○○      │
│ Last match: 2 min ago                     [⏸ pause]  │
└──────────────────────────────────────────────────────┘
```

- **●/○ indicator**: green = announcing, grey = paused.
- **σ meter**: 5-dot fuzziness indicator.
- **Relation pills**: up to 3 shown; "+2" overflow chip.
- **[▶]**: quick-jump to Match Explorer.

### 2.3 Channel Actions

| Action | Gesture / control | Behavior |
|---|---|---|
| Open Match Explorer | Tap card body | Navigate to §4 for that channel |
| Pause / resume | Tap ⏸ / ▶ toggle | Stops/starts DHT announcements; embed preserved |
| Create | + FAB (bottom right) | Opens §3 Channel Editor (create mode) |
| Edit | Long-press → Edit / swipe-right | Opens §3 (edit mode) |
| Fork | Long-press → Fork | New channel, same description; independent announce |
| Duplicate as template | Long-press → Template | Saves as reusable template (no announce) |
| Archive | Swipe-left → Archive | Hidden from list; TTL expires; recoverable |
| Delete | Swipe-left → Delete | Confirm dialog; removes from localStorage |
| Reorder | Long-press → drag | Persisted order |
| Share channel | Long-press → Share | Generates invite link / QR pre-filling channel on join |

### 2.4 Limits & Enforcement

- **5 active channels maximum** (UI blocks 6th activation with explanation).
- Archived channels don't count. Templates don't count.
- If user has 5 active and tries to create a new one: *"Deactivate or archive one channel first."* — shows list of active channels with checkboxes.

### 2.5 Channel Templates

Pre-built starting points shown on empty state and in the editor:

| Template | Description seed |
|---|---|
| **Current research** | *"My research in [field], focusing on [specific question]"* |
| **Local scene** | *"What's happening in [city] around [topic]"* |
| **Open question** | *"I'm trying to understand why [phenomenon]"* |
| **Looking for collaborators** | *"Working on [project type] and looking for people who…"* |
| **Emotional space** | *"Feeling [mood] and thinking about [topic]"* |

---

## 3. Channel Editor

### 3.1 Fields

| Field | Type | Constraints | Notes |
|---|---|---|---|
| **Name** | Text | ≤ 50 chars | Display label; not embedded. Required. |
| **Description** | Multiline text | No hard limit (embedding handles length well) | The semantic payload. Required. |
| **Spread (σ)** | Slider | 0.0–0.3 | Default 0.1. Tooltip: *"Higher = fuzzier; more serendipitous but less precise."* |
| **Relations** | Section | 0–5 tags | Each tag: tag picker + object field + optional weight |
| **Visibility** | Radio | Public / Ephemeral / Silent | Ephemeral: rotates peer ID per session. Silent: receive-only. |

### 3.2 AI-Assisted Description

> **Technical note**: The primary embedding model (`all-MiniLM-L6-v2`) is **encoder-only** — it produces vector representations but cannot generate text. Two implementation paths are offered:

**Path A — Keyword extraction (default, no extra download)**: Uses the embedding model's tokenizer vocabulary to surface the top 10–15 concept terms that are closest to the current description's embedding. Shown as a tag cloud; user taps tags to incorporate them into their description. Copy: *"Key concepts detected from what you've written — tap to add them."* This requires zero additional model weight.

**Path B — Local generative AI (optional, ~1–2 GB download)**: If the user has downloaded an optional quantized decoder model (e.g., TinyLlama-1.1B-Q4 or Phi-2-Q4), the **Write with AI** button activates full prose generation: generates 3 candidate descriptions from a brief free-text prompt. Download prompt appears on first tap of the button: *"Full AI suggestions require an additional 1.2 GB model. Download now? (Wi-Fi recommended) [Download] [Use keywords instead]"*

Path A is the default experience. Path B is surfaced as an upgrade prompt. Both run entirely locally; nothing is sent to any server. Copy on both: *"Generated on your device — not sent anywhere."*

### 3.3 Relation Tag Builder

For each relation slot:

**Tag picker** — labeled dropdown with icon, plain-English label, and one-line example:

| Tag | Label | Icon | Example object |
|---|---|---|---|
| `in_location` | Place | 📍 | `lat:35.68, long:139.69, radius:50km` or city name |
| `during_time` | Time | 🕓 | Date range picker → ISO 8601 string |
| `with_mood` | Mood | 🎭 | `reflective and cautious` |
| `under_domain` | Domain | 🏷 | `machine learning, philosophy` |
| `causes_effect` | Causes | ⚡ | `automation → job displacement` |
| `part_of` | Part of | 🧩 | `ethics → philosophy` |
| `similar_to` | Analogous to | 🔗 | `neural networks → brain synapses` |
| `opposed_to` | In tension with | ↔ | `centralization ↔ decentralization` |
| `requires` | Requires | 🔑 | `training → labeled data` |
| `boosted_by` | Amplified by | 🚀 | `community feedback → model improvement` |

**Object input**:
- `in_location`: map picker (tap on a map) *or* text field (`city, country` auto-geocoded) *or* lat/long manual entry. Radius slider (1–500 km).
- `during_time`: date-range picker (calendar widget). Outputs ISO 8601.
- All others: free text.

**Weight** (Advanced, collapsed by default): `0.1–3.0`, default 1.0.

**+ Add relation** button; appears up to 5 times; greyed beyond limit.

### 3.4 Live Embedding Preview

As the user types the description:
- **Semantic preview strip**: shows 2–3 sample concepts the embedding captures (generated from the embedding model's nearest vocabulary words to the embedding centroid). E.g., *"Your channel is close to: AI safety · algorithmic accountability · machine ethics"*.
- **Distance to own channels**: shows cosine similarity between the draft channel and each of the user's existing channels. Helps users understand channel diversity.
- **Estimated match quality**: *"Based on current network activity, expect ~8 nearby peers."* (derived from DHT density in the LSH bucket — not a guarantee).

### 3.5 Actions

| Action | Behavior |
|---|---|
| **Save & Activate** | Embeds (or delegates), announces to DHT, navigates to Match Explorer |
| **Save Draft** | Persists to IndexedDB without activating |
| **Save as Template** | Saves to template library; not announced |
| **Preview matches** | Runs a DHT query without announcing; shows candidates read-only |
| **Cancel** | Confirm dialog if unsaved changes |

---

## 4. Match Explorer

The core discovery view for one channel. Shows who is semantically nearby.

### 4.1 Match List

**Header bar**: channel name · spread glyph · announcing indicator (pulsing ●) · List/Map/Thought-Bridge toggle.

**Controls row** (collapsible; shows summary when collapsed):
- **Threshold slider** 0.30–0.95 (default 0.55). Live-filtered; no reload.
- **Sort**: Similarity ▾ · Freshness · Mutual relations · Reputation (Phase 2+).
- **Filter by relation tag**: multi-select chip row. Hides peers lacking selected tags.
- **Chaos dial**: 0.0–0.3 perturbation for serendipity. On change: reruns sampling, does not re-query DHT.
- **Refresh ⟳**: manual re-query (auto-refreshes per tier schedule).
- **Fuzzy anonymity toggle** (Phase 3): hides peer IDs entirely; shows only similarity + relation overlap.

**Match entries**:

```
┌────────────────────────────────────────────────────────────────┐
│  0.91  Very Close   QmX4…a9f2   📍 Tokyo  🕓 2026            │
│        [Dial ▶]  [Profile]  [Follow]  [⋯ more]               │
├────────────────────────────────────────────────────────────────┤
│  0.74  Nearby       QmY7…b3c1   🏷 ML  ↔ Centralization      │
│        [Dial]  [Profile]  [Follow]  [⋯]                       │
├────────────────────────────────────────────────────────────────┤
│  0.58  Orbiting ↓  QmZ2…e8d4   🔗 neural nets               │
│        (tap to expand → [Dial] [Profile] [More])              │
└────────────────────────────────────────────────────────────────┘
```

- 0.85+: **Very Close** — bright dial CTA; auto-dial prompt available.
- 0.70–0.85: **Nearby** — standard Dial button.
- 0.55–0.70: **Orbiting** — row collapsed by default; tap to expand.
- < 0.55: hidden by default; *"Show distant peers"* toggle at bottom.
- **⋯ more**: Mute · Block · Report · Copy peer ID · ZK verify (Phase 4).

**Group chat formation CTA**: when 3+ "Very Close" peers are simultaneously online, a banner appears: *"Dense cluster detected — [Start group chat]"*.

**Empty state variants**:

| Condition | Message | Auto-action |
|---|---|---|
| No peers, model loaded | *"No thought neighbors yet. Your presence is propagating."* | After 30 s, auto-expand threshold by 0.10 and re-query; show *"Expanding search…"* |
| No peers after expansion | *"Still nothing. Broadening to general topics…"* | Silently drop threshold by another 0.10 and re-query with σ+0.05 |
| No peers, sparse network | *"[N] peers are active on the network — none close to your channel yet."* + **[Show Global Pulse]** CTA | Global Pulse shows a random sample of 10 currently-active channels to prove the network is alive |
| No peers, word-hash mode | *"Using keyword matching (no model loaded). Connect to Wi-Fi for semantic matching."* | — |
| All below threshold | *"All peers are below your threshold. Lower it to see more, or enable Chaos mode."* | Show threshold slider inline in the empty state card |
| Offline | *"Offline — showing last known matches."* Greyed list with timestamps. | — |

**Global Pulse panel** (triggered from the empty state CTA above): a read-only scrollable list of 10 random currently-active channel *descriptions* (no peer IDs) sampled from the DHT. Each shows its topic and how many peers are active in that neighborhood. Tapping one opens a Channel Editor pre-seeded with that description as inspiration. Copy at top: *"The network is alive — here's what people are thinking about right now."*

### 4.2 Peer Card (Detail Sheet)

Slides up from bottom (sheet modal) when a match entry is tapped.

**Content**:
- **Similarity breakdown table**: Root score, + each fused relation score (labeled), = total.
- **Relation comparison**: two-column table — "Your channel" ↔ "Their channel" — for each matched relation.
- **Explainability sentence**: *"You both described interest in AI ethics in Tokyo during 2026 with a reflective mood."* (auto-generated from matched relation tags).
- **Reputation meter** (Phase 2+): 0–1 bar; tooltip: *"Built from X mutual interactions, decaying over 30 days."*
- **Uptime badge** (if supernode): *"Serving for 96 hours · 98% success rate."*
- **ZK proximity proof** (Phase 4): *"This peer has proven their similarity > 0.70 without revealing their vector."* — verify button.

**Actions** (bottom of sheet): **Dial Chat** · **Video Call** (Phase 3) · **View Profile** · **Follow** · **Suggest Bridge** · **Mute** · **Report** · **Block**.

### 4.3 Semantic Map (2D View)

Toggle from list via header icon. A 2D projection (random-projection PCA fallback, or UMAP-lite if available) of all current candidates.

- **Own channel** plotted at center as a large ◉.
- **Peer dots**: colored by tier (green/teal/grey); size scales with reputation (Phase 2+).
- **Hover / long-press on dot**: shows peer ID + similarity tooltip.
- **Tap dot**: opens Peer Card.
- **Pinch-zoom, drag-pan**.
- **Distribution rings**: translucent rings at σ radius around own channel showing the spread boundary.
- **Chaos ghost**: when Chaos dial > 0, show a transparent "ghost" of the perturbed channel position alongside the true position.
- **Cluster outlines**: when 3+ peers are within 0.85 pairwise similarity, a dashed convex hull outlines the potential group.
- **Relation-filtered overlay**: when a relation tag filter is active, dim all peers lacking that tag.
- **Label toggle**: show/hide peer ID labels (default hidden for clean view).

### 4.4 Thought Bridge

Dedicated view (3rd toggle in header). Takes the user's channel embedding and the selected peer's embedding and surfaces connection points.

**Content**:
- **Bridge statement**: *"Your interest in AI ethics and their focus on algorithmic accountability are 91% semantically aligned. Suggested opening: 'How do you think about accountability frameworks in AI deployment?'"*
- **3 conversation starters**: ranked by geometric proximity between the two embeddings. Tap to copy to clipboard or auto-fill chat input.
- **Conceptual crossover words**: the top 10 vocabulary words nearest the midpoint of the two embeddings (uses model tokenizer vocabulary). E.g., *"fairness, transparency, bias, accountability, governance, autonomy, oversight…"*
- **Bridge graph**: tiny 2-point vector projection showing the midpoint and both vectors. Purely visual.

Computation is entirely local (no API). Uses the loaded embedding model's vocabulary projection.

---

## 5. Chat

### 5.1 1:1 Chat

**Entry**: Dial from Match Explorer or Peer Card.

**Header**: ← back · peer ID (abbreviated) · similarity badge (live-updating if both peers remain active) · connection path icon (direct / relay) · latency ms · ⋯ menu.

**⋯ menu options**: View Profile · Invite to Group · Video Call (Phase 3) · Mute · Report · Block · End Chat.

**Message bubbles**:
- Own: right-aligned, filled.
- Peer: left-aligned, outlined.
- Each: timestamp (relative → absolute on tap) · signature verified icon (✓ green / ⚠ red).
- Tampered messages: red banner *"Warning: this message failed signature verification."* No auto-removal — user decides.

**Ephemeral mode** (toggle in ⋯ menu): messages marked `ephemeral: true`; both sides delete on session end. Banner in header: *"Ephemeral — messages deleted on close."*

**Typing indicator**: peer's "thinking" animation shown when incoming stream has an in-flight message.

**Input area**:
- Multiline text field.
- **Send** button (→) or Enter key.
- **Emoji** picker.
- **Attach** (Phase 3): image/video/audio via IPFS drag-in or file picker.
- **Thought Bridge suggestion**: if enabled in Settings, a ghost-text prompt appears in the input field derived from the §4.4 bridge computation. Tap to adopt; press any key to dismiss.

**Connection state banners** (in-chat, dismissible):
- *"Connecting via relay — slightly higher latency."*
- *"Connection lost — retrying (attempt 2 of 3)…"*
- *"Peer's similarity has dropped to 0.38. [Continue] [End chat]"*
- *"Rate limit: cannot dial this peer again for 15 min."*

**Drift exit protocol**: when ongoing similarity drops below 0.55, a non-intrusive card appears at the bottom of the thread: *"Your thoughts seem to be drifting apart. This chat will continue unless you end it."* [End gracefully] [Keep going]. Not a forced exit.

### 5.2 Group Chat

**Entry**: auto-formation when 3+ peers reach pairwise ≥ 0.85 (highest peerID initiates); or manual invite from 1:1 chat header.

**Header**: Group · member count · centroid similarity · member list icon · ⋯.

**Member panel** (collapsible sidebar or sheet):
- Each member: abbreviated peer ID · similarity to centroid · leaving indicator (greyed dot when < 0.55 with drift note).
- Tap member → Peer Card.
- Members > 8: *"Observer mode: you can read but not send."*
- **Bandwidth scaling**: as group size grows, the UI progressively drops: typing indicators (off at ≥5 members); video thumbnails (off at ≥4 in video mode); read receipts (off at ≥3). A subtle badge shows what has been disabled: *"⚡ Reduced for performance"*. This prevents mesh WebRTC from saturating bandwidth before reaching the 8-participant observer threshold.

**Invitation toast**: *"QmX… invited you to a group (similarity 0.91, 4 members). [Join] [Decline]"*

**Latecomer join**: share the group's `roomID` (shown in header menu → *"Invite to group"*) as a link. Recipient opens link → lands on group join confirmation → WebRTC mesh dial.

**Group moderation** (co-initiated; no owner with special power):
- Any member can propose to remove another; majority accept (> 50% of current members) → target receives graceful exit message; their stream is dropped.
- Leaving: tap ← + *"Leave group"* — no notification to group; chat continues without you.

### 5.3 Direct Messages (DMs)

**Entry**: Peer Profile → Message; post action → DM; new chat icon.

**DM list screen** (accessible from navigation): shows all DM threads sorted by last activity. No content preview (privacy). Badge shows unread count.

**DM thread**: Identical to 1:1 chat. Header shows E2E badge (🔒) always. Content encrypted via libsodium sealed box before leaving the browser; decrypted client-side on receipt.

**Group DMs**: Created from member list (pick ≥2 peers) or from community. Functionally identical to group chat, but without the semantic auto-formation logic; invited by peer ID directly.

**Message delivery states**: Sent (→) · Delivered (→→) · Read (→→ filled) — only if both peers support the ACK protocol. Read state is local; never announced to DHT.

### 5.4 Video Call (Phase 3)

**Entry**: Peer Card → Video Call; 1:1 chat header → 🎥.

**UI**:
- Full-screen video; own camera inset (draggable corner).
- Bottom bar: Mute mic · Camera on/off · Screen share · Invite to group call · Hang up.
- Similarity badge persists in top-right corner (live).
- Text chat sidebar (toggleable): same channel as 1:1 DM thread; continues after call.

**Connection**: WebRTC video via same mesh as chat. Falls back to relay. No central media server.

**Group video** (Phase 3): up to 8 participants. Grid layout; active speaker enlarged. Same mesh formation as group chat.

**Recording**: local browser-side only (MediaRecorder API). Never streamed to servers. User explicitly initiates with a permission prompt to all participants.

---

## 6. Social Feed (Phase 3+)

Three tabs accessible from bottom navigation (visible from Phase 3).

### 6.1 For You

Semantic proximity feed ranked by ANN queries on active channel distributions.

**Post card anatomy**:

```
┌─────────────────────────────────────────────────────┐
│ QmA4…b2f1 · 12 min ago       0.82 ~ AI Ethics ✦    │
│                                                     │
│ "The tension between model interpretability and     │
│  raw performance is going to define the next…"  ··· │
│                                                     │
│ ❤ 14  🔁 3  💬 7                                   │
│ [Like] [Repost] [Reply] [Quote] [⋯]                │
└─────────────────────────────────────────────────────┘
```

- **Similarity badge**: always visible (*"0.82 ~ AI Ethics"*). Tap → inline explanation: *"This post is 0.82 semantically similar to your AI Ethics channel's current embedding."*
- **Author**: peer ID (abbreviated). If they have a bio, show it on hover/long-press.
- **Overflow ⋯**: Share link · Mute author · Report · See similar posts · See author's profile.

**Loading state**: Because the feed queries the DHT via ANN across a distributed network, initial load takes 2–10 seconds (vs. milliseconds for a central database). Rather than a generic spinner:
- Show a skeleton list of 3 shimmer cards immediately.
- Overlay caption: *"Gathering thoughts from the network…"* (not *"Loading"*).
- Each card populates as it resolves — results trickle in rather than bulk-appearing.
- If no results after 10s: show the ghost-town empty state (auto-expand horizon triggers at 30s).

**Feed controls** (collapsible):
- **Threshold** slider (default 0.6).
- **Diversity enforcement**: toggle to ensure ≥ 15% of posts are in the serendipity zone (0.55–0.70).
- **Chaos level**: 0.0–0.3 perturbation on ANN query — increases topical variety.
- **Time window**: Last hour / 6h / 24h / All time.
- **Refresh** (manual; auto every 5 min).

**Serendipity nudge**: if diversity is disabled and feed is highly uniform (inter-post similarity > 0.85 mean), show: *"Your feed looks quite uniform. Enable diversity to discover adjacent ideas."*

### 6.2 Following

Chronological posts from follows. Sorted by time (desc). Secondary sort: similarity.

**Filter row**: All follows · Specific peer · Specific channel.

**Empty state**: *"Follow peers from Match Explorer. They'll appear here when they post."*

### 6.3 Global Explore / Trending

Updated hourly via DHT `/isc/trending/<modelHash>` key.

**Sections**:
- **Trending** (last hour): top 20 by weighted score (replies × 3 + reposts × 2 + likes × 1).
- **Semantic Clusters**: vector-density-derived topic groups. Each cluster shown as a label cloud + post count. Tap → filtered feed.
- **Rising** (last 15 min): posts gaining engagement fastest. Algorithm: engagement velocity (delta count / time since post).
- **Near You** (if `in_location` relation active): posts from peers in the same geographic region.

**Filters**: time window · cluster · model shard.

**Bot protection** (Phase 2+): posts from peers with reputation < 0.3 are excluded from Trending. Shown if manually searched.

---

## 7. Post Composer

**Entry**: FAB (floating action button) on Feed views; Reply button on any post; share target from chat; "Post here" in community.

### 7.1 Modes

| Mode | Entry | Behavior |
|---|---|---|
| **Short post** | Default | ≤ 280 chars; char counter shown when > 200 |
| **Long-form** | Toggle 📝 | No char limit; estimated read time shown |
| **Reply** | Reply button | Posts inline; fused embedding of reply + parent |
| **Quote** | Quote button | Original shown inline; fused embedding from original + commentary |
| **Repost** | Repost button | No text; re-announces with reposter's channel embedding |

### 7.2 Fields

| Field | Notes |
|---|---|
| **Content** | Main textarea. Autosave to IndexedDB every 10s. |
| **Channel** | Picker from active channels. Drives embedding + DHT routing. Required. |
| **Visibility** | Public (default) · Followers only (Phase 3) · Community only (Phase 3) |
| **Media** (Phase 3) | Images / video / audio; uploaded to IPFS. Preview thumbnail shown. |
| **Schedule** (Phase 3) | Datetime picker. Post queued in IndexedDB; announced at scheduled time. |
| **Cross-post to AT Protocol** (Phase 4) | Toggle; requires AT Protocol bridge configured in §16. |

### 7.3 Semantic Preview

Live-updating as user types:
- **Channel match meter**: horizontal bar showing similarity from current text to selected channel. Turns amber < 0.4 with warning: *"Post is off-topic — it may not reach your channel's audience."*
- **Concept cloud**: top 5 semantically captured concepts (using model vocabulary projection). Updates every 2 seconds (debounced).

### 7.4 Drafts

Accessed from Composer header → **Drafts** (badge count). Shows list of saved drafts with timestamp and preview. Each has: Open · Delete.

### 7.5 Actions

**Post** → sign → announce to DHT → return to Feed.
**Schedule** → store in queue → show confirmation with scheduled time.
**Discard** → confirm if non-empty.

---

## 8. Post Detail / Thread

**Entry**: Tap any post card.

**Structure**:
1. **Original post** — full text; author; timestamp; similarity badge; engagement counts.
2. **Explainability panel** (collapsible): *"This post reached you because it is 0.82 similar to your AI Ethics channel."* Includes a mini bar chart of all active channel scores.
3. **Semantic position mini-map** (optional, setting-guarded): tiny 2D point plot showing this post's position relative to the user's channel embedding.
4. **Replies** — threaded list. Each reply shows: author · timestamp · similarity to original post · engagement.
5. **Quotes** — listed after replies.
6. **Action bar**: Like · Reply · Repost · Quote · Share link · Report · Mute author.

**Share link**: `https://isc.network/post/<postID>` — resolves via DHT; recipient must load ISC at that URL, which fetches the post by postID.

**Deep thread navigation**: long reply chains collapse after depth 3 with *"Show more replies"*.

---

## 9. Profile View

### 9.1 Own Profile

**Access**: Bottom navigation → Profile tab.

**Sections**:
- **Identity header**: peer ID (full + copy) · public key (copy) · joined date (first keygen timestamp) · Supernode badge (if active).
- **Bio**: editable text; or tap to add. Saved to DHT as a profile channel. Embedding displayed as a concept cloud (*"Your bio captures: open systems, distributed cognition, emergence"*).
- **Semantic fingerprint** (optional): a small 2D scatter of all your channel embeddings plotted together. Shows the shape of your intellectual interests. Toggle in Settings.
- **Channels**: listed with match count, spread, relation tags.
- **Posts**: reverse-chronological; count; engagement totals.
- **Follows / Followers**: count; tappable lists.
- **Reputation** (Phase 2+): 0–1 meter; tap for breakdown (interactions, decay, penalties).

**Actions**: Edit bio · Export data · Import data · Key management (→ §19a) · Share profile (QR / link) · Vector reveal toggle (Phase 3).

**Vector reveal** (Phase 3, opt-in): *"Allow peers to see your raw embedding vector for enhanced matching."* When enabled: embedding added to DHT profile entry. Warning: *"Your vector reveals the direction of your interests, not your exact words — but may allow inference."*

### 9.2 Peer Profile

**Sections**:
- **Identity header**: peer ID · bio (if published) · reputation (Phase 2+) · supernode status.
- **Mutual channels**: highlighted at top.
- **Their channels** (if publicly announced): each with similarity to each of your channels.
- **Semantic fingerprint**: if they've enabled vector reveal, show their concept cloud.
- **Mutual follows**: list of peers both of you follow.
- **Web of Trust path** (Phase 2+): *"You trust QmX via: you → QmY (mutual) → QmZ (mutual) → QmX"* — shortest trust path shown.

**Actions**: Follow/Unfollow · Dial · Video Call (Phase 3) · DM · Mute · Block · Report · Copy peer ID.

---

## 10. Communities (Phase 3+)

### 10.1 Community List

**Discovery**: Communities surface in Match Explorer (when semantically proximal) and in Global Explore. Also directly browsable.

**Community card**:
- Name · description (truncated).
- Member count · activity level (posts/day).
- Similarity to your most relevant channel.
- Your role: None / Member / Co-editor.
- Tags: Open / Invite-only / Private.

**Actions**: Browse · Join · Create.

### 10.2 Community Channel View

Tab bar: **Feed** · **Members** · **Places** (§11) · **Audio** · **Edit** (co-editors only) · **Governance** (Phase 4).

**Feed**: Posts filtered to community embedding space (cosine ≥ community threshold, default 0.5). Composer available here (channel auto-set to community channel).

**Members tab**: list of members; peer ID · similarity to community centroid · role badge · Last active. Co-editors shown first.

**Edit tab** (co-editors only):
- Edit description, spread, relations (same UI as §3).
- Changes require co-editor majority approval (Phase 4) or take effect immediately (Phase 3).
- Invite co-editors by peer ID.
- Set community threshold (minimum similarity to appear in feed).
- Transfer community ownership (generate new multisig).

**Leave**: removes local subscription; no DHT notification (pseudonymous). If last co-editor: community enters maintenance mode (announcements expire after TTL; other members can claim editor role).

**Moderation** (semantic first): posts below community threshold auto-deprioritized (shown with amber label "off-topic"). Co-editors can issue signed `CommunityReport` events. Members report with `ReportEvent` which is reputation-weighted (Phase 2+).

### 10.3 Audio Space

**Entry**: Community Channel → **🎙 Start Audio Space** — if no active space. **Join** if one is live.

**Discovery**: Active spaces appear as a live banner in the Community Channel header: *"🔴 Live · 6 speaking · [Join]"*

**UI layout**:
```
┌────────────────────────────────────────────────────────────┐
│  AI Ethics Audio Space       6 speaking · 14 listening     │
├────────────────────────────────────────────────────────────┤
│  [QmA 🔊]  [QmB ●]  [QmC ●]  [QmD ●]  [QmE ●]  [+ 1]   │
│  (waveform under active speaker)                           │
├────────────────────────────────────────────────────────────┤
│  Chat sidebar ──────────────────────────────────────────── │
│  QmA: great point about...                                 │
│  QmC: agreed                                               │
├────────────────────────────────────────────────────────────┤
│  [🎙 Mute]  [✋ Raise Hand]  [📩 Invite]  [🚪 Leave]      │
└────────────────────────────────────────────────────────────┘
```

- **Participant grid**: peer ID chip + waveform indicator when speaking + ● status.
- **Raise hand**: adds a ✋ badge; host (highest-uptime peer) can recognize.
- **Observer threshold**: > 10 participants → new joiners are observers (listen + text only). Observers listed below speakers.
- **Recording**: local only; all participants notified via in-space banner.
- **Leave**: immediate; space continues if ≥ 2 remain.

### 10.4 Community Governance (Phase 4)

Lightweight on-chain-less DAO for community decisions.

**Proposal types**: Edit channel description · Admit new co-editor · Remove co-editor · Change community threshold · Merge with another community · Dissolve.

**Proposal flow**:
1. Any co-editor creates a proposal.
2. All co-editors receive a notification.
3. Each co-editor votes: Approve / Reject / Abstain.
4. Threshold: simple majority for structural changes; 2/3 for dissolution.
5. Result announced via DHT signed event.
6. Non-co-editor members can "signal" (non-binding thumbs up/down) to inform co-editors.

**Proposal UI**: card in Governance tab with countdown timer (vote window: 72 hours default), current vote tally, and vote buttons.

---

## 11. Places — Idea Boards (Phase 3+)

**Concept**: Posts that have evolved into shared idea workspaces. A Place is a collaborative semantic graph — vector-positioned nodes (ideas, resources, questions) that members can add, link, and evolve. Directly inspired by *"idea boards where posts evolve into projects"* from SOCIAL.md.

### 11.1 Place Discovery

- Surfaces in Community Channel Feed when a post has been extensively replied-to and evolves into a dense semantic cluster.
- Suggestion: *"This thread has become a rich idea space. [Open as Place]"*
- Also created manually: Post Composer → ⋯ → *"Create Place from this post"*.

### 11.2 Place View

**Layout**: a 2D spatial canvas where each node is a thought, resource, or question.

```
┌─────────────────────────────────────────────────────────┐
│  Place: AI Ethics Governance Framework     [+ Add node] │
│                                                         │
│      [Interpretability]──[Accountability]               │
│           │                    │                        │
│      [Oversight]         [Auditability]                 │
│           │                                             │
│      [Regulation?] ←──── [Who decides?]                │
│                                                         │
│  Members: QmA QmB QmC +12        Viewing: 5 online     │
└─────────────────────────────────────────────────────────┘
```

- **Nodes**: text snippets, links, questions, media. Each has an embedding; positioned on the canvas by semantic proximity.
- **Edges**: added manually by members (tap two nodes → *"Connect"*) or auto-suggested (when similarity > 0.80).
- **Adding a node**: text field → embedded → placed by the canvas on the closest semantic position.
- **Editing a node**: tap → edit text → re-embedded → repositioned.
- **Linking to external posts**: paste a post URL to pull its content in as a node.
- **Exporting**: JSON graph export (nodes as embeddings + text, edges as pairs). Importable to other tools.
- **Members**: see who is present; real-time collaborative editing via libp2p pubsub.

### 11.3 Place Settings

| Setting | Options |
|---|---|
| **Who can add nodes** | All members / Co-editors only |
| **Auto-suggest edges** | On / Off (similarity threshold for suggestion: slider) |
| **Auto-layout algorithm** | Semantic proximity (default) / Tree / Force-directed |
| **Export** | JSON / CSV / Markdown outline |
| **Evolve into post** | Summarize the Place into a long-form post |

---

## 12. Search

ISC provides two search modes: **Semantic** and **Exact**.

### 12.1 Semantic Search

**Entry**: Search icon in navigation bar or `Ctrl/Cmd+K` shortcut.

**Input**: Natural-language query. User types what they're looking for; the query is embedded locally and used to query the DHT.

**Scope selector** (chips): Peers · Posts · Communities · Places · My channels.

**Results**: ranked by cosine similarity, same visual treatment as Match Explorer (similarity badges, relation labels).

**Saved searches**: users can save a semantic query as a watch (auto-runs on schedule; new results trigger notification).

### 12.2 Exact / Keyword Search

**Input**: Enter `/keyword` prefix to switch to exact mode. Searches local IndexedDB (own data) + DHT (posts, profiles).

**Scope**: Own messages · Own posts · Peers by ID · Communities by name.

### 12.3 Search History

Locally stored. Accessible as a dropdown below the search input. Cleared by: Settings → Privacy → Clear search history. Never announced to DHT.

---

## 13. Notifications

### 13.1 Notification Types

| Event | Message | Delivery | Batching |
|---|---|---|---|
| New match ≥ 0.85 | *"Very close match in [Channel]: 0.91"* | Badge + opt-in sound | 1 per channel per 5 min |
| New match 0.70–0.85 | *"New nearby peer in [Channel]"* | Badge | Per refresh cycle |
| Group chat invite | *"QmX… invited you to a group (0.91, 4 members)"* | Full-screen toast | Immediate |
| Incoming 1:1 dial | *"QmX… is connecting (0.88 similarity)"* | Full-screen toast + ringtone | Immediate |
| Incoming video call | *"QmX… is calling (video)"* | Full-screen toast + ringtone | Immediate |
| DM received | *"New message"* (no content preview) | Badge | Burst per sender, 30 s |
| Post reply | *"Someone replied to your post"* | Badge | Batched every 10 min |
| Post liked / reposted | *"Your post got reactions (N)"* | Badge | Batched hourly |
| New follower | *"A peer followed you"* | Badge | Batched daily |
| Peer drifted in chat | *"Similarity dropped to 0.38"* | In-chat banner | Immediate |
| Audio space started | *"🔴 Live in [Community]: 4 speaking"* | Tappable banner | Immediate |
| Model migration | *"New embedding model available"* | Persistent banner | Once per version |
| Supernode opportunity | *"Your device qualifies to help the network"* | One-time nudge | Once |
| Key backup overdue | *"Back up your identity key"* | Badge | Weekly until done |
| Rate limit | *"Slowing down — next announce in Xs"* | Status bar flash | Max 1/hour |
| DHT quota | *"Matching slowed — quota reached"* | Status bar flash + badge | Max 1/hour |
| Queue flushed | *"X queued actions delivered"* | Toast on reconnect | Once per reconnect |
| Governance vote | *"New proposal in [Community]"* | Badge | Immediate |
| Reputation flagged | *"A peer reported you for review"* | Badge | Immediate |

### 13.2 Notification Center

**Access**: 🔔 bell icon (badge always visible). Reverse-chronological list. Each item: icon · message · relative timestamp · dismiss ×.

**Actions**: Dismiss all · Filter by type (chips) · Mark all read.

### 13.3 Push Notifications (PWA, Phase 2+)

When ISC is installed as a PWA with push permission: DMs, group invites, and dial events send OS-level push. Push payload contains event type only — no message content. Service worker fetches content from DHT on tap.

---

## 14. Lightning Tips Wallet (Phase 3+)

Opt-in always. Never shown until the user enables it.

### 14.1 Setup

Settings → Lightning Tips → Enable. User enters a Lightning address (`user@getalby.com`) or connects a WebLN wallet. ISC validates the address resolves to a node. Tips are now receivable.

### 14.2 Sending a Tip

- **From peer card**: ⋯ → *"Tip this peer"*.
- **From post**: ⚡ icon below engagement counts.
- **From group/audio**: ⋯ → *"Tip speaker"*.

**Tip flow**: Amount picker (1 / 10 / 100 sat / custom) → optional note (≤ 64 chars) → Confirm → WebLN payment → success toast.

### 14.3 Supernode Tips

Configured in Settings → Delegation: *"Tip rate: 1 sat/request to QmX… [Change] [Disable]"*. Supernodes see receipts in their dashboard (§20.2). Rate and address set by supernode operator in Settings → Delegation → Supernode.

### 14.4 Wallet View

Settings → Lightning Tips → View wallet: balance (if custodial WebLN) · recent transactions · lifetime totals · CSV export.

---

## 15. Model Registry (Phase 2+)

### 15.1 Registry View

Settings → Network → Model Registry:
- **Current**: model name · version hash · size · loaded date.
- **Canonical** (from DHT `/isc/model_registry`): name · hash · release date · change summary.
- **Deprecated**: countdown to migration deadline.
- **Community proposals** (Phase 4): pending models awaiting multisig review.

### 15.2 Migration Flow

Triggered when the canonical model differs from the loaded model and > 50% of encountered peers use the new hash.

**Banner**: *"A new embedding model is available. Upgrading improves match quality. [Upgrade now] [Later] [Why?]"*

**Why panel**: explains what changes, what breaks (nothing during dual-announce window), 90-day transition, and what happens if skipped (compatibility shard isolation after deadline).

**Upgrade steps**:
1. Download new model (progress bar; cancellable).
2. Re-embed all active channels (per-channel progress).
3. Re-announce in new model's LSH space.
4. High-tier peers: enable dual-announce for 90 days (also announce in old space).
5. Completion: *"Upgrade complete. You are now in the new model space."*

**Dual-announce indicator**: shown per channel in Channel List when migration window is active.

---

## 16. AT Protocol / Bluesky Bridge (Phase 4)

### 16.1 Setup

Settings → Integrations → AT Protocol: enter PDS server · Bluesky handle · app password (encrypted with keypair in IndexedDB).

### 16.2 Cross-Posting

Post Composer toggle: *"Post to Bluesky"*. Mirrors content as a standard `app.bsky.feed.post` with ISC metadata attached as a Lexicon extension. Disclaimer: *"Bluesky posts are public and permanent. ISC posts expire after 24 hours."*

### 16.3 Follow Import

Settings → AT Protocol → Import follows: fetches Bluesky follow list; DHT lookup for bridged peer IDs; auto-suggests follows in ISC.

### 16.4 Profile Bridge

User can publish their ISC peer ID in their Bluesky `description`. Other ISC users resolve `@handle → peer ID` via the AT PLC directory and can dial or follow directly.

---

## 17. DAO Governance (Phase 4)

### 17.1 Governance Home

Bottom nav → Governance (Phase 4). Sections: Active Proposals · Past Proposals · My Votes · Protocol Stats.

### 17.2 Proposal Types

| Type | Scope | Quorum | Threshold |
|---|---|---|---|
| Model registry update | Network | 5% of DAU | 2/3 approval |
| Protocol parameter change | Network | 10% of DAU | 2/3 |
| Bootstrap peer addition | Network | 3% of DAU | Simple majority |
| Community court decision | Community | All co-editors | 2/3 |
| Treasury allocation | Network | 10% of DAU | 2/3 |

### 17.3 Voting

**Reputation-weighted**: vote weight = reputation score × uptime factor. Raw counts and weighted results both shown.

**Proposal card**: title · description · proposer · closes in Xh · approval bar · [Approve] [Reject] [Abstain] · **Discussion thread** (linked posts, DHT-stored 30 days).

Results announced as a signed DHT event. Auto-applied for parameter changes requiring no code deployment.

---

## 18. Enterprise / Private Instance Admin (Phase 4)

### 18.1 Admin Dashboard

`http://localhost:3001/admin` (server) or `?admin=true` (browser, admin keypair required).

**Panels**: Peers (list, tier, uptime, load) · Channels (active announcements, topic clusters) · Bootstrap config · Access control (invite-only toggle, allowlist/blocklist) · Federation (bridge to other ISC instances) · Audit log (join/leave/moderation events, CSV export).

### 18.2 Invite-Only Mode

`isc invite create --uses 50 --expires 7d` → token. Invitee URL: `https://isc.company.com/?invite=<token>`. New keypair generation gated by valid token. Revoke: `isc invite revoke <token>`.

### 18.3 Private Bootstrap

Operator runs `isc bootstrap start --port 4001 --private`. Members add the resulting multiaddress via Settings → Network → Bootstrap peers. No data reaches public networks unless federation is configured.

---

## 19. Settings

### 19a. Identity & Keys

| Setting | Type | Description |
|---|---|---|
| **My Peer ID** | Display + copy | Full libp2p peer ID |
| **Public key** | Display + copy | Base58 ed25519 |
| **Passphrase encryption** | Toggle + set | Encrypts private key via PBKDF2 (100k iterations) |
| **Change passphrase** | Action | Re-derive + re-encrypt |
| **Backup → Export file** | Action | Download encrypted `.isc-identity.json` |
| **Backup → QR code** | Action | QR of encrypted keypair blob |
| **Backup → Social recovery** | Action | Shamir N=5 K=3; share links per shard |
| **Import keypair** | Action | File / QR / Shard assembly |
| **Key rotation** | Action | New keypair; re-sign channels; 30-day grace |
| **Ephemeral key per channel** | Per-channel toggle | New throwaway keypair per session |
| **Hardware key (Phase 4)** | Connect | YubiKey / WebAuthn signing |
| **Active sessions** | List | Tab instances; revoke individual |

### 19b. Privacy

| Setting | Type | Description |
|---|---|---|
| **Announcement mode** | Picker: Normal / Ephemeral / Silent | Ephemeral: rotate peer ID per session. Silent: receive-only. |
| **Default spread (σ)** | Slider 0.0–0.3 | Applied to all new channels |
| **IP obfuscation** | Toggle | Route via circuit relays |
| **Tor / I2P routing** | Toggle | Requires plugin |
| **Opt out of Trending** | Toggle | Posts excluded from trending aggregation |
| **Opt-in telemetry** | Toggle | Differential-privacy metrics; default off |
| **Error reporting** | Toggle | Stack traces, no PII; default off |
| **Muted peers** | List | View / unmute |
| **Blocked peers** | List | View / unblock |
| **Search history** | Clear | Wipes local history |
| **Export all data** | Action | Full JSON |
| **Delete all data** | Action | Wipes IndexedDB + localStorage; two-step confirm |

### 19c. Matching

| Setting | Type | Description |
|---|---|---|
| **Default threshold** | Slider 0.30–0.95 | Default 0.55 |
| **Auto-dial threshold** | Slider | Default 0.85 |
| **Show orbiting zone** | Toggle | 0.55–0.70 tier; default on |
| **Max match results** | Number | Top-k; tier-dependent max |
| **Default chaos level** | Slider 0.0–0.3 | Serendipity; default 0 |
| **Spatiotemporal boost** | Slider 0.0–1.0 | `in_location`/`during_time` weight; default 0.5 |
| **Show numeric scores** | Toggle | Default on |
| **Auto-dial on very close** | Toggle | Prompt at 0.85+; default off |
| **Tier override** | Picker | Manual override of auto-detection |
| **Announce on cellular** | Toggle | Default off |
| **Strict mode (inbound block)** | Toggle | Reject all unsolicited inbound WebRTC dials; outbound Dial still works. Phase 1 defense against Sybil dial-spam before reputation system launches. Banner shown when active. Default off. |

### 19d. Delegation & Supernode

| Setting | Type | Description |
|---|---|---|
| **Use delegation** | Toggle | Allow supernode assist; default on Low/Minimal |
| **Prefer local compute** | Toggle | Try local first; default on |
| **Max delegation latency** | Slider 500–10000 ms | Default 5000 ms |
| **Max delegations/min** | Number | Default 3 |
| **Trusted supernodes** | List + search | Pinned preferred nodes |
| **Per-channel delegation** | Per-channel toggle | Disable for sensitive channels |
| **Enable supernode mode** | Toggle (High tier only) | Begin serving peers |
| **Supernode max concurrent** | Number | Default 5 |
| **Supernode max RAM** | MB slider | Default 4096 MB |
| **Accept Lightning tips** | Toggle | Default off |
| **Lightning address** | Text | Validated on entry |
| **Tip rate** | Sats/request | Default 1; 0 = free |
| **Live supernode stats** | Display | Requests/24h · success rate · avg latency · sats received |

### 19e. Network

| Setting | Type | Description |
|---|---|---|
| **Bootstrap peers** | List + add/remove | Multiaddresses; community list shown as suggestions |
| **TURN servers** | List + add/remove | URI + credentials |
| **Max WebRTC connections** | Number | Default 50 |
| **Heartbeat interval** | Slider 10–120 s | Default 30 s |
| **Reconnect delay** | Slider 1–60 s | Default 5 s |
| **Announce interval override** | Picker | Default: per-tier schedule |
| **Seed tab** | Action | Opens persistent tab as local bootstrap |
| **Direct connect** | Action | Peer ID + relay URL; dial immediately |
| **QR connect** | Action | Camera scan |
| **Network status** | Live display | Peers · DHT keys · relay latency · bootstrap health |

### 19f. Notifications

| Setting | Type | Description |
|---|---|---|
| **New matches** | Toggle | Badge for matches |
| **Match sound** | Toggle | Sound on Very Close match |
| **Incoming calls** | Toggle | Toast + ringtone |
| **DMs** | Toggle | Badge |
| **Post replies** | Toggle | Badge |
| **Reactions** | Toggle | Badge, batched |
| **Governance** | Toggle | Badge on new proposals |
| **Quiet hours** | Time range | No sounds/toasts during window |
| **PWA push** | Toggle (PWA) | OS-level push |
| **Notification history** | List | Last 50; clearable |

### 19g. Appearance & Accessibility

| Setting | Type | Description |
|---|---|---|
| **Theme** | Picker: System / Light / Dark / High Contrast / Custom | |
| **Accent color** | Color picker | Applied to highlights, CTAs, scores |
| **Font size** | Slider | Relative to browser default |
| **Font family** | Picker: System / Serif / Mono / OpenDyslexic | |
| **Reduce motion** | Toggle | Disables animations; respects OS pref |
| **Screen reader mode** | Toggle | More verbose ARIA live regions |
| **Focus ring always visible** | Toggle | 3px outline; default on |
| **Language / locale** | Picker | UI strings language + number/date format |
| **Compact mode** | Toggle | Denser layouts throughout |
| **Show vector map** | Toggle | 2D scatter in Match Explorer |
| **Show semantic fingerprint** | Toggle | Concept cloud on own profile |
| **Post mini-map** | Toggle | Position map in post detail |
| **Show scores as labels only** | Toggle | "Very Close" instead of "0.91" |

### 19h. Developer / Debug

| Setting | Type | Description |
|---|---|---|
| **Tier override** | Picker | Force tier |
| **Debug logging** | Multi-select | DHT · WebRTC · Delegation · Matching · Crypto · A11y |
| **Export logs** | Action | Structured JSON download |
| **Live peer stats** | Panel | `peer.delegation.stats` · `peer.match.stats` · heap |
| **DHT inspector** | Panel | Browse local DHT keys |
| **Queue inspector** | Panel | Offline action queue; count + preview + flush |
| **Force cold start** | Action | Clear DHT cache |
| **Simulate offline** | Toggle | Disconnects network |
| **Model inspector** | Display | Model ID · hash · dims · size · load time · inference time |
| **URL params reference** | Reference | `?tier=low&delegate=true&supernode=true&mode=event&admin=true` |
| **Run smoke tests** | Action | In-page smoke test suite (Phase 2+) |

---

## 20. CLI / Node.js Operator Dashboard

### 20.1 CLI Reference

```
Core
  isc embed <text>                    Embed text → JSON vector
  isc match <text> <text>             Cosine similarity
  isc lsh <text>                      LSH hashes for a text

Network
  isc peer list                       Connected peers (ID, tier, latency)
  isc peer info <peerID>              Detailed peer info
  isc dht get <key>                   DHT value lookup
  isc dht put <key> <value>           Signed DHT put
  isc dht inspect <channel>           All DHT keys for a channel

Channels
  isc channel create <file.json>      Create + announce from JSON
  isc channel edit <id> <file.json>   Edit + re-announce
  isc channel list                    List local channels
  isc channel export <id>             Export channel JSON with embedding

Supernode
  isc supernode start [--config]      Start serving delegation requests
  isc supernode stop                  Graceful shutdown
  isc supernode status                Health metrics (JSON)
  isc supernode stats --period=24h    Aggregated stats

Identity
  isc key generate                    New keypair
  isc key export [--encrypt]          Export keypair
  isc key import <file>               Import keypair
  isc key rotate                      Rotate + announce

Invites (enterprise)
  isc invite create --uses N --expires Nd    Generate invite token
  isc invite revoke <token>                  Revoke token

Simulation (dev)
  isc sim start --peers=50 --topics=5        Local simulation
  isc sim report                             Metrics
  isc sim inject-churn --rate=0.1            Peer churn
```

### 20.2 HTTP Monitoring Dashboard (`/admin`)

Available at `localhost:3001/admin` when running as a server.

**Overview**: Peer ID · uptime · version · active connections · DHT put/get rates · delegation requests/24h · success rate · p50/p95 latency · Lightning sats received.

**Charts**: 7-day time series for all metrics (PNG / CSV export).

**Peer table**: live; tier · latency · delegation requests served.

**DHT explorer**: key-value browser with TTL countdown.

**Log stream**: live tail; filterable by level and subsystem.

**Alert rules**: configurable thresholds; webhook on breach.

**Prometheus**: `GET /metrics` → `isc_delegation_latency_seconds`, `isc_match_quality_score`, `isc_dht_operations_total`, `isc_memory_heap_bytes`, `isc_lightning_sats_received_total`.

---

## 21. Connectivity & Error States

Every error gives the user a clear next action. No dead ends.

| Error | Display | User action |
|---|---|---|
| **No bootstrap peers** | Full-screen spinner: *"Searching for the network…"* | Retry · Add custom bootstrap · Open seed tab |
| **Bootstrap timeout (30s)** | *"Can't reach bootstrap peers."* | Different network · Enter bootstrap manually |
| **NAT traversal → direct failed** | Inline: *"Connecting via relay…"* (auto) | Auto-retries; can cancel |
| **NAT traversal → relay failed** | *"Could not connect to this peer."* | Skip; try next match |
| **Model download failed** | Banner: *"Download failed. Word-matching active."* | Retry · Use delegation · Continue |
| **Model on cellular, saveData** | Banner: *"Waiting for Wi-Fi to download model."* | Download now · Always use cellular |
| **Signature invalid** | Peer: red outline + ⚠ | Auto-filtered; can report |
| **Embedding norm invalid** | Toast: *"Helper node returned bad data — blocked."* | Auto-removed; retry |
| **Self rate limited** | Status: *"Slowing down. Next in Xs."* | Auto-resolves |
| **Supernode rate limited** | Toast: *"Helper node busy. Retrying 60s."* | Auto-retry; dismiss |
| **DHT quota exceeded** | Banner: *"Quota reached — reduce channels."* | Reduce channels; wait |
| **Offline** | Red ✕ status bar; grey badges; offline banner | Queues actions; auto-syncs |
| **Storage full** | Modal: *"Storage full — clear old data."* | Storage manager |
| **Model mismatch** | Match list: *"Some peers use a different model."* | Migration banner if > 50% |
| **Key compromise** | Urgent banner: *"Rotate your key now."* | Key rotation flow |
| **Supernode misbehavior** | Toast: *"Bad response — blocked."* | Auto-reported |
| **IndexedDB unavailable** | *"Storage unavailable. Data won't persist."* | Memory-only mode |
| **WebRTC blocked** | *"Chat unavailable on this network."* | Relay fallback if available |
| **No supernodes available** | *"No helper nodes. Using limited local model."* | Auto-upgrades when found |
| **Clock skew > 60s** | *"Device clock differs from network — matches may be filtered."* | Prompt to sync clock |

---

## 22. Offline-First Behaviors

| Action | Offline behavior | On reconnect |
|---|---|---|
| Send chat message | Queued; "pending ⏳" badge | Auto-delivered; badge clears |
| Post to feed | Queued; local "pending" label | Announced to DHT |
| Like / repost / reply | Queued; optimistic UI (+1 locally) | Synced; server state reconciled |
| Follow / unfollow | Queued; optimistic local state | Synced via pubsub |
| Edit channel | Local; embed re-queued | DHT re-announce within 5s |
| Mute peer | Applied locally immediately | Signed MuteEvent synced |
| Create community | Queued; local preview | Announced to DHT |
| Vote (governance) | Blocked; explanation shown | Prompt on reconnect |
| Key rotation | Blocked | — |
| Delegation request | Falls back to local minimal model | Resumes delegation |
| Schedule post | Stored in queue | Announced at scheduled time |

**Reconnect banner**: *"Back online. Syncing X actions…"* with live progress. LWW-Map conflict resolution for channels; toast on merge.

---

## 23. Trust & Safety

### 23.1 Mute

One-click from any surface (match card, peer card, chat, post, profile). Issues signed `MuteEvent` to DHT. Peer disappears from all views immediately. **Undo** in notification center for 5 min; thereafter via Settings → Privacy → Muted peers.

### 23.2 Block

Local only; no DHT event. WebRTC connections from blocker to blocked are rejected at the transport layer. Managed in Settings → Privacy → Blocked peers. Reversible; not announced.

### 23.3 Report

Surfaces on every content surface. Reason picker: Spam · Harassment · Impersonation · Off-topic · Malicious content · Other. Optional description ≤ 500 chars. Sends signed `ReportEvent` to DHT (reputation-weighted in Phase 2+). Auto-mutes reported peer (undo in notification for 5 min).

### 23.4 Community Courts (Phase 4)

**Trigger**: ≥ 3 independent reports within 24h.

**Jury**: 5 random peers with reputation > 0.8, selected deterministically from hash(reportedPeerID + timestamp).

**Flow**: Jury notified → evidence panel (reports, post history) → vote (Dismiss / Warn / Temporary flag / Global flag) → result via signed DHT → reported peer notified → one appeal available (new 5-peer jury).

### 23.5 Harassment Exit

When in-chat/group similarity < 0.55: non-blocking card at thread bottom: *"Thoughts drifting apart. [Keep going] [Exit gracefully]."* Exit closes WebRTC from the user's side; peer sees a generic disconnect. No punitive consequence.

### 23.6 Rate Limit Framing

*"Slowing down — next announce in 42s"* — never *"banned"* or *"suspended"*. Frame: *"The network has shared limits for fairness."* Auto-resolves; queue executes when window resets.

---

## 24. Accessibility (WCAG 2.1 AA)

### 24.1 Per-Screen ARIA Requirements

| Region | Requirement |
|---|---|
| Channel list | `role="list"` + `aria-label`. Each card: accessible name includes count. |
| Match list | `aria-live="polite"` on container; announces count on refresh. Entry label: *"0.91 similarity — very close — peer QmX…"* |
| Chat messages | `aria-live="polite"` on thread; new messages announced. Tampered: `aria-live="assertive"`. |
| Similarity scores | Not color-only; numeric + text label always present. |
| Semantic Map | Non-visual alternative = List view. Map `aria-label` states peer count and closest peer. |
| Audio space | Speaking state via live region. Mute button reflects `aria-pressed`. |
| Toasts / banners | `role="alert"` (urgent) or `aria-live="polite"` (informational). |
| Modals / sheets | Focus trapped inside. Escape closes. `aria-modal="true"`. |
| Inputs | `<label>` or `aria-label`. Required marked with `aria-required`. |

### 24.2 Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Navigate interactive elements |
| `Enter` / `Space` | Activate |
| `Escape` | Close / cancel |
| Arrow keys | Navigate lists |
| `Home` / `End` | First / last in list |
| Skip link | First stop on every view → main content |

### 24.3 Focus Management

- Modal open: focus → first interactive element inside.
- Modal close: focus → triggering element.
- Route change: focus → page `h1`.
- Dynamic inserts: no focus steal; live region announcement.

### 24.4 Testing

| Method | Frequency | Tools |
|---|---|---|
| Automated | Every PR | `axe-core`; zero new-violations policy |
| NVDA + Chrome | Quarterly | Full core flows |
| VoiceOver macOS/iOS | Quarterly | Full core flows |
| JAWS + Edge | Quarterly | Full core flows |
| User testing | Per major release | ≥ 2 users with disabilities in beta |
| Contrast audit | Per design change | WAVE / axe DevTools |

---

## 25. Internationalization

| Requirement | Detail |
|---|---|
| **Script coverage** | CJK, Arabic, Devanagari, Cyrillic, Latin. User informed of word-hash fallback if model doesn't support their script. |
| **RTL** | CSS `dir="rtl"` with logical properties (`inline-start/end`) for Arabic, Hebrew, Persian, Urdu. |
| **Dates** | Stored as Unix ms (UTC). Displayed via `Intl.DateTimeFormat`. |
| **Numbers** | Stored as `float64`. Displayed via `Intl.NumberFormat`. |
| **Plurals** | CLDR via `Intl.PluralRules`. |
| **Text expansion** | 30%+ accommodation for German, Finnish. No fixed-width text containers. |
| **Translation pipeline** | All strings in `i18n/<locale>.json`; community-contributed; native-speaker reviewed. |
| **Locale fallback** | `en-US` base; partial locales fall back string-by-string. |
| **IME input** | CJK input methods fully supported in all text fields. |
| **Cross-lingual matching** | Multilingual model variant maps semantically equivalent concepts across languages. Match list shows language indicator: *"This peer writes in Chinese — concepts are geometrically close."* |

---

## 26. Keyboard Shortcuts & Mobile Gestures

### 26.1 Global

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+K` | Open Search |
| `Ctrl/Cmd+N` | New Channel |
| `Ctrl/Cmd+P` | New Post |
| `Ctrl/Cmd+,` | Settings |
| `Ctrl/Cmd+/` | Keyboard shortcut help |
| `Ctrl/Cmd+1–5` | Switch to channel 1–5 |
| `Ctrl/Cmd+B` | Notification center |
| `Escape` | Close modal / exit view |

### 26.2 Match Explorer

| Shortcut | Action |
|---|---|
| `M` | Toggle Map / List |
| `C` | Toggle Chaos mode |
| `R` | Manual refresh |
| `Ctrl/Cmd+F` | Focus threshold/filter bar |
| `↑/↓` | Navigate list |
| `Enter` | Open focused peer card |
| `D` | Dial focused peer |
| `F` | Follow focused peer |
| `X` | Mute focused peer |

### 26.3 Chat

| Shortcut | Action |
|---|---|
| `Enter` | Send |
| `Shift+Enter` | New line |
| `↑` (empty input) | Edit last sent message |
| `Ctrl/Cmd+E` | Toggle ephemeral mode |
| `Ctrl/Cmd+G` | Invite to group |
| `Ctrl/Cmd+V` | Start video call |

### 26.4 Mobile Gestures

| Gesture | Target | Action |
|---|---|---|
| Swipe right | Channel card | Edit |
| Swipe left | Channel card | Archive / Delete |
| Long-press | Channel card | Context menu (fork, template, share, delete) |
| Long-press | Match entry | Context menu (dial, follow, mute, report) |
| Swipe down | Any modal/sheet | Dismiss |
| Pinch | Semantic map | Zoom |
| Two-finger tap | Semantic map | Reset center |
| Swipe left/right | Feed tabs | Navigate For You / Following / Explore |

---

## 27. Micro-Interactions & Feedback

Animations serve communication, not decoration. All disabled when `prefers-reduced-motion` is set.

| Element | Animation | Duration | Purpose |
|---|---|---|---|
| Match badge count | Counts up with soft pulse | 300 ms | Signals new info |
| New peer in list | Fade in + upward translate | 200 ms | Entity entering space |
| Peer disappears | Fade out | 150 ms | Clean removal |
| Announcing ● | Slow pulse, 2 s period | Continuous | Network heartbeat |
| Dial connecting | Ripple from button | 400 ms loop | Action in progress |
| Message sent | Bubble slides in + tick | 200 ms | Send confirmation |
| Signature verified | ✓ tick fades in | 100 ms | Non-disruptive trust signal |
| Similarity score | Counts from 0 to value | 400 ms ease-out | Draws attention to key metric |
| Score live change | Smooth numeric transition | 300 ms | Shows drift in real time |
| Map dot placement | Spring physics | 500 ms | Spatial intuition |
| Error | Horizontal shake ±4px × 3 | 250 ms | Standard error affordance |
| Toast in | Slide up from bottom | 200 ms ease-out | Notification arrival |
| Toast out | Slide up out | 200 ms | Clean removal |
| Chaos ghost dot | Position shift | 200 ms | Real-time perturbation preview |
| Group formation banner | Expand from collapsed | 300 ms ease-out | Important but not alarming |
| Model download bar | Smooth fill | Continuous | Realistic progress |

---

## 28. Civilization-Scale Use Cases

ISC routes by semantic geometry. The following scenarios are fully realizable from Phase 1 onward and define the design targets for every UX decision.

### 28.1 Distributed Research Coordination

3,000 researchers across 60 countries working on pandemic preparedness without a trusted central platform. ISC clusters them by semantic proximity; a researcher in Kenya and one in Norway working on the same mechanism find each other within minutes. Communities form around method areas; Places accumulate shared resources; Audio Spaces enable real-time cross-continental discussions. Nothing needs to be pre-configured. **UI target**: Match Explorer as discovery layer; Communities as collaboration layer; Places as the knowledge commons.

### 28.2 Disaster Response

Major earthquake; internet partially degraded. Minimal-tier mode works on 2G/low-end Android. Channels: *"medical supplies, western district"*, *"structural engineers, collapse assessment"*. `in_location` anchors requests geographically. A few laptops act as supernodes serving volunteers with feature phones. Offline-first queues messages through connectivity gaps. **UI target**: `in_location` with simple GPS/city entry; degraded-state UI showing clearly what works; queue indicator.

### 28.3 Civic Deliberation

A city surfaces genuine public sentiment on housing policy without filter-bubble amplification. Semantic clustering reveals real opinion distributions. Chaos mode is enabled for sponsored discovery sessions so citizens encounter perspectives near but not identical to their own. DAO governance lets citizens vote on instance parameters. **UI target**: Chaos mode + echo chamber score metric visible in feed settings; public Trending board; local instance admin panel.

### 28.4 Activist Safety (High-Threat Environment)

Custom bootstrap peers (operator-controlled), Tor transport, Silent announcement, ephemeral keys per channel, high spread (σ = 0.3) to prevent vector inference, Social recovery distributed across jurisdictions, ZK proofs to coordinate without revealing vectors. **UI target**: `?mode=private` onboarding with dedicated safety guide; Privacy settings surfacing all relevant controls prominently; single-flow "clear everything" action.

### 28.5 Academic Knowledge Commons

Researchers post paper summaries; channels represent research programs. "For You" surfaces related work across disciplinary boundaries — a cognitive scientist finds a neuroscience paper without knowing the vocabulary. Places accumulate evidence and counterarguments. AT Protocol bridge integrates Bluesky-based academic communities. **UI target**: Long-form post; Places/Idea Boards; semantic search; AT Protocol bridge; community threshold tuned for cross-disciplinary serendipity.

### 28.6 Mental Health Peer Support

`with_mood` relation signals emotional context anonymously. Peer IDs, no real names. Thought Drift exit protocol means conversations end without confrontation. "Listening mode" — user appears nearby but does not auto-dial, requiring explicit action from the other side. Mute is instant. No profile history means stigma doesn't accumulate. **UI target**: `with_mood` UI with preset emotional vocabulary; listening mode toggle on channel card; one-tap exit; clear first-launch privacy statement.

### 28.7 Serendipitous Intellectual Discovery

Chaos at 0.2 + spread σ = 0.3 + threshold 0.40: the Orbiting zone becomes a rich frontier. Semantic Map provides visual territory navigation. Thought Bridge generates conceptual connectors between disparate embeddings. **UI target**: Chaos/spread as prominently discoverable; Semantic Map as the default mode for exploration; Thought Bridge surfaced from Peer Card.

### 28.8 Decentralized Science (DeSci)

Independent scientists announcing experiments; Communities acting as pre-print venues; `causes_effect` and `requires` relations capturing experimental dependencies; Lightning tips funding replication; DAO governance managing a scientific-vocabulary model registry variant.

### 28.9 Cross-Language Idea Discovery

A Chinese researcher and a French philosopher working on the same idea. The multilingual model maps semantically equivalent concepts across languages to nearby embedding positions. ISC surfaces the connection without requiring either party to know the other's language or vocabulary. Match list shows language indicator with plain-English tooltip. **UI target**: Multilingual model advertised in Model Registry; language indicator on match entries.

### 28.10 Supernode Economy — Sustainable Infrastructure

10,000 daily users; reliable infrastructure without central funding. Supernodes earn Lightning tips; reputation badges provide social incentive; transparent health metrics let the community route away from underperforming nodes; DAO governance manages minimum uptime requirements. **UI target**: Supernode health dashboard; delegation settings showing tip rates and received sats; governance proposals for infrastructure decisions.

---

## 29. Phased Feature Availability

> Future-phase features appear as greyed-out cards labeled *"Coming in Phase X"* — giving users a full mental model of the product roadmap without misleading them about current state.

| Feature | Phase | Tier |
|---|---|---|
| Single-channel semantic matching + 1:1 WebRTC chat | 1 | All |
| Multi-channel management (up to 5 active) | 1 | All |
| Supernode delegation (embed / ANN / sig-verify) | 1 | Low/Minimal client; High server |
| Rate limiting + mute/block | 1 | All |
| Device auto-tier + model download + fallback | 1 | All |
| Channel Editor (name, description, spread, relations) | 1 | All |
| 2D Semantic Map | 1 | High/Mid |
| NAT traversal fallback chain | 1 | All |
| Offline-first action queue | 1 | All |
| PWA installable shell | 2 | All |
| Relational embeddings (all 10 tags, fused scoring) | 2 | High/Mid |
| Reputation system + Web of Trust | 2 | All |
| Model migration tooling + dual-announce | 2 | High (dual); All (migration) |
| Delegation health metrics + supernode leaderboard | 2 | All |
| IPFS deployment (zero-infra hosting) | 2 | All |
| Posts + For You + Following feeds | 3 | All |
| Reactions (like, repost, reply, quote) | 3 | All |
| Profiles + follow/unfollow + suggested follows | 3 | All |
| Communities + shared channels + Audio Spaces | 3 | All |
| Places / Idea Boards | 3 | High/Mid |
| Video calls (1:1 + group) | 3 | High/Mid |
| Global Explore / Trending | 3 | All |
| Chaos mode + serendipity controls | 3 | All |
| Thought Bridge (AI conversation openers) | 3 | High (local compute) |
| Vector reveal (opt-in) | 3 | All |
| Semantic Search + saved searches | 3 | All |
| Lightning Network tips (opt-in) | 3 | All |
| Post scheduling | 3 | All |
| Cross-post to AT Protocol / Bluesky | 4 | All |
| AT Protocol follow import | 4 | All |
| DAO Governance (reputation-weighted voting) | 4 | All |
| Community Courts + appeal system | 4 | All |
| ZK proximity proofs | 4 | All |
| Enterprise / private instance admin panel | 4 | Admin |
| Hardware key (YubiKey / WebAuthn) | 4 | All |
| Native mobile apps | 4 | All |
| Federated network bridges | 4 | All |
| Supernode staking (Sybil resistance) | 4 | Opt-in |

---

## 30. Navigation Model

### 30.1 Bottom Navigation (Mobile / PWA)

| Tab | Icon | Phase | Screen |
|---|---|---|---|
| **Home** | ⬡ | 1+ | Channel List |
| **Explore** | 🔍 | 1+ | Match Explorer (last active channel) |
| **Feed** | 📰 | 3+ | Social Feed — For You |
| **Communities** | 👥 | 3+ | Community List |
| **Profile** | 👤 | 1+ | Own Profile |

Phase 1–2: Home + Explore + Profile visible; Feed + Communities shown greyed with phase label.

### 30.2 Deep Links

| URL | Destination |
|---|---|
| `isc://channel/<id>` | Channel Editor (edit) |
| `isc://peer/<id>` | Peer Profile |
| `isc://post/<id>` | Post Detail |
| `isc://group/<roomID>` | Group Chat join |
| `isc://community/<channelID>` | Community Channel |
| `isc://place/<placeID>` | Place (Idea Board) |
| `https://isc.network/?peer=<id>&relay=<url>` | Direct-connect onboarding |
| `https://isc.network/?invite=<token>` | Invite-gated onboarding |
| `https://isc.network/?mode=event&channel=<desc>` | Event onboarding with pre-filled channel |
| `https://isc.network/post/<id>` | Web-resolvable post (DHT fetch) |

---

## 31. Data Management

| Action | Location | Detail |
|---|---|---|
| **Export all data** | Settings → Privacy → Export | JSON: keypair (encrypted), channels, posts, follows, mutes, blocks, chat history, drafts, Place snapshots |
| **Delete all data** | Settings → Privacy → Delete all | Wipes IndexedDB + localStorage. *"Posts may remain on peers' caches until TTL expires."* Two-step confirm. |
| **Clear model cache** | Settings → Network | Frees IndexedDB model storage; triggers re-download |
| **Clear match cache** | Settings → Network | Forces re-query from DHT |
| **Storage manager** | Settings → Developer | Per-category breakdown: keypair / model / channels / posts / chat / drafts / cache. Per-category delete. |
| **Archive channel** | Channel list swipe | Hidden; recoverable from Settings → Channels → Archived |
| **Restore archived** | Settings → Channels → Archived | Re-activates; DHT re-announce |
| **Draft management** | Post Composer → Drafts | List with preview; open, edit, delete |

---

*End of ISC UI Specification v2.*

---

> **Document history**
>
> | Date | Change |
> |---|---|
> | 2026-03-09 | Initial draft (v2.0) — 23 sections, 973 lines |
> | 2026-03-10 | Major revision (v2.1) — 31 sections, ~1800 lines. Added: Places/Idea Boards (§11), Search (§12), Lightning Tips Wallet (§14), Model Registry (§15), AT Protocol Bridge (§16), DAO Governance (§17), Enterprise Admin (§18), Community Courts (§23.4), Thought Bridge (§4.4), Video Calls (§5.4), Ephemeral mode (§5.1), AI-assisted channel description (§3.2), Channel templates (§2.5, §3), 2D Semantic Map enhancements (§4.3), Fuzzy anonymity mode (§4.1), Vector reveal (§9.1), Places (§11), Keyboard shortcuts (§26), Micro-interactions spec (§27), Civilization-scale use cases (§28, 10 scenarios), expanded Phased availability table (§29), deep-linked navigation (§30), full Settings panels (§19). |
> | 2026-03-10 | Expert review patch (v2.2) — 1,551 lines. Applied 9 targeted fixes: (1) Added `Low Power` + `Strict Mode` global states with 2-second debounce rule for transient states. (2) Added §1.5 Pair Device / Multi-Device Sync (QR pairing, encrypted WebRTC transfer, LAN mDNS discovery, LWW ongoing sync). (3) Corrected §3.2 AI-assisted description — clarified `all-MiniLM-L6-v2` is encoder-only; introduced two paths: keyword extraction (default, zero extra download) and optional decoder model (TinyLlama/Phi-2, ~1.2 GB, opt-in). (4) Expanded §4.1 ghost-town cold start: auto-expanding search horizon after 30 s + Global Pulse panel (10 random active channels). (5) Added §5.2 bandwidth-scaling note for group chat mesh (typing indicators, video thumbnails, read receipts progressively disabled as member count grows). (6) Added §6.1 DHT-latency loading state: skeleton shimmer + *"Gathering thoughts from the network…"* copy. (7) Added `Low Power` + `Strict Mode` rows to §2.1 Channel List visual states with exact banner copy and behavior. (8) Added `Strict mode (inbound block)` to §19c Matching settings — Phase 1 Sybil dial-spam protection. (9) Added `Ctrl/Cmd+F` shortcut to §26.2 Match Explorer shortcuts. |


