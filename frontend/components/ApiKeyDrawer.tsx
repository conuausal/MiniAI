'use client';

import { useState } from 'react';
import { useUserKeys, PROVIDER_META, BuiltinProvider, CustomProvider, CustomModel } from '@/lib/user-keys';
import { useDarkMode } from '@/lib/theme';
import clsx from 'clsx';

const BUILTIN_PROVIDERS: BuiltinProvider[] = ['deepseek', 'openai', 'MiniMax', 'zhipu', 'moonshot', 'qwen', 'gemini'];

interface Props { open: boolean; onClose: () => void; }

export default function ApiKeyDrawer({ open, onClose }: Props) {
  const { keys, customs, hasAnyKey, hasAnyCustom, set, clear, setCustom, removeCustom } = useUserKeys();
  const { isDark, toggle } = useDarkMode();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [editingCustom, setEditingCustom] = useState<CustomProvider | null>(null);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface shadow-xl animate-drawer-in flex flex-col">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-serif font-semibold">设置</h2>
            <p className="text-xs text-text-mute mt-1">所有 Key 只保存在本机浏览器，不上传服务器。</p>
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
                <div className="text-xs text-text-mute mt-0.5">跟随系统偏好自动切换</div>
              </div>
              <button onClick={toggle} className={clsx('relative w-11 h-6 rounded-full transition', isDark ? 'bg-brand-600' : 'bg-gray-300')}>
                <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform', isDark && 'translate-x-5')} />
              </button>
            </div>
          </section>

          {/* 内置 Provider Keys */}
          <section>
            <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider mb-2">主流模型 API Keys</h3>
            <div className="space-y-2.5">
              {BUILTIN_PROVIDERS.map((pid) => {
                const meta = PROVIDER_META[pid];
                return (
                  <div key={pid} className="surface rounded-xl p-3.5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <span>{meta.emoji}</span>
                          <span>{meta.label}</span>
                        </div>
                        <p className="text-[11px] text-text-mute mt-0.5">{meta.hint}</p>
                      </div>
                      {keys[pid] && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={show[pid] ? 'text' : 'password'}
                        value={keys[pid] || ''}
                        onChange={(e) => set(pid, e.target.value)}
                        placeholder={`${meta.label} API Key`}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                      />
                      <button onClick={() => setShow((s) => ({ ...s, [pid]: !s[pid] }))} className="btn-ghost btn !p-1.5 text-xs" title={show[pid] ? '隐藏' : '显示'}>
                        {show[pid] ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <a href={meta.signupUrl} target="_blank" rel="noreferrer" className="text-[11px] text-brand-600 hover:underline mt-1.5 inline-block">
                      注册获取 →
                    </a>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 自定义 Provider */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider">自定义 OpenAI 兼容服务</h3>
              <button
                onClick={() => setEditingCustom({ id: `custom_${Date.now()}`, label: '', emoji: '⚙️', baseUrl: '', apiKey: '', models: [] })}
                className="text-xs text-brand-600 hover:underline"
              >
                ＋ 添加
              </button>
            </div>
            <p className="text-[11px] text-text-mute mb-3">
              接入任意 OpenAI 兼容端点：本地 Ollama、公司内网代理、One-API、OpenRouter 等。
            </p>
            <div className="space-y-2">
              {Object.values(customs).map((c) => (
                <div key={c.id} className="surface rounded-xl p-3.5 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <span>{c.emoji}</span>
                        <span className="truncate">{c.label || '(未命名)'}</span>
                      </div>
                      <div className="text-[11px] text-text-mute mt-0.5 truncate" title={c.baseUrl}>{c.baseUrl}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.models.map((m) => (
                          <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-bg-soft text-text-soft font-mono">
                            {m.id}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => setEditingCustom(c)} className="btn-ghost btn !p-1.5 text-xs" title="编辑">✏️</button>
                      <button onClick={() => { if (confirm('删除这个自定义服务？')) removeCustom(c.id); }} className="btn-ghost btn !p-1.5 text-xs hover:text-red-500" title="删除">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 关于 */}
          <section>
            <h3 className="text-xs font-semibold text-text-soft uppercase tracking-wider mb-2">关于</h3>
            <div className="surface rounded-xl p-4 text-sm space-y-1.5 text-text-soft">
              <p>🧠 MiniAI v0.5.0 · 开源个人 AI 助手</p>
              <p>📦 数据全部本地存储（Key、会话、知识库）</p>
              <p>🔗 <a href="https://github.com/conuausal/MiniAI" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">GitHub: conuausal/MiniAI</a></p>
            </div>
          </section>
        </div>

        <footer className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button
            onClick={() => { if (confirm('清空所有内置 API Key？')) clear(); }}
            disabled={!hasAnyKey && !hasAnyCustom}
            className="btn-ghost btn text-red-600 disabled:opacity-40 text-xs"
          >
            🗑️ 清空内置
          </button>
          <button onClick={onClose} className="btn btn-primary">
            完成
          </button>
        </footer>
      </aside>

      {editingCustom && (
        <CustomProviderEditor
          initial={editingCustom}
          onSave={(p) => { setCustom(p.id, p); setEditingCustom(null); }}
          onCancel={() => setEditingCustom(null)}
        />
      )}
    </>
  );
}

// ============== 自定义 Provider 编辑器弹窗 ==============

function CustomProviderEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: CustomProvider;
  onSave: (p: CustomProvider) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CustomProvider>(initial);
  const [modelsText, setModelsText] = useState(
    initial.models.map((m) => `${m.id}|${m.label}`).join('\n')
  );

  const parse = () => {
    const models: CustomModel[] = modelsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, label] = line.split('|').map((s) => s.trim());
        return { id, label: label || id };
      })
      .filter((m) => m.id);
    setDraft({ ...draft, models });
  };

  const valid = draft.baseUrl.trim() && draft.models.length > 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] grid place-items-center p-4 pointer-events-none">
        <div className="bg-surface rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up pointer-events-auto">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-serif font-semibold text-lg">自定义 OpenAI 兼容服务</h3>
            <button onClick={onCancel} className="btn-ghost btn !p-1.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <Row label="显示名">
              <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="例如：本地 Ollama / 公司内网 / OpenRouter"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Row>

            <Row label="图标（emoji）">
              <input value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                placeholder="🦙 / 🏢 / 🔌" maxLength={4}
                className="w-20 px-3 py-2 text-sm text-center rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Row>

            <Row label="Base URL *" hint="OpenAI 兼容端点">
              <input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300" />
              <div className="text-[10px] text-text-mute mt-1">
                常见：Ollama <code>http://localhost:11434/v1</code> · OpenRouter <code>https://openrouter.ai/api/v1</code> · One-API 自部署
              </div>
            </Row>

            <Row label="API Key">
              <input value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-... （Ollama 可填任意值）"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Row>

            <Row label="模型列表 *" hint="每行一个：model_id|显示名">
              <textarea
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
                onBlur={parse}
                placeholder={'llama3.2:3b|Llama 3.2 3B\nqwen2.5:7b|Qwen 2.5 7B'}
                rows={5}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
              />
              {draft.models.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {draft.models.map((m) => (
                    <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 font-mono">
                      {m.id}
                    </span>
                  ))}
                </div>
              )}
            </Row>
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
            <button onClick={onCancel} className="btn btn-ghost">取消</button>
            <button
              onClick={() => onSave(draft)}
              disabled={!valid}
              className="btn btn-primary"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-medium text-text-soft mb-1.5">
        <span>{label}</span>
        {hint && <span className="font-normal text-text-mute text-[10px]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
