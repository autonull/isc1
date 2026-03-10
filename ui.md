# ISC UI Design Specification v5.0

## *"Meet your thought neighbors"*

> **Design Philosophy**: *"Familiar on arrival, powerful on demand."*
>
> ISC uses **standard UI components** that users already understand. The innovation is in what the interface *does*, not how it looks. Novel visualizations (cosmos, waves, orbs) are deferred to Phase 2 as optional enhancements.

---

## Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Zero Learning Curve** | If you've used a messaging app, you know ISC |
| **Progressive Disclosure** | Advanced features reveal themselves when needed |
| **Text Over Graphics** | Words before icons, numbers before visualizations |
| **Standard Patterns** | Tabs, cards, lists, sheets — nothing invented here |
| **Graceful Degradation** | Same UI across all device tiers, different performance |

---

## Navigation Structure

### Bottom Tab Bar (Mobile) / Top Nav (Desktop)

**Five tabs — standard app pattern:**

```
┌─────────────────────────────────────────────────┐
│  [🏠 Now]  [📡 Discover]  [➕]  [💬 Chats]  [⚙️] │
└─────────────────────────────────────────────────┘
```

| Tab | Purpose | Familiar Analog |
|-----|---------|-----------------|
| **Now** | Active channel + live matches | Twitter Home / Instagram Feed |
| **Discover** | Explore topics, trending thoughts | Twitter Explore / Reddit Browse |
| **➕ Compose** | Create/edit channel | Twitter Compose / Instagram Post |
| **Chats** | Active conversations | iMessage / WhatsApp |
| **Settings** | Channels, profile, preferences | Any app Settings |

**Design notes:**

- Compose button is centered, slightly larger, distinct color
- Badge notifications on Chats (unread count) and Now (new high-proximity matches)
- Desktop: Same tabs rendered as horizontal top nav with dropdowns

---

## Tab 1: NOW (Home Screen)

### Channel Header (Pinned at Top)

```
┌─────────────────────────────────────────────────┐
│  ● AI Ethics                           [▼] [✏️] │
│  "Ethical implications of machine learning..."  │
│  ─────────────────────────────────────────────  │
│  📍 Tokyo  •  🕐 2026  •  💭 Reflective         │
│  ─────────────────────────────────────────────  │
│  ◉ 14 nearby  •  Updated 3 min ago  •  [🔒 E2E] │
└─────────────────────────────────────────────────┘
```

**Interactions:**

- Tap `[▼]` → Bottom sheet with channel switcher
- Tap `[✏️]` → Inline edit mode (expands header)
- Tap relation chips (`📍 Tokyo`) → Edit/remove context
- Pull down anywhere → Refresh matches

**States:**

- **Active**: Filled dot `●`, relation chips visible
- **Inactive**: Hollow dot `○`, relations hidden, tap to activate
- **No matches**: "◉ 0 nearby — Your thoughts are rare right now"

---

### Match List (Main Content)

**Looks like a messaging app inbox — because it is:**

```
┌─────────────────────────────────────────────────┐
│  VERY CLOSE (0.85+)                             │
│  ─────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────┐ │
│  │ ▐▌▐▌▐  Alex Chen                          │ │
│  │        "Also thinking about AI copyright"  │ │
│  │        📍 Neo-Tokyo  •  🕐 2026            │ │
│  │                              [Tap to chat] │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  NEARBY (0.70–0.85)                             │
│  ─────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────┐ │
│  │ ▐▌▐▌░  Sam Ortiz                          │ │
│  │        "Derivative works in ML training"   │ │
│  │        🕐 Jan–Dec 2026                     │ │
│  │                              [Tap to chat] │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ ▐▌▐▌░  Group (3 people)                   │ │
│  │        "AI ethics + art + autonomy"        │ │
│  │                              [Join group]  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ORBITING (0.55–0.70)                           │
│  ─────────────────────────────────────────────  │
│  ▸ 12 more nearby thinkers  [Show All]          │
└─────────────────────────────────────────────────┘
```

**Visual encoding:**

