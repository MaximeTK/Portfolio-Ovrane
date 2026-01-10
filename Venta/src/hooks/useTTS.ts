'use client';

import { useState, useCallback, useRef } from 'react';

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

  const speakWithBrowser = useCallback((text: string, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) {
      console.error('❌ Web Speech API non supportée');
      setTimeout(onEnd, 5000);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
    if (frenchVoice) utterance.voice = frenchVoice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      audioLevelRef.current = 0;
      onEnd();
    };
    utterance.onerror = (e) => {
      console.error('❌ Web Speech API erreur:', e);
      setIsSpeaking(false);
      audioLevelRef.current = 0;
      setTimeout(onEnd, 5000);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const playAudio = useCallback((
    audioBlob: Blob,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void
  ) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    setupVisualization(audio, (level) => {
      audioLevelRef.current = level;
    });
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => {
      setIsSpeaking(false);
      audioLevelRef.current = 0;
      onEnd();
      URL.revokeObjectURL(audioUrl);
    };
    audio.onerror = (e) => {
      console.error('❌ Erreur lecture audio:', e);
      URL.revokeObjectURL(audioUrl);
      speakWithBrowser('', onEnd);
    };
    
    audio.play();
  }, [speakWithBrowser]);

  const speakWithAPI = useCallback(async (
    text: string, 
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void
  ) => {
    try {
      stop();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.warn('⚠️ TTS API erreur');
        speakWithBrowser(text, onEnd);
        return;
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.useClientTTS && data.text) {
          speakWithBrowser(data.text, onEnd);
          return;
        }
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio vide reçu');
        speakWithBrowser(text, onEnd);
        return;
      }
      
      playAudio(audioBlob, setupVisualization, onEnd);
    } catch (error) {
      console.error('❌ Erreur synthèse vocale:', error);
      speakWithBrowser(text, onEnd);
    }
  }, [speakWithBrowser, playAudio, stop]);

  /**
   * Joue l'audio directement depuis des données base64 (reçu du backend)
   */
  const speakWithBase64 = useCallback(async (
    base64Audio: string,
    mimeType: string | undefined,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void
  ) => {
    try {
      stop();
      // Convertir base64 en Blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });
      
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio vide reçu depuis base64');
        onEnd();
        return;
      }
      
      playAudio(audioBlob, setupVisualization, onEnd);
    } catch (error) {
      console.error('❌ Erreur lecture audio base64:', error);
      onEnd();
    }
  }, [playAudio, stop]);

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
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/tts`, {
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
   * Lecture TTS en file (queue) :
   * - découpe en blocs de 4 phrases (4 ".")
   * - précharge en parallèle
   * - démarre la lecture après 2 blocs prêts si multi-blocs, sinon dès le 1er
   * - garde isSpeaking actif jusqu'à la fin de la queue (pas de coupure entre blocs)
   */
  const speakWithQueue = useCallback(async (
    fullText: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    options?: { onStartSpeaking?: () => void },
  ) => {
    stop();
    const runId = activeRunIdRef.current;

    const blocks = splitTextIntoTTSBlocks(fullText, 4);
    console.log('🧩 [TTS Queue] Découpage en blocs', {
      blocksCount: blocks.length,
      blocks: blocks.map((b, i) => ({ i: i + 1, length: b.length, preview: b.slice(0, 220) })),
    });
    if (blocks.length === 0) {
      onEnd();
      return;
    }

    const requiredReady = blocks.length > 1 ? 2 : 1;
    const maxConcurrency = 2;
    let canPrefetchBeyondInitial = false;

    const prepared: Array<PreparedChunk | null> = new Array(blocks.length).fill(null);
    let nextToFetch = 0;
    let inFlight = 0;
    const waiters: Array<() => void> = [];

    const notify = () => {
      while (waiters.length) {
        const w = waiters.shift();
        try { w?.(); } catch { /* ignore */ }
      }
    };

    const fetchMore = () => {
      if (activeRunIdRef.current !== runId) return;
      while (inFlight < maxConcurrency && nextToFetch < blocks.length) {
        // IMPORTANT: avant le démarrage de la parole, on ne précharge QUE les blocs nécessaires (1 ou 2).
        // Cela évite l'effet "tout se génère puis ça parle" et priorise le démarrage rapide.
        if (!canPrefetchBeyondInitial && nextToFetch >= requiredReady) {
          break;
        }
        const idx = nextToFetch++;
        console.log(`⏳ [TTS Queue] Préchargement chunk ${idx + 1}/${blocks.length}`);
        const ctrl = new AbortController();
        abortControllersRef.current.add(ctrl);
        inFlight += 1;

        fetchChunk(blocks[idx], ctrl)
          .then((chunk) => {
            abortControllersRef.current.delete(ctrl);
            if (activeRunIdRef.current !== runId) return;
            prepared[idx] = chunk;
            console.log(`✅ [TTS Queue] Chunk prêt ${idx + 1}/${blocks.length}`, {
              type: chunk.type,
            });
          })
          .catch(() => {
            abortControllersRef.current.delete(ctrl);
            if (activeRunIdRef.current !== runId) return;
            prepared[idx] = { type: 'client', text: blocks[idx] };
            console.warn(`⚠️ [TTS Queue] Chunk fallback client ${idx + 1}/${blocks.length}`);
          })
          .finally(() => {
            inFlight -= 1;
            notify();
            fetchMore();
          });
      }
    };

    const waitUntilPrepared = async (idx: number) => {
      while (activeRunIdRef.current === runId && prepared[idx] === null) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      return prepared[idx];
    };

    // Lancer le préchargement
    fetchMore();

    // Attendre le buffer minimal (2 blocs si multi, sinon 1)
    for (let i = 0; i < Math.min(requiredReady, blocks.length); i += 1) {
      await waitUntilPrepared(i);
      if (activeRunIdRef.current !== runId) return;
    }

    // Maintenant qu'on a le buffer minimal, on autorise le préchargement des blocs suivants
    // (pendant que le TTS parle).
    canPrefetchBeyondInitial = true;
    fetchMore();

    // Début de la parole (animation/awake, etc.)
    console.log('▶️ [TTS Queue] Début parole (min buffer atteint)', {
      requiredReady,
      total: blocks.length,
    });
    options?.onStartSpeaking?.();
    setIsSpeaking(true);

    // Lecture séquentielle
    for (let idx = 0; idx < blocks.length; idx += 1) {
      if (activeRunIdRef.current !== runId) return;
      const chunk = (await waitUntilPrepared(idx)) ?? { type: 'client', text: blocks[idx] };
      if (activeRunIdRef.current !== runId) return;

      if (chunk.type === 'audio') {
        console.log(`🔊 [TTS Queue] Lecture chunk audio ${idx + 1}/${blocks.length}`);
        await playAudioQueued(chunk.blob, setupVisualization, runId);
      } else {
        console.log(`🗣️ [TTS Queue] Lecture chunk client ${idx + 1}/${blocks.length}`);
        await speakBrowserQueued(chunk.text, runId);
      }
    }

    if (activeRunIdRef.current !== runId) return;
    console.log('⏹️ [TTS Queue] Fin parole (queue terminée)');
    audioLevelRef.current = 0;
    setIsSpeaking(false);
    onEnd();
  }, [fetchChunk, playAudioQueued, speakBrowserQueued, stop]);

  return {
    isSpeaking,
    getAudioLevel: () => audioLevelRef.current,
    stop,
    speakWithBrowser,
    speakWithAPI,
    speakWithBase64,
    speakWithUrl,
    speakWithQueue,
  };
}

