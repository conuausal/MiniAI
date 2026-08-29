'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserKeys } from '@/lib/user-keys';
import { useDarkMode } from '@/lib/theme';
import ApiKeyDrawer from './ApiKeyDrawer';

export default function Topbar() {
  const pathname = usePathname();
  const { hasAny } = useUserKeys();
  const { isDark, toggle } = useDarkMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { href: '/', label: '对话', emoji: '💬' },
    { href: '/write', label: '写作', emoji: '✍️' },
    { href: '/knowledge', label: '知识库', emoji: '📚' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 h-14 px-5 flex items-center justify-between glass">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-xs font-bold shadow-soft-sm group-hover:shadow-soft-md transition">
              M
            </div>
            <span className="font-serif font-semibold text-base tracking-tight">MiniAI</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 text-sm rounded-lg transition ${
                    active
                      ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30'
                      : 'text-text-soft hover:text-text hover:bg-bg-soft'
                  }`}
                >
                  <span className="mr-1.5">{item.emoji}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="btn-ghost btn !p-2"
            title={isDark ? '切换到亮色' : '切换到暗色'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className={`btn !p-2 relative ${hasAny ? 'btn-ghost' : 'btn-secondary border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'}`}
            title="设置"
          >
            <span className="text-base">🔑</span>
            {!hasAny && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-pulse-soft" />
            )}
          </button>
          <a
            href="https://github.com/conuausal/MiniAI"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost btn !p-2"
            title="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </header>
      <ApiKeyDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
