/**
 * 统一键值读写：按 PersistMode 选 local / session
 */

import { getDataStore } from "./mode";

export function kvGet(key: string): string | null {
  const store = getDataStore();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: string): void {
  const store = getDataStore();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    // quota / private mode
  }
}

export function kvRemove(key: string): void {
  const store = getDataStore();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

export function kvGetJson<T>(key: string): T | null {
  const raw = kvGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function kvSetJson(key: string, value: unknown): void {
  try {
    kvSet(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
