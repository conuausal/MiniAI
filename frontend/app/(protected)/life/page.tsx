'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { life, HomeOverview, Note } from '@/lib/life';

export default function LifeHome() {
  const [data, setData] = useState<HomeOverview | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try { setData(await life.home()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const toggleTodo = async (id: number, status: string) => {
    await life.todos.update(id, { status: status === 'done' ? 'todo' : 'done' });
    refresh();
  };
  const addNote = async () => {
    if (!noteText.trim() || saving) return;
    setSaving(true);
    try { await life.notes.create({ content: noteText.trim() }); setNoteText(''); refresh(); }
    finally { setSaving(false); }
  };
  const togglePin = async (n: Note) => { await life.notes.update(n.id, { pinned: !n.pinned }); refresh(); };
  const delNote = async (id: number) => { await life.notes.remove(id); refresh(); };

  const cards = data ? [
    { emoji: '📣', label: '自媒体', value: `${data.modules.media_publish_today} 篇今日待发布`, href: '/life/media' },
    { emoji: '💻', label: '开发', value: `${data.modules.dev_active_projects} 活跃项目 · ${data.modules.dev_tasks_today} 今日任务`, href: '/life/dev' },
    { emoji: '💼', label: '咨询', value: `${data.modules.consult_in_progress} 项进行中`, href: '/life/consult' },
    { emoji: '💪', label: '健身', value: data.modules.fitness_checked_today ? '今日已打卡 ✓' : '今日未打卡', href: '/life/fitness', warn: !data.modules.fitness_checked_today },
    { emoji: '🥗', label: '饮食', value: data.modules.diet_recorded_today ? '今日已记录 ✓' : '今日未记录', href: '/life/diet', warn: !data.modules.diet_recorded_today },
    { emoji: '🎮', label: '游戏', value: `${data.modules.game_hours_today} 小时`, href: '/life/games' },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">🏠</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">首页总览</h1>
        </div>
        <p className="text-sm text-text-soft">{data?.date ?? ''} · 今天也要加油 ✨</p>
      </header>

      {/* 今日待办 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">✅ 今日待办</h2>
          <Link href="/life/todos" className="text-xs text-primary hover:underline">管理 →</Link>
        </div>
        {!data?.todos?.length ? (
          <div className="text-sm text-text-mute text-center py-6">今天还没有待办，去「今日计划」添加吧</div>
        ) : (
          <ul className="space-y-1.5">
            {data.todos.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-soft transition group">
                <button
                  onClick={() => toggleTodo(t.id, t.status)}
                  className={clsx('w-5 h-5 shrink-0 rounded-full border-2 grid place-items-center transition',
                    t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text-mute hover:border-primary')}
                >
                  {t.status === 'done' && '✓'}
                </button>
                <span className={clsx('flex-1 text-sm', t.status === 'done' && 'line-through text-text-mute')}>{t.title}</span>
                {t.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-red/15 text-accent-red">高</span>}
                {t.due_time && <span className="text-xs text-text-mute">{t.due_time}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 快速备忘 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-3">📌 快速备忘</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="记点什么灵感或临时事项…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={addNote} disabled={!noteText.trim() || saving} className="btn btn-primary !py-2 text-xs">记录</button>
        </div>
        {!!data?.notes?.length && (
          <ul className="space-y-1.5">
            {data.notes.map((n) => (
              <li key={n.id} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-bg-soft transition">
                <span className="text-base mt-0.5">{n.pinned ? '📌' : '💭'}</span>
                <span className="flex-1 text-sm whitespace-pre-wrap">{n.content}</span>
                <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => togglePin(n)} className="text-xs text-text-mute hover:text-amber-500" title="置顶">📌</button>
                  <button onClick={() => delNote(n.id)} className="text-xs text-text-mute hover:text-accent-red" title="删除">✕</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 模块摘要 */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '150ms' }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="glass-card rounded-2xl p-4 hover:scale-[1.02] transition">
            <div className="text-xl mb-1.5">{c.emoji}</div>
            <div className="text-xs text-text-mute mb-0.5">{c.label}</div>
            <div className={clsx('text-sm font-medium', c.warn ? 'text-accent-orange' : 'text-text')}>{c.value}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
