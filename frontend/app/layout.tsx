import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MiniAI · 你专属的开源 AI 助手',
  description: 'MiniAI - 多模型 + RAG + 联网搜索 + 工具调用 + 多智能体写作',
};

// 显式锁定移动端视口，防止个别浏览器按桌面宽度渲染导致竖屏左右被裁
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('miniai:theme') === 'dark' ||
                    (!localStorage.getItem('miniai:theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
