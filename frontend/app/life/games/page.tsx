'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, Game, GameRecord } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);
const GAME_STATUS: Record<string, { label: string; cls: string }> = {
  wishlist: { label: '想玩', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  playing: { label: '在玩', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  finished: { label: '通关', cls: 'bg-accent-purple/15 text-accent-purple' },
};

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [hours, setHours] = useState('');
  const [gDate, setGDate] = useState(today());

  const refreshGames = useCallback(async () => {
    try { setGames(await life.games.list({})); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refreshGames(); }, [refreshGames]);

  const refreshRecords = useCallback(async () => {
    try { setRecords(await life.gameRecords.list({})); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refreshRecords(); }, [refreshRecords]);

  const addGame = async () => {
    if (!name.trim()) return;
    await life.games.create({ name: name.trim(), platform: platform || null });
    setName(''); setPlatform('');
    refreshGames();
  };
  const cycleStatus = async (g: Game) => {
    const next = ({ wishlist: 'playing', playing: 'finished', finished: 'wishlist' } as Record<string, string>)[g.status] ?? 'wishlist';
    await life.games.update(g.id, { status: next });
    refreshGames();
  };
  const delGame = async (id: number) => { await life.games.remove(id); if (selId === id) setSelId(null); refreshGames(); refreshRecords(); };

  const addRecord = async () => {
    if (!selId || !hours.trim()) return;
    await life.gameRecords.create({ game_id: selId, record_date: gDate, hours: Number(hours) || 0 });
    setHours('');
    refreshRecords();
  };
  const delRecord = async (id: number) => { await life.gameRecords.remove(id); refreshRecords(); };

  const totalHours = records.reduce((s, r) => s + Number(r.hours), 0);
  const todayHours = records.filter((r) => r.record_date === today()).reduce((s, r) => s + Number(r.hours), 0);
  const selGame = games.find((g) => g.id === selId);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">🎮</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">游戏娱乐</h1>
        </div>
        <p className="text-sm text-text-soft">累计 {totalHours.toFixed(1)} 小时 · 今日 {todayHours.toFixed(1)} 小时</p>
      </header>

      {/* 游戏库 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <h2 className="font-semibold mb-3">🎮 游戏库</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="游戏名" className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input value={platform} onChange={(e) => setPlatform(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGame()} placeholder="平台（可选）" className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addGame} disabled={!name.trim()} className="btn btn-primary !py-2 text-xs">＋ 添加</button>
        </div>
        {games.length === 0 ? <div className="text-sm text-text-mute text-center py-6">游戏库是空的</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {games.map((g) => (
              <div key={g.id} onClick={() => setSelId(g.id)}
                className={clsx('group flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition border',
                  selId === g.id ? 'bg-primary/10 border-primary/40' : 'hover:bg-bg-soft border-transparent')}>
                <span className="text-xl">🎮</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{g.name}</div>
                  {g.platform && <div className="text-[11px] text-text-mute">{g.platform}</div>}
                </div>
                <span className="text-xs text-text-mute">{g.total_hours}h</span>
                <button onClick={(e) => { e.stopPropagation(); cycleStatus(g); }} className="text-[10px]">
                  <span className={clsx('px-2 py-0.5 rounded-full font-medium', GAME_STATUS[g.status]?.cls)}>{GAME_STATUS[g.status]?.label}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); delGame(g.id); }} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 游玩记录 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-3">🕹️ 游玩记录</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={selId ?? ''} onChange={(e) => setSelId(Number(e.target.value))} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft">
            <option value="">选择游戏</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" step="0.1" value={hours} onChange={(e) => setHours(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRecord()} placeholder="时长(小时)" className="w-28 px-2 py-2 text-xs rounded-lg border border-border bg-bg-soft" />
          <button onClick={addRecord} disabled={!selId || !hours.trim()} className="btn btn-primary !py-2 text-xs">记录</button>
        </div>
        {selGame && <div className="text-xs text-text-mute mb-2">{selGame.name} · 累计 {records.filter((r) => r.game_id === selId).reduce((s, r) => s + Number(r.hours), 0).toFixed(1)} 小时</div>}
        {records.length === 0 ? <div className="text-sm text-text-mute text-center py-6">还没有游玩记录</div> : (
          <ul className="space-y-1.5">
            {records.slice(0, 30).map((r) => {
              const g = games.find((x) => x.id === r.game_id);
              return (
                <li key={r.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                  <span className="flex-1 text-sm">{g?.name ?? `#${r.game_id}`}</span>
                  <span className="text-xs text-text-mute font-mono">{r.record_date}</span>
                  <span className="text-sm font-medium">{Number(r.hours).toFixed(1)}h</span>
                  <button onClick={() => delRecord(r.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