- **Signal bars** (`▐▌▐▌▐`) replace numeric similarity — familiar from phone signal indicators
- **Section headers** group by proximity tier — scannable, no numbers needed
- **Relation chips** show shared context — text labels, not icons alone
- **Group indicator** shows member count — tap to join mesh chat

**Interactions:**

- Tap card → Slide-up chat panel (doesn't navigate away)
- Long-press card → Context menu: *Mute • Block • View Profile • Share*
- Swipe left → Quick mute (reveals red background)
- Swipe right → Quick bookmark (reveals yellow background)

**Empty states:**

- **No matches**: "No one nearby right now. Edit your thought or try Discover."
- **Loading**: Skeleton cards with shimmer animation
- **Offline**: "Looking for the network…" with spinning indicator

---

## Tab 2: DISCOVER (Explore)

### Search + Browse Interface

```
┌─────────────────────────────────────────────────┐
│  🔍 Search thoughts...                          │
│  ─────────────────────────────────────────────  │
│                                                 │
│  TRENDING NOW                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ AI Safety│ │ Climate │ │ Web3    │           │
│  │ 2.3k    │ │ Tech    │ │ Gaming  │           │
│  │ thinking│ │ 1.8k    │ │ 1.2k    │           │
│  └─────────┘ └─────────┘ └─────────┘           │
│                                                 │
│  NEARBY TOPICS                                  │
│  ┌───────────────────────────────────────────┐ │
│  │ 📍 Tokyo · AI Ethics                      │ │
│  │    47 people thinking nearby              │ │
│  │                           [Drift Here →]  │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ 🕐 2026 · Future of Work                  │ │
│  │    23 people thinking nearby              │ │
│  │                           [Drift Here →]  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  SUGGESTED CONTEXT                              │
│  Add to your channel to find better matches:   │
│  [📍 Location]  [🕐 Time]  [💭 Mood]  [🔬 Domain]│
└─────────────────────────────────────────────────┘
```

**Features:**

- **Search**: Semantic search (not keyword) — type "loneliness" → finds "solitude," "isolation," "quiet reflection"
- **Trending**: Aggregate high-engagement clusters — updated hourly
- **Nearby Topics**: Geo/temporal clusters you can "drift toward" (temporarily bias your matching)
- **Suggested Context**: Relation tags recommended based on your current description

**Interactions:**

- Tap topic card → Preview: top 3 thoughts + active chats in that cluster
- Tap `[Drift Here]` → Temporary 30-min bias toward that semantic area
- Tap suggested context → Auto-add to your channel (one-tap)

---

## Tab 3: COMPOSE (Create/Edit Channel)

### Single-Screen Editor

```
┌─────────────────────────────────────────────────┐
│  ← Cancel          New Channel        Save →   │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Channel Name                                   │
│  ┌───────────────────────────────────────────┐ │
│  │ AI Ethics                                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  What are you thinking about?                   │
│  ┌───────────────────────────────────────────┐ │
│  │ Ethical implications of machine learning, │ │
│  │ autonomy, and the philosophy of AI art.   │ │
│  │                                           │ │
│  │                                           │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│  ─────────────────────────────────────────────  │
│  + Add context (optional)                       │
│                                                 │
│  Added Context:                                 │
│  [📍 Tokyo          ✕]                          │
│  [🕐 2026           ✕]                          │
│  [💭 Reflective     ✕]                          │
│                                                 │
│  ─────────────────────────────────────────────  │
│  How specific are you being?                    │
│  Precise ○────●────○ Exploratory               │
│                                                 │
│  ─────────────────────────────────────────────  │
│  ◉ Estimated reach: 14–50 nearby minds         │
│                                                 │
│              [ Publish Channel ]                │
└─────────────────────────────────────────────────┘
```

**Key design choices:**

- **Single textarea** — no rich text, no markdown, no character counter
- **Context as chips** — tap `[+ Add context]` → bottom sheet with 10 relation types
- **Spread slider** — labeled in plain language ("Precise" vs "Exploratory")
- **Reach estimate** — live feedback as you type (based on current network state)

**Context Bottom Sheet:**

```
┌─────────────────────────────────────────────────┐
│  Add Context                             [Done] │
│  ─────────────────────────────────────────────  │
│                                                 │
│  📍 Place                                       │
│     "Where are you thinking this?"              │
│     [Use Current Location] [Enter Manually]     │
│                                                 │
│  🕐 Time Window                                 │
│     "When is this relevant?"                    │
│     [Now] [Today] [This Week] [Custom Range]    │
│                                                 │
│  💭 Mood / Tone                                 │
│     "What's the emotional context?"             │
│     [Reflective] [Excited] [Concerned] [Custom] │
│                                                 │
│  🔬 Domain                                      │
│     "What field or discipline?"                 │
│     [Technology] [Philosophy] [Art] [Custom]    │
│                                                 │
│  ⚡ Causal                                      │
│     "What causes what?"                         │
│     [Free text: "X leads to Y..."]              │
│                                                 │
│  ... (5 more relation types)                    │
│                                                 │
│  Max 5 contexts per channel                     │
└─────────────────────────────────────────────────┘
```

**Live Embedding Preview (Optional Enhancement):**

```
As user types, show subtle indicator:

┌─────────────────────────────────────────────────┐
│  Your thought is taking shape...                │
│  ─────────────────────────────────────────────  │
│  [████████████░░] Embedding ready              │
│  ─────────────────────────────────────────────  │
│  Suggested contexts: [📍 Place?] [🕐 Time?]     │
└─────────────────────────────────────────────────┘
```

**Validation:**

- Minimum 10 characters in description
- Channel name required (auto-suggest from first 20 chars if empty)
- Max 5 context tags (enforced in bottom sheet)

---

## Tab 4: CHATS (Conversations)

### Conversation List

**Looks exactly like iMessage / WhatsApp:**

```
┌─────────────────────────────────────────────────┐
│  Chats                               [Filter]  │
│  ─────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────┐ │
│  │ Alex Chen                      2 min ago  │ │
│  │ "the copyright angle is so..."            │ │
│  │ via AI Ethics · ▐▌▐▌▐ 0.91                │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ Sam Ortiz                     15 min ago  │ │
│  │ "yeah the Turing test thing..."           │ │
│  │ via AI Ethics · ▐▌▐▌░ 0.78                │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ 👥 Group: AI Ethics + Art     1 hr ago    │ │
│  │ Taylor: "What if we consider..."          │ │
│  │ 4 people · ▐▌▐▌▐ 0.88 avg                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ARCHIVED (3)  [Show]                          │
└─────────────────────────────────────────────────┘
```

**Key elements:**

- **Preview text**: Last message snippet (truncated at 40 chars)
- **Context line**: `via [Channel Name] · [Signal bars] [Similarity]`
- **Group indicator**: `👥` icon + member count
- **Timestamp**: Relative time (2 min, 15 min, 1 hr)

**Interactions:**

- Tap → Full-screen chat view
- Swipe left → Archive (reveals gray background)
- Long-press → Context menu: *Mute • Pin • Export • Delete*

**Empty state:**

- "No active conversations yet. Find your thought neighbors in Now or Discover."

---

### Chat View (Full Screen)

```
┌─────────────────────────────────────────────────┐
│  ← Alex Chen                        🔒 E2E  ⋮  │
│  ─────────────────────────────────────────────  │
│  via AI Ethics · ▐▌▐▌▐ 0.91 similarity         │
│  📍 Neo-Tokyo  •  🕐 2026  •  💭 Reflective    │
│  ─────────────────────────────────────────────  │
│                                                 │
│                                         2:34 PM │
│  ┌───────────────────────────────────────────┐ │
│  │ Hey! Saw your thought on AI copyright.    │ │
│  │ Really interesting perspective.           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Thanks! What's your take on               │ │
│  │ derivative works in ML training?          │ │
│  └───────────────────────────────────────────┘ │
│                                          You  │
│                                                 │
│  ─────────────────────────────────────────────  │
│  [ Type message...                    ]  [↑]   │
│  [🎤] [📎] [😊]                                │
└─────────────────────────────────────────────────┘
```

**Header behavior:**

- Similarity score updates live if either party edits their channel
- If similarity drops below 0.6: subtle banner appears

  ```
  ┌─────────────────────────────────────────────────┐
  │ Your thoughts are drifting apart. That's okay. │
  │                          [Continue] [End Chat] │
  └─────────────────────────────────────────────────┘
  ```

**Message features:**

- Standard bubbles (left = them, right = you)
- Timestamps on hover (mobile: tap message)
- Reactions: Long-press message → emoji picker
- No read receipts (privacy by default)
- No typing indicators (reduces pressure)

**Group chat:**

- Same layout, sender name above each bubble
- Header shows member list (tap to see details)
- Auto-formed when 3+ peers match within threshold
- Anyone can rename: tap group name → edit

---

## Tab 5: SETTINGS (Profile + Preferences)

### Profile Section (Top)

```
┌─────────────────────────────────────────────────┐
│  Profile                                        │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │    [Your Display Name]                    │ │
│  │    @optional-handle (for follows)         │ │
│  │                                           │ │
│  │    "What are you thinking about..."       │ │
│  │    [Current channel description preview]  │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Your Channels (4)                              │
│  ┌───────────────────────────────────────────┐ │
│  │ ● AI Ethics     14 nearby      [Active]   │ │
│  │ ○ Work          quiet            [Activate]│ │
│  │ ○ Evening       3 nearby         [Activate]│ │
│  │ ○ Weekend       1 nearby         [Activate]│ │
│  │                                           │ │
│  │ [+ New Channel]                           │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

### Preferences (Scrollable List)

```
│  ─────────────────────────────────────────────  │
│  PREFERENCES                                    │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Appearance                                     │
│  ├ Theme        [Dark ▸]                        │
│  ├ Text Size    [Medium ▸]                      │
│  └ Reduce Motion [Off ▸]                        │
│                                                 │
│  Privacy                                        │
│  ├ Ephemeral TTL    [24 hours ▸]               │
│  ├ Show Location    [Off ▸]                     │
│  ├ Allow Delegation [On ▸]                      │
│  └ Incognito Mode   [Off ▸]                     │
│                                                 │
│  Notifications                                  │
│  ├ New High-Proximity Match [On ▸]             │
│  ├ Chat Messages          [On ▸]               │
│  ├ Group Invitations      [On ▸]               │
│  └ Sound                    [On ▸]              │
│                                                 │
│  Network                                        │
│  ├ Device Tier        [Auto ▸]                  │
│  ├ Model Cache        [22 MB ▸]                 │
│  ├ Data Saver         [Off ▸]                   │
│  └ Export All Data    [→]                       │
│                                                 │
│  About                                          │
│  ├ Version            0.5.0                     │
│  ├ License            MIT                       │
│  └ No servers. No account. No surveillance.     │
└─────────────────────────────────────────────────┘
```

**Key toggles explained:**

| Setting | Plain-English Description |
|---------|--------------------------|
| **Allow Delegation** | "When enabled, your device helps others find matches faster (High-tier only)" |
| **Incognito Mode** | "Browse without appearing in others' match lists" |
| **Ephemeral TTL** | "How long your channel stays visible: 1h, 6h, 24h, 7d" |
| **Data Saver** | "Reduce model quality and match frequency on slow connections" |
| **Device Tier Override** | "Force a specific performance tier (default: Auto-detect)" |

---

## Channel Switcher (Bottom Sheet)

**Triggered from:** Now tab channel header, or Settings → Your Channels

```
┌─────────────────────────────────────────────────┐
│  Your Channels                           [Done] │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ● AI Ethics                               │ │
│  │   "Ethical implications of machine..."    │ │
│  │   ◉ 14 nearby  •  Updated 3 min ago       │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ○ Work                                    │ │
│  │   "Distributed systems, consensus..."     │ │
│  │   ◉ 0 nearby  •  Updated 2 hr ago         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ○ Evening                                 │ │
│  │   "Ambient music, slow fiction"           │ │
│  │   ◉ 3 nearby  •  Updated 1 day ago        │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ─────────────────────────────────────────────  │
│  [+ New Channel]                                │
└─────────────────────────────────────────────────┘
```

**Interactions:**

- Tap card → Activate channel (fills dot, updates Now tab)
- Swipe left → Quick actions: *Edit • Archive • Delete*
- Long-press → Drag to reorder (spatial memory for priority)

---

## Chat Panel (Slide-Up Overlay)

**Triggered from:** Tapping a match card in Now tab

**Does NOT navigate away** — preserves context of match list:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  [Match list still visible behind, blurred]    │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ╭─────────────────────────────────────╮  │ │
│  │ │ Alex Chen · 0.91 similarity    [×] │  │ │
│  │ │ "Also thinking about AI copyright" │  │ │
│  │ ╰─────────────────────────────────────╯  │ │
│  │                                          │ │
│  │ Hey! What's your take on                 │ │
│  │ derivative works?                        │ │
│  │                                          │ │
│  │ Interesting—I see it as...              │ │
│  │                                          │ │
│  │ ─────────────────────────────────────── │ │
│  │ [ Type message...              ]  [↑]   │ │
│  │ [🔒 E2E] [⏳ 24h TTL]                    │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Behavior:**

- Slides up from bottom (60% height default)
- Can be expanded to full screen (tap expand icon)
- Can be dismissed (swipe down or tap ×)
- Multiple chats can be open (swipe horizontally between them)
- Auto-minimizes after 5 minutes of inactivity

---

## Onboarding Flow

### First Launch (< 30 seconds total)

**Step 1: Single Input (5 seconds)**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              Welcome to ISC                     │
│                                                 │
│         Meet your thought neighbors.            │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  What are you thinking about right now?         │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │                                           │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│              [ Find Thought Neighbors ]         │
│                                                 │
│  No account. No server. No tracking.            │
└─────────────────────────────────────────────────┘
```

**Step 2: Processing (3 seconds)**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│         Finding minds like yours...             │
│                                                 │
│              [Animating spinner]                │
│                                                 │
│  Running locally on your device.                │
└─────────────────────────────────────────────────┘
```

**Step 3: First Match Reveal (5 seconds)**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  You have 3 thought neighbors nearby.           │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ▐▌▐▌▐  Alex                               │ │
│  │        "Also thinking about AI ethics"     │ │
│  │                              [Say Hello]   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Tap to start a conversation.                   │
│  Or edit your thought to find different people. │
│                                                 │
│              [ Continue to ISC ]                │
└─────────────────────────────────────────────────┘
```

**Step 4: Dropped into Now Tab**

- Tutorial tooltip (dismissible): "Pull down to refresh matches"
- Second tooltip (after 10 seconds): "Tap a card to chat"
- No more tutorials — interface is self-explanatory

---

## Accessibility Implementation

### Semantic HTML Structure

```html
<!-- Now Tab (Home) -->
<main role="main" aria-label="Thought neighbors">
  <header role="banner" aria-label="Active channel">
    <h1>AI Ethics</h1>
    <p>Ethical implications of machine learning...</p>
    <ul aria-label="Context tags">
      <li><span aria-hidden="true">📍</span> Tokyo</li>
      <li><span aria-hidden="true">🕐</span> 2026</li>
    </ul>
  </header>

  <section aria-label="Match list">
    <h2>Very Close</h2>
    <ul role="list">
      <li>
        <button aria-label="Alex Chen, 91% similarity, thinking about AI copyright">
          <span aria-hidden="true">▐▌▐▌▐</span>
          <span>Alex Chen</span>
          <p>"Also thinking about AI copyright"</p>
        </button>
      </li>
    </ul>
  </section>
</main>

<!-- Chat Panel -->
<div role="dialog" aria-label="Chat with Alex" aria-modal="false">
  <header>
    <h2>Alex Chen</h2>
    <p>91% similarity via AI Ethics</p>
  </header>
  <ul role="log" aria-label="Messages">
    <li role="listitem">
      <p>Hey! What's your take on derivative works?</p>
      <time>2:34 PM</time>
    </li>
  </ul>
  <form aria-label="Message input">
    <label for="message-input" class="visually-hidden">Type message</label>
    <input id="message-input" type="text" placeholder="Type message...">
    <button type="submit">Send</button>
  </form>
</div>
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle through interactive elements |
| `Enter` | Activate focused element (open chat, send message) |
| `Escape` | Close chat panel, dismiss modals |
| `Arrow Up/Down` | Navigate match list |
| `Arrow Left/Right` | Switch between open chats |
| `Ctrl+K` | Quick channel switcher |
| `Ctrl+N` | New channel composer |
| `Ctrl+M` | Focus message input |

### Screen Reader Announcements

```javascript
// When new match appears
announce('New match: Alex, 91% similarity, thinking about AI copyright');

// When similarity changes
announce('Similarity with Alex changed from 91% to 87%');

// When chat message received
announce('New message from Alex: Hey! What\'s your take...');

// When channel updated
announce('Channel updated. 14 people now nearby.');
```

### Motion Preferences

```css
/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Chat panel slide-up becomes instant fade */
.chat-panel {
  transition: transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .chat-panel {
    transition: opacity 0.1s ease;
    transform: none;
  }
}
```

---

## Device Tier Adaptation

### Same UI, Different Performance

| Feature | High Tier | Mid Tier | Low Tier | Minimal Tier |
|---------|-----------|----------|----------|--------------|
| **Layout** | Full (optional 2-column) | Standard mobile | Standard mobile | Text-only HTML |
| **Animations** | All enabled | Reduced | Minimal | None |
| **Live embedding preview** | Yes | Yes | No | No |
| **Match refresh rate** | 30 seconds | 60 seconds | 120 seconds | Manual only |
| **Model** | all-MiniLM-L6-v2 | paraphrase-MiniLM-L3-v3 | gte-tiny | Word-hash fallback |
| **Delegation** | Can serve + request | Can request | Can request | Can request |
| **Initial load** | ~25 MB | ~10 MB | ~5 MB | <50 KB |

### Minimal Tier (Text-Only Fallback)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ISC — AI Ethics</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 1rem; }
    .match { border-bottom: 1px solid #ccc; padding: 0.5rem 0; }
    .similarity { color: #666; }
    textarea { width: 100%; min-height: 100px; }
    nav { margin-top: 1rem; }
    nav a { margin-right: 1rem; }
  </style>
</head>
<body>
  <h1>● AI Ethics</h1>
  <p>Ethical implications of machine learning...</p>
  <p>📍 Tokyo · 🕐 2026 · 💭 Reflective</p>
  <p>◉ 14 nearby</p>

  <h2>Matches</h2>
  <div class="match">
    <a href="/chat/alex">
      <span class="similarity">▐▌▐▌▐</span>
      Alex — "Also thinking about AI copyright"
    </a>
  </div>
  <div class="match">
    <a href="/chat/sam">
      <span class="similarity">▐▌▐▌░</span>
      Sam — "Derivative works in ML training"
    </a>
  </div>

  <h2>New Thought</h2>
  <form action="/embed" method="POST">
    <textarea name="description" placeholder="Thinking about..."></textarea>
    <button type="submit">Embed</button>
  </form>

  <nav>
    <a href="/now">Now</a>
    <a href="/discover">Discover</a>
    <a href="/chats">Chats</a>
    <a href="/settings">Settings</a>
  </nav>
</body>
</html>
```

---

## Delegation Transparency UI

### When Delegation is Active

**Subtle indicator in status bar:**

```
┌─────────────────────────────────────────────────┐
│  ◉ 14 nearby  •  ⚡ Delegated  •  🔒 E2E        │
└─────────────────────────────────────────────────┘
```

**Tap indicator → Details:**

```
┌─────────────────────────────────────────────────┐
│  Delegation Status                              │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ✓ Using delegated embedding                    │
│    Provider: @supernode-alice                   │
│    Model: all-MiniLM-L6-v2                      │
│    Verified: ✓ Signature ✓ Norm ✓ Model         │
│                                                 │
│  Last request: 2 seconds ago                    │
│  Average latency: 247ms                         │
│                                                 │
│  ─────────────────────────────────────────────  │
│  [ Disable for this channel ]                   │
│  [ View delegation audit log ]                  │
│  [ Learn how delegation works → ]               │
└─────────────────────────────────────────────────┘
```

### When Delegation Fails

**Inline message (non-blocking):**

```
┌─────────────────────────────────────────────────┐
│  ⚠️ Matches limited (local mode)                │
│  No supernodes available. Using local model.    │
│                              [Retry] [Dismiss]  │
└─────────────────────────────────────────────────┘
```

### Settings Toggle

```
┌─────────────────────────────────────────────────┐
│  Allow Delegation                    [On ▸]     │
│  ─────────────────────────────────────────────  │
│  When enabled:                                  │
│  • Your device helps others find matches        │
│  • Others can request embedding assistance      │
│  • All results are verified locally             │
│                                                 │
│  [ Learn more about delegation → ]              │
└─────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Core MVP (Q1 2026)

- [ ] Bottom tab navigation structure
- [ ] Now tab: Channel header + match list
- [ ] Compose tab: Channel editor with context chips
- [ ] Chats tab: Conversation list + chat view
- [ ] Settings tab: Profile + preferences
- [ ] Channel switcher bottom sheet
- [ ] Slide-up chat panel overlay
- [ ] Basic accessibility (semantic HTML, keyboard nav)
- [ ] Device tier auto-detection

### Phase 2: Polish + Accessibility (Q2 2026)

- [ ] Screen reader announcements
- [ ] Motion preference support
- [ ] High contrast mode
- [ ] Internationalization (RTL, localized relation labels)
- [ ] Delegation transparency UI
- [ ] Live embedding preview (High/Mid tier)
- [ ] Discover tab: Search + trending
- [ ] Onboarding flow optimization

### Phase 3: Social Layer (Q3-Q4 2026)

- [ ] Follow system + profile cards
- [ ] Posts + semantic feeds
- [ ] Reactions (likes, reposts)
- [ ] Communities (shared channels)
- [ ] Audio spaces UI
- [ ] Crypto tipping integration

### Phase 4: Optional Visual Enhancements (2027+)

- [ ] **Cosmos Mode**: Toggle to visualize matches as orbiting orbs (from ui.1/ui.3)
- [ ] **Resonance Mode**: Waveform visualization for conversations (from ui.2)
- [ ] **Ambient Mode**: Floating orb in corner for background awareness
- [ ] **Gesture Navigation**: Pinch/swipe gestures for power users
- [ ] **Advanced Animations**: Particle effects, thought sculpting preview

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time-to-first-chat** | <60 seconds | From app load to first message sent |
| **Onboarding completion** | >90% | Users who reach Now tab after first launch |
| **Day-7 retention** | >40% | Users returning within 7 days |
| **Accessibility score** | WCAG 2.1 AA | Automated (axe-core) + manual audit |
| **Task success rate** | >95% | Users can create channel + find match without help |
| **System Usability Scale** | >80/100 | Post-session survey (n≥100) |
| **Minimal tier load time** | <2 seconds | On 3G connection, <50KB payload |

---

## Design Tokens

### Color Palette

```css
:root {
  /* Base (Dark Theme) */
  --bg-primary: #0A0F1E;
  --bg-secondary: #151A28;
  --bg-elevated: #1E2538;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --border-subtle: rgba(148, 163, 184, 0.2);

  /* Accent */
  --accent-primary: #6366F1;
  --accent-secondary: #818CF8;
  --accent-success: #10B981;
  --accent-warning: #F59E0B;
  --accent-danger: #EF4444;

  /* Proximity (Signal Bars) */
  --signal-strong: #22D3EE;
  --signal-medium: #818CF8;
  --signal-weak: #64748B;

  /* Light Theme */
  @media (prefers-color-scheme: light) {
    --bg-primary: #FFFFFF;
    --bg-secondary: #F8FAFC;
    --bg-elevated: #F1F5F9;
    --text-primary: #1E293B;
    --text-secondary: #64748B;
  }
}
```

### Typography

```css
:root {
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

### Spacing

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
}
```

### Component Specifications

```css
/* Card */
.card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
}

