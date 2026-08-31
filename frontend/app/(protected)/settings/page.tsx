'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import { api, ModelInfo, ToolInfo, UserPreferences } from '@/lib/api';
import { useUserKeys } from '@/lib/user-keys';
import clsx from 'clsx';

const STAT_COLORS = [
  'from-emerald-400/20 to-emerald-500/10 border-emerald-300/40',
  'from-primary/20 to-accent-purple/15 border-primary/30',
  'from-accent-orange/20 to-accent-yellow/15 border-accent-orange/30',
];

const WEBHOOK_TEMPLATE = {
  name: 'my_tool',
  description: '描述这个工具做什么，模型据此决定何时调用',
  url: 'http://localhost:9000/my-tool',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '参数说明' },
    },
    required: ['query'],
  },
};

export default function SettingsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [health, setHealth] = useState<string>('检测中…');
  const { hasAny } = useUserKeys();

  // 个性化
  const [systemPrompt, setSystemPrompt] = useState('');
  const [customTools, setCustomTools] = useState<UserPreferences['custom_tools']>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTool, setEditingTool] = useState<number | null>(null);

  useEffect(() => {
    api.health().then((h) => setHealth(h.status)).catch(() => setHealth('❌ 后端不可达'));
    api.listModels().then(({ models }) => setModels(models)).catch(() => {});
    api.listTools().then(({ tools }) => setTools(tools)).catch(() => {});
    api.getPreferences()
      .then((p) => { setSystemPrompt(p.system_prompt || ''); setCustomTools(p.custom_tools || []); })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
  }, [hasAny]);

  const savePrefs = async () => {
    setSaving(true);
    try {
      const saved = await api.savePreferences({ system_prompt: systemPrompt, custom_tools: customTools });
      setCustomTools(saved.custom_tools || []);
      alert('已保存');
    } catch (e: any) {
      alert('保存失败：' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const addTool = () => {
    if (customTools.length >= 20) { alert('最多 20 个自定义工具'); return; }
    setCustomTools([...customTools, { ...WEBHOOK_TEMPLATE, parameters: JSON.parse(JSON.stringify(WEBHOOK_TEMPLATE.parameters)) }]);
    setEditingTool(customTools.length);
  };

  const updateTool = (idx: number, patch: Partial<UserPreferences['custom_tools'][number]>) => {
    const next = [...customTools];
    next[idx] = { ...next[idx], ...patch };
    setCustomTools(next);
  };

  const removeTool = (idx: number) => {
    setCustomTools(customTools.filter((_, i) => i !== idx));
    setEditingTool(null);
  };

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);

  return (
    <div className="h-screen flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          <header className="animate-slide-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-hero grid place-items-center text-white text-2xl shadow-glow-blue">⚙️</div>
              <div>
                <h1 className="font-serif text-3xl font-semibold tracking-tight">设置</h1>
                <p className="text-sm text-text-soft">配置 API Key、个性化偏好与工具状态。</p>
              </div>
            </div>
          </header>

          {/* 状态卡 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <StatCard icon="💚" label="后端" value={health === 'ok' ? '在线' : health} ok={health === 'ok'} colorIdx={0} />
            <StatCard icon="🤖" label="可用模型" value={`${enabled.length} / ${models.length}`} ok={enabled.length > 0} colorIdx={1} />
            <StatCard icon="🔧" label="可用工具" value={`${tools.length + customTools.length} 个`} ok={tools.length > 0} colorIdx={2} />
          </div>

          {!hasAny && (
            <div className="glass-card rounded-2xl p-5 border-amber-300/60 animate-slide-up" style={{ animationDelay: '80ms' }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔑</span>
                <div>
                  <div className="font-semibold">还没有配置 API Key</div>
                  <p className="text-sm text-text-soft mt-1">
                    点击右上角 🔑 按钮填入至少一个模型提供商的 Key。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 个性化 */}
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '110ms' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">🎨 个性化</h2>
              <button onClick={savePrefs} disabled={!prefsLoaded || saving} className="btn btn-primary !py-1.5 !px-4 text-xs disabled:opacity-40">
                {saving ? '保存中…' : '保存全部'}
              </button>
            </div>
            <p className="text-xs text-text-mute mb-4">自定义系统提示词与专属工具，随账号生效（所有设备同步）</p>

            {/* 系统提示词 */}
            <label className="text-sm font-medium block mb-1.5">系统提示词（人格 / 规则 / 偏好）</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="例如：你是一位严谨的技术顾问，回答先给结论再给依据，默认使用中文，代码注释用中文…"
              className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition text-sm"
            />
            <div className="text-right text-[10px] text-text-mute mt-1">{systemPrompt.length} / 4000</div>

            {/* 自定义 Webhook 工具 */}
            <div className="flex items-center justify-between mt-5 mb-1.5">
              <label className="text-sm font-medium">专属工具（HTTP Webhook）</label>
              <button onClick={addTool} className="text-xs px-2.5 py-1 rounded-md border border-border text-text-soft hover:border-primary/50 hover:text-primary transition">
                + 添加工具
              </button>
            </div>
            <p className="text-xs text-text-mute mb-3">
              模型调用工具时，后端会 POST <code className="font-mono">{'{name, arguments}'}</code> 到你填的 URL，以响应文本作为工具结果。请自备可公网/局域网访问的服务。
            </p>
            <div className="space-y-2">
              {customTools.length === 0 && (
                <div className="text-xs text-text-mute text-center py-4 rounded-xl bg-bg-soft/60 border border-dashed border-border">
                  还没有自定义工具，点击「添加工具」用模板创建一个
                </div>
              )}
              {customTools.map((t, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-bg-soft/60 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🧩</span>
                      <code className="font-mono text-sm font-semibold text-accent-purple">{t.name}</code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingTool(editingTool === idx ? null : idx)}
                        className="text-xs px-2 py-1 rounded-md border border-border text-text-soft hover:text-primary transition"
                      >
                        {editingTool === idx ? '收起' : '编辑'}
                      </button>
                      <button onClick={() => removeTool(idx)} className="text-xs px-2 py-1 rounded-md text-accent-red hover:bg-accent-red/10 transition">
                        删除
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-soft mb-1.5">{t.description}</p>
                  <code className="text-[10px] text-text-mute font-mono break-all">{t.url}</code>
                  {editingTool === idx && (
                    <div className="mt-3 space-y-2 animate-slide-down">
                      <input
                        value={t.name}
                        onChange={(e) => updateTool(idx, { name: e.target.value })}
                        placeholder="工具名（字母/数字/_/-，≤64 字符，不与内置重名）"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={t.description}
                        onChange={(e) => updateTool(idx, { description: e.target.value })}
                        placeholder="描述（1-500 字，模型据此决定何时调用）"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={t.url}
                        onChange={(e) => updateTool(idx, { url: e.target.value })}
                        placeholder="http(s):// 你的服务地址"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <textarea
                        value={JSON.stringify(t.parameters, null, 2)}
                        onChange={(e) => {
                          try { updateTool(idx, { parameters: JSON.parse(e.target.value) }); } catch { /* 编辑中允许暂时不合法 */ }
                        }}
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="text-[10px] text-text-mute">JSON Schema（type 必须是 object）；参数会被过滤为 schema 声明过的键</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 模型清单 */}
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <h2 className="font-semibold mb-1">🤖 模型</h2>
            <p className="text-xs text-text-mute mb-4">填入对应 provider 的 Key 后自动启用</p>
            <div className="space-y-1.5">
              {enabled.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border border-emerald-300/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm font-medium">{m.label}</span>
                  </div>
                  <span className="text-xs text-text-mute font-mono">{m.provider}</span>
                </div>
              ))}
              {disabled.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-bg-soft/60 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-text-mute rounded-full" />
                    <span className="text-sm">{m.label}</span>
                  </div>
                  <span className="text-xs text-text-mute font-mono">{m.provider}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 工具清单 */}
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2 className="font-semibold mb-1">🔧 Function Calling 工具</h2>
            <p className="text-xs text-text-mute mb-4">在对话中勾选 🔧 工具 后启用</p>
            <div className="space-y-2">
              {tools.map((t) => (
                <div key={t.name} className="p-3 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-400/5 border border-amber-200/40">
                  <div className="flex items-center justify-between mb-1">
                    <code className="font-mono text-sm font-semibold text-accent-orange">{t.name}</code>
                    <span className="text-xs text-text-mute">
                      {Object.keys(t.parameters?.properties || {}).length} 参数
                    </span>
                  </div>
                  <p className="text-xs text-text-soft">{t.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 关于 */}
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <h2 className="font-semibold mb-3">💡 关于 MiniAI</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <Info label="版本" value="v0.10.1" />
              <Info label="开源协议" value="MIT" />
              <Info label="技术栈" value="FastAPI · Next.js · ChromaDB" />
              <Info label="数据存储" value="全本地" />
              <div className="md:col-span-2">
                <a href="https://github.com/conuausal/MiniAI" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium">
                  ⭐ GitHub: conuausal/MiniAI →
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, ok, colorIdx }: { icon: string; label: string; value: string; ok: boolean; colorIdx: number }) {
  return (
    <div className={clsx(
      'glass-card p-4 bg-gradient-to-br border',
      STAT_COLORS[colorIdx]
    )}>
      <div className="flex items-center gap-2 text-text-mute text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={clsx('text-lg font-semibold', ok ? 'text-text' : 'text-accent-red')}>
        {value}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-mute">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
