'use client';

import { useState } from 'react';
import { useUserKeys, Provider } from '@/lib/user-keys';
import { useDarkMode } from '@/lib/theme';

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  emoji: string;
  hint: string;
  signupUrl: string;
  recommended?: string;
}> = [
  { id: 'deepseek', label: 'DeepSeek', emoji: '🐋', hint: '国产之光，中文最强，性价比极高', signupUrl: 'https://platform.deepseek.com/', recommended: '推荐新手' },
  { id: 'openai', label: 'OpenAI', emoji: '🧠', hint: 'GPT-4o / o1 等，海外最强', signupUrl: 'https://platform.openai.com/api-keys' },
  { id: 'zhipu', label: '智谱 GLM', emoji: '🀄', hint: '国产，GLM-4-Flash 有免费额度', signupUrl: 'https://open.bigmodel.cn/' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiKeyDrawer({ open, onClose }: Props) {
  const { keys, set, hasAny, clear } = useUserKeys();
  const { isDark, toggle } = useDarkMode();
  const [show, setShow] = useState<Record<Provider, boolean>>({ openai: false, deepseek: false, zhipu: false });

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface shadow-xl animate-drawer-in flex flex-col">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-semibold">设置</h2>
            <p className="text-xs text-text-mute mt-1">你的 Key 只保存在本机浏览器，不上传服务器。</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn !p-2 rounded-full" aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 主题切换 */}
          <section>
            <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider mb-2">外观</h3>
            <div className="flex items-center justify-between p-4 surface rounded-xl">
              <div>
                <div className="text-sm font-medium">{isDark ? '🌙 暗色模式' : '☀️ 亮色模式'}</div>
                <div className="text-xs text-text-mute mt-0.5">跟随系统自动切换</div>
              </div>
              <button
                onClick={toggle}
                className={`relative w-11 h-6 rounded-full transition ${isDark ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isDark ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </section>

          {/* API Keys */}
          <section>
            <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider mb-2">API Keys</h3>
            <div className="space-y-3">
              {PROVIDERS.map((p) => (
                <div key={p.id} className="surface rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                        {p.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                            {p.recommended}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-mute mt-1">{p.hint}</p>
                    </div>
                    {keys[p.id] && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        ✓ 已配置
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type={show[p.id] ? 'text' : 'password'}
                      value={keys[p.id] || ''}
                      onChange={(e) => set(p.id, e.target.value)}
                      placeholder={`${p.label} API Key`}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                    />
                    <button
                      onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      className="btn-ghost btn !p-2"
                      title={show[p.id] ? '隐藏' : '显示'}
                    >
                      {show[p.id] ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <a
                    href={p.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-600 hover:underline mt-2 inline-block"
                  >
                    注册获取 → {p.signupUrl.replace('https://', '')}
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* 关于 */}
          <section>
            <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider mb-2">关于</h3>
            <div className="surface rounded-xl p-4 text-sm space-y-2 text-text-soft">
              <p>🧠 MiniAI v0.4.0 · 开源个人 AI 助手</p>
              <p>📦 数据全部本地存储（Key、会话、知识库）</p>
              <p>
                🔗{' '}
                <a href="https://github.com/conuausal/MiniAI" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  GitHub: conuausal/MiniAI
                </a>
              </p>
            </div>
          </section>
        </div>

        <footer className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => { if (confirm('确定清空所有 Key？')) clear(); }}
            disabled={!hasAny}
            className="btn-ghost btn text-red-600 disabled:opacity-40"
          >
            🗑️ 清空
          </button>
          <button onClick={onClose} className="btn btn-primary">
            完成
          </button>
        </footer>
      </aside>
    </>
  );
}
