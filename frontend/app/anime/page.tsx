'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';

export default function AnimePage() {
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnime = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.randomAnime();
      setImg(data.url);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <header className="text-center mb-8 animate-slide-up">
            <div className="text-5xl mb-2">🎴</div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-hero">随机二次元</h1>
            <p className="text-sm text-text-soft mt-2">点击按钮，随机获取一张二次元图片</p>
          </header>

          <div className="flex justify-center mb-8 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <button
              onClick={fetchAnime}
              disabled={loading}
              className="btn btn-primary !px-6 !py-3 !text-base disabled:opacity-60"
            >
              {loading ? '⏳ 加载中…' : img ? '🔄 再来一张' : '🎴 随机一张'}
            </button>
          </div>

          {error && (
            <div className="text-center text-accent-red text-sm mb-4 animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          {img && (
            <div className="glass-card rounded-2xl p-3 animate-fade-in">
              <img
                src={img}
                alt="随机二次元"
                className="w-full rounded-xl max-h-[70vh] object-contain bg-black/10"
              />
              <div className="flex items-center justify-center mt-2">
                <a
                  href={img}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-text-mute hover:text-primary transition"
                >
                  打开原图 ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
