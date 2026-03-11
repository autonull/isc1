export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): AsyncIterable<string>;
}

export interface EmbeddingModelAdapter {
  load(modelId: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  unload(): Promise<void>;
}

export interface NetworkAdapter {
  announce(payload: any): Promise<void>;
  query(key: string): Promise<any[]>;
  dial(peerId: string, protocol: string): Promise<any>;
}

export interface TierDetector {
  detect(): Promise<'minimal' | 'low' | 'mid' | 'high'>;
}
