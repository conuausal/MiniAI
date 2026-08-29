/**
 * 浏览器原生语音能力封装。
 *
 * - STT: Web SpeechRecognition（Chrome/Edge 原生支持，中文识别优秀）
 * - TTS: SpeechSynthesis（所有现代浏览器，支持中文音色）
 *
 * 兼容性提示：
 * - Chrome / Edge / Safari（部分）：完整支持
 * - Firefox：STT 不支持，TTS 支持
 * - 不支持的浏览器会暴露 stt.supported = false，让 UI 优雅降级
 */

// ============== 类型 ==============

export interface VoiceOptions {
  lang?: string;                 // 'zh-CN' / 'en-US'
  interimResults?: boolean;      // 是否返回中间结果
  continuous?: boolean;          // 是否连续识别
}

export interface STTEvent {
  type: 'start' | 'interim' | 'final' | 'end' | 'error';
  transcript?: string;
  error?: string;
}

export interface STTController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  supported: boolean;
}

export interface TTSOptions {
  lang?: string;
  rate?: number;     // 0.1 - 10
  pitch?: number;    // 0 - 2
  volume?: number;   // 0 - 1
  voiceName?: string;
}

export interface VoiceCapability {
  stt: boolean;
  tts: boolean;
}

// ============== 能力检测 ==============

export function getVoiceCapability(): VoiceCapability {
  if (typeof window === 'undefined') return { stt: false, tts: false };
  const w = window as any;
  const stt = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  const tts = Boolean(window.speechSynthesis);
  return { stt, tts };
}

export function getTTSVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

// ============== STT ==============

export function createSTT(
  onEvent: (e: STTEvent) => void,
  options: VoiceOptions = {},
): STTController {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const SR = w?.SpeechRecognition || w?.webkitSpeechRecognition;

  if (!SR) {
    return { start: () => {}, stop: () => {}, abort: () => {}, supported: false };
  }

  const recognition = new SR();
  recognition.lang = options.lang || 'zh-CN';
  recognition.interimResults = options.interimResults ?? true;
  recognition.continuous = options.continuous ?? false;
  recognition.maxAlternatives = 1;

  let stopped = false;

  recognition.onstart = () => onEvent({ type: 'start' });
  recognition.onresult = (e: any) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) onEvent({ type: 'final', transcript: final });
    else if (interim) onEvent({ type: 'interim', transcript: interim });
  };
  recognition.onerror = (e: any) => onEvent({ type: 'error', error: e.error || 'unknown' });
  recognition.onend = () => {
    if (!stopped) onEvent({ type: 'end' });
  };

  return {
    start: () => {
      stopped = false;
      try { recognition.start(); } catch (e) { onEvent({ type: 'error', error: String(e) }); }
    },
    stop: () => {
      stopped = true;
      try { recognition.stop(); } catch { /* ignore */ }
    },
    abort: () => {
      stopped = true;
      try { recognition.abort(); } catch { /* ignore */ }
    },
    supported: true,
  };
}

// ============== TTS ==============

export function speak(text: string, options: TTSOptions = {}, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (!text) { onEnd?.(); return null; }

  // 取消上一个未完成的朗读
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = options.lang || 'zh-CN';
  u.rate = options.rate ?? 1.0;
  u.pitch = options.pitch ?? 1.0;
  u.volume = options.volume ?? 1.0;
  if (options.voiceName) {
    const v = window.speechSynthesis.getVoices().find((vv) => vv.name === options.voiceName);
    if (v) u.voice = v;
  }
  if (onEnd) u.onend = onEnd;
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  return typeof window !== 'undefined' && window.speechSynthesis?.speaking;
}
