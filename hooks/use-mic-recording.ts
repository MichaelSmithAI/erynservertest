'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error';

export function useMicRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Array<Blob>>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const resetSilenceTimer = useCallback(
    (timeoutMs: number, onTimeout: () => void) => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(onTimeout, timeoutMs);
    },
    [],
  );

  const stopAnalysis = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // Stop recording and transition to processing
  const stop = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    setStatus('processing');
  }, []);

  const analyzeInput = useCallback(
    (stream: MediaStream) => {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      sourceRef.current = source;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);

      const SILENCE_THRESHOLD = 0.015; // relative magnitude ~0..1
      const SILENCE_MS = 1200; // stop after 1.2s of silence

      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        // Normalize and compute RMS
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128; // -1..1
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length); // 0..1

        if (rms > SILENCE_THRESHOLD) {
          resetSilenceTimer(SILENCE_MS, () => stop());
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      // Start the timeout initially so silence-only speech ends quickly
      resetSilenceTimer(SILENCE_MS, () => stop());
      rafRef.current = requestAnimationFrame(tick);
    },
    [resetSilenceTimer, stop],
  );

  const start = useCallback(async () => {
    try {
      setError(null);
      if (status === 'recording' || status === 'processing') return;

      // Environment and support checks
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        setError('Microphone can only be used in the browser.');
        setStatus('error');
        return;
      }
      if (!window.isSecureContext) {
        setError('Microphone requires HTTPS or localhost.');
        setStatus('error');
        return;
      }
      const hasMediaDevices = !!(navigator as any).mediaDevices;
      const hasGetUserMedia = !!(navigator as any).mediaDevices?.getUserMedia;
      const legacyGetUserMedia =
        (navigator as any).getUserMedia ||
        (navigator as any).webkitGetUserMedia ||
        (navigator as any).mozGetUserMedia ||
        (navigator as any).msGetUserMedia;
      if (!hasMediaDevices && !legacyGetUserMedia) {
        setError('Microphone is not supported in this browser. Try Chrome.');
        setStatus('error');
        return;
      }
      if (typeof (window as any).MediaRecorder === 'undefined') {
        setError('Recording is not supported in this browser. Try Chrome.');
        setStatus('error');
        return;
      }

      // Obtain the audio stream
      const stream: MediaStream = hasGetUserMedia
        ? await (navigator as any).mediaDevices.getUserMedia({ audio: true })
        : await new Promise<MediaStream>((resolve, reject) =>
            legacyGetUserMedia.call(
              navigator,
              { audio: true },
              resolve,
              reject,
            ),
          );

      audioChunksRef.current = [];
      // Choose a supported mimeType for the recorder
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
      ];
      let mimeType: string | undefined;
      const canCheck =
        typeof (window as any).MediaRecorder?.isTypeSupported === 'function';
      for (const t of candidates) {
        if (!canCheck || (window as any).MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopAnalysis();
      };

      analyzeInput(stream);
      setStatus('recording');
      mediaRecorder.start(200);
    } catch (err: any) {
      if (
        err &&
        (err.name === 'NotAllowedError' || err.name === 'NotFoundError')
      ) {
        setIsPermissionDenied(true);
        setError('Microphone permission denied');
      } else if (err && err.name === 'NotSupportedError') {
        setError('Recording not supported in this browser. Try Chrome.');
      } else if (err?.message) {
        setError(`Microphone access failed: ${err.message}`);
      } else {
        setError('Microphone access failed');
      }
      setStatus('error');
    }
  }, [status, analyzeInput, stopAnalysis]);

  const transcribe = useCallback(async (language?: string) => {
    if (audioChunksRef.current.length === 0) return { text: '' };
    const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(audioChunksRef.current, { type: recordedType });
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    if (language) formData.append('language', language);

    const res = await fetch('/api/transcription', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      setError('Transcription failed');
      setStatus('error');
      return { text: '' };
    }
    const json = await res.json();
    setStatus('idle');
    audioChunksRef.current = [];
    return json as { text: string };
  }, []);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
      stopAnalysis();
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    };
  }, [stopAnalysis]);

  return {
    start,
    stop,
    transcribe,
    status,
    error,
    isPermissionDenied,
  };
}
