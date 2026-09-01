'use client';

import { create } from 'zustand';
import { ChatMessage, ModelInfo, RagHitsData, SessionInfo, ToolCallRecord } from './api';

interface ChatState {
  // 会话
  sessions: SessionInfo[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  toolRecords: Record<number, ToolCallRecord[]>;
  thinking: Record<number, string>; // 每条助手消息的思考过程（实时流式累积）
  ragHits: Record<number, RagHitsData>; // 每条助手消息的知识库检索命中信息
  // 模型
  models: ModelInfo[];
  currentModel: string;
  // 选项
  enableRag: boolean;
  enableSearch: boolean;
  enableTools: boolean;
  enableKbStrict: boolean; // 知识库严格模式：仅依据检索片段回答
  // 语音
  enableVoiceInput: boolean;   // 是否启用语音输入按钮
  enableVoiceOutput: boolean;  // 是否自动朗读助手回复

  // 状态
  streaming: boolean;
  abortCtl: AbortController | null;

  setSessions: (s: SessionInfo[]) => void;
  setModels: (m: ModelInfo[]) => void;
  setCurrentModel: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  setMessages: (m: ChatMessage[]) => void;
  appendMessage: (m: ChatMessage) => void;
  setEnableRag: (v: boolean) => void;
  setEnableSearch: (v: boolean) => void;
  setEnableTools: (v: boolean) => void;
  setEnableKbStrict: (v: boolean) => void;
  setEnableVoiceInput: (v: boolean) => void;
  setEnableVoiceOutput: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setAbortCtl: (c: AbortController | null) => void;
  resetMessages: () => void;
  appendToolRecord: (msgIdx: number, rec: ToolCallRecord) => void;
  appendThinking: (msgIdx: number, delta: string) => void;
  patchMessage: (idx: number, patch: Partial<ChatMessage>) => void;
  setRagHits: (msgIdx: number, data: RagHitsData) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  toolRecords: {},
  thinking: {},
  ragHits: {},
  models: [],
  currentModel: 'miniai-demo',
  enableRag: false,
  enableSearch: false,
  enableTools: false,
  enableKbStrict: false,
  enableVoiceInput: true,
  enableVoiceOutput: false,

  streaming: false,
  abortCtl: null,

  setSessions: (sessions) => set({ sessions }),
  setModels: (models) => set({ models }),
  setCurrentModel: (currentModel) => set({ currentModel }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setMessages: (messages) => set({ messages, toolRecords: {}, thinking: {}, ragHits: {} }),
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setEnableRag: (enableRag) => set({ enableRag }),
  setEnableSearch: (enableSearch) => set({ enableSearch }),
  setEnableTools: (enableTools) => set({ enableTools }),
  setEnableKbStrict: (enableKbStrict) => set({ enableKbStrict }),
  setEnableVoiceInput: (enableVoiceInput) => set({ enableVoiceInput }),
  setEnableVoiceOutput: (enableVoiceOutput) => set({ enableVoiceOutput }),
  setStreaming: (streaming) => set({ streaming }),
  setAbortCtl: (abortCtl) => set({ abortCtl }),
  resetMessages: () => set({ messages: [], toolRecords: {}, thinking: {}, ragHits: {}, currentSessionId: null }),
  appendToolRecord: (msgIdx, rec) =>
    set((s) => ({
      toolRecords: { ...s.toolRecords, [msgIdx]: [...(s.toolRecords[msgIdx] || []), rec] },
    })),
  appendThinking: (msgIdx, delta) =>
    set((s) => ({
      thinking: { ...s.thinking, [msgIdx]: (s.thinking[msgIdx] || '') + delta },
    })),
  // 只更新单条消息内容，不清空 thinking / toolRecords（流式期间专用）
  patchMessage: (idx, patch) =>
    set((s) => {
      if (!s.messages[idx]) return s;
      const next = [...s.messages];
      next[idx] = { ...next[idx], ...patch };
      return { messages: next };
    }),
  setRagHits: (msgIdx, data) =>
    set((s) => ({ ragHits: { ...s.ragHits, [msgIdx]: data } })),
}));
