﻿'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { streamChat, ChatMessage } from '@/lib/api';
import MessageBubble from './MessageBubble';
import ToolCallCard from './ToolCallCard';
import VoiceInputButton from './VoiceInputButton';
import { useUserKeys } from '@/lib/user-keys';
import { speak, stopSpeaking, getVoiceCapability } from '@/lib/voice';

const SUGGESTIONS = [
  { emoji: '💡', title: '解释一个概念', prompt: '用通俗的话解释一下 Transformer 架构', color: 'glass-purple', glow: 'shadow-glow-purple' },
  { emoji: '✍️', title: '帮我写文案', prompt: '帮我为新产品写一段小红书种草文', color: 'glass-pink', glow: 'shadow-glow-pink' },
  { emoji: '🔧', title: '启用工具', prompt: '现在几点了？顺便算一下 (123+456)*7', color: 'glass-cyan', glow: '' },
  { emoji: '🌐', title: '查最新资讯', prompt: '帮我搜一下今天 AI 领域有什么重要新闻', color: 'glass-orange', glow: '' },
];

export default function ChatWindow() {
  const {
    messages, toolRecords, currentModel, currentSessionId,
    enableRag, enableSearch, enableTools,
    enableVoiceInput, enableVoiceOutput,
    streaming, setStreaming, setAbortCtl, abortCtl,
    appendMessage, setMessages, setCurrentSession,
    appendToolRecord,
  } = useChatStore();
  const { hasAny } = useUserKeys();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ttsSupported = getVoiceCapability().tts;
  const lastSpokenIdxRef = useRef<number>(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, toolRecords]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  useEffect(() => {
    if (!enableVoiceOutput || !ttsSupported) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || !last.content) return;
    if (streaming) return;
    if (lastSpokenIdxRef.current === messages.length - 1) return;
    lastSpokenIdxRef.current = messages.length - 1;
    const cleaned = last.content
      .replace(/```[\s\S]*?```/g, '代码块已省略')
      .replace(/[*_`#>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '。 ')
      .trim();
    speak(cleaned.slice(0, 1500), { lang: 'zh-CN', rate: 1.05 });
  }, [messages, streaming, enableVoiceOutput, ttsSupported]);

  const stop = () => {
    abortCtl?.abort();
    stopSpeaking();
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    setInput('');
    stopSpeaking();

    const userMsg: ChatMessage = { role: 'user', content: text };
    appendMessage(userMsg);
    appendMessage({ role: 'assistant', content: '' });
    const assistantIdx = useChatStore.getState().messages.length - 1;
    lastSpokenIdxRef.current = -1;

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
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-blink" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-blink" style={{ animationDelay: '200ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-blink" style={{ animationDelay: '400ms' }} />
                </span>
                MiniAI 正在思考…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border-soft bg-surface/40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative glass rounded-2xl focus-within:shadow-soft-md focus-within:border-primary/50 transition-all">
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
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              {enableVoiceInput && (
                <VoiceInputButton
                  onFinalText={(t) => send(t)}
                  disabled={!hasAny || streaming}
                />
              )}
            </div>
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {streaming ? (
                <button onClick={stop} className="btn bg-accent-red/15 text-accent-red hover:bg-accent-red/25 !py-1.5 !px-3 text-xs">
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
    <div className="h-full flex flex-col items-center justify-center px-6 py-12 animate-slide-up">
      <div className="max-w-3xl w-full text-center">
        {/* 顶部标签 */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-surface/60 backdrop-blur-md border border-border text-text-soft text-xs font-medium shadow-soft-xs">
          <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-pulse-soft" />
          开源 · 隐私优先 · 25+ 模型 · 语音对话
        </div>

        {/* 大衬线标题 */}
        <h1 className="font-serif text-5xl md:text-7xl font-semibold tracking-tight mb-3">
          <span className="text-hero animate-aurora">Liquid AI</span>
          <br />
          <span className="text-text">for everyone</span>
        </h1>

        <p className="text-text-soft text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          多模型 · RAG 知识库 · 联网搜索 · 工具调用 · 多智能体写作 · 语音对话
          <br />
          <span className="text-text-mute text-sm">把 AI 装进你自己的浏览器</span>
        </p>

        {!hasKey && (
          <div className="mb-8 inline-flex items-start gap-3 px-5 py-4 rounded-2xl glass border-amber-200/60 dark:border-amber-800/60 text-left">
            <span className="text-2xl mt-0.5">🔑</span>
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-100">开始之前，请先配置 API Key</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                点击右上角 🔑 按钮填入至少一个模型 Key。
                <span className="font-medium">你的 Key 只保存在本机浏览器</span>，不上传到任何服务器。
              </div>
            </div>
          </div>
        )}

        {/* 4 张彩色玻璃卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => hasKey && onPick(s.prompt)}
              disabled={!hasKey}
              style={{ animationDelay: `${i * 80}ms` }}
              className={`group text-left p-5 ${s.color} ${s.glow} rounded-2xl border-0 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 animate-slide-up overflow-hidden relative`}
            >
              {/* 装饰光斑 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="text-3xl mb-3 drop-shadow-lg">{s.emoji}</div>
                <div className="font-semibold mb-1 text-white text-base">{s.title}</div>
                <div className="text-xs text-white/80 leading-relaxed">{s.prompt}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 底部展示区 */}
        <div className="mt-12 flex items-center justify-center gap-x-4 gap-y-2 flex-wrap text-[11px] text-text-mute">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-mint rounded-full" />
            25+ 模型
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full" />
            Function Calling
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full" />
            RAG 知识库
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
            多智能体写作
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-pink rounded-full" />
            语音对话
          </span>
        </div>
      </div>
    </div>
  );
}