/* Button */
.button-primary {
  background: var(--accent-primary);
  color: white;
  padding: var(--space-3) var(--space-5);
  border-radius: 8px;
  font-weight: var(--font-weight-medium);
  min-height: 44px; /* Touch target */
}

/* Input */
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  min-height: 44px;
}

.input:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Bottom Sheet */
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  padding: var(--space-5);
  max-height: 80vh;
  overflow-y: auto;
}

/* Chat Panel Overlay */
.chat-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border-radius: 16px 16px 0 0;
  height: 60vh;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}

.chat-panel[open] {
  transform: translateY(0);
}
```

---

## What We Deferred to Phase 4 (Optional Visual Enhancements)

| Feature | From Proposal | Why Deferred |
|---------|---------------|--------------|
| Semantic Cosmos (orbiting orbs) | ui.1, ui.3 | Novel metaphor requires learning; add after core is stable |
| Waveform/resonance visualization | ui.2 | Too abstract for first-time users |
| Gesture-based navigation (pinch/swipe) | ui.1, ui.3 | Standard tap/click works; gestures are power-user feature |
| Chaos Mode particle effects | ui.1 | Decoration without functional value |
| Live embedding preview theater | ui.1, ui.3 | Nice-to-have; not essential for core flow |
| Advanced inspector panels | ui.1 | Power-user feature; defer until Phase 2 social layer |
| Haptic feedback patterns | ui.1, ui.3 | Enhancement, not requirement |
| Ambient floating orb mode | ui.3 | Secondary interaction pattern |

**Rationale**: These are all *enhancements* that add delight for experienced users, but are not required for the core value proposition: *"Describe your thought, find nearby minds, start chatting."*

---

## What We Adopted from Previous Proposals

| From | Adopted Element | Implementation |
|------|-----------------|----------------|
| **ui.1** | Accessibility checklist | Full ARIA, keyboard nav, screen reader announcements |
| **ui.1** | Relation tag visualization | Text chips with icons (📍 🕐 💭) |
| **ui.1** | Delegation transparency | Status indicator + verification details |
| **ui.1** | Tier-aware layout | Same UI, different performance characteristics |
| **ui.2** | "Drift Exit" concept | Humane banner when similarity drops |
| **ui.2** | Ephemeral by default | TTL countdown, natural conversation decay |
| **ui.3** | Live embedding preview | Optional enhancement (High/Mid tier) |
| **ui.3** | Bottom sheet navigation | Channel switcher, context picker |
| **ui.4** | Bottom tab structure | Now/Discover/Compose/Chats/Settings |
| **ui.4** | Signal bars for proximity | ▐▌▐▌▐ instead of numeric scores |
| **ui.4** | Familiar chat interface | iMessage-style bubbles, no novelty |
| **ui.4** | Single-screen onboarding | "What are you thinking?" → Find neighbors |
| **ui.4** | Text-over-graphics philosophy | Words before icons, numbers before visualizations |

---

> **Final Design Mantra**:
> *"Perfection is achieved not when there is nothing more to add,
> but when there is nothing left to take away."*
>
> ISC v5.0 uses **standard components** to deliver **novel functionality**.
> The interface is familiar on arrival. The experience is unlike anything else.
>
> **Next Step**: Build functional prototype in vanilla JS + CSS.
> Test with 10 first-time users. Remove anything they hesitate on.

---

## Appendix: Component Library Reference

| Component | Standard Analog | ISC Adaptation |
|-----------|-----------------|----------------|
| **Bottom Tab Bar** | Instagram, Twitter | 5 tabs, centered Compose button |
| **Card List** | Messaging app inbox | Match cards with signal bars |
| **Bottom Sheet** | iOS Action Sheet, Android Bottom Sheet | Channel switcher, context picker |
| **Slide-Up Panel** | iOS Control Center, Spotify Now Playing | Chat overlay (non-modal) |
| **Chip/Tag** | Gmail labels, iOS filters | Relation context (📍 🕐 💭) |
| **Slider** | Volume, brightness | Spread (Precise ↔ Exploratory) |
| **Skeleton Loader** | Facebook, LinkedIn | Match list loading state |
| **Toast/Banner** | Android Snackbar | Drift warning, delegation status |
| **Dropdown Menu** | Standard overflow menu | Chat actions, channel options |
| **Toggle Switch** | iOS Settings | Preferences (On/Off) |

**No custom components invented.** Every element is a variation on a pattern users already know.
