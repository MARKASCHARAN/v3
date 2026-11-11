import { useSyncExternalStore } from 'react';
import { UserProfile } from '@/types/api';

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  user: UserProfile | null;
}

const STORAGE_KEY = 'v3_auth_session';
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSession: StoredAuthSession | null = null;

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const readSnapshot = (): StoredAuthSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedSession;
  }
  cachedRaw = raw;
  if (!raw) {
    cachedSession = null;
    return null;
  }
  try {
    cachedSession = JSON.parse(raw) as StoredAuthSession;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
};

export const getStoredAuthSession = (): StoredAuthSession | null => readSnapshot();

export const saveAuthSession = (session: StoredAuthSession): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const serialized = JSON.stringify(session);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  cachedRaw = serialized;
  cachedSession = session;
  notifyListeners();
};

export const clearAuthSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedSession = null;
  notifyListeners();
};

export const useAuthSession = (): StoredAuthSession | null => {
  return useSyncExternalStore(subscribe, readSnapshot, () => null);
};

