'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { streamChat, ChatMessage } from '@/lib/api';
import MessageBubble from './MessageBubble';
import ModelSelector from './ModelSelector';
import ToolCallCard from './ToolCallCard';
import { useUserKeys } from '@/lib/user-keys';

const SUGGESTIONS = [
  { emoji: '💡', title: '解释一个概念', prompt: '用通俗的话解释一下 Transformer 架构' },
  { emoji: '✍️', title: '帮我写文案', prompt: '帮我为新产品写一段小红书种草文' },
  { emoji: '🔧', title: '启用工具', prompt: '现在几点了？顺便算一下 (123+456)*7' },
  { emoji: '🌐', title: '查最新资讯', prompt: '帮我搜一下今天 AI 领域有什么重要新闻' },
];

export default function ChatWindow() {
  const {
    messages, toolRecords, currentModel, currentSessionId,
    enableRag, enableSearch, enableTools,
    streaming, setStreaming, setAbortCtl, abortCtl,
    appendMessage, setMessages, setCurrentSession,
    appendToolRecord,
  } = useChatStore();
  const { hasAny } = useUserKeys();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, toolRecords]);

  // 自动撑高 textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    appendMessage(userMsg);
    appendMessage({ role: 'assistant', content: '' });
    const assistantIdx = useChatStore.getState().messages.length - 1;

    const ctl = new AbortController();
    setAbortCtl(ctl);
    setStreaming(true);

    try {
      await streamChat(
        {
          session_id: currentSessionId,
          model: currentModel,
          messages: [...messages, userMsg],
          enable_rag: enableRag,
          enable_search: enableSearch,
          enable_tools: enableTools,
          temperature: 0.7,
          max_tokens: 2048,
        },
        {
          onMeta: ({ session_id }) => setCurrentSession(session_id),
          onDelta: (delta) => {
            const all = useChatStore.getState().messages;
            const next = [...all];
            const lastIdx = next.length - 1;
            next[lastIdx] = { ...next[lastIdx], content: (next[lastIdx].content || '') + delta };
            setMessages(next);
          },
          onToolCall: ({ tool_calls }) => {
            for (const tc of tool_calls) {
              let args: any = {};
              try { args = JSON.parse(tc?.function?.arguments || '{}'); } catch {}
              appendToolRecord(assistantIdx, { name: tc?.function?.name || 'unknown', args, result: '⏳ 调用中…' });
            }
          },
          onToolResult: ({ name, args, result }) => {
            const records = useChatStore.getState().toolRecords[assistantIdx] || [];
            const idx = records.findIndex((r) => r.name === name && r.result === '⏳ 调用中…');
            if (idx >= 0) {
              const next = [...records];
              next[idx] = { name, args, result };
              useChatStore.setState((s) => ({
                toolRecords: { ...s.toolRecords, [assistantIdx]: next },
              }));
            } else {
              appendToolRecord(assistantIdx, { name, args, result });
            }
          },
          onError: (msg) => {
            const all = useChatStore.getState().messages;
            const next = [...all];
            next[next.length - 1] = { ...next[next.length - 1], content: (next[next.length - 1].content || '') + `\n\n> ⚠️ ${msg}` };
            setMessages(next);
          },
          onDone: () => { setStreaming(false); setAbortCtl(null); },
        },
        ctl.signal,
      );
    } catch (e: any) {
      const all = useChatStore.getState().messages;
      const next = [...all];
      next[next.length - 1] = { ...next[next.length - 1], content: (next[next.length - 1].content || '') + `\n\n> ⚠️ ${e?.message || e}` };
      setMessages(next);
    }

    setStreaming(false);
    setAbortCtl(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* 头部选择器条 */}
      <div className="px-6 py-3 border-b border-border-soft flex items-center justify-between bg-surface/50">
        <div className="flex items-center gap-2 text-sm text-text-soft">
          <span className="text-text-mute">模型</span>
        </div>
        <ModelSelector />
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen hasKey={hasAny} onPick={(t) => send(t)} />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((m, i) => (
              <div key={i} className="animate-fade-in">
                <MessageBubble message={m} />
                {m.role === 'assistant' && toolRecords[i] && toolRecords[i].length > 0 && (
                  <div className="flex justify-start mt-2">
                    <ToolCallCard records={toolRecords[i]} />
                  </div>
                )}
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-2 text-xs text-text-mute animate-fade-in pl-1">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-blink" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-blink" style={{ animationDelay: '200ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-blink" style={{ animationDelay: '400ms' }} />
                </span>
                MiniAI 正在思考…
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border-soft bg-surface/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative surface rounded-2xl shadow-soft-sm focus-within:shadow-soft-md focus-within:border-brand-400 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={hasAny ? '输入消息，Enter 发送 · Shift+Enter 换行' : '👋 先点击右上角 🔑 配置 API Key'}
              className="w-full resize-none max-h-48 min-h-[52px] px-4 pt-3.5 pb-12 rounded-2xl bg-transparent text-sm focus:outline-none placeholder:text-text-mute"
              rows={1}
              disabled={!hasAny}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {streaming ? (
                <button
                  onClick={() => abortCtl?.abort()}
                  className="btn bg-red-100 text-red-700 hover:bg-red-200 !py-1.5 !px-3 text-xs"
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || !hasAny}
                  className="btn btn-primary !py-1.5 !px-3 text-xs disabled:opacity-40"
                >
                  发送
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="text-center text-[10px] text-text-mute mt-2">
            MiniAI 可能会出错 · 重要信息请核实
          </div>
        </div>
      </div>
    </main>
  );
}

function WelcomeScreen({ hasKey, onPick }: { hasKey: boolean; onPick: (t: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 animate-slide-up">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-200 text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse-soft" />
          开源 · 隐私友好 · 可自部署
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight mb-3">
          你好，我是 <span className="text-brand-600 dark:text-brand-400">MiniAI</span>
        </h1>
        <p className="text-text-soft text-base md:text-lg max-w-lg mx-auto mb-10">
          多模型 · RAG 知识库 · 联网搜索 · 工具调用 · 多智能体写作 —— 一个真正属于你的 AI 助手。
        </p>

        {!hasKey && (
          <div className="mb-8 inline-flex items-start gap-3 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left">
            <span className="text-xl mt-0.5">🔑</span>
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-100">开始之前，请先配置 API Key</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                点击右上角 🔑 按钮，填入至少一个模型提供商的 Key（推荐 DeepSeek，性价比高）。
                你的 Key 只保存在本机浏览器，不会上传到任何服务器。
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => hasKey && onPick(s.prompt)}
              disabled={!hasKey}
              className="group text-left p-4 surface rounded-xl hover:border-brand-300 hover:shadow-soft-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-2xl mb-2">{s.emoji}</div>
              <div className="text-sm font-medium mb-1">{s.title}</div>
              <div className="text-xs text-text-mute group-hover:text-text-soft transition">{s.prompt}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
