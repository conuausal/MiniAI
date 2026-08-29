'use client';

import { useChatStore } from '@/lib/store';

export default function ModelSelector() {
  const {
    models, currentModel, setCurrentModel,
    enableRag, setEnableRag,
    enableSearch, setEnableSearch,
    enableTools, setEnableTools,
    streaming, abortCtl,
  } = useChatStore();

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <select
          value={currentModel}
          onChange={(e) => setCurrentModel(e.target.value)}
          disabled={streaming || enabled.length === 0}
          className="text-sm pl-3 pr-8 py-1.5 rounded-lg border border-border bg-surface hover:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand-300 transition appearance-none cursor-pointer disabled:opacity-50"
        >
          {enabled.length === 0 && <option value="">(请先配置 Key)</option>}
          {enabled.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
          {disabled.length > 0 && (
            <optgroup label="—— 未配置 ——">
              {disabled.map((m) => (
                <option key={m.id} value={m.id} disabled>{m.label}</option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute pointer-events-none text-xs">▾</span>
      </div>

      <ToggleChip active={enableRag} onChange={setEnableRag} disabled={streaming} emoji="📚" label="知识库" />
      <ToggleChip active={enableSearch} onChange={setEnableSearch} disabled={streaming} emoji="🌐" label="联网" />
      <ToggleChip active={enableTools} onChange={setEnableTools} disabled={streaming} emoji="🔧" label="工具" accent="amber" />
    </div>
  );
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
