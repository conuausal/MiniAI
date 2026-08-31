'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, FitnessPlan, BodyMetric } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);

export default function FitnessPage() {
  const [checkedToday, setCheckedToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [plans, setPlans] = useState<FitnessPlan[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [pName, setPName] = useState('');
  const [pParts, setPParts] = useState('');
  const [w, setW] = useState('');
  const [bf, setBf] = useState('');

  const refresh = useCallback(async () => {
    try { setCheckedToday((await life.fitnessCheckins.list({ checkin_date: today() })).length > 0); } catch { /* ignore */ }
    try { setStreak((await life.fitnessStreak()).streak); } catch { /* ignore */ }
    try { setPlans(await life.fitnessPlans.list({})); } catch { /* ignore */ }
    try { setMetrics(await life.bodyMetrics.list({})); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const checkin = async () => {
    if (checkedToday) return;
    await life.fitnessCheckins.create({ checkin_date: today(), completed: true });
    refresh();
  };
  const uncheckin = async () => {
    const list = await life.fitnessCheckins.list({ checkin_date: today() });
    for (const c of list) await life.fitnessCheckins.remove(c.id);
    refresh();
  };
  const addPlan = async () => {
    if (!pName.trim()) return;
    await life.fitnessPlans.create({ name: pName.trim(), parts: pParts || null });
    setPName(''); setPParts('');
    refresh();
  };
  const delPlan = async (id: number) => { await life.fitnessPlans.remove(id); refresh(); };
  const addMetric = async () => {
    await life.bodyMetrics.create({ metric_date: today(), weight: w ? Number(w) : null, body_fat: bf ? Number(bf) : null });
    setW(''); setBf('');
    refresh();
  };
  const delMetric = async (id: number) => { await life.bodyMetrics.remove(id); refresh(); };

  const trend = [...metrics].sort((a, b) => a.metric_date.localeCompare(b.metric_date)).slice(-14);
  const maxW = Math.max(...trend.map((m) => Number(m.weight) || 0), 1);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">💪</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">健身计划</h1>
        </div>
        <p className="text-sm text-text-soft">连续打卡 <span className="font-semibold text-accent-orange">{streak}</span> 天</p>
      </header>

      {/* 今日打卡 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">🏋️ 今日打卡</h2>
            <p className="text-sm text-text-mute mt-1">{checkedToday ? '今天已训练，太棒了！' : '今天还没打卡，去练一组吧'}</p>
          </div>
          <button
            onClick={checkedToday ? uncheckin : checkin}
            className={clsx('btn !py-2.5 !px-5', checkedToday ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'btn-primary')}
          >
            {checkedToday ? '✓ 已打卡（点击取消）' : '⚡ 开始打卡'}
          </button>
        </div>
      </section>

      {/* 训练模板 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-3">🗂️ 训练模板</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="模板名（如：胸+三头）" className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input value={pParts} onChange={(e) => setPParts(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlan()} placeholder="部位（可选）" className="w-32 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addPlan} disabled={!pName.trim()} className="btn btn-primary !py-2 text-xs">＋ 添加</button>
        </div>
        {plans.length === 0 ? <div className="text-sm text-text-mute text-center py-4">还没有训练模板</div> : (
          <ul className="space-y-1.5">
            {plans.map((p) => (
              <li key={p.id} className="group flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-bg-soft">
                <span className="text-base">🏋️</span>
                <div className="flex-1">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.parts && <span className="text-xs text-text-mute ml-2">{p.parts}</span>}
                </div>
                <button onClick={() => delPlan(p.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 身体数据 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
        <h2 className="font-semibold mb-3">⚖️ 身体数据</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} placeholder="体重 kg" className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input type="number" step="0.1" value={bf} onChange={(e) => setBf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMetric()} placeholder="体脂 %" className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addMetric} disabled={!w && !bf} className="btn btn-primary !py-2 text-xs">记录</button>
          <span className="text-xs text-text-mute self-center">记录于 {today()}</span>
        </div>

        {trend.length > 1 && (
          <div className="mb-4">
            <div className="text-[11px] text-text-mute mb-1.5">体重趋势（近 {trend.length} 条）</div>
            <div className="flex items-end gap-1 h-20">
              {trend.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${m.metric_date} ${m.weight}kg`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-primary/40 to-accent-pink/60" style={{ height: `${Math.max(4, ((Number(m.weight) || 0) / maxW) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {metrics.length === 0 ? <div className="text-sm text-text-mute text-center py-4">暂无身体数据</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-text-mute border-b border-border-soft"><th className="py-1.5">日期</th><th className="text-right">体重(kg)</th><th className="text-right">体脂(%)</th><th></th></tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-border-soft/50 group">
                  <td className="py-1.5 text-xs font-mono">{m.metric_date}</td>
                  <td className="text-right text-xs">{m.weight ?? '—'}</td>
                  <td className="text-right text-xs">{m.body_fat ?? '—'}</td>
                  <td className="text-right"><button onClick={() => delMetric(m.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button></td>
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
