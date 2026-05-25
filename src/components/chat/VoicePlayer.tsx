'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Pause, Play, Loader2 } from 'lucide-react';

interface Props {
  text: string;
  voice?: 'alloy' | 'nova' | 'shimmer' | 'onyx' | 'echo' | 'fable';
}

export function VoicePlayer({ text, voice = 'nova' }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAndPlay = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Creare și redare element audio
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended  = () => setStatus('idle');
      audio.onpause  = () => setStatus('paused');
      audio.onplay   = () => setStatus('playing');
      audio.onerror  = () => setStatus('error');

      await audio.play();
      setStatus('playing');
    } catch (err) {
      console.error('[VoicePlayer]', err);
      setStatus('error');
    }
  }, [text, voice]);

  const handleClick = useCallback(() => {
    const audio = audioRef.current;

    if (status === 'idle' || status === 'error') {
      // Dacă există audio generat anterior, redă-l direct
      if (audioUrl && audio) {
        audio.currentTime = 0;
        void audio.play();
      } else {
        void fetchAndPlay();
      }
      return;
    }

    if (status === 'playing') {
      audio?.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      void audio?.play();
      setStatus('playing');
      return;
    }
  }, [status, audioUrl, fetchAndPlay]);

  const label =
    status === 'loading' ? 'Se generează…'
    : status === 'playing' ? 'Pauză'
    : status === 'paused'  ? 'Continuă'
    : status === 'error'   ? 'Eroare — reîncearcă'
    : 'Ascultă';

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={status === 'loading'}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50',
        status === 'error'
          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
      ].join(' ')}
      title={label}
      aria-label={label}
    >
      {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
      {status === 'playing' && <Pause  className="w-3 h-3" aria-hidden="true" />}
      {status === 'paused'  && <Play   className="w-3 h-3" aria-hidden="true" />}
      {(status === 'idle' || status === 'error') && <Volume2 className="w-3 h-3" aria-hidden="true" />}
      {label}
    </motion.button>
  );
}
