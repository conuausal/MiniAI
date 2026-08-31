'use client';

import { create } from 'zustand';
import { ChatMessage, ModelInfo, SessionInfo, ToolCallRecord } from './api';

interface ChatState {
  // 会话
  sessions: SessionInfo[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  toolRecords: Record<number, ToolCallRecord[]>;
  thinking: Record<number, string>; // 每条助手消息的思考过程（实时流式累积）
  // 模型
  models: ModelInfo[];
  currentModel: string;
  // 选项
  enableRag: boolean;
  enableSearch: boolean;
  enableTools: boolean;
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
  setEnableVoiceInput: (v: boolean) => void;
  setEnableVoiceOutput: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setAbortCtl: (c: AbortController | null) => void;
  resetMessages: () => void;
  appendToolRecord: (msgIdx: number, rec: ToolCallRecord) => void;
  appendThinking: (msgIdx: number, delta: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  toolRecords: {},
  thinking: {},
  models: [],
  currentModel: 'miniai-demo',
  enableRag: false,
  enableSearch: false,
  enableTools: false,
  enableVoiceInput: true,
  enableVoiceOutput: false,

  streaming: false,
  abortCtl: null,

  setSessions: (sessions) => set({ sessions }),
  setModels: (models) => set({ models }),
  setCurrentModel: (currentModel) => set({ currentModel }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setMessages: (messages) => set({ messages, toolRecords: {}, thinking: {} }),
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setEnableRag: (enableRag) => set({ enableRag }),
  setEnableSearch: (enableSearch) => set({ enableSearch }),
  setEnableTools: (enableTools) => set({ enableTools }),
  setEnableVoiceInput: (enableVoiceInput) => set({ enableVoiceInput }),
  setEnableVoiceOutput: (enableVoiceOutput) => set({ enableVoiceOutput }),
  setStreaming: (streaming) => set({ streaming }),
  setAbortCtl: (abortCtl) => set({ abortCtl }),
  resetMessages: () => set({ messages: [], toolRecords: {}, thinking: {}, currentSessionId: null }),
  appendToolRecord: (msgIdx, rec) =>
    set((s) => ({
      toolRecords: { ...s.toolRecords, [msgIdx]: [...(s.toolRecords[msgIdx] || []), rec] },
    })),
  appendThinking: (msgIdx, delta) =>
    set((s) => ({
      thinking: { ...s.thinking, [msgIdx]: (s.thinking[msgIdx] || '') + delta },
    })),
}));
