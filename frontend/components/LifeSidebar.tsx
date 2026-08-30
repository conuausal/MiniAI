'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { life } from '@/lib/life';

const MODULES = [
  { href: '/life', label: '总览', emoji: '🏠', key: 'home' },
  { href: '/life/todos', label: '今日计划', emoji: '✅', key: 'todos' },
  { href: '/life/media', label: '自媒体', emoji: '📣', key: 'media' },
  { href: '/life/dev', label: '开发工作', emoji: '💻', key: 'dev' },
  { href: '/life/consult', label: '咨询工作', emoji: '💼', key: 'consult' },
  { href: '/life/fitness', label: '健身计划', emoji: '💪', key: 'fitness' },
  { href: '/life/diet', label: '饮食计划', emoji: '🥗', key: 'diet' },
  { href: '/life/games', label: '游戏娱乐', emoji: '🎮', key: 'games' },
  { href: '/life/settings', label: '数据与设置', emoji: '⚙️', key: 'settings' },
];

export default function LifeSidebar() {
  const pathname = usePathname();
  const [disabled, setDisabled] = useState<Set<string>>(new Set());

  // 读取模块开关，隐藏被关闭的模块
  useEffect(() => {
    life.getSettings()
      .then((s) => {
        const toggles = (s as Record<string, unknown>).module_toggles as Record<string, boolean> | undefined;
        if (!toggles) return;
        setDisabled(new Set(Object.entries(toggles).filter(([, v]) => v === false).map(([k]) => k)));
      })
      .catch(() => {});
  }, []);

  const items = MODULES.filter((m) => !disabled.has(m.key));

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-surface/50 backdrop-blur-md flex flex-col overflow-y-auto">
      <div className="px-4 pt-4 pb-2 text-[11px] font-semibold text-text-mute uppercase tracking-wider">我的生活</div>
      <nav className="flex-1 px-2 pb-3 space-y-0.5">
        {items.map((m) => {
          const active = pathname === m.href || (m.href !== '/life' && pathname?.startsWith(m.href));
          return (
            <Link
              key={m.href}
              href={m.href}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition',
                active
                  ? 'bg-primary/10 text-primary font-medium shadow-soft-xs'
                  : 'text-text-soft hover:text-text hover:bg-surface/60',
              )}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-[10px] text-text-mute border-t border-border-soft">🧠 个人工作生活管理</div>
    </aside>
  );
}
