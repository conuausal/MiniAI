'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { life, Recipe } from '@/lib/life';

const today = () => new Date().toISOString().slice(0, 10);
const MEAL_TYPES = [
  { v: 'breakfast', label: '早餐', emoji: '🌅' },
  { v: 'lunch', label: '午餐', emoji: '☀️' },
  { v: 'dinner', label: '晚餐', emoji: '🌙' },
  { v: 'snack', label: '加餐', emoji: '🍎' },
];

export default function DietPage() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState<{ meals: any[]; totals: any; goal: any } | null>(null);
  const [mealType, setMealType] = useState('lunch');
  const [content, setContent] = useState('');
  const [cal, setCal] = useState('');
  const [pro, setPro] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [rName, setRName] = useState('');
  const [rCat, setRCat] = useState('');

  const [gCal, setGCal] = useState('');
  const [gPro, setGPro] = useState('');
  const [gCarb, setGCarb] = useState('');
  const [gFat, setGFat] = useState('');

  const refresh = useCallback(async () => {
    try { setSummary(await life.dietSummary(date)); } catch { /* ignore */ }
    try { setRecipes(await life.recipes.list({})); } catch { /* ignore */ }
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);

  const addMeal = async () => {
    await life.meals.create({
      meal_date: date, meal_type: mealType, content: content || null,
      calories: Number(cal) || 0, protein: Number(pro) || 0, carbs: Number(carb) || 0, fat: Number(fat) || 0,
    });
    setContent(''); setCal(''); setPro(''); setCarb(''); setFat('');
    refresh();
  };
  const delMeal = async (id: number) => { await life.meals.remove(id); refresh(); };
  const addRecipe = async () => {
    if (!rName.trim()) return;
    await life.recipes.create({ name: rName.trim(), category: rCat || null });
    setRName(''); setRCat('');
    refresh();
  };
  const delRecipe = async (id: number) => { await life.recipes.remove(id); refresh(); };
  const saveGoal = async () => {
    const existing = (await life.nutritionGoals.list({ goal_date: date }))[0];
    const data = { goal_date: date, calories: Number(gCal) || 0, protein: Number(gPro) || 0, carbs: Number(gCarb) || 0, fat: Number(gFat) || 0 };
    if (existing) await life.nutritionGoals.update(existing.id, data);
    else await life.nutritionGoals.create(data);
    refresh();
  };

  const t = summary?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const goal = summary?.goal;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <header className="animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="text-3xl">🥗</div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-hero">饮食计划</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-border bg-bg-soft" />
          <span className="text-sm text-text-soft">记录 {summary?.meals?.length ?? 0} 餐</span>
        </div>
      </header>

      {/* 营养合计 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <h2 className="font-semibold mb-3">📊 当日营养</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: '热量', v: t.calories, unit: 'kcal', color: 'text-accent-orange' },
            { label: '蛋白', v: t.protein, unit: 'g', color: 'text-accent-cyan' },
            { label: '碳水', v: t.carbs, unit: 'g', color: 'text-accent-purple' },
            { label: '脂肪', v: t.fat, unit: 'g', color: 'text-accent-pink' },
          ].map((n) => (
            <div key={n.label} className="rounded-xl bg-bg-soft/50 p-3">
              <div className={clsx('text-2xl font-semibold', n.color)}>{Math.round(n.v)}<span className="text-xs ml-0.5">{n.unit}</span></div>
              <div className="text-xs text-text-mute mt-0.5">{n.label}{goal && <span>/{goal[n.label === '热量' ? 'calories' : n.label === '蛋白' ? 'protein' : n.label === '碳水' ? 'carbs' : 'fat']}</span>}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <div className="text-xs text-text-mute">营养目标：</div>
          <input type="number" value={gCal} onChange={(e) => setGCal(e.target.value)} placeholder="热量" className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={gPro} onChange={(e) => setGPro(e.target.value)} placeholder="蛋白g" className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={gCarb} onChange={(e) => setGCarb(e.target.value)} placeholder="碳水g" className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={gFat} onChange={(e) => setGFat(e.target.value)} placeholder="脂肪g" className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <button onClick={saveGoal} className="btn btn-primary !py-1.5 text-xs">保存目标</button>
        </div>
      </section>

      {/* 三餐记录 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-semibold mb-3">🍽️ 记录三餐</h2>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MEAL_TYPES.map((m) => (
            <button key={m.v} onClick={() => setMealType(m.v)}
              className={clsx('text-xs px-3 py-1.5 rounded-lg transition', mealType === m.v ? 'bg-primary/15 text-primary font-medium' : 'bg-bg-soft text-text-soft hover:bg-surface')}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="吃了什么" className="flex-1 min-w-[150px] px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input type="number" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="kcal" className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={pro} onChange={(e) => setPro(e.target.value)} placeholder="蛋白" className="w-16 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={carb} onChange={(e) => setCarb(e.target.value)} placeholder="碳水" className="w-16 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMeal()} placeholder="脂肪" className="w-16 px-2 py-1.5 text-xs rounded-lg border border-border bg-bg-soft" />
          <button onClick={addMeal} className="btn btn-primary !py-1.5 text-xs">记录</button>
        </div>
        {summary?.meals?.length ? (
          <ul className="mt-3 space-y-1.5">
            {summary.meals.map((m: any) => (
              <li key={m.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                <span>{MEAL_TYPES.find((x) => x.v === m.meal_type)?.emoji ?? '🍽️'}</span>
                <span className="flex-1 text-sm">{m.content || '（无描述）'}</span>
                <span className="text-xs text-text-mute">{m.calories} kcal · 蛋{m.protein} 碳{m.carbs} 脂{m.fat}</span>
                <button onClick={() => delMeal(m.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
              </li>
            ))}
          </ul>
        ) : <div className="text-sm text-text-mute text-center py-4 mt-2">这一天还没记录</div>}
      </section>

      {/* 食谱库 */}
      <section className="glass-card rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
        <h2 className="font-semibold mb-3">📚 食谱库</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="菜名" className="flex-1 min-w-[150px] px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <input value={rCat} onChange={(e) => setRCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRecipe()} placeholder="分类（如：增肌餐）" className="w-32 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-soft focus:outline-none" />
          <button onClick={addRecipe} disabled={!rName.trim()} className="btn btn-primary !py-1.5 text-xs">＋ 添加</button>
        </div>
        {recipes.length === 0 ? <div className="text-sm text-text-mute text-center py-4">食谱库是空的</div> : (
          <ul className="space-y-1.5">
            {recipes.map((r) => (
              <li key={r.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-soft">
                <span className="text-base">🍲</span>
                <div className="flex-1">
                  <span className="text-sm font-medium">{r.name}</span>
                  {r.category && <span className="text-xs text-text-mute ml-2">{r.category}</span>}
                </div>
                <span className="text-xs text-text-mute">{r.calories} kcal</span>
                <button onClick={() => delRecipe(r.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
