'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useChatStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function Sidebar() {
  const { sessions, currentSessionId, setSessions, setCurrentSession, setMessages, resetMessages } = useChatStore();

  const refresh = async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { refresh(); }, []);

  const newSession = async () => {
    const s = await api.createSession('新对话', useChatStore.getState().currentModel);
    await refresh();
    setCurrentSession(s.id);
    setMessages([]);
  };

  const openSession = async (id: string) => {
    const detail = await api.getSession(id);
    setCurrentSession(id);
    setMessages(detail.messages || []);
  };

  const removeSession = async (id: string) => {
    if (!confirm('确定删除这个会话？')) return;
    await api.deleteSession(id);
    if (currentSessionId === id) resetMessages();
    await refresh();
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white font-bold">M</div>
          <div>
            <div className="font-semibold leading-tight">MiniAI</div>
            <div className="text-[10px] text-slate-500">开源个人助手 · v0.1</div>
          </div>
        </div>
        <button
          onClick={newSession}
          className="w-full text-sm py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white transition"
        >
          ＋ 新建对话
        </button>
      </div>

      <nav className="px-2 py-2 text-sm">
        <Link href="/" className="block px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">💬 对话</Link>
        <Link href="/knowledge" className="block px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">📚 知识库</Link>
        <Link href="/settings" className="block px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">⚙️ 设置</Link>
      </nav>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 py-1 text-xs text-slate-500">历史会话</div>
        {sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-400">暂无会话，点击上方"新建对话"开始</div>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <div
                onClick={() => openSession(s.id)}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition
                  ${currentSessionId === s.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <span className="truncate">{s.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500"
                >×</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        <a className="hover:underline" href="https://github.com/" target="_blank" rel="noreferrer">⭐ Star on GitHub</a>
      </div>
    </aside>
  );
}
