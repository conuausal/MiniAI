'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, MediaPost, MediaStat } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);
const KINDS = [
  { v: 'idea', label: '选题池', emoji: '💡' },
  { v: 'draft', label: '草稿', emoji: '📝' },
  { v: 'published', label: '已发布', emoji: '🚀' },
];

export default function MediaPage() {
  const [kind, setKind] = useState('idea');
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [stats, setStats] = useState<MediaStat[]>([]);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');

  const [sp, setSp] = useState('');
  const [sd, setSd] = useState(today());
  const [sf, setSf] = useState('');
  const [sv, setSv] = useState('');
  const [sl, setSl] = useState('');
  const [sc, setSc] = useState('');

  const refresh = useCallback(async () => {
    try { setPosts(await life.mediaPosts.list({ kind })); } catch { /* ignore */ }
    try { setStats(await life.mediaStats.list({})); } catch { /* ignore */ }
  }, [kind]);
  useEffect(() => { refresh(); }, [refresh]);

  const addPost = async () => {
    if (!title.trim()) return;
    await life.mediaPosts.create({ title: title.trim(), kind, platform });
    setTitle(''); setPlatform('');
    refresh();
  };
  const moveKind = async (p: MediaPost, k: string) => {
    await life.mediaPosts.update(p.id, { kind: k, ...(k === 'published' && !p.publish_date ? { publish_date: today() } : {}) });
    refresh();
  };
  const delPost = async (id: number) => { await life.mediaPosts.remove(id); refresh(); };

  const addStat = async () => {
    if (!sp.trim()) return;
    await life.mediaStats.create({
      platform: sp.trim(), stat_date: sd,
      followers: Number(sf) || 0, views: Number(sv) || 0, likes: Number(sl) || 0, comments: Number(sc) || 0,
    });
    setSf(''); setSv(''); setSl(''); setSc('');
    refresh();
  };
  const delStat = async (id: number) => { await life.mediaStats.remove(id); refresh(); };

  const chart = [...stats].sort((a, b) => a.stat_date.localeCompare(b.stat_date)).slice(-14);
  const maxViews = Math.max(1, ...chart.map((s) => s.views));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">📣</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">自媒体</h1>
        </div>
        <p className="text-sm text-text-soft">内容创作流程 + 平台数据登记</p>
      </header>

      {/* 内容管理 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-2 mb-4">
          {KINDS.map((k) => (
            <button key={k.v} onClick={() => setKind(k.v)}
              className={clsx('text-sm px-3 py-1.5 rounded-lg transition',
                kind === k.v ? 'bg-primary/15 text-primary font-medium' : 'text-text-soft hover:bg-bg-soft')}>
              {k.emoji} {k.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-text-mute">{posts.length} 条</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPost()}
            placeholder="新内容标题…" className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="平台（可选）"
            className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addPost} disabled={!title.trim()} className="btn btn-primary !py-2 text-xs">＋ 添加</button>
        </div>

        {posts.length === 0 ? (
          <div className="text-sm text-text-mute text-center py-8">这个分类还没有内容</div>
        ) : (
          <ul className="space-y-1.5">
            {posts.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-soft transition">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  {p.platform && <div className="text-[11px] text-text-mute">{p.platform}</div>}
                </div>
                {p.publish_date && <span className="text-xs text-text-mute font-mono">{p.publish_date}</span>}
                <span className="flex gap-1">
                  {KINDS.filter((k) => k.v !== kind).map((k) => (
                    <button key={k.v} onClick={() => moveKind(p, k.v)} className="text-[11px] px-1.5 py-0.5 rounded-md bg-bg-soft text-text-mute hover:text-primary" title={k.label}>{k.emoji}</button>
                  ))}
                </span>
                <button onClick={() => delPost(p.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red" title="删除">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 平台数据 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-3">📊 平台数据</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <input value={sp} onChange={(e) => setSp(e.target.value)} placeholder="平台" className="w-24 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="date" value={sd} onChange={(e) => setSd(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input value={sf} onChange={(e) => setSf(e.target.value)} placeholder="粉丝" className="w-20 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input value={sv} onChange={(e) => setSv(e.target.value)} placeholder="阅读" className="w-20 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input value={sl} onChange={(e) => setSl(e.target.value)} placeholder="点赞" className="w-20 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input value={sc} onChange={(e) => setSc(e.target.value)} placeholder="评论" className="w-20 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <button onClick={addStat} disabled={!sp.trim()} className="btn btn-primary !py-2 text-xs">记录</button>
        </div>

        {/* 阅读趋势图（轻量条形） */}
        {chart.length > 1 && (
          <div className="mb-4">
            <div className="text-[11px] text-text-mute mb-1.5">阅读趋势（近 {chart.length} 条记录）</div>
            <div className="flex items-end gap-1 h-20">
              {chart.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-gradient-to-t from-primary/40 to-accent-purple/60" style={{ height: `${Math.max(4, (s.views / maxViews) * 100)}%` }} title={`${s.platform} ${s.stat_date}: ${s.views}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.length === 0 ? (
          <div className="text-sm text-text-mute text-center py-6">还没有数据记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mute border-b border-border-soft">
                <th className="py-1.5">日期</th><th>平台</th><th className="text-right">粉丝</th><th className="text-right">阅读</th><th className="text-right">点赞</th><th className="text-right">评论</th><th></th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-border-soft/50 group">
                  <td className="py-1.5 text-xs font-mono">{s.stat_date}</td>
                  <td className="text-xs">{s.platform}</td>
                  <td className="text-right text-xs">{s.followers}</td>
                  <td className="text-right text-xs">{s.views}</td>
                  <td className="text-right text-xs">{s.likes}</td>
                  <td className="text-right text-xs">{s.comments}</td>
                  <td className="text-right"><button onClick={() => delStat(s.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button></td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
