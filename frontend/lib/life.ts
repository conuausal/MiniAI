/** 个人工作生活管理 —— API 客户端（fetch 拦截器已自动带用户配置头）。 */
'use client';

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function jf<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const s = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  return s ? `?${s}` : '';
}

function crud<T>(base: string) {
  return {
    list: (params?: Record<string, string | undefined>) => jf<T[]>(`${base}${qs(params)}`),
    create: (data: Partial<T>) => jf<T>(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<T>) => jf<T>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => jf<{ deleted: number }>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

// ============ 类型 ============

export interface Todo { id: number; title: string; priority: string; due_date: string | null; due_time: string | null; status: string; module: string | null; sort_order: number; note: string | null; created_at?: string; }
export interface Note { id: number; content: string; pinned: boolean; created_at?: string; }
export interface MediaPost { id: number; title: string; platform: string; kind: string; content: string | null; publish_date: string | null; url: string | null; status: string; }
export interface MediaStat { id: number; platform: string; stat_date: string; followers: number; views: number; likes: number; comments: number; }
export interface DevProject { id: number; name: string; description: string | null; status: string; repo_url: string | null; }
export interface DevTask { id: number; project_id: number; title: string; status: string; priority: string; due_date: string | null; }
export interface DevBug { id: number; project_id: number; title: string; severity: string; status: string; notes: string | null; }
export interface DevNote { id: number; project_id: number | null; title: string; content: string | null; tags: string | null; }
export interface ConsultClient { id: number; name: string; category: string | null; contact: string | null; notes: string | null; }
export interface ConsultRecord { id: number; client_id: number; title: string; content: string | null; status: string; due_date: string | null; }
export interface ConsultIncome { id: number; client_id: number | null; record_id: number | null; amount: number; income_date: string; note: string | null; }
export interface FitnessPlan { id: number; name: string; parts: string | null; exercises: Array<{ name: string; sets: number; reps: number; weight?: number }> | null; note: string | null; }
export interface FitnessCheckin { id: number; checkin_date: string; plan_id: number | null; exercises: unknown; completed: boolean; note: string | null; }
export interface BodyMetric { id: number; metric_date: string; weight: number | null; body_fat: number | null; }
export interface Meal { id: number; meal_date: string; meal_type: string; content: string | null; calories: number; protein: number; carbs: number; fat: number; }
export interface Recipe { id: number; name: string; category: string | null; ingredients: string | null; calories: number; protein: number; carbs: number; fat: number; notes: string | null; }
export interface NutritionGoal { id: number; goal_date: string; calories: number; protein: number; carbs: number; fat: number; }
export interface Game { id: number; name: string; platform: string | null; status: string; rating: number | null; total_hours: number; note: string | null; }
export interface GameRecord { id: number; game_id: number; record_date: string; hours: number; note: string | null; }

export interface ModuleSummary {
  media_publish_today: number; dev_active_projects: number; dev_tasks_today: number;
  consult_in_progress: number; fitness_checked_today: boolean; diet_recorded_today: boolean; game_hours_today: number;
}
export interface HomeOverview { date: string; todos: Todo[]; notes: Note[]; modules: ModuleSummary; }

// ============ 各模块 API ============

export const life = {
  home: () => jf<HomeOverview>('/api/life/home'),

  todos: crud<Todo>('/api/life/todos'),
  notes: crud<Note>('/api/life/notes'),

  mediaPosts: crud<MediaPost>('/api/life/media/posts'),
  mediaStats: crud<MediaStat>('/api/life/media/stats'),

  devProjects: crud<DevProject>('/api/life/dev/projects'),
  devTasks: crud<DevTask>('/api/life/dev/tasks'),
  devBugs: crud<DevBug>('/api/life/dev/bugs'),
  devNotes: crud<DevNote>('/api/life/dev/notes'),

  consultClients: crud<ConsultClient>('/api/life/consult/clients'),
  consultRecords: crud<ConsultRecord>('/api/life/consult/records'),
  consultIncome: crud<ConsultIncome>('/api/life/consult/income'),
  consultSummary: () => jf<{ total: number; by_month: Record<string, number> }>('/api/life/consult/summary'),

  fitnessPlans: crud<FitnessPlan>('/api/life/fitness/plans'),
  fitnessCheckins: crud<FitnessCheckin>('/api/life/fitness/checkins'),
  fitnessStreak: () => jf<{ streak: number }>('/api/life/fitness/streak'),
  bodyMetrics: crud<BodyMetric>('/api/life/fitness/metrics'),

  meals: crud<Meal>('/api/life/diet/meals'),
  recipes: crud<Recipe>('/api/life/diet/recipes'),
  nutritionGoals: crud<NutritionGoal>('/api/life/diet/goals'),
  dietSummary: (meal_date: string) => jf<{ date: string; meals: Meal[]; totals: { calories: number; protein: number; carbs: number; fat: number }; goal: { calories: number; protein: number; carbs: number; fat: number } | null }>(`/api/life/diet/summary?meal_date=${meal_date}`),

  games: crud<Game>('/api/life/games'),
  gameRecords: crud<GameRecord>('/api/life/games/records'),

  getSettings: () => jf<Record<string, unknown>>('/api/life/settings'),
  putSetting: (key: string, value: unknown) => jf(`/api/life/settings/${key}`, { method: 'PUT', body: JSON.stringify({ key, value }) }),

  stats: () => jf<Record<string, unknown>>('/api/life/stats'),
  exportBackup: () => jf<unknown>('/api/life/backup/export'),
  importBackup: (data: unknown) => jf(`/api/life/backup/import`, { method: 'POST', body: JSON.stringify(data) }),
};
