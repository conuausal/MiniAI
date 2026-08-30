'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, Todo } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);
const PRIOS = [
  { v: 'low', label: '低', cls: 'text-emerald-600 dark:text-emerald-400' },
  { v: 'mid', label: '中', cls: 'text-amber-600 dark:text-amber-400' },
  { v: 'high', label: '高', cls: 'text-accent-red' },
];

export default function TodosPage() {
  const [items, setItems] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [date, setDate] = useState<string>(today());
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('mid');
  const [dueTime, setDueTime] = useState('');

  const refresh = useCallback(async () => {
    try {
      const params: Record<string, string> = { due_date: date };
      if (filter !== 'all') params.status = filter;
      setItems(await life.todos.list(params));
    } catch { /* ignore */ }
  }, [filter, date]);
  useEffect(() => { refresh(); }, [refresh]);

  const add = async () => {
    if (!title.trim()) return;
    await life.todos.create({ title: title.trim(), priority, due_date: date, due_time: dueTime || null });
    setTitle(''); setDueTime('');
    refresh();
  };
  const toggle = async (t: Todo) => { await life.todos.update(t.id, { status: t.status === 'done' ? 'todo' : 'done' }); refresh(); };
  const setPrio = async (t: Todo, p: string) => { await life.todos.update(t.id, { priority: p }); refresh(); };
  const del = async (id: number) => { await life.todos.remove(id); refresh(); };

  const doneCount = items.filter((t) => t.status === 'done').length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">✅</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">今日计划</h1>
        </div>
        <p className="text-sm text-text-soft">{doneCount}/{items.length} 已完成</p>
      </header>

      {/* 新增 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <h2 className="font-semibold mb-3">＋ 新增待办</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="要做什么？"
            className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft">
            <option value="low">低优先级</option>
            <option value="mid">中优先级</option>
            <option value="high">高优先级</option>
          </select>
          <button onClick={add} disabled={!title.trim()} className="btn btn-primary !py-2 text-xs">添加</button>
        </div>
      </section>

      {/* 列表 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">📋 待办列表</h2>
          <div className="flex gap-1">
            {(['all', 'todo', 'done'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx('text-xs px-2.5 py-1 rounded-md transition',
                  filter === f ? 'bg-primary/15 text-primary font-medium' : 'text-text-mute hover:bg-bg-soft')}>
                {f === 'all' ? '全部' : f === 'todo' ? '未完成' : '已完成'}
              </button>
            ))}
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-text-mute text-center py-8">这一天没有待办</div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-soft transition">
                <button onClick={() => toggle(t)} className={clsx('w-5 h-5 shrink-0 rounded-full border-2 grid place-items-center transition',
                  t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text-mute hover:border-primary')}>
                  {t.status === 'done' && '✓'}
                </button>
                <span className={clsx('flex-1 text-sm', t.status === 'done' && 'line-through text-text-mute')}>{t.title}</span>
                {t.due_time && <span className="text-xs text-text-mute font-mono">{t.due_time}</span>}
                <span className="flex gap-0.5">
                  {PRIOS.map((p) => (
                    <button key={p.v} onClick={() => setPrio(t, p.v)} title={`优先级 ${p.label}`}
                      className={clsx('w-2 h-2 rounded-full', t.priority === p.v ? 'bg-current ' + p.cls : 'bg-text-mute/30 hover:bg-text-mute/60')} />
                  ))}
                </span>
                <button onClick={() => del(t.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red transition" title="删除">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
