'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/lib/store';
import { api } from '@/lib/api';
import clsx from 'clsx';

/**
 * 会话列表（新建对话 + 最近会话）。
 * 桌面端由 Sidebar 使用；移动端由 MobileNav 抽屉复用。
 * onNavigate：点选会话后回调（移动端用于关闭抽屉）。
 */
export default function SessionList({ onNavigate }: { onNavigate?: () => void }) {
  const { sessions, currentSessionId, setSessions, setCurrentSession, setMessages, resetMessages } = useChatStore();

  const refresh = async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { refresh(); }, []);

  const newSession = async () => {
    try {
      const s = await api.createSession('新对话', useChatStore.getState().currentModel);
      await refresh();
      setCurrentSession(s.id);
      setMessages([]);
      onNavigate?.();
    } catch (e: any) {
      alert('新建对话失败：' + (e?.message || e));
    }
  };

  const openSession = async (id: string) => {
    try {
      const detail = await api.getSession(id);
      setCurrentSession(id);
      setMessages(detail.messages || []);
      onNavigate?.();
    } catch (e: any) {
      alert('打开对话失败：' + (e?.message || e));
    }
  };

  const removeSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('删除这个对话？')) return;
    try {
      await api.deleteSession(id);
      if (currentSessionId === id) resetMessages();
      await refresh();
    } catch (e: any) {
      alert('删除失败：' + (e?.message || e));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={newSession}
          className="w-full btn btn-primary justify-center !py-2.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="px-2 py-1 text-[11px] font-semibold text-text-mute uppercase tracking-wider">最近</div>
        {sessions.length === 0 && (
          <div className="px-3 py-6 text-xs text-text-mute text-center">
            <div className="mb-2 opacity-50">💭</div>
            <div>还没有对话</div>
            <div className="mt-1">点击上方按钮开始</div>
          </div>
        )}
        <ul className="space-y-0.5">
          {sessions.map((s) => (
            <li key={s.id}>
              <div
                onClick={() => openSession(s.id)}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition animate-fade-in',
                  currentSessionId === s.id
                    ? 'bg-surface text-text shadow-soft-sm border-l-2 border-primary'
                    : 'hover:bg-surface/60 text-text-soft hover:text-text'
                )}
              >
                <span className="truncate flex-1">{s.title}</span>
                <button
                  onClick={(e) => removeSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-text-mute hover:text-accent-red transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
