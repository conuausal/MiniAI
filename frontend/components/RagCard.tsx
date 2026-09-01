'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { RagHitsData } from '@/lib/api';

interface Props {
  data?: RagHitsData;
}

/** 知识库检索过程卡片（青色系）：命中显示片段来源与分数，未命中明示。 */
export default function RagCard({ data }: Props) {
  const [open, setOpen] = useState(false);
  if (!data?.enabled) return null;

  const hits = data.hits || [];

  if (hits.length === 0) {
    return (
      <div className="mb-2 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-50/70 dark:bg-cyan-900/20 border border-cyan-200/80 dark:border-cyan-800/60 text-xs text-cyan-900 dark:text-cyan-100">
          <span>📚</span>
          <span>知识库未命中 · 本次回答基于模型通识</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 animate-fade-in">
      <div className="bg-cyan-50/70 dark:bg-cyan-900/20 border border-cyan-200/80 dark:border-cyan-800/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30 transition"
        >
          <div className="flex items-center gap-2 text-xs text-cyan-900 dark:text-cyan-100">
            <span>📚</span>
            <span className="font-medium">已检索知识库 · {hits.length} 个片段</span>
            <span className="text-cyan-700/70 dark:text-cyan-300/70 hidden md:inline">
              {hits.map((h) => h.source).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join('、')}
            </span>
          </div>
          <svg
            className={clsx('w-3 h-3 text-cyan-600 transition-transform', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="px-3 pb-2.5 pt-1 space-y-1.5 animate-slide-down">
            {hits.map((h, i) => (
              <div key={i} className="text-xs bg-white/80 dark:bg-slate-900/60 rounded-lg p-2 border border-cyan-100/80 dark:border-cyan-900/60">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-cyan-700 dark:text-cyan-300 font-medium">[{i + 1}]</span>
                    <span className="truncate text-text-soft">📄 {h.source || '未知来源'}</span>
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-primary/20 text-cyan-700 dark:text-cyan-300 text-[10px]">
                    {h.score?.toFixed(3)}
                  </span>
                </div>
                <div className="text-text-mute leading-relaxed line-clamp-2">{h.preview}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
