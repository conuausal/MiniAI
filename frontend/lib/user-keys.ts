'use client';

/**
 * 用户配置管理（API Keys + 自定义 OpenAI 兼容 provider）
 * - 存到 localStorage（仅本机）
 * - fetch 拦截器自动注入 X-User-API-Keys 和 X-User-Custom-Providers
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const KEYS_STORAGE_KEY = 'miniai:user-keys:v1';
const CUSTOM_STORAGE_KEY = 'miniai:user-custom-providers:v1';

// ============== 内置 Provider 元信息（与后端同步） ==============

export type BuiltinProvider = 'deepseek' | 'openai' | 'MiniMax' | 'zhipu' | 'moonshot' | 'qwen' | 'gemini';

export const PROVIDER_META: Record<BuiltinProvider, { label: string; emoji: string; signupUrl: string; hint: string }> = {
  deepseek:  { label: 'DeepSeek',     emoji: '🐋', signupUrl: 'https://platform.deepseek.com/', hint: '国产之光 · 中文最强 · 性价比极高' },
  openai:    { label: 'OpenAI',       emoji: '🧠', signupUrl: 'https://platform.openai.com/api-keys', hint: 'GPT-4o / o1 等 · 海外最强' },
  MiniMax:     { label: 'MiniMax',       emoji: '🤖', signupUrl: 'https://platform.MiniMax.io/', hint: 'MiniMax-M3 · 多模态旗舰' },
  zhipu:     { label: '智谱 GLM',      emoji: '🀄', signupUrl: 'https://open.bigmodel.cn/', hint: '国产 · GLM-4-Flash 有免费额度' },
  moonshot:  { label: 'Moonshot Kimi', emoji: '🌙', signupUrl: 'https://platform.moonshot.cn/', hint: '超长上下文 128K' },
  qwen:      { label: '通义千问 Qwen', emoji: '☁️', signupUrl: 'https://dashscope.console.aliyun.com/', hint: '阿里 DashScope · 兼容 OpenAI' },
  gemini:    { label: 'Google Gemini', emoji: '💎', signupUrl: 'https://aistudio.google.com/apikey', hint: 'Google Gemini · 多模态' },
};

export interface UserKeys {
  deepseek: string;
  openai: string;
  MiniMax: string;
  zhipu: string;
  moonshot: string;
  qwen: string;
  gemini: string;
}

const EMPTY_KEYS: UserKeys = { deepseek: '', openai: '', MiniMax: '', zhipu: '', moonshot: '', qwen: '', gemini: '' };

// ============== 自定义 Provider ==============

export interface CustomModel {
  id: string;
  label: string;
  tags?: string[];
}

export interface CustomProvider {
  id: string;          // 用户自定义的内部 ID（如 my_ollama）
  label: string;       // 显示名
  emoji: string;       // 图标
  baseUrl: string;     // OpenAI 兼容端点
  apiKey: string;      // 任意字符串（Ollama 可以是 "ollama"）
  models: CustomModel[];
}

export type CustomProviders = Record<string, CustomProvider>;

// ============== 全局 store（基于订阅） ==============

let keysCache: UserKeys = readKeys();
let customsCache: CustomProviders = readCustoms();
const listeners = new Set<() => void>();

function readKeys(): UserKeys {
  if (typeof window === 'undefined') return EMPTY_KEYS;
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return EMPTY_KEYS;
    const data = JSON.parse(raw);
    return { ...EMPTY_KEYS, ...data };
  } catch { return EMPTY_KEYS; }
}

function readCustoms(): CustomProviders {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch { return {}; }
}

function writeKeys(next: UserKeys) {
  if (typeof window === 'undefined') return;
  const slim: Record<string, string> = {};
  (Object.keys(next) as (keyof UserKeys)[]).forEach((k) => { if (next[k]) slim[k] = next[k]; });
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(slim));
}

function writeCustoms(next: CustomProviders) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS_STORAGE_KEY || e.key === CUSTOM_STORAGE_KEY) refresh();
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

function refresh() {
  keysCache = readKeys();
  customsCache = readCustoms();
  listeners.forEach((l) => l());
}

function setKey(provider: keyof UserKeys, value: string) {
  keysCache = { ...keysCache, [provider]: value };
  writeKeys(keysCache);
  listeners.forEach((l) => l());
}

function clearAllKeys() {
  keysCache = EMPTY_KEYS;
  localStorage.removeItem(KEYS_STORAGE_KEY);
  listeners.forEach((l) => l());
}

function setCustomProvider(id: string, p: CustomProvider) {
  customsCache = { ...customsCache, [id]: p };
  writeCustoms(customsCache);
  listeners.forEach((l) => l());
}

function removeCustomProvider(id: string) {
  const next = { ...customsCache };
  delete next[id];
  customsCache = next;
  writeCustoms(customsCache);
  listeners.forEach((l) => l());
}

// ============== Hook ==============

export function useUserKeys() {
  const keys = useSyncExternalStore(subscribe, () => keysCache, () => EMPTY_KEYS);
  const customs = useSyncExternalStore(subscribe, () => customsCache, () => ({} as CustomProviders));
  const hasAnyKey = Object.values(keys).some(Boolean);
  const hasAnyCustom = Object.keys(customs).length > 0;

  const set = useCallback((provider: keyof UserKeys, value: string) => setKey(provider, value), []);
  const clear = useCallback(() => clearAllKeys(), []);
  const setCustom = useCallback((id: string, p: CustomProvider) => setCustomProvider(id, p), []);
  const removeCustom = useCallback((id: string) => removeCustomProvider(id), []);

  return { keys, customs, hasAnyKey, hasAnyCustom, set, clear, setCustom, removeCustom };
}

// ============== Header 注入器（fetch 拦截） ==============

let patched = false;

export function patchFetchWithUserConfig() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    try {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      const ks = readKeys();
      const cs = readCustoms();
      const hasKeys = Object.values(ks).some(Boolean);
      const hasCustoms = Object.keys(cs).length > 0;
      if (hasKeys && !headers.has('X-User-API-Keys')) {
        headers.set('X-User-API-Keys', JSON.stringify(ks));
      }
      if (hasCustoms && !headers.has('X-User-Custom-Providers')) {
        headers.set('X-User-Custom-Providers', JSON.stringify(cs));
      }
      init.headers = headers;
    } catch { /* ignore */ }
    return original(input, init);
  };
}

if (typeof window !== 'undefined') {
  patchFetchWithUserConfig();
}
