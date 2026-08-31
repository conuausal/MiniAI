'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface Props {
  thinking: string;
  live?: boolean; // 正在流式生成思考过程
}

/** 思考过程折叠卡片（紫色系，展示推理模型的 ReAct/推理链）。 */
export default function ThinkingCard({ thinking, live = false }: Props) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (live) {
      // 流式开始：自动展开并开始计时
      if (startRef.current == null) startRef.current = Date.now();
      setOpen(true);
    } else if (startRef.current != null) {
      // 思考结束：保持展开供用户查看，记录用时；只有用户手动点击才收起
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
      startRef.current = null;
    }
  }, [live]);

  if (!thinking) return null;

  return (
    <div className="mb-2 animate-fade-in">
      <div className="bg-violet-50/70 dark:bg-violet-900/20 border border-violet-200/80 dark:border-violet-800/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/30 transition"
        >
          <div className="flex items-center gap-2 text-xs text-violet-900 dark:text-violet-100">
            <span>💭</span>
            <span className="font-medium">{live ? '思考中…' : '思考过程'}</span>
            {elapsed != null && !live && (
              <span className="text-violet-600/70 dark:text-violet-300/70">· {elapsed}s</span>
            )}
            {live && (
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse [animation-delay:300ms]" />
              </span>
            )}
          </div>
          <svg
            className={clsx('w-3 h-3 text-violet-600 transition-transform', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="px-3 pb-2.5 pt-1 animate-slide-down">
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-violet-800/90 dark:text-violet-200/90 font-sans max-h-60 overflow-y-auto">
              {thinking}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

