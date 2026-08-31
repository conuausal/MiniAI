'use client';

import SessionList from './SessionList';

/**
 * 会话侧边栏（桌面端常驻）。
 * 移动端由 Topbar 的汉堡菜单抽屉（MobileNav）提供会话列表。
 */
export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-72 shrink-0 border-r border-border bg-surface/50 backdrop-blur-md flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <SessionList />
      </div>
      <div className="p-3 border-t border-border-soft">
        <div className="text-[10px] text-text-mute leading-relaxed">
          🧠 MiniAI 是开源的<br />
          你的数据只属于你
        </div>
      </div>
    </aside>
  );
}
