'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type TTSContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  speak: (
    text: string,
    options?: { voice?: string; language?: string },
  ) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  hasAutoplayError: boolean;
  playStoredAudio: () => Promise<void>;
};

const TTSContext = createContext<TTSContextValue | null>(null);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [hasAutoplayError, setHasAutoplayError] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const storedAudioRef = useRef<Blob | null>(null);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsSpeaking(false);
    setHasAutoplayError(false);
    storedAudioRef.current = null;
  };

  const playStoredAudio = useCallback(async () => {
    if (!storedAudioRef.current) return;

    try {
      const url = URL.createObjectURL(storedAudioRef.current);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        setHasAutoplayError(false);
        storedAudioRef.current = null;
      };

      setIsSpeaking(true);
      await audio.play();
    } catch (err) {
      console.error('Stored audio play error:', err);
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string, options?: { voice?: string; language?: string }) => {
      if (!enabled) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      stop();
      setIsSpeaking(true);

      try {
        const res = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: trimmed, ...options }),
        });

        if (!res.ok) {
          // Try to extract server error to help diagnose
          try {
            const errJson = await res.json();
            console.error('TTS server error:', errJson);
          } catch {}
          throw new Error(`TTS request failed: ${res.status}`);
        }

        const contentType = res.headers.get('content-type') || 'audio/mpeg';
        if (!contentType.startsWith('audio/')) {
          // Not an audio response – likely configuration error
          try {
            const text = await res.text();
            console.error('TTS non-audio response:', text);
          } catch {}
          setIsSpeaking(false);
          return;
        }
        const audioBuffer = await res.arrayBuffer();
        const blob = new Blob([audioBuffer], { type: contentType });
        storedAudioRef.current = blob;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          storedAudioRef.current = null;
          setHasAutoplayError(false);
        };

        try {
          await audio.play();
        } catch (playError: any) {
          // Handle autoplay policy error
          if (playError.name === 'NotAllowedError') {
            console.warn(
              'Autoplay blocked by browser policy. Audio stored for manual playback.',
            );
            setHasAutoplayError(true);
            setIsSpeaking(false);
            return;
          }
          throw playError;
        }
      } catch (err) {
        console.error('TTS play error:', err);
        setIsSpeaking(false);
      }
    },
    [enabled],
  );

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      speak,
      stop,
      isSpeaking,
      hasAutoplayError,
      playStoredAudio,
    }),
    [enabled, isSpeaking, speak, hasAutoplayError, playStoredAudio],
  );

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

export function useTTS() {
  const ctx = useContext(TTSContext);
  if (!ctx) throw new Error('useTTS must be used within a TTSProvider');
  return ctx;
}
