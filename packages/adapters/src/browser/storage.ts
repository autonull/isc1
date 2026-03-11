import { get, set, del, keys } from 'idb-keyval';
import { StorageAdapter } from '../interfaces/index.js';

export const browserStorage: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await get<T>(key);
      if (data !== undefined) return data;

      // Fallback to localStorage
      const localData = localStorage.getItem(key);
      if (localData) {
        return JSON.parse(localData) as T;
      }
      return null;
    } catch (e) {
      console.warn('Storage get error', e);
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await set(key, value);
    } catch (e) {
      console.warn('IndexedDB set failed, falling back to localStorage', e);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (lsErr) {
        console.error('All storage mechanisms failed', lsErr);
      }
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await del(key);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage delete error', e);
    }
  },

  async *keys(prefix?: string): AsyncIterable<string> {
    try {
      const allKeys = await keys();
      for (const key of allKeys) {
        if (typeof key === 'string' && (!prefix || key.startsWith(prefix))) {
          yield key;
        }
      }
    } catch (e) {
      console.warn('Storage keys iteration error', e);
    }
  }
};
