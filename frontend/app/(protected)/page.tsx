'use client';

import { useEffect } from 'react';
import Topbar from '@/components/Topbar';
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
        if (!models.find((m) => m.id === currentModel && m.enabled)) {
          const first = models.find((m) => m.enabled);
          if (first) setCurrentModel(first.id);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  );
}
