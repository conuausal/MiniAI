'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, DevProject, DevTask, DevBug, DevNote } from '@/lib/life';

const PROJECT_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  paused: { label: '暂停', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  done: { label: '已完成', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export default function DevPage() {
  const [projects, setProjects] = useState<DevProject[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [tab, setTab] = useState<'tasks' | 'bugs' | 'notes'>('tasks');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [bugs, setBugs] = useState<DevBug[]>([]);
  const [notes, setNotes] = useState<DevNote[]>([]);

  const [tTitle, setTTitle] = useState('');
  const [bTitle, setBTitle] = useState('');
  const [nTitle, setNTitle] = useState('');
  const [nContent, setNContent] = useState('');

  const refreshProjects = useCallback(async () => {
    try {
      const list = await life.devProjects.list({});
      setProjects(list);
      if (!list.find((p) => p.id === selId)) setSelId(list[0]?.id ?? null);
    } catch { /* ignore */ }
  }, [selId]);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  const refreshDetail = useCallback(async () => {
    if (!selId) return;
    try { setTasks(await life.devTasks.list({ project_id: String(selId) })); } catch { /* ignore */ }
    try { setBugs(await life.devBugs.list({ project_id: String(selId) })); } catch { /* ignore */ }
    try { setNotes(await life.devNotes.list({ project_id: String(selId) })); } catch { /* ignore */ }
  }, [selId]);
  useEffect(() => { refreshDetail(); }, [refreshDetail]);

  const addProject = async () => {
    if (!name.trim()) return;
    const p = await life.devProjects.create({ name: name.trim(), description: desc || null });
    setName(''); setDesc('');
    setSelId(p.id);
    refreshProjects();
  };
  const cycleProject = async (id: number) => {
    const cur = projects.find((p) => p.id === id)?.status || 'active';
    const next = cur === 'active' ? 'paused' : cur === 'paused' ? 'done' : 'active';
    await life.devProjects.update(id, { status: next });
    refreshProjects();
  };
  const delProject = async (id: number) => { await life.devProjects.remove(id); setSelId(null); refreshProjects(); };

  const addTask = async () => { if (!tTitle.trim() || !selId) return; await life.devTasks.create({ project_id: selId, title: tTitle.trim() }); setTTitle(''); refreshDetail(); };
  const toggleTask = async (t: DevTask) => { await life.devTasks.update(t.id, { status: t.status === 'done' ? 'todo' : 'done' }); refreshDetail(); };
  const delTask = async (id: number) => { await life.devTasks.remove(id); refreshDetail(); };

  const addBug = async () => { if (!bTitle.trim() || !selId) return; await life.devBugs.create({ project_id: selId, title: bTitle.trim() }); setBTitle(''); refreshDetail(); };
  const cycleBug = async (b: DevBug) => {
    const next = ({ open: 'fixing', fixing: 'fixed', fixed: 'closed', closed: 'open' } as Record<string, string>)[b.status] ?? 'open';
    await life.devBugs.update(b.id, { status: next });
    refreshDetail();
  };
  const delBug = async (id: number) => { await life.devBugs.remove(id); refreshDetail(); };

  const addNote = async () => { if (!nTitle.trim() || !selId) return; await life.devNotes.create({ project_id: selId, title: nTitle.trim(), content: nContent || null }); setNTitle(''); setNContent(''); refreshDetail(); };
  const delNote = async (id: number) => { await life.devNotes.remove(id); refreshDetail(); };

  const sel = projects.find((p) => p.id === selId);

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* 项目列表 */}
      <aside className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-border-soft p-4 space-y-3 overflow-y-auto max-h-[40vh] lg:max-h-none">
        <div className="flex items-center gap-2">
          <span className="text-xl">💻</span>
          <h1 className="font-serif font-semibold text-hero">开发工作</h1>
        </div>
        <div className="space-y-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="简介（可选）" className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addProject} disabled={!name.trim()} className="w-full btn btn-primary !py-1.5 text-xs">＋ 新建项目</button>
        </div>
        {projects.length === 0 && <div className="text-xs text-text-mute text-center py-6">还没有项目</div>}
        <div className="space-y-1">
          {projects.map((p) => (
            <div key={p.id} onClick={() => setSelId(p.id)}
              className={clsx('group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition',
                selId === p.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surface/60 text-text-soft')}>
              <span className="flex-1 truncate">{p.name}</span>
              <button onClick={(e) => { e.stopPropagation(); cycleProject(p.id); }} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" title="切换状态">
                <span className={clsx('px-1.5 py-0.5 rounded-full', PROJECT_STATUS[p.status]?.cls)}>{PROJECT_STATUS[p.status]?.label}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); delProject(p.id); }} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
            </div>
          ))}
        </div>
      </aside>

      {/* 项目详情 */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {!sel ? (
          <div className="text-center text-text-mute py-24">
            <div className="text-4xl mb-3">💻</div>
            <div>选择或新建一个项目</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            <header className="animate-fade-in">
              <h2 className="font-serif text-xl font-semibold text-hero">{sel.name}</h2>
              {sel.description && <p className="text-sm text-text-soft mt-1">{sel.description}</p>}
            </header>

            <div className="flex gap-1">
              {(['tasks', 'bugs', 'notes'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={clsx('text-sm px-3 py-1.5 rounded-lg transition',
                    tab === t ? 'bg-primary/15 text-primary font-medium' : 'text-text-soft hover:bg-bg-soft')}>
                  {t === 'tasks' ? '📋 任务' : t === 'bugs' ? '🐛 Bug' : '📝 笔记'}
                </button>
              ))}
            </div>

            {tab === 'tasks' && (
              <div className="glass-card rounded-2xl p-4 space-y-2 animate-fade-in">
                <div className="flex gap-2">
                  <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="新任务…" className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                  <button onClick={addTask} disabled={!tTitle.trim()} className="btn btn-primary !py-1.5 text-xs">添加</button>
                </div>
                {tasks.length === 0 ? <div className="text-sm text-text-mute text-center py-4">暂无任务</div> : (
                  <ul className="space-y-1">
                    {tasks.map((t) => (
                      <li key={t.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                        <button onClick={() => toggleTask(t)} className={clsx('w-4 h-4 shrink-0 rounded-full border-2 grid place-items-center', t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text-mute')}>{t.status === 'done' && '✓'}</button>
                        <span className={clsx('flex-1 text-sm', t.status === 'done' && 'line-through text-text-mute')}>{t.title}</span>
                        <button onClick={() => delTask(t.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'bugs' && (
              <div className="glass-card rounded-2xl p-4 space-y-2 animate-fade-in">
                <div className="flex gap-2">
                  <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBug()} placeholder="新 Bug…" className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                  <button onClick={addBug} disabled={!bTitle.trim()} className="btn btn-primary !py-1.5 text-xs">添加</button>
                </div>
                {bugs.length === 0 ? <div className="text-sm text-text-mute text-center py-4">没有 Bug 🎉</div> : (
                  <ul className="space-y-1">
                    {bugs.map((b) => (
                      <li key={b.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                        <button onClick={() => cycleBug(b)} className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-accent-red/15 text-accent-red hover:bg-accent-red/25" title="推进状态">
                          {({ open: '待修', fixing: '修复中', fixed: '已修复', closed: '已关闭' } as Record<string, string>)[b.status] ?? b.status}
                        </button>
                        <span className="flex-1 text-sm">{b.title}</span>
                        <button onClick={() => delBug(b.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'notes' && (
              <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
                <div className="flex flex-wrap gap-2">
                  <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="笔记标题" className="w-full lg:w-48 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                  <input value={nContent} onChange={(e) => setNContent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="内容（可选）" className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                  <button onClick={addNote} disabled={!nTitle.trim()} className="btn btn-primary !py-1.5 text-xs">记录</button>
                </div>
                {notes.length === 0 ? <div className="text-sm text-text-mute text-center py-4">暂无笔记</div> : (
                  <ul className="space-y-1.5">
                    {notes.map((n) => (
                      <li key={n.id} className="group p-3 rounded-lg bg-bg-soft/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{n.title}</span>
                          <button onClick={() => delNote(n.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                        </div>
                        {n.content && <div className="text-sm text-text-soft whitespace-pre-wrap">{n.content}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
