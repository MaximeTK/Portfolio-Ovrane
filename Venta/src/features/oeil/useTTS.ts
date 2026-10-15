'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import pLimit from 'p-limit';

type SetupVisualizationFn = (audio: HTMLAudioElement, callback: (level: number) => void) => void;

type PreparedChunk = { type: 'audio'; blob: Blob } | { type: 'client'; text: string };

// Au-delà, le bloc est dit par la voix du navigateur
const TTS_TIMEOUT_MS = 8000;

/** Découpe un texte en blocs de 4 phrases, une phrase finissant par un point. */
function splitTextIntoTTSBlocks(text: string, sentencesPerBlock = 4): string[] {
  const sentences = (text.replace(/\s+/g, ' ').trim().match(/[^.]+(?:\.)|[^.]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerBlock) {
    blocks.push(sentences.slice(i, i + sentencesPerBlock).join(' '));
  }
  return blocks;
}

async function fetchChunk(text: string, signal: AbortSignal): Promise<PreparedChunk> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  const isAudio = response.ok && response.headers.get('Content-Type')?.startsWith('audio/');
  const blob = isAudio ? await response.blob() : null;
  return blob?.size ? { type: 'audio', blob } : { type: 'client', text };
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Niveau sonore lu à chaque image par l'œil, sans rendu React
  const audioLevelRef = useRef(0);
  const activeRunIdRef = useRef(0);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    // Invalide la file et les requêtes en cours
    activeRunIdRef.current += 1;
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();
    window.speechSynthesis?.cancel();

    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audio.load();
    }
    currentAudioRef.current = null;
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
    currentAudioUrlRef.current = null;

    audioLevelRef.current = 0;
    setIsSpeaking(false);
  }, []);

  // Démontage de l'accueil : la voix et la file en cours s'arrêtent
  useEffect(() => stop, [stop]);

  const getAudioLevel = useCallback(() => audioLevelRef.current, []);

  const speakWithUrl = useCallback((
    url: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    onStart?: () => void,
  ) => {
    stop();
    const runId = activeRunIdRef.current;
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    setupVisualization(audio, (level) => {
      audioLevelRef.current = level;
    });
    const fin = () => {
      if (activeRunIdRef.current !== runId) return;
      audioLevelRef.current = 0;
      setIsSpeaking(false);
      onEnd();
    };
    audio.onplay = () => {
      onStart?.();
      setIsSpeaking(true);
    };
    audio.onended = fin;
    audio.onerror = fin;
    audio.play().catch(fin);
  }, [stop]);

  const playAudioQueued = useCallback((audioBlob: Blob, setupVisualization: SetupVisualizationFn, runId: number) =>
    new Promise<void>((resolve) => {
      if (activeRunIdRef.current !== runId) return resolve();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      currentAudioUrlRef.current = audioUrl;
      setupVisualization(audio, (level) => {
        audioLevelRef.current = level;
      });
      const fin = () => {
        audioLevelRef.current = 0;
        URL.revokeObjectURL(audioUrl);
        if (currentAudioUrlRef.current === audioUrl) currentAudioUrlRef.current = null;
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        resolve();
      };
      audio.onended = fin;
      audio.onerror = fin;
      audio.play().catch(fin);
    }), []);

  const speakBrowserQueued = useCallback((text: string, runId: number) =>
    new Promise<void>((resolve) => {
      // Sans synthèse vocale, le bloc est sauté pour ne pas bloquer la file
      if (activeRunIdRef.current !== runId || !('speechSynthesis' in window)) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      const frenchVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith('fr'));
      if (frenchVoice) utterance.voice = frenchVoice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    }), []);

  /**
   * Lecture en file : blocs de 4 phrases, au plus 2 générés en même temps,
   * lus dans l'ordre dès que le premier est prêt.
   */
  const speakWithQueue = useCallback(async (
    fullText: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    onStart?: () => void,
  ) => {
    stop();
    const runId = activeRunIdRef.current;
    const isStale = () => activeRunIdRef.current !== runId;

    const blocks = splitTextIntoTTSBlocks(fullText);
    if (blocks.length === 0) return onEnd();

    const limit = pLimit(2);
    const pending = blocks.map((block) =>
      limit(async (): Promise<PreparedChunk> => {
        if (isStale()) return { type: 'client', text: block };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
        abortControllersRef.current.add(ctrl);
        try {
          return await fetchChunk(block, ctrl.signal);
        } catch {
          return { type: 'client', text: block };
        } finally {
          clearTimeout(timer);
          abortControllersRef.current.delete(ctrl);
        }
      }),
    );

    // Deux blocs prêts avant de parler : aucun silence entre le premier et le second
    await Promise.all(pending.slice(0, 2));
    if (isStale()) return;
    onStart?.();
    setIsSpeaking(true);

    for (const promise of pending) {
      const chunk = await promise;
      if (isStale()) return;
      if (chunk.type === 'audio') {
        await playAudioQueued(chunk.blob, setupVisualization, runId);
      } else {
        await speakBrowserQueued(chunk.text, runId);
      }
    }

    if (isStale()) return;
    audioLevelRef.current = 0;
    setIsSpeaking(false);
    onEnd();
  }, [playAudioQueued, speakBrowserQueued, stop]);

  return { isSpeaking, getAudioLevel, stop, speakWithUrl, speakWithQueue };
}
