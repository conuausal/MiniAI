'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { life } from '@/lib/life';

const TOGGLE_MODULES = [
  { key: 'todos', label: '今日计划', emoji: '✅' },
  { key: 'media', label: '自媒体', emoji: '📣' },
  { key: 'dev', label: '开发工作', emoji: '💻' },
  { key: 'consult', label: '咨询工作', emoji: '💼' },
  { key: 'fitness', label: '健身计划', emoji: '💪' },
  { key: 'diet', label: '饮食计划', emoji: '🥗' },
  { key: 'games', label: '游戏娱乐', emoji: '🎮' },
];

export default function LifeSettingsPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try { setStats(await life.stats()); } catch { /* ignore */ }
    try {
      const s = await life.getSettings();
      setToggles((s as Record<string, unknown>).module_toggles as Record<string, boolean> || {});
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const setToggle = async (key: string, v: boolean) => {
    const next = { ...toggles, [key]: v };
    setToggles(next);
    await life.putSetting('module_toggles', next);
  };

  const doExport = async () => {
    try {
      const data = await life.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miniai-life-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('已导出备份 ✅');
    } catch (e) { setMsg(`导出失败: ${e}`); }
    setTimeout(() => setMsg(''), 3000);
  };
  const doImport = async (file: File) => {
    if (!confirm('导入将覆盖当前所有生活数据，确定继续？')) { if (fileRef.current) fileRef.current.value = ''; return; }
    try {
      const data = JSON.parse(await file.text());
      await life.importBackup(data);
      setMsg('导入成功 ✅');
      refresh();
    } catch (e) { setMsg(`导入失败: ${e}`); }
    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  const cards = stats ? [
    { label: '待办完成率', value: `${Math.round(Number(stats.todo_rate) * 100)}%`, sub: `${stats.todo_done}/${stats.todo_total}`, emoji: '✅', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: '健身连续打卡', value: `${stats.fitness_streak} 天`, sub: '连续', emoji: '💪', color: 'text-accent-orange' },
    { label: '咨询累计收入', value: `¥${Number(stats.consult_income_total).toLocaleString()}`, sub: '总计', emoji: '💼', color: 'text-accent-cyan' },
    { label: '游戏累计时长', value: `${stats.game_total_hours} h`, sub: '总计', emoji: '🎮', color: 'text-accent-purple' },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">⚙️</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">数据与设置</h1>
        </div>
        <p className="text-sm text-text-soft">统计看板 · 模块开关 · 数据备份</p>
      </header>

      {/* 统计看板 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-2xl p-4">
            <div className="text-xl mb-1">{c.emoji}</div>
            <div className={clsx('text-xl font-semibold', c.color)}>{c.value}</div>
            <div className="text-xs text-text-mute">{c.label} · {c.sub}</div>
          </div>
        ))}
      </section>

      {/* 模块开关 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-1">🧩 模块开关</h2>
        <p className="text-xs text-text-mute mb-3">关闭后对应模块从左侧导航隐藏（总览与数据与设置始终显示）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOGGLE_MODULES.map((m) => {
            const on = toggles[m.key] !== false;
            return (
              <div key={m.key} className="flex items-center justify-between p-3 rounded-xl bg-bg-soft/50">
                <span className="text-sm">{m.emoji} {m.label}</span>
                <button onClick={() => setToggle(m.key, !on)}
                  className={clsx('relative w-10 h-6 rounded-full transition', on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}>
                  <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform', on && 'translate-x-4')} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 数据备份 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
        <h2 className="font-semibold mb-1">💾 数据备份</h2>
        <p className="text-xs text-text-mute mb-3">一键导出全部生活数据为 JSON；导入会覆盖当前数据，请先备份。</p>
        <div className="flex items-center gap-2">
          <button onClick={doExport} className="btn btn-primary !py-2 text-xs">⬇️ 导出备份</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-secondary !py-2 text-xs">⬆️ 导入备份</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          {msg && <span className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
