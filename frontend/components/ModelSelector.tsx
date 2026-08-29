'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { ModelInfo } from '@/lib/api';

const TAG_STYLES: Record<string, string> = {
  '推荐': 'bg-brand-100 text-brand-700',
  '推理': 'bg-violet-100 text-violet-700',
  '代码': 'bg-emerald-100 text-emerald-700',
  '快速': 'bg-amber-100 text-amber-700',
  '经济': 'bg-stone-100 text-stone-700',
  '中文': 'bg-red-100 text-red-700',
  '长文本': 'bg-cyan-100 text-cyan-700',
  '多模态': 'bg-pink-100 text-pink-700',
  '免费': 'bg-lime-100 text-lime-700',
  '最新': 'bg-blue-100 text-blue-700',
};

const PROVIDER_EMOJI: Record<string, string> = {
  deepseek: '🐋', openai: '🧠', MiniMax: '🤖', zhipu: '🀄',
  moonshot: '🌙', qwen: '☁️', gemini: '💎',
};

export default function ModelSelector() {
  const {
    models, currentModel, setCurrentModel,
    enableRag, setEnableRag,
    enableSearch, setEnableSearch,
    enableTools, setEnableTools,
    streaming,
  } = useChatStore();

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);

  const grouped = useMemo(() => groupByProvider(enabled), [enabled]);
  const groupedDisabled = useMemo(() => groupByProvider(disabled), [disabled]);

  return (
    <div className="flex items-center gap-1.5">
      <ModelPicker
        currentModel={currentModel}
        onSelect={setCurrentModel}
        enabledGroups={grouped}
        disabledGroups={groupedDisabled}
        disabled={streaming || enabled.length === 0}
      />

      <ToggleChip active={enableRag} onChange={setEnableRag} disabled={streaming} emoji="📚" label="RAG" activeColor="cyan" />
      <ToggleChip active={enableSearch} onChange={setEnableSearch} disabled={streaming} emoji="🌐" label="联网" activeColor="blue" />
      <ToggleChip active={enableTools} onChange={setEnableTools} disabled={streaming} emoji="🔧" label="工具" activeColor="amber" />
    </div>
  );
}

function ModelPicker({
  currentModel, onSelect, enabledGroups, disabledGroups, disabled,
}: {
  currentModel: string;
  onSelect: (id: string) => void;
  enabledGroups: Map<string, ModelInfo[]>;
  disabledGroups: Map<string, ModelInfo[]>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; minWidth: number }>({ top: 0, right: 0, minWidth: 280 });

  // 计算弹出位置（基于按钮的 bounding rect）
  const recompute = () => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 6,
      right: window.innerWidth - r.right,
      minWidth: Math.max(280, r.width),
    });
  };

  useEffect(() => {
    if (!open) return;
    recompute();
    const onResize = () => recompute();
    const onClickOutside = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // 当前选中的模型
  const current = [...enabledGroups.values()].flat().find((m) => m.id === currentModel);
  const displayLabel = current?.label || '选择模型';
  const providerEmoji = current ? (PROVIDER_EMOJI[current.provider] || '⚙️') : '';

  return (
    <>
      <button
        ref={buttonRef}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="text-sm pl-3 pr-7 py-1.5 rounded-lg border border-border bg-surface/80 backdrop-blur hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 min-w-[180px] justify-between"
      >
        <span className="truncate flex items-center gap-1.5">
          {providerEmoji && <span>{providerEmoji}</span>}
          <span>{displayLabel}</span>
        </span>
        <span className={`text-text-mute text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div
          ref={popRef}
          style={{ top: pos.top, right: pos.right, minWidth: pos.minWidth }}
          className="fixed z-[9999] max-h-[70vh] overflow-y-auto glass-strong rounded-xl shadow-xl border border-border animate-slide-down"
        >
          {enabledGroups.size === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-text-mute">
              <div className="mb-2 text-2xl">🔑</div>
              请先在右上角 🔑 配置 API Key
            </div>
          ) : (
            <div className="py-1.5">
              {[...enabledGroups.entries()].map(([provider, models]) => (
                <div key={provider} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-text-mute uppercase tracking-wider flex items-center gap-1.5">
                    <span>{PROVIDER_EMOJI[provider] || '⚙️'}</span>
                    <span>{provider}</span>
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { onSelect(m.id); setOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-soft transition flex items-center justify-between gap-2 ${currentModel === m.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    >
                      <span className="flex-1 truncate">{m.label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {(m.tags || []).slice(0, 1).map((t) => (
                          <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TAG_STYLES[t] || 'bg-bg-soft text-text-soft'}`}>
                            {t}
                          </span>
                        ))}
                        {currentModel === m.id && <span className="text-primary">✓</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {disabledGroups.size > 0 && (
            <div className="border-t border-border-soft py-1.5 bg-bg-soft/40">
              <div className="px-3 py-1 text-[10px] font-semibold text-text-mute uppercase tracking-wider">
                — 未配置 —
              </div>
              {[...disabledGroups.entries()].map(([provider, models]) => (
                <div key={provider}>
                  {models.slice(0, 3).map((m) => (
                    <div key={m.id} className="px-3 py-1 text-xs text-text-mute truncate opacity-50">
                      {m.label}
                    </div>
                  ))}
                  {models.length > 3 && (
                    <div className="px-3 py-0.5 text-[10px] text-text-mute opacity-50">+{models.length - 3} 更多</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function groupByProvider(models: ModelInfo[]): Map<string, ModelInfo[]> {
  const map = new Map<string, ModelInfo[]>();
  for (const m of models) {
    if (!map.has(m.provider)) map.set(m.provider, []);
    map.get(m.provider)!.push(m);
  }
  return map;
}

function ToggleChip({ active, onChange, disabled, emoji, label, activeColor }: {
  active: boolean; onChange: (v: boolean) => void; disabled: boolean;
  emoji: string; label: string; activeColor?: 'amber' | 'cyan' | 'blue';
}) {
  const activeCls =
    activeColor === 'amber' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
    : activeColor === 'cyan' ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700'
    : activeColor === 'blue' ? 'bg-primary/15 text-primary border-primary/40'
    : 'bg-primary/15 text-primary border-primary/40';

  return (
    <button
      onClick={() => onChange(!active)}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
        active
          ? activeCls
          : 'bg-surface/70 text-text-soft border-border hover:bg-surface'
      } disabled:opacity-50 backdrop-blur-sm`}
    >
      <span>{emoji}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
