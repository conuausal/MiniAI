'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserKeys } from '@/lib/user-keys';
import { useChatStore } from '@/lib/store';
import { useDarkMode } from '@/lib/theme';
import ApiKeyDrawer from './ApiKeyDrawer';
import ModelSelector from './ModelSelector';

export default function Topbar() {
  const pathname = usePathname();
  const { hasAny } = useUserKeys();
  const { enableVoiceOutput, setEnableVoiceOutput, enableVoiceInput, setEnableVoiceInput } = useChatStore();
  const { isDark, toggle } = useDarkMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 仅在对话页（/）显示模型选择器
  const showModelSelector = pathname === '/';

  const navItems = [
    { href: '/', label: '对话', emoji: '💬' },
    { href: '/write', label: '写作', emoji: '✍️' },
    { href: '/knowledge', label: '知识库', emoji: '📚' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40">
        <div className="glass-strong h-14 px-4 flex items-center gap-4">
          {/* 左：Logo + 导航 */}
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-hero grid place-items-center text-white font-bold shadow-glow-blue group-hover:scale-110 transition-transform">
                M
              </div>
              <span className="font-serif font-semibold text-base tracking-tight text-hero hidden sm:inline">
                MiniAI
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1.5 text-sm rounded-lg transition-all ${
                      active
                        ? 'text-text bg-surface shadow-soft-sm font-medium'
                        : 'text-text-soft hover:text-text hover:bg-surface/50'
                    }`}
                  >
                    <span className="mr-1.5">{item.emoji}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 中：模型选择器（仅对话页） */}
          {showModelSelector && (
            <div className="flex-1 flex justify-center min-w-0">
              <ModelSelector />
            </div>
          )}
          {!showModelSelector && <div className="flex-1" />}

          {/* 右：功能按钮 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <IconButton
              active={enableVoiceOutput}
              onClick={() => setEnableVoiceOutput(!enableVoiceOutput)}
              emoji={enableVoiceOutput ? '🔊' : '🔇'}
              label={enableVoiceOutput ? '语音输出已开启' : '语音输出已关闭'}
              activeColor="pink"
            />
            <IconButton
              active={enableVoiceInput}
              onClick={() => setEnableVoiceInput(!enableVoiceInput)}
              emoji="🎙️"
              label={enableVoiceInput ? '语音输入已开启' : '语音输入已关闭'}
              activeColor="purple"
            />
            <IconButton onClick={toggle} emoji={isDark ? '☀️' : '🌙'} label={isDark ? '切换亮色' : '切换暗色'} />
            <IconButton
              onClick={() => setDrawerOpen(true)}
              emoji="🔑"
              label="设置"
              hasBadge={!hasAny}
            />
            <a
              href="https://github.com/conuausal/MiniAI"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost !p-2"
              title="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="gradient-line" />
      </header>
      <ApiKeyDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function IconButton({
  active, onClick, emoji, label, hasBadge, activeColor,
}: {
  active?: boolean; onClick: () => void; emoji: string; label: string;
  hasBadge?: boolean; activeColor?: 'pink' | 'purple' | 'blue';
}) {
  const activeStyle = active
    ? activeColor === 'pink'
      ? 'bg-accent-pink/15 text-accent-pink shadow-soft-xs'
      : activeColor === 'purple'
        ? 'bg-accent-purple/15 text-accent-purple shadow-soft-xs'
        : 'bg-primary/15 text-primary shadow-soft-xs'
    : 'btn-ghost';
  return (
    <button
      onClick={onClick}
      className={`relative btn !p-2 ${activeStyle}`}
      title={label}
    >
      <span className="text-base">{emoji}</span>
      {hasBadge && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-accent-orange rounded-full animate-pulse-soft ring-2 ring-bg" />
      )}
    </button>
  );
}
