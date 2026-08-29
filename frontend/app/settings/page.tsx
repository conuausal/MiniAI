'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, ModelInfo } from '@/lib/api';

export default function SettingsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [health, setHealth] = useState<string>('检测中…');

  useEffect(() => {
    api.health().then((h) => setHealth(h.status)).catch(() => setHealth('❌ 后端不可达'));
    api.listModels().then(({ models }) => setModels(models)).catch(() => {});
  }, []);

  const reload = async () => {
    await api.reloadModels();
    const { models } = await api.listModels();
    setModels(models);
  };

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);

  return (
    <main className="h-screen flex">
      <Sidebar />
      <section className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950">
        <h1 className="text-2xl font-bold mb-1">⚙️ 设置</h1>
        <p className="text-sm text-slate-500 mb-6">配置 API Key、查看模型可用性</p>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">后端状态</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${health === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {health}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            配置 API Key：编辑 <code className="px-1 bg-slate-100 dark:bg-slate-800 rounded">backend/.env</code>，
            修改后点击"重新加载模型"。
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">模型</div>
            <button onClick={reload} className="text-xs px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white">重新加载</button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="font-medium text-green-600 dark:text-green-400">✓ 已启用（{enabled.length}）</div>
            {enabled.length === 0 && <div className="text-xs text-slate-400 pl-2">未配置 API Key</div>}
            {enabled.map((m) => (
              <div key={m.id} className="flex items-center justify-between pl-3 py-1 border-l-2 border-green-400">
                <span>{m.label}</span>
                <span className="text-xs text-slate-500">{m.provider} · {m.id}</span>
              </div>
            ))}

            <div className="font-medium text-slate-500 mt-4">✗ 未配置（{disabled.length}）</div>
            {disabled.map((m) => (
              <div key={m.id} className="flex items-center justify-between pl-3 py-1 border-l-2 border-slate-300 opacity-60">
                <span>{m.label}</span>
                <span className="text-xs text-slate-500">{m.provider} · {m.id}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-sm space-y-2">
          <div className="font-semibold">🚀 快速开始</div>
          <ol className="list-decimal list-inside text-slate-600 dark:text-slate-300 space-y-1">
            <li>复制 <code>backend/.env.example</code> 为 <code>backend/.env</code></li>
            <li>填入至少一个模型的 API Key（推荐 DeepSeek，性价比高）</li>
            <li><code>docker compose up -d</code> 一键启动</li>
            <li>浏览器访问 <code>http://localhost:3000</code></li>
          </ol>
        </div>
      </section>
    </main>
  );
}
