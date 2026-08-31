'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import type { ChatMessage } from '@/lib/api';
import ThinkingCard from './ThinkingCard';

interface Props {
  message: ChatMessage;
  thinking?: string;      // 实时思考过程（覆盖 message.thinking）
  thinkingLive?: boolean; // 思考过程正在流式生成
  showCursor?: boolean;   // 流式中的最后一条消息，尾部闪烁光标
}

export default function MessageBubble({ message, thinking, thinkingLive = false, showCursor = false }: Props) {
  const isUser = message.role === 'user';
  const thinkingText = thinking ?? message.thinking ?? '';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-9 h-9 shrink-0 rounded-xl bg-hero grid place-items-center text-white text-sm font-bold shadow-glow-blue">
          M
        </div>
      )}
      <div
        className={clsx(
          'max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 animate-fade-in',
          isUser
            ? 'bg-hero text-white rounded-tr-sm shadow-glow-blue'
            : 'glass-card rounded-tl-sm !bg-surface/80'
        )}
      >
        {!isUser && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-mute mb-1.5">
            MiniAI
          </div>
        )}
        {!isUser && thinkingText && (
          <ThinkingCard thinking={thinkingText} live={thinkingLive} />
        )}
        {(message.content || showCursor) && (
          <div className={clsx(
            'prose prose-sm max-w-none leading-relaxed',
            isUser ? 'prose-invert' : 'dark:prose-invert'
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter style={oneDark as any} language={match[1]} PreTag="div" customStyle={{ margin: 0, borderRadius: 10 }}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                },
                a({ children, ...props }: any) {
                  return <a {...props} target="_blank" rel="noreferrer">{children}</a>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {showCursor && <span className="inline-block w-2 h-4 align-text-bottom bg-primary animate-pulse rounded-sm" />}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-9 h-9 shrink-0 rounded-xl bg-glass-soft bg-bg-soft grid place-items-center text-text-soft text-sm shadow-soft-sm">
          👤
        </div>
      )}
    </div>
  );
}
