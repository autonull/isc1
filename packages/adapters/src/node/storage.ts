import { StorageAdapter } from '../interfaces/index.js';

let fs: any;
let path: any;
let os: any;

const getStorageFile = async () => {
  if (!fs) {
    // Lazy load node modules using dynamic import so this file can be parsed by Vite without breaking
    // even though it's technically a node-only file.
    fs = await import('fs/promises');
    path = await import('path');
    os = await import('os');
  }
  return path.join(os.homedir(), '.isc-storage.json');
};

async function loadStorageData(): Promise<Record<string, any>> {
  try {
    const file = await getStorageFile();
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {};
    }
    console.warn(`Failed to read storage file: ${err.message}`);
    return {};
  }
}

async function saveStorageData(data: Record<string, any>): Promise<void> {
  try {
    const file = await getStorageFile();
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.error(`Failed to write storage file: ${err.message}`);
  }
}

export const nodeStorage: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    const data = await loadStorageData();
    if (data[key] !== undefined) {
      return data[key] as T;
    }
    return null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    const data = await loadStorageData();
    data[key] = value;
    await saveStorageData(data);
  },

  async delete(key: string): Promise<void> {
    const data = await loadStorageData();
    if (data[key] !== undefined) {
      delete data[key];
      await saveStorageData(data);
    }
  },

  async *keys(prefix?: string): AsyncIterable<string> {
    const data = await loadStorageData();
    for (const key of Object.keys(data)) {
      if (!prefix || key.startsWith(prefix)) {
        yield key;
      }
    }
  }
};
