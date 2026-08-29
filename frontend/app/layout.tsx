import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MiniAI · 开源个人 AI 助手',
  description: 'MiniAI - 多模型 + RAG + 联网搜索 + 对话记忆',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
