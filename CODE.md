# ISC Monorepo Architecture

> **Purpose**: Modular architecture and package structure specification.
>
> For an overview, see [README.md](README.md#modular-architecture).

---

## Goal

Maximize code sharing across browser, Node.js server, CLI, and future form factors while maintaining clean separation of environment-specific concerns.

---

## Architecture Principles

1. **Core logic is environment-agnostic** — Embedding math, LSH, relational matching, and protocol logic have no browser or Node.js dependencies.
2. **Environment adapters are pluggable** — Storage, networking, and model loading are abstracted behind interfaces with multiple implementations.
3. **Dependencies are layered** — Core packages have zero browser-specific or Node.js-specific dependencies.
4. **Form factors are compositions** — Browser app, Node.js server, CLI, and future apps are thin compositions of shared packages.

---

## Package Structure

```
isc/
├── packages/
│   ├── core/                    # Environment-agnostic core logic
│   ├── adapters/                # Environment-specific implementations
│   ├── protocol/                # Libp2p protocol definitions
│   └── apps/                    # Form-factor compositions
│
├── docs/
│   ├── README.md                # Complete architectural overview
│   ├── PROTOCOL.md
│   ├── SEMANTIC.md
│   ├── DELEGATION.md
│   ├── SECURITY.md
│   ├── SOCIAL.md
│   ├── MONOREPO.md
│   ├── GETTING_STARTED.md
│   └── ROADMAP.md
│
├── package.json                 # Root workspace config
└── tsconfig.json                # Shared TypeScript config
```

---

## Package Details

### `@isc/core` — Environment-Agnostic Core

**Purpose**: Pure JavaScript/TypeScript logic with zero environment dependencies.

**Exports**:

```typescript
// Embedding & semantic matching
export function computeRelationalDistributions(channel: Channel): Distribution[];
export function relationalMatch(myDists: Distribution[], peerDists: Distribution[]): number;
export function cosineSimilarity(a: number[], b: number[]): number;

// LSH & DHT key generation
export function lshHash(vec: number[], channelId: string, seed: string): string[];

// Monte Carlo sampling
export function sampleFromDistribution(mu: number[], sigma: number, n: number): number[][];

// Cryptography (uses Web Crypto API abstraction)
export function generateKeypair(): Promise<Keypair>;
export function sign(payload: Uint8Array, keypair: Keypair): Promise<Signature>;
export function verify(payload: Uint8Array, signature: Signature, publicKey: PublicKey): Promise<boolean>;

// Types - see PROTOCOL.md for interface definitions
export type { Channel, Distribution, Relation, Keypair };
```

**Dependencies**: None (pure JS/TS only)

**Testable**: Core logic (embedding math, LSH, matching, crypto abstraction) testable in Node.js.
**Requires Mocks**: Web Crypto API (use Node.js crypto module), IndexedDB (use LevelDB adapter).
**Test Coverage Goal**: 90% for @isc/core, 70% for @isc/protocol.

---

### `@isc/adapters` — Environment-Specific Implementations

**Purpose**: Provide concrete implementations of abstract interfaces for different environments.

**Structure**:

```
adapters/
├── src/
│   ├── interfaces/              # Abstract interfaces
│   ├── browser/                 # Browser implementations
│   ├── node/                    # Node.js implementations
│   ├── cli/                     # CLI implementations
│   └── index.ts                 # Exports by environment
```

#### Interfaces (Abstract)

```typescript
// Storage interface
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): AsyncIterable<string>;
}

// Model loading interface
export interface EmbeddingModelAdapter {
  load(modelId: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  unload(): Promise<void>;
}

// Networking interface
export interface NetworkAdapter {
  announce(payload: SignedAnnouncement): Promise<void>;
  query(key: string): Promise<SignedAnnouncement[]>;
  dial(peerId: string, protocol: string): Promise<Stream>;
}

// Tier detection interface
export interface TierDetector {
  detect(): Promise<Tier>;
}
```

#### Browser Implementations

```typescript
export const browserStorage: StorageAdapter = {
  get: async (key) => {
    const data = await indexedDB.get(key);
    return data ?? localStorage.getItem(key);
  },
  set: async (key, value) => { /* IndexedDB + localStorage fallback */ },
};

export const browserModel: EmbeddingModelAdapter = {
  load: async (modelId) => {
    const { pipeline } = await import('@xenova/transformers.js');
    // Load model in Web Worker
  },
  embed: async (text) => { /* Web Worker inference */ },
};

export const browserNetwork: NetworkAdapter = {
  announce: async (payload) => { /* libp2p browser */ },
};

export const browserTierDetector: TierDetector = {
  detect: async () => {
    const cores = navigator.hardwareConcurrency ?? 2;
    const mem = navigator.deviceMemory ?? 1;
    // ...
  },
};
```

**Dependencies**: `@xenova/transformers.js`, `libp2p`, `indexeddb`, browser APIs

#### Node.js Implementations

```typescript
export const nodeStorage: StorageAdapter = {
  get: async (key) => await db.get(key),
  set: async (key, value) => { /* LevelDB/RocksDB */ },
};

export const nodeModel: EmbeddingModelAdapter = {
  load: async (modelId) => { /* ONNX Runtime */ },
  embed: async (text) => { /* Native inference */ },
};

export const nodeNetwork: NetworkAdapter = {
  announce: async (payload) => { /* libp2p TCP */ },
};

export const nodeTierDetector: TierDetector = {
  detect: async () => 'high',  // Server = always high tier
};
```

**Dependencies**: `libp2p`, `@libp2p/tcp`, `leveldb`, `onnxruntime-node`

---

### `@isc/protocol` — Libp2p Protocol Definitions

**Purpose**: Define protocol handlers, message formats, and stream handlers.

**Exports**:

```typescript
// Protocol constants
export const PROTOCOL_CHAT = '/isc/chat/1.0';
export const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
export const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';

// Message types - see PROTOCOL.md for interface definitions
export type { ChatMessage, DelegateRequest, DelegateResponse };

// Protocol handlers
export function createChatHandler(stream: Stream): ChatProtocol;
export function createDelegateHandler(capabilities: Capabilities): DelegateProtocol;
export function createAnnounceHandler(dht: DHT): AnnounceProtocol;
```

**Dependencies**: `@isc/core`, `libp2p`, `it-pipe`

---

### `@isc/apps/*` — Form Factor Compositions

#### Browser App (`@isc/apps/browser`)

```typescript
import { computeRelationalDistributions } from '@isc/core';
import { browserStorage, browserModel, browserNetwork } from '@isc/adapters/browser';

const app = new ISCApp({
  storage: browserStorage,
  model: browserModel,
  network: browserNetwork,
});

app.mount(document.getElementById('app'));
```

**Dependencies**: `@isc/core`, `@isc/adapters`, `@isc/protocol`

#### Node.js Server (`@isc/apps/node`)

```typescript
import { computeRelationalDistributions } from '@isc/core';
import { nodeStorage, nodeModel, nodeNetwork } from '@isc/adapters/node';

const app = new ISCApp({
  storage: nodeStorage,
  model: nodeModel,
  network: nodeNetwork,
});

app.enableSupernode({ maxConcurrentRequests: 10 });
http.listen(3000);
```

**Dependencies**: `@isc/core`, `@isc/adapters`, `@isc/protocol`, `express`

#### CLI App (`@isc/apps/cli`)

```typescript
import { cosineSimilarity } from '@isc/core';
import { cliModel } from '@isc/adapters/cli';

program.command('embed <text>').action(async (text) => {
  const model = cliModel;
  await model.load('Xenova/all-MiniLM-L6-v2');
  const embedding = await model.embed(text);
  console.log(JSON.stringify(embedding));
});
```

**Dependencies**: `@isc/core`, `@isc/adapters`, `commander`

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        Form Factor Apps                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Browser  │  │  Node.js │  │   CLI    │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│       └─────────────┴─────────────┘                              │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   @isc/protocol                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  @isc/adapters                               │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐                  │ │
│  │   │ Browser  │  │ Node.js  │  │   CLI    │                  │ │
│  │   └──────────┘  └──────────┘  └──────────┘                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    @isc/core                                 │ │
│  │         (Pure JS: embedding, LSH, matching, crypto)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Sharing Matrix

| Module | Browser | Node.js | CLI |
|--------|---------|---------|-----|
| **@isc/core** | ✅ 100% | ✅ 100% | ✅ 100% |
| **@isc/protocol** | ✅ 100% | ✅ 100% | ⚠️ Partial |
| **Storage** | IndexedDB | LevelDB | JSON file |
| **Model** | transformers.js | ONNX Runtime | ONNX Runtime |
| **Network** | libp2p (browser) | libp2p (TCP) | libp2p (TCP) |

---

## Workspace Configuration

### Root `package.json`

```json
{
  "name": "isc-monorepo",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/adapters",
    "packages/protocol",
    "apps/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "dev:browser": "turbo run dev --filter=@isc/apps/browser",
    "dev:node": "turbo run dev --filter=@isc/apps/node"
  },
  "devDependencies": {
    "turbo": "^1.10",
    "typescript": "^5.0"
  }
}
```

### `packages/core/package.json`

```json
{
  "name": "@isc/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^0.34",
    "typescript": "^5.0"
  }
}
```

---

## Migration Strategy

### Phase 1: Extract Core

1. Move pure functions to `packages/core/`
2. Remove all browser/Node.js imports from core
3. Add comprehensive unit tests (run in Node.js CI)

### Phase 2: Create Adapters

1. Define interfaces in `adapters/src/interfaces/`
2. Move browser-specific code to `adapters/src/browser/`
3. Create Node.js implementations in `adapters/src/node/`
4. Update browser app to import from adapters

### Phase 3: Extract Protocol

1. Move libp2p protocol handlers to `packages/protocol/`
2. Define message types and handlers
3. Update both browser and Node.js apps to use protocol package

### Phase 4: Create Node.js Server

1. Compose `@isc/apps/node` from core + adapters + protocol
2. Add HTTP API for monitoring
3. Add Prometheus metrics export
4. Deploy as supernode reference implementation

### Phase 5: CLI Tool

1. Compose `@isc/apps/cli` for embedding/matching utilities
2. Add to npm for community use
3. Use in CI for ground-truth fixture generation

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Code reuse** | 80-90% of logic shared across all form factors |
| **Testability** | Core logic testable in Node.js without browser mocks |
| **Maintainability** | Bug fixes in core automatically benefit all apps |
| **Extensibility** | New form factors only need adapter implementations |
| **Performance** | Node.js server can use native ONNX Runtime |

---

## Example: Same Logic, Different Environments

### Browser

```typescript
import { computeRelationalDistributions } from '@isc/core';
import { browserModel } from '@isc/adapters/browser';

await browserModel.load('Xenova/all-MiniLM-L6-v2');
const dists = await computeRelationalDistributions(channel);
```

### Node.js Server

```typescript
import { computeRelationalDistributions } from '@isc/core';
import { nodeModel } from '@isc/adapters/node';

await nodeModel.load('Xenova/all-MiniLM-L6-v2');
const dists = await computeRelationalDistributions(channel);
```

### CLI

```typescript
import { computeRelationalDistributions } from '@isc/core';
import { cliModel } from '@isc/adapters/cli';

await cliModel.load('Xenova/all-MiniLM-L6-v2');
const dists = await computeRelationalDistributions(channel);
```

**Same core function, different model adapters, identical results.**

---

## Future Form Factors

| Form Factor | Adapter Needed | Effort |
|-------------|----------------|--------|
| **Desktop (Electron)** | Electron storage + model | Low (reuse Node.js) |
| **iOS/Android (Native)** | Swift/Kotlin core bindings | High (FFI layer) |
| **Edge (Cloudflare Workers)** | KV storage + edge model | Medium (WASM model) |
| **Browser Extension** | Extension storage + model | Low (reuse browser) |
| **Discord/Slack Bot** | Discord/Slack network adapter | Medium (protocol bridge) |
