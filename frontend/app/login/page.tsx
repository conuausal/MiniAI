'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace('/'); }, [user, router]);

  const submit = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || '出错了，请重试');
    }
    setBusy(false);
  };

  return (
    <div className="h-screen grid place-items-center bg-bg px-4">
      <div className="glass-card rounded-2xl w-full max-w-sm p-8 animate-slide-up">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🧠</div>
          <h1 className="font-serif text-2xl font-semibold text-hero">MiniAI</h1>
          <p className="text-sm text-text-soft mt-1">{mode === 'login' ? '登录你的账号' : '注册新账号'}</p>
        </div>
        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名（3-32 位字母/数字/下划线/中文）"
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="密码（至少 6 位）"
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <button
            onClick={submit}
            disabled={!username.trim() || password.length < 6 || busy}
            className="w-full btn btn-primary !py-2.5 disabled:opacity-40"
          >
            {busy ? '请稍候…' : mode === 'login' ? '登 录' : '注册并登录'}
          </button>
          <div className="text-center text-xs text-text-mute">
            {mode === 'login' ? (
              <>还没有账号？<button onClick={() => setMode('register')} className="text-primary hover:underline">去注册</button></>
            ) : (
              <>已有账号？<button onClick={() => setMode('login')} className="text-primary hover:underline">去登录</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
