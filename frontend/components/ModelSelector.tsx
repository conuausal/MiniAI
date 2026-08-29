'use client';

import { useChatStore } from '@/lib/store';

export default function ModelSelector() {
  const { models, currentModel, setCurrentModel, enableRag, setEnableRag, enableSearch, setEnableSearch, streaming, setAbortCtl, abortCtl } = useChatStore();

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={currentModel}
        onChange={(e) => setCurrentModel(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        disabled={streaming}
      >
        {enabled.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
        {disabled.length > 0 && (
          <optgroup label="未配置 API Key">
            {disabled.map((m) => (
              <option key={m.id} value={m.id} disabled>{m.label}</option>
            ))}
          </optgroup>
        )}
      </select>

      <label className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer">
        <input type="checkbox" checked={enableRag} onChange={(e) => setEnableRag(e.target.checked)} />
        📚 RAG
      </label>

      <label className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer">
        <input type="checkbox" checked={enableSearch} onChange={(e) => setEnableSearch(e.target.checked)} />
        🌐 联网
      </label>

      {streaming && (
        <button
          onClick={() => abortCtl?.abort()}
          className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
        >停止</button>
      )}
    </div>
  );
}
