'use client';

/**
 * 用户 API Key 管理：
 * - 存到 localStorage（仅本机，不上传到后端）
 * - fetch 拦截器自动注入 X-User-API-Keys header
 * - 任何页面 / 组件都可以通过 useUserKeys() 访问
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'miniai:user-keys:v1';

export type Provider = 'openai' | 'deepseek' | 'zhipu';

export interface ProviderKey {
  provider: Provider;
  apiKey: string;
}

export interface UserKeys {
  openai: string;
  deepseek: string;
  zhipu: string;
}

const EMPTY: UserKeys = { openai: '', deepseek: '', zhipu: '' };

// ============== 全局 store（基于订阅） ==============

let cache: UserKeys = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): UserKeys {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const data = JSON.parse(raw);
    return { openai: data.openai || '', deepseek: data.deepseek || '', zhipu: data.zhipu || '' };
  } catch {
    return EMPTY;
  }
}

function writeToStorage(next: UserKeys) {
  if (typeof window === 'undefined') return;
  // 仅保存非空的 key，节省空间
  const slim: Record<string, string> = {};
  if (next.openai) slim.openai = next.openai;
  if (next.deepseek) slim.deepseek = next.deepseek;
  if (next.zhipu) slim.zhipu = next.zhipu;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // 监听跨标签页变化
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) refresh(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

function refresh() {
  cache = readFromStorage();
  listeners.forEach((l) => l());
}

function setKey(provider: Provider, value: string) {
  cache = { ...cache, [provider]: value };
  writeToStorage(cache);
  listeners.forEach((l) => l());
}

function clearAll() {
  cache = EMPTY;
  localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

// ============== Hook ==============

export function useUserKeys() {
  const keys = useSyncExternalStore(subscribe, () => cache, () => EMPTY);
  const hasAny = Boolean(keys.openai || keys.deepseek || keys.zhipu);
  const set = useCallback((provider: Provider, value: string) => setKey(provider, value), []);
  const clear = useCallback(() => clearAll(), []);
  return { keys, hasAny, set, clear };
}

// ============== Header 注入器（在 layout 加载一次） ==============

let patched = false;

export function patchFetchWithUserKeys() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    try {
      const k = readFromStorage();
      const hasAny = k.openai || k.deepseek || k.zhipu;
      if (hasAny) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        // 仅当还没设置时才覆盖（允许测试场景手动设置）
        if (!headers.has('X-User-API-Keys')) {
          headers.set('X-User-API-Keys', JSON.stringify(k));
        }
        init.headers = headers;
      }
    } catch { /* ignore */ }
    return original(input, init);
  };
}

// 在客户端加载时立即 patch（一次性）
if (typeof window !== 'undefined') {
  patchFetchWithUserKeys();
}
