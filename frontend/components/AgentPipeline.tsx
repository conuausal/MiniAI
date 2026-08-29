'use client';

import clsx from 'clsx';
import type { PipelineState } from '@/lib/write';

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: '等待', cls: 'bg-surface-2 text-text-mute' },
  running: { text: '运行中', cls: 'bg-amber-100 text-amber-700 animate-pulse-soft' },
  done: { text: '完成', cls: 'bg-emerald-100 text-emerald-700' },
  error: { text: '错误', cls: 'bg-rose-100 text-rose-700' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
  return <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', s.cls)}>{s.text}</span>;
}

const AGENT_PALETTE = [
  { border: 'border-l-accent-purple', glow: 'shadow-glow-purple', gradient: 'bg-magic', icon: '🧭' },
  { border: 'border-l-accent-blue',   glow: 'shadow-glow-blue',   gradient: 'bg-ocean',  icon: '🔍' },
  { border: 'border-l-accent-cyan',   glow: '',                   gradient: 'bg-ocean',  icon: '🔍' },
  { border: 'border-l-accent-teal',   glow: '',                   gradient: 'bg-ocean',  icon: '🔍' },
  { border: 'border-l-accent-pink',   glow: 'shadow-glow-pink',   gradient: 'bg-fire',   icon: '✍️' },
];

interface Props { state: PipelineState; }

export default function AgentPipeline({ state }: Props) {
  return (
    <div className="space-y-3">
      {/* Planner */}
      <AgentCard
        index={0}
        role="Planner"
        desc="主编：拆解主题为大纲"
        status={state.planner.status}
      >
        {state.planner.outline.length > 0 ? (
          <ul className="text-xs space-y-1.5">
            {state.planner.outline.map((o, i) => (
              <li key={o.section_id} className="flex gap-2">
                <span className="font-mono text-accent-purple shrink-0 font-bold">{i + 1}.</span>
                <div>
                  <div className="font-medium text-text">{o.title}</div>
                  {o.focus && <div className="text-text-mute">↳ {o.focus}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : state.planner.status === 'running' ? (
          <div className="text-xs text-text-mute animate-pulse-soft">正在拆解主题...</div>
        ) : (
          <div className="text-xs text-text-mute">等待启动</div>
        )}
      </AgentCard>

      {state.researchers.map((r, i) => (
        <AgentCard
          key={r.section_id}
          index={i + 1}
          role={`Researcher ${i + 1}`}
          desc={r.title}
          status={r.status}
        >
          {r.notes ? (
            <div>
              <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-y-auto bg-surface/60 rounded-lg p-2.5 border border-border">
                {r.notes}
              </pre>
              {r.sources.length > 0 && (
                <div className="mt-1.5 text-[10px] text-text-mute flex items-center gap-1">
                  📎 {r.sources.length} 个来源
                </div>
              )}
            </div>
          ) : r.status === 'running' ? (
            <div className="text-xs text-text-mute animate-pulse-soft">收集资料中…</div>
          ) : (
            <div className="text-xs text-text-mute">等待启动</div>
          )}
        </AgentCard>
      ))}

      {/* Writer */}
      <AgentCard
        index={AGENT_PALETTE.length - 1}
        role="Writer"
        desc="撰稿人：综合素材生成终稿"
        status={state.writer.status}
      >
        {state.writer.article ? (
          <div className="text-xs text-accent-pink font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-pink" />
            已生成 {state.writer.wordCount} 字的文章
          </div>
        ) : state.writer.status === 'running' ? (
          <div className="text-xs text-text-mute animate-pulse-soft">正在综合所有素材撰写…</div>
        ) : (
          <div className="text-xs text-text-mute">等待研究人员完成</div>
        )}
      </AgentCard>
    </div>
  );
}

function AgentCard({
  index, role, desc, status, children,
}: {
  index: number; role: string; desc: string; status: string; children: React.ReactNode;
}) {
  const palette = AGENT_PALETTE[index] || AGENT_PALETTE[0];
  return (
    <div className={clsx(
      'glass-card border-l-4 overflow-hidden',
      palette.border,
      status === 'running' && palette.glow
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'w-8 h-8 rounded-lg grid place-items-center text-white text-sm shadow-soft-sm',
              palette.gradient
            )}>
              {palette.icon}
            </div>
            <div>
              <div className="font-semibold text-sm text-text">{role}</div>
              <div className="text-[11px] text-text-mute">{desc}</div>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        {children}
      </div>
    </div>
  );
}
