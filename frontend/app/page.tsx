'use client';

import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import { useChatStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function HomePage() {
  const { setModels, setCurrentModel, currentModel } = useChatStore();

  useEffect(() => {
    api.listModels()
      .then(({ models }) => {
        setModels(models);
        // 若当前模型不可用，自动选第一个可用的
        if (!models.find((m) => m.id === currentModel && m.enabled)) {
          const first = models.find((m) => m.enabled);
          if (first) setCurrentModel(first.id);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <main className="h-screen flex">
      <Sidebar />
      <ChatWindow />
    </main>
  );
}
