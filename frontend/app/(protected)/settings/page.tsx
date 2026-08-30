'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import { api, ModelInfo, ToolInfo } from '@/lib/api';
import { useUserKeys } from '@/lib/user-keys';
import clsx from 'clsx';

const STAT_COLORS = [
  'from-emerald-400/20 to-emerald-500/10 border-emerald-300/40',
  'from-primary/20 to-accent-purple/15 border-primary/30',
  'from-accent-orange/20 to-accent-yellow/15 border-accent-orange/30',
];

export default function SettingsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [health, setHealth] = useState<string>('检测中…');
  const { hasAny } = useUserKeys();

  useEffect(() => {
    api.health().then((h) => setHealth(h.status)).catch(() => setHealth('❌ 后端不可达'));
    api.listModels().then(({ models }) => setModels(models)).catch(() => {});
    api.listTools().then(({ tools }) => setTools(tools)).catch(() => {});
  }, [hasAny]);

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
                <p className="text-sm text-text-soft">配置 API Key、查看模型与工具状态。</p>
              </div>
            </div>
          </header>

          {/* 状态卡 */}
          <div className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <StatCard icon="💚" label="后端" value={health === 'ok' ? '在线' : health} ok={health === 'ok'} colorIdx={0} />
            <StatCard icon="🤖" label="可用模型" value={`${enabled.length} / ${models.length}`} ok={enabled.length > 0} colorIdx={1} />
            <StatCard icon="🔧" label="可用工具" value={`${tools.length} 个`} ok={tools.length > 0} colorIdx={2} />
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

          {/* 模型清单 */}
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
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
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
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
          <section className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2 className="font-semibold mb-3">💡 关于 MiniAI</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <Info label="版本" value="v0.8.0" />
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
