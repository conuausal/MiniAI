'use client';

import clsx from 'clsx';
import type { PipelineState } from '@/lib/write';

const AGENT_COLORS: Record<string, string> = {
  planner: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20',
  researcher: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  writer: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
};

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: '等待', cls: 'bg-slate-200 text-slate-600' },
  running: { text: '运行中', cls: 'bg-amber-200 text-amber-800 animate-pulse' },
  done: { text: '完成', cls: 'bg-green-200 text-green-800' },
  error: { text: '错误', cls: 'bg-red-200 text-red-800' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
  return <span className={clsx('text-[10px] px-2 py-0.5 rounded-full', s.cls)}>{s.text}</span>;
}

interface Props { state: PipelineState; }

export default function AgentPipeline({ state }: Props) {
  return (
    <div className="space-y-3">
      <AgentCard
        icon="🧭"
        role="Planner"
        desc="主编：拆解主题为大纲"
        status={state.planner.status}
        color={AGENT_COLORS.planner}
      >
        {state.planner.outline.length > 0 ? (
          <ul className="text-xs space-y-1">
            {state.planner.outline.map((o, i) => (
              <li key={o.section_id} className="flex gap-2">
                <span className="font-mono text-purple-600 dark:text-purple-300 shrink-0">{i + 1}.</span>
                <div>
                  <div className="font-medium">{o.title}</div>
                  {o.focus && <div className="text-slate-500 dark:text-slate-400">↳ {o.focus}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : state.planner.status === 'running' ? (
          <div className="text-xs text-slate-500 animate-pulse">正在拆解主题...</div>
        ) : (
          <div className="text-xs text-slate-400">等待启动</div>
        )}
      </AgentCard>

      {state.researchers.map((r) => (
        <AgentCard
          key={r.section_id}
          icon="🔍"
          role={`Researcher`}
          desc={r.title}
          status={r.status}
          color={AGENT_COLORS.researcher}
        >
          {r.notes ? (
            <div>
              <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-y-auto bg-white/60 dark:bg-slate-900/60 rounded p-2 border border-blue-100 dark:border-blue-900">
                {r.notes}
              </pre>
              {r.sources.length > 0 && (
                <div className="mt-1 text-[10px] text-slate-500">
                  📎 {r.sources.length} 个来源
                </div>
              )}
            </div>
          ) : r.status === 'running' ? (
            <div className="text-xs text-slate-500 animate-pulse">收集资料中…</div>
          ) : (
            <div className="text-xs text-slate-400">等待启动</div>
          )}
        </AgentCard>
      ))}

      <AgentCard
        icon="✍️"
        role="Writer"
        desc="撰稿人：综合素材生成终稿"
        status={state.writer.status}
        color={AGENT_COLORS.writer}
      >
        {state.writer.article ? (
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            ✅ 已生成 {state.writer.wordCount} 字的文章
          </div>
        ) : state.writer.status === 'running' ? (
          <div className="text-xs text-slate-500 animate-pulse">正在综合所有素材撰写…</div>
        ) : (
          <div className="text-xs text-slate-400">等待研究人员完成</div>
        )}
      </AgentCard>
    </div>
  );
}

function AgentCard({
  icon, role, desc, status, color, children,
}: {
  icon: string; role: string; desc: string; status: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className={clsx('border-l-4 rounded-r-lg p-3', color)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-semibold text-sm">{role}</span>
          <span className="text-xs text-slate-500">· {desc}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  );
}
