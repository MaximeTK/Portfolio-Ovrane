'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import pLimit from 'p-limit';

type SetupVisualizationFn = (
  audio: HTMLAudioElement,
  callback: (level: number) => void,
) => void;

type PreparedChunk =
  | { type: 'audio'; blob: Blob }
  | { type: 'client'; text: string };

function normalizeForChunking(text: string) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Découpe un texte en blocs de 4 phrases (≈ 4 points ".").
 * On se base principalement sur "." comme demandé.
 */
function splitTextIntoTTSBlocks(text: string, sentencesPerBlock = 4): string[] {
  const normalized = normalizeForChunking(text);
  if (!normalized) return [];

  // 1 "phrase" = un segment qui se termine par "." (ou fin de texte).
  const sentences = normalized.match(/[^.]+(?:\.)|[^.]+$/g) ?? [];
  const cleaned = sentences
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (cleaned.length <= sentencesPerBlock) {
    return cleaned.length ? [cleaned.join(' ')] : [];
  }

  const blocks: string[] = [];
  for (let i = 0; i < cleaned.length; i += sentencesPerBlock) {
    const block = cleaned.slice(i, i + sentencesPerBlock).join(' ').trim();
    if (block) blocks.push(block);
  }
  return blocks;
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Utilisation d'une ref pour éviter les re-renders excessifs (performance)
  const audioLevelRef = useRef(0);
  const activeRunIdRef = useRef(0);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    // Invalide toutes les opérations async en cours (queue + fetch)
    activeRunIdRef.current += 1;

    // Abort des fetch TTS en cours
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();

    // Stop WebSpeech
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }

    // Stop audio HTML
    const audio = currentAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.src = '';
        audio.load();
      } catch {
        // ignore
      }
    }
    currentAudioRef.current = null;

    const url = currentAudioUrlRef.current;
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    currentAudioUrlRef.current = null;

    audioLevelRef.current = 0;
    setIsSpeaking(false);
  }, []);

  // Quitter l'accueil pour une page projet coupe la voix et la file en cours
  useEffect(() => stop, [stop]);

  const speakWithUrl = useCallback((
    url: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    options?: { onStartSpeaking?: () => void }
  ) => {
    try {
      stop();
      const audio = new Audio(url);
      
      setupVisualization(audio, (level) => {
        audioLevelRef.current = level;
      });
      audio.onplay = () => {
        options?.onStartSpeaking?.();
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        audioLevelRef.current = 0;
        onEnd();
      };
      audio.onerror = (e) => {
        console.error('❌ Erreur lecture audio URL:', e);
        onEnd();
      };
      
      audio.play();
    } catch (error) {
      console.error('❌ Erreur lancement audio URL:', error);
      onEnd();
    }
  }, [stop]);

  const playAudioQueued = useCallback(async (
    audioBlob: Blob,
    setupVisualization: SetupVisualizationFn,
    runId: number,
  ) => {
    await new Promise<void>((resolve) => {
      // Si une nouvelle exécution a démarré, on sort immédiatement
      if (activeRunIdRef.current !== runId) return resolve();

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      currentAudioRef.current = audio;
      currentAudioUrlRef.current = audioUrl;

      setupVisualization(audio, (level) => {
        audioLevelRef.current = level;
      });

      audio.onended = () => {
        audioLevelRef.current = 0;
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {
          // ignore
        }
        if (currentAudioUrlRef.current === audioUrl) currentAudioUrlRef.current = null;
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        resolve();
      };

      audio.onerror = () => {
        audioLevelRef.current = 0;
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {
          // ignore
        }
        if (currentAudioUrlRef.current === audioUrl) currentAudioUrlRef.current = null;
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        resolve();
      };

      audio.play().catch(() => resolve());
    });
  }, []);

  const speakBrowserQueued = useCallback(async (text: string, runId: number) => {
    await new Promise<void>((resolve) => {
      if (activeRunIdRef.current !== runId) return resolve();

      if (!('speechSynthesis' in window)) {
        // Pas de WebSpeech -> on termine (évite de bloquer la queue)
        return resolve();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find((voice) => voice.lang.startsWith('fr'));
      if (frenchVoice) utterance.voice = frenchVoice;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const fetchChunk = useCallback(async (
    text: string,
    controller: AbortController,
  ): Promise<PreparedChunk> => {
    console.log('🗣️ [TTS Queue] Envoi chunk au backend /api/tts:', {
      length: text.length,
      preview: text.slice(0, 220),
    });
    // IMPORTANT (prod): passer par l'API Next (same-origin) pour éviter CORS.
    const response = await fetch(`/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('⚠️ [TTS Queue] Backend TTS non-OK, fallback client TTS', {
        status: response.status,
      });
      return { type: 'client', text };
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      const data = await response.json().catch(() => null);
      if (data?.useClientTTS) {
        console.warn('⚠️ [TTS Queue] Backend demande fallback client TTS', {
          preview: String(data.text || text).slice(0, 220),
        });
        return { type: 'client', text: String(data.text || text) };
      }
    }

    const audioBlob = await response.blob();
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('⚠️ [TTS Queue] Audio vide reçu, fallback client TTS');
      return { type: 'client', text };
    }

    console.log('✅ [TTS Queue] Chunk audio prêt', {
      bytes: audioBlob.size,
    });
    return { type: 'audio', blob: audioBlob };
  }, []);

  /**
   * Lecture TTS en file :
   * - découpe en blocs de 4 phrases
   * - p-limit borne la génération à 2 requêtes simultanées
   * - la lecture séquentielle attend chaque bloc dans l'ordre, donc la parole
   *   démarre dès le premier prêt sans attendre les suivants
   *
   * La version précédente réimplémentait ce sémaphore à la main : waiters[],
   * notify(), inFlight, nextToFetch, canPrefetchBeyondInitial et un tableau
   * `prepared` rempli par effet de bord.
   */
  const speakWithQueue = useCallback(async (
    fullText: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    options?: { onStartSpeaking?: () => void },
  ) => {
    stop();
    const runId = activeRunIdRef.current;
    const isStale = () => activeRunIdRef.current !== runId;

    const blocks = splitTextIntoTTSBlocks(fullText, 4);
    if (blocks.length === 0) {
      onEnd();
      return;
    }

    const limit = pLimit(2);
    const pending = blocks.map((block) =>
      limit(async (): Promise<PreparedChunk> => {
        if (isStale()) return { type: 'client', text: block };
        const ctrl = new AbortController();
        abortControllersRef.current.add(ctrl);
        try {
          return await fetchChunk(block, ctrl);
        } catch {
          return { type: 'client', text: block };
        } finally {
          abortControllersRef.current.delete(ctrl);
        }
      }),
    );

    // Tampon minimal avant de parler : 2 blocs quand il y en a plusieurs, pour
    // qu'aucun silence n'apparaisse entre le premier et le second.
    await Promise.all(pending.slice(0, Math.min(2, pending.length)));
    if (isStale()) return;
    options?.onStartSpeaking?.();
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
  }, [fetchChunk, playAudioQueued, speakBrowserQueued, stop]);

  return {
    isSpeaking,
    getAudioLevel: () => audioLevelRef.current,
    stop,
    speakWithUrl,
    speakWithQueue,
  };
}

