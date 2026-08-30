'use client';

/** 登录鉴权客户端：共享 auth 状态 + login/register/logout。 */
import { useEffect, useSyncExternalStore } from 'react';

export interface AuthUser { id: number; username: string; }
export interface AuthState { user: AuthUser | null; loading: boolean; }

let _state: AuthState = { user: null, loading: true };
let _booted = false;
const _listeners = new Set<() => void>();

function _emit() { _listeners.forEach((l) => l()); }
function _subscribe(l: () => void) { _listeners.add(l); return () => { _listeners.delete(l); }; }
function _get() { return _state; }

async function _fetchMe() {
  if (_booted) return;
  _booted = true;
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const d = await res.json();
      _state = { user: d.user, loading: false };
    } else {
      _state = { user: null, loading: false };
    }
  } catch {
    _state = { user: null, loading: false };
  }
  _emit();
}

async function _post(url: string, body: object): Promise<AuthUser> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    let detail = '请求失败';
    try { detail = (await res.json()).detail || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const d = await res.json();
  _state = { user: d.user, loading: false };
  _emit();
  return d.user;
}

export const auth = {
  login: (username: string, password: string) => _post('/api/auth/login', { username, password }),
  register: (username: string, password: string) => _post('/api/auth/register', { username, password }),
  logout: async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    _state = { user: null, loading: false };
    _emit();
  },
};

export function useAuth() {
  const state = useSyncExternalStore(_subscribe, _get, _get);
  useEffect(() => { if (state.loading) _fetchMe(); }, [state.loading]);
  return { ...state, ...auth };
}
