'use client';

import { useMemo } from 'react';
import { useChatStore } from '@/lib/store';
import { ModelInfo } from '@/lib/api';

const TAG_STYLES: Record<string, string> = {
  '推荐': 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  '推理': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
  '代码': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  '快速': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  '经济': 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
  '中文': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  '长文本': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200',
  '多模态': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200',
  '免费': 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-200',
  '最新': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
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
    <div className="flex items-center gap-2 flex-wrap">
      <ModelPicker
        currentModel={currentModel}
        onSelect={setCurrentModel}
        enabledGroups={grouped}
        disabledGroups={groupedDisabled}
        disabled={streaming || enabled.length === 0}
      />

      <ToggleChip active={enableRag} onChange={setEnableRag} disabled={streaming} emoji="📚" label="知识库" />
      <ToggleChip active={enableSearch} onChange={setEnableSearch} disabled={streaming} emoji="🌐" label="联网" />
      <ToggleChip active={enableTools} onChange={setEnableTools} disabled={streaming} emoji="🔧" label="工具" accent="amber" />
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
  // 当前选中的模型
  const current = [...enabledGroups.values()].flat().find((m) => m.id === currentModel);
  const displayLabel = current?.label || '选择模型';
  const providerEmoji = current ? (PROVIDER_EMOJI[current.provider] || '⚙️') : '';

  return (
    <div className="relative group">
      <button
        disabled={disabled}
        className="text-sm pl-3 pr-8 py-1.5 rounded-lg border border-border bg-surface hover:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand-300 transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 min-w-[180px] justify-between"
      >
        <span className="truncate flex items-center gap-1.5">
          {providerEmoji && <span>{providerEmoji}</span>}
          <span>{displayLabel}</span>
        </span>
        <span className="text-text-mute text-xs">▾</span>
      </button>

      {/* Dropdown panel */}
      <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[280px] max-h-[60vh] overflow-y-auto bg-surface border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 origin-top-right">
        {enabledGroups.size === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-text-mute">
            <div className="mb-2 text-2xl">🔑</div>
            请先在右上角 🔑 配置 API Key
          </div>
        ) : (
          <div className="py-1.5">
            {[...enabledGroups.entries()].map(([provider, models]) => (
              <div key={provider} className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-text-mute uppercase tracking-wider">
                  {PROVIDER_EMOJI[provider] || '⚙️'} {provider}
                </div>
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelect(m.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-soft transition flex items-center justify-between gap-2 ${currentModel === m.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200' : ''}`}
                  >
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {(m.tags || []).slice(0, 1).map((t) => (
                        <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TAG_STYLES[t] || 'bg-bg-soft text-text-soft'}`}>
                          {t}
                        </span>
                      ))}
                      {currentModel === m.id && <span className="text-brand-500">✓</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {disabledGroups.size > 0 && (
          <div className="border-t border-border-soft py-1.5 bg-bg-soft/50">
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
    </div>
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

function ToggleChip({ active, onChange, disabled, emoji, label, accent }: {
  active: boolean; onChange: (v: boolean) => void; disabled: boolean;
  emoji: string; label: string; accent?: 'amber';
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
        active
          ? accent === 'amber'
            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
            : 'bg-brand-100 text-brand-700 border-brand-300 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700'
          : 'bg-surface text-text-soft border-border hover:bg-bg-soft'
      } disabled:opacity-50`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
