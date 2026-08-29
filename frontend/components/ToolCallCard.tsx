'use client';

import { useState } from 'react';
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
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl rounded-tl-sm overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition"
        >
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <span>🔧</span>
            <span className="font-medium">
              调用了 {records.length} 个工具
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              {records.map((r) => TOOL_ICONS[r.name] || '⚙️').join(' → ')}
            </span>
          </div>
          <span className="text-xs text-amber-600 dark:text-amber-400">{open ? '收起' : '展开'}</span>
        </button>

        {open && (
          <div className="px-3 pb-3 space-y-2">
            {records.map((rec, i) => (
              <div key={i} className="text-xs bg-white dark:bg-slate-900 rounded-md p-2 border border-amber-100 dark:border-amber-900">
                <div className="flex items-center gap-2 mb-1">
                  <span>{TOOL_ICONS[rec.name] || '⚙️'}</span>
                  <code className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                    {rec.name}
                  </code>
                </div>
                {Object.keys(rec.args || {}).length > 0 && (
                  <div className="mb-1">
                    <span className="text-slate-500">参数：</span>
                    <code className="text-slate-700 dark:text-slate-300">
                      {JSON.stringify(rec.args, null, 0)}
                    </code>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">结果：</span>
                  <pre className="mt-0.5 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
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
