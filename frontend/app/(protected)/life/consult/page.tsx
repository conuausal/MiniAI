'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, ConsultClient, ConsultRecord, ConsultIncome } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);
const REC_STATUS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: '进行中', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  delivered: { label: '已交付', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  closed: { label: '已关闭', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export default function ConsultPage() {
  const [clients, setClients] = useState<ConsultClient[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [income, setIncome] = useState<ConsultIncome[]>([]);
  const [summary, setSummary] = useState<{ total: number; by_month: Record<string, number> }>({ total: 0, by_month: {} });
  const [cName, setCName] = useState('');
  const [cCat, setCCat] = useState('');
  const [rTitle, setRTitle] = useState('');
  const [rContent, setRContent] = useState('');
  const [iAmt, setIAmt] = useState('');
  const [iDate, setIDate] = useState(today());

  const refreshClients = useCallback(async () => {
    try {
      const list = await life.consultClients.list({});
      setClients(list);
      if (!list.find((c) => c.id === selId)) setSelId(list[0]?.id ?? null);
    } catch { /* ignore */ }
  }, [selId]);
  useEffect(() => { refreshClients(); }, [refreshClients]);

  const refreshDetail = useCallback(async () => {
    if (!selId) return;
    try { setRecords(await life.consultRecords.list({ client_id: String(selId) })); } catch { /* ignore */ }
    try { setIncome(await life.consultIncome.list({ client_id: String(selId) })); } catch { /* ignore */ }
  }, [selId]);
  useEffect(() => { refreshDetail(); }, [refreshDetail]);

  const refreshSummary = useCallback(async () => {
    try { setSummary(await life.consultSummary()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refreshSummary(); }, [refreshSummary]);

  const addClient = async () => {
    if (!cName.trim()) return;
    const c = await life.consultClients.create({ name: cName.trim(), category: cCat || null });
    setCName(''); setCCat('');
    setSelId(c.id);
    refreshClients();
  };
  const delClient = async (id: number) => { await life.consultClients.remove(id); setSelId(null); refreshClients(); };

  const addRecord = async () => {
    if (!rTitle.trim() || !selId) return;
    await life.consultRecords.create({ client_id: selId, title: rTitle.trim(), content: rContent || null });
    setRTitle(''); setRContent('');
    refreshDetail();
  };
  const cycleRecord = async (r: ConsultRecord) => {
    const next = ({ in_progress: 'delivered', delivered: 'closed', closed: 'in_progress' } as Record<string, string>)[r.status] ?? 'in_progress';
    await life.consultRecords.update(r.id, { status: next });
    refreshDetail();
  };
  const delRecord = async (id: number) => { await life.consultRecords.remove(id); refreshDetail(); };

  const addIncome = async () => {
    if (!iAmt.trim() || !selId) return;
    await life.consultIncome.create({ client_id: selId, amount: Number(iAmt) || 0, income_date: iDate });
    setIAmt('');
    refreshDetail();
    refreshSummary();
  };
  const delIncome = async (id: number) => { await life.consultIncome.remove(id); refreshDetail(); refreshSummary(); };

  const sel = clients.find((c) => c.id === selId);
  const monthKeys = Object.keys(summary.by_month).sort().reverse();

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* 客户列表 */}
      <aside className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-border-soft p-4 space-y-3 overflow-y-auto max-h-[40vh] lg:max-h-none">
        <div className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <h1 className="font-serif font-semibold text-hero">咨询工作</h1>
        </div>
        <div className="space-y-1.5">
          <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="客户名" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input value={cCat} onChange={(e) => setCCat(e.target.value)} placeholder="类型（如：技术答疑）" className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addClient} disabled={!cName.trim()} className="w-full btn btn-primary !py-1.5 text-xs">＋ 新增客户</button>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-300/40">
          <div className="text-[11px] text-text-mute">累计收入</div>
          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">¥{summary.total.toLocaleString()}</div>
          {monthKeys.slice(0, 3).map((k) => <div key={k} className="text-[11px] text-text-mute">{k} · ¥{summary.by_month[k].toLocaleString()}</div>)}
        </div>
        {clients.length === 0 && <div className="text-xs text-text-mute text-center py-6">还没有客户</div>}
        <div className="space-y-1">
          {clients.map((c) => (
            <div key={c.id} onClick={() => setSelId(c.id)}
              className={clsx('group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition',
                selId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surface/60 text-text-soft')}>
              <span className="flex-1 truncate">{c.name}</span>
              {c.category && <span className="text-[10px] text-text-mute">{c.category}</span>}
              <button onClick={(e) => { e.stopPropagation(); delClient(c.id); }} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
            </div>
          ))}
        </div>
      </aside>

      {/* 客户详情 */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {!sel ? (
          <div className="text-center text-text-mute py-24">
            <div className="text-4xl mb-3">💼</div>
            <div>选择或新增一个客户</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            <header className="animate-fade-in">
              <h2 className="font-serif text-xl font-semibold text-hero">{sel.name}</h2>
              {sel.category && <p className="text-sm text-text-soft mt-1">{sel.category}</p>}
            </header>

            {/* 进度记录 */}
            <section className="glass-card rounded-2xl p-4 space-y-2">
              <h3 className="font-semibold text-sm">📈 咨询进度</h3>
              <div className="flex flex-wrap gap-2">
                <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="事项标题" className="w-full lg:w-48 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                <input value={rContent} onChange={(e) => setRContent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRecord()} placeholder="详情（可选）" className="flex-1 min-w-[140px] px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                <button onClick={addRecord} disabled={!rTitle.trim()} className="btn btn-primary !py-1.5 text-xs">添加</button>
              </div>
              {records.length === 0 ? <div className="text-sm text-text-mute text-center py-4">暂无记录</div> : (
                <ul className="space-y-1">
                  {records.map((r) => (
                    <li key={r.id} className="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                      <button onClick={() => cycleRecord(r)} className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 hover:opacity-80">
                        <span className={clsx('px-1.5 py-0.5 rounded-full', REC_STATUS[r.status]?.cls)}>{REC_STATUS[r.status]?.label}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{r.title}</div>
                        {r.content && <div className="text-xs text-text-soft whitespace-pre-wrap">{r.content}</div>}
                      </div>
                      <button onClick={() => delRecord(r.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 收费记录 */}
            <section className="glass-card rounded-2xl p-4 space-y-2">
              <h3 className="font-semibold text-sm">💰 收费记录</h3>
              <div className="flex flex-wrap gap-2">
                <input type="number" value={iAmt} onChange={(e) => setIAmt(e.target.value)} placeholder="金额" className="w-full sm:w-28 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
                <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className="px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
                <button onClick={addIncome} disabled={!iAmt.trim()} className="btn btn-primary !py-1.5 text-xs">记一笔</button>
              </div>
              {income.length === 0 ? <div className="text-sm text-text-mute text-center py-4">暂无收费记录</div> : (
                <ul className="space-y-1">
                  {income.map((i) => (
                    <li key={i.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                      <span className="flex-1 text-sm font-mono">{i.income_date}</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">¥{Number(i.amount).toLocaleString()}</span>
                      <button onClick={() => delIncome(i.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
