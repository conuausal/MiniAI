'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { streamChat, ChatMessage } from '@/lib/api';
import MessageBubble from './MessageBubble';
import ModelSelector from './ModelSelector';
import ToolCallCard from './ToolCallCard';

export default function ChatWindow() {
  const {
    messages, toolRecords, currentModel, currentSessionId,
    enableRag, enableSearch, enableTools,
    streaming, setStreaming, setAbortCtl, abortCtl,
    appendMessage, setMessages, setCurrentSession,
    appendToolRecord,
  } = useChatStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, toolRecords]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    appendMessage(userMsg);
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    appendMessage(assistantMsg);
    const assistantIdx = useChatStore.getState().messages.length - 1; // 刚 append 的 assistant index

    const ctl = new AbortController();
    setAbortCtl(ctl);
    setStreaming(true);

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
          // 用占位记录，先展示"准备调用"
          for (const tc of tool_calls) {
            let args: any = {};
            try { args = JSON.parse(tc?.function?.arguments || '{}'); } catch {}
            appendToolRecord(assistantIdx, { name: tc?.function?.name || 'unknown', args, result: '⏳ 调用中…' });
          }
        },
        onToolResult: ({ name, args, result }) => {
          // 找到该 assistant 消息下最后一个未完成记录并更新
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
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">💬 对话</div>
        <ModelSelector />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <div className="text-5xl mb-3">🧠</div>
            <div className="text-lg font-semibold mb-1">你好，我是 MiniAI</div>
            <div className="text-sm">选择模型、勾选 RAG / 联网 / 工具，开始你的第一次提问</div>
            <div className="mt-4 text-xs text-slate-400">
              💡 试试：勾选 🔧 工具 后问「现在几点了？」「算一下 (123+456)*7」「帮我搜下最新 AI 新闻」
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <MessageBubble message={m} />
            {/* 在对应 assistant 消息下方展示工具卡片 */}
            {m.role === 'assistant' && toolRecords[i] && toolRecords[i].length > 0 && (
              <div className="flex justify-start mt-2">
                <ToolCallCard records={toolRecords[i]} />
              </div>
            )}
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="text-xs text-slate-400 animate-blink ml-2">MiniAI 正在思考…</div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入消息，Enter 发送 / Shift+Enter 换行"
            className="flex-1 resize-none max-h-40 min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 text-sm"
            rows={1}
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white text-sm transition"
          >发送</button>
        </div>
      </div>
    </div>
  );
}
