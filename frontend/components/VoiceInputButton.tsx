'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { createSTT, getVoiceCapability, STTController } from '@/lib/voice';

interface Props {
  onFinalText: (text: string) => void;
  disabled?: boolean;
  lang?: string;
  size?: 'sm' | 'md';
}

export default function VoiceInputButton({ onFinalText, disabled, lang = 'zh-CN', size = 'md' }: Props) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<STTController | null>(null);

  useEffect(() => {
    setSupported(getVoiceCapability().stt);
  }, []);

  if (!supported) {
    return (
      <button
        disabled
        title="当前浏览器不支持语音输入（推荐使用 Chrome / Edge）"
        className={clsx(
          'btn-ghost btn !p-0 grid place-items-center rounded-full opacity-30 cursor-not-allowed',
          size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
        )}
      >
        🎙️
      </button>
    );
  }

  const start = () => {
    if (recording || disabled) return;
    setError(null);
    setInterim('');
    const ctrl = createSTT(
      (e) => {
        if (e.type === 'start') {
          setRecording(true);
        } else if (e.type === 'interim') {
          setInterim(e.transcript || '');
        } else if (e.type === 'final') {
          const text = (e.transcript || '').trim();
          if (text) onFinalText(text);
          setInterim('');
        } else if (e.type === 'end') {
          setRecording(false);
          setInterim('');
        } else if (e.type === 'error') {
          setRecording(false);
          setError(translateError(e.error));
          setInterim('');
          setTimeout(() => setError(null), 3000);
        }
      },
      { lang, interimResults: true, continuous: false },
    );
    ctrlRef.current = ctrl;
    ctrl.start();
  };

  const stop = () => {
    ctrlRef.current?.stop();
    setRecording(false);
    setInterim('');
  };

  const abort = () => {
    ctrlRef.current?.abort();
    setRecording(false);
    setInterim('');
  };

  return (
    <div className="relative">
      {!recording ? (
        <button
          onClick={start}
          disabled={disabled}
          title="点击开始语音输入"
          className={clsx(
            'btn-ghost btn !p-0 grid place-items-center rounded-full text-text-soft hover:bg-bg-soft hover:text-brand-600 transition',
            size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-lg',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          🎙️
        </button>
      ) : (
        <button
          onClick={stop}
          title="点击结束录音"
          className={clsx(
            'relative grid place-items-center rounded-full bg-red-500 text-white shadow-lg animate-pulse-soft',
            size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-lg'
          )}
        >
          {/* 同心圆脉冲 */}
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
          <span className="relative">⏹</span>
        </button>
      )}

      {/* 录音中浮层：显示识别中间结果 */}
      {recording && (
        <div
          className="absolute bottom-full mb-2 right-0 w-72 max-w-[80vw] bg-surface border border-border rounded-2xl shadow-xl p-3 z-50 animate-slide-up"
          onClick={abort}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex gap-0.5 items-end h-3">
              <span className="w-0.5 bg-red-500 rounded-full animate-blink" style={{ height: '40%', animationDelay: '0ms' }} />
              <span className="w-0.5 bg-red-500 rounded-full animate-blink" style={{ height: '100%', animationDelay: '150ms' }} />
              <span className="w-0.5 bg-red-500 rounded-full animate-blink" style={{ height: '60%', animationDelay: '300ms' }} />
              <span className="w-0.5 bg-red-500 rounded-full animate-blink" style={{ height: '90%', animationDelay: '450ms' }} />
            </span>
            <span className="text-xs font-medium text-red-600 dark:text-red-400">正在聆听...</span>
            <span className="ml-auto text-[10px] text-text-mute">点击停止</span>
          </div>
          <div className="text-sm text-text min-h-[20px]">
            {interim || <span className="text-text-mute italic">说话中...</span>}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-full mb-2 right-0 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

function translateError(code?: string): string {
  switch (code) {
    case 'no-speech': return '没听清，再试一次？';
    case 'audio-capture': return '麦克风不可用';
    case 'not-allowed': return '请允许使用麦克风';
    case 'network': return '网络错误';
    case 'aborted': return '已取消';
    default: return `语音错误: ${code || 'unknown'}`;
  }
}
