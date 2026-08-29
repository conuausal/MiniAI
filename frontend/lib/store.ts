'use client';

import { create } from 'zustand';
import { ChatMessage, ModelInfo, SessionInfo } from './api';

interface ChatState {
  // 会话
  sessions: SessionInfo[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  // 模型
  models: ModelInfo[];
  currentModel: string;
  // 选项
  enableRag: boolean;
  enableSearch: boolean;
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
  setStreaming: (v: boolean) => void;
  setAbortCtl: (c: AbortController | null) => void;
  resetMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  models: [],
  currentModel: 'deepseek-chat',
  enableRag: false,
  enableSearch: false,
  streaming: false,
  abortCtl: null,

  setSessions: (sessions) => set({ sessions }),
  setModels: (models) => set({ models }),
  setCurrentModel: (currentModel) => set({ currentModel }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setEnableRag: (enableRag) => set({ enableRag }),
  setEnableSearch: (enableSearch) => set({ enableSearch }),
  setStreaming: (streaming) => set({ streaming }),
  setAbortCtl: (abortCtl) => set({ abortCtl }),
  resetMessages: () => set({ messages: [], currentSessionId: null }),
}));
