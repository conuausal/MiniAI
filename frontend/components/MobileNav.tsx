'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useChatStore } from '@/lib/store';
import { useDarkMode } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import SessionList from './SessionList';
import { useLifeModules } from './LifeSidebar';

const NAV = [
  { href: '/', label: '对话', emoji: '💬' },
  { href: '/write', label: '写作', emoji: '✍️' },
  { href: '/knowledge', label: '知识库', emoji: '📚' },
  { href: '/anime', label: '二次元', emoji: '🎴' },
  { href: '/life', label: '生活', emoji: '🏠' },
];

/**
 * 移动端汉堡菜单抽屉（<lg 时由 Topbar 触发）。
 * - 对话页：展示导航 + 最近会话
 * - 生活页：额外展示 9 个生活模块
 * - 底部：语音开关 / 深色模式 / 退出登录 / GitHub
 */
export default function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { enableVoiceOutput, setEnableVoiceOutput, enableVoiceInput, setEnableVoiceInput } = useChatStore();
  const { isDark, toggle } = useDarkMode();
  const { items: lifeItems } = useLifeModules();

  const isChat = pathname === '/';
  const isLife = pathname.startsWith('/life');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="absolute top-0 bottom-0 left-0 w-[85vw] max-w-sm bg-surface shadow-xl animate-drawer-in-left flex flex-col">
        <header className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
          <span className="font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-hero grid place-items-center text-white text-sm font-bold">M</span>
            <span className="font-serif text-base text-hero">MiniAI</span>
          </span>
          <button onClick={onClose} className="btn btn-ghost !p-1.5 rounded-lg" aria-label="关闭菜单">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* 主导航 */}
          <nav className="px-2 py-2 space-y-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition',
                    active
                      ? 'bg-primary/10 text-primary font-medium shadow-soft-xs'
                      : 'text-text-soft hover:text-text hover:bg-surface/60',
                  )}
                >
                  <span className="text-base">{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 生活模块（生活页内） */}
          {isLife && (
            <div className="border-t border-border-soft px-2 py-3">
              <div className="px-3 pb-1 text-[11px] font-semibold text-text-mute uppercase tracking-wider">我的生活</div>
              <nav className="space-y-0.5">
                {lifeItems.map((m) => {
                  const active = pathname === m.href || (m.href !== '/life' && pathname?.startsWith(m.href));
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      onClick={onClose}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-text-soft hover:text-text hover:bg-surface/60',
                      )}
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span>{m.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          {/* 最近会话（对话页内） */}
          {isChat && (
            <div className="border-t border-border-soft">
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-mute uppercase tracking-wider">最近会话</div>
              <div className="h-64">
                <SessionList onNavigate={onClose} />
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <footer className="border-t border-border-soft p-3 space-y-1.5 shrink-0">
          {user && (
            <div className="px-2 py-1 text-sm text-text-soft truncate">👤 {user.username}</div>
          )}
          <ToggleRow label="语音输出" value={enableVoiceOutput} onToggle={() => setEnableVoiceOutput(!enableVoiceOutput)} />
          <ToggleRow label="语音输入" value={enableVoiceInput} onToggle={() => setEnableVoiceInput(!enableVoiceInput)} />
          <ToggleRow label="深色模式" value={isDark} onToggle={toggle} />
          <div className="flex gap-2 pt-1.5">
            <button
              onClick={async () => { await logout(); onClose(); router.push('/login'); }}
              className="flex-1 btn btn-ghost !py-2 text-sm"
            >
              ⎋ 退出登录
            </button>
            <a
              href="https://github.com/conuausal/MiniAI"
              target="_blank"
              rel="noreferrer"
              className="flex-1 btn btn-ghost !py-2 text-sm text-center"
            >
              GitHub ↗
            </a>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-xs text-text-soft">{label}</span>
      <button
        onClick={onToggle}
        className={clsx('relative w-10 h-5 rounded-full transition', value ? 'bg-brand-600' : 'bg-border')}
        aria-pressed={value}
      >
        <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', value ? 'translate-x-5 left-0.5' : 'left-0.5')} />
      </button>
    </div>
  );
}
