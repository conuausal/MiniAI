'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ToolCallRecord } from '@/lib/api';

const TOOL_ICONS: Record<string, string> = {
  get_current_time: '⏰',
  calculate: '🧮',
  web_search: '🌐',
  query_knowledge: '📚',
  read_file: '📄',
};

interface Props {
  records: ToolCallRecord[];
}

export default function ToolCallCard({ records }: Props) {
  const [open, setOpen] = useState(false);
  if (!records.length) return null;

  return (
    <div className="max-w-[85%] md:max-w-[75%] animate-fade-in">
      <div className="bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition"
        >
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-100">
            <span>🔧</span>
            <span className="font-medium">
              调用了 {records.length} 个工具
            </span>
            <span className="text-amber-700/70 dark:text-amber-300/70">
              {records.map((r) => TOOL_ICONS[r.name] || '⚙️').join(' → ')}
            </span>
          </div>
          <svg
            className={clsx('w-3 h-3 text-amber-700 transition-transform', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="px-3 pb-3 pt-1 space-y-2 animate-slide-down">
            {records.map((rec, i) => (
              <div key={i} className="text-xs bg-white/80 dark:bg-slate-900/60 rounded-lg p-2.5 border border-amber-100/80 dark:border-amber-900/60">
                <div className="flex items-center gap-2 mb-1">
                  <span>{TOOL_ICONS[rec.name] || '⚙️'}</span>
                  <code className="font-mono font-semibold text-amber-800 dark:text-amber-200">
                    {rec.name}
                  </code>
                </div>
                {Object.keys(rec.args || {}).length > 0 && (
                  <div className="mb-1.5">
                    <span className="text-text-mute">参数：</span>
                    <code className="text-text-soft">
                      {JSON.stringify(rec.args)}
                    </code>
                  </div>
                )}
                <div>
                  <span className="text-text-mute">结果：</span>
                  <pre className="mt-0.5 whitespace-pre-wrap break-words text-text-soft font-sans">
                    {rec.result}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
