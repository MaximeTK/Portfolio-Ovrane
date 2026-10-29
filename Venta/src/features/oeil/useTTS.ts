'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import pLimit from 'p-limit';
import { startLevelLoop } from './useAudioVisualization';

type SetupVisualizationFn = (audio: HTMLAudioElement, callback: (level: number) => void) => void;

type PreparedChunk =
  | { type: 'audio'; blob: Blob }
  | { type: 'stream'; body: ReadableStream<Uint8Array> }
  | { type: 'client'; text: string };

// Au-delà, le bloc est dit par la voix du navigateur
const TTS_TIMEOUT_MS = 8000;

// Lecture pendant la réception : le MP3 est versé dans une MediaSource, si le navigateur sait la lire ainsi
const fluxLisible = () => typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg');

// Voix d'une réponse en flux : PCM 16 bits à 24 kHz, avance prise au premier son contre l'irrégularité des morceaux
const TAUX_PCM = 24000;
const AVANCE_S = 0.25;

/** Voix reçue morceau par morceau pendant que la réponse s'écrit. */
export type FluxVoix = { pousser: (pcm: string) => void; terminer: () => void };

// Le backend refuse un bloc de plus de 1 000 caractères : la coupe se fait avant, entre deux phrases
const MAX_BLOC = 900;

/** Découpe un texte en blocs de 4 phrases et de MAX_BLOC caractères au plus, une phrase finissant par un point. */
export function splitTextIntoTTSBlocks(text: string, sentencesPerBlock = 4): string[] {
  const sentences = (text.replace(/\s+/g, ' ').trim().match(/[^.]+(?:\.)|[^.]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let bloc: string[] = [];
  for (const phrase of sentences) {
    if (bloc.length && (bloc.length === sentencesPerBlock || [...bloc, phrase].join(' ').length > MAX_BLOC)) {
      blocks.push(bloc.join(' '));
      bloc = [];
    }
    bloc.push(phrase);
  }
  if (bloc.length) blocks.push(bloc.join(' '));
  return blocks;
}

async function fetchChunk(text: string, signal: AbortSignal, enFlux: boolean): Promise<PreparedChunk> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  const isAudio = response.ok && response.headers.get('Content-Type')?.startsWith('audio/');
  if (isAudio && enFlux && response.body) return { type: 'stream', body: response.body };
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
  const fluxRef = useRef<{ couper: () => void } | null>(null);

  const stop = useCallback(() => {
    // Invalide la file et les requêtes en cours
    activeRunIdRef.current += 1;
    fluxRef.current?.couper();
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

  // Le flux se lit pendant qu'il arrive : la lecture attend les morceaux en retard et ne finit qu'après le dernier reçu
  const playStreamQueued = useCallback((body: ReadableStream<Uint8Array>, setupVisualization: SetupVisualizationFn, runId: number) =>
    new Promise<void>((resolve) => {
      if (activeRunIdRef.current !== runId) return resolve();
      const source = new MediaSource();
      const audioUrl = URL.createObjectURL(source);
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
      source.addEventListener('sourceopen', async () => {
        const tampon = source.addSourceBuffer('audio/mpeg');
        const verser = (morceau: Uint8Array) => new Promise<void>((ok, echec) => {
          tampon.onupdateend = () => ok();
          tampon.onerror = tampon.onabort = () => echec(new Error('tampon audio fermé'));
          tampon.appendBuffer(morceau as Uint8Array<ArrayBuffer>);
        });
        const lecteur = body.getReader();
        let lance = false;
        try {
          for (let morceau = await lecteur.read(); !morceau.done; morceau = await lecteur.read()) {
            await verser(morceau.value);
            if (!lance) {
              lance = true;
              audio.play().catch(fin);
            }
          }
        } catch {
          // Arrêt demandé ou réseau coupé : la suite n'arrivera pas
        }
        // Fin du flux annoncée : la lecture va au bout de ce qui est reçu, puis « ended »
        if (source.readyState === 'open' && !tampon.updating) source.endOfStream();
        if (!lance) fin();
      }, { once: true });
    }), []);

  // Chaque morceau de PCM est programmé juste après le précédent : la voix ne s'interrompt pas tant qu'ils arrivent à temps
  const ouvrirFlux = useCallback((onEnd: () => void, onStart?: () => void): FluxVoix => {
    stop();
    const runId = activeRunIdRef.current;
    const Contexte = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const contexte = new Contexte();
    const analyseur = contexte.createAnalyser();
    analyseur.fftSize = 1024;
    analyseur.smoothingTimeConstant = 0.85;
    analyseur.connect(contexte.destination);
    const arreterNiveau = startLevelLoop(analyseur, (level) => {
      audioLevelRef.current = level;
    });
    const sources = new Set<AudioBufferSourceNode>();
    let suite = 0;
    let demarre = false;
    let fini = false;
    let clos = false;
    const poignee = {
      couper: () => {
        if (clos) return;
        clos = true;
        arreterNiveau();
        sources.forEach((source) => source.stop());
        sources.clear();
        contexte.close().catch(() => undefined);
        if (fluxRef.current === poignee) fluxRef.current = null;
      },
    };
    fluxRef.current = poignee;
    const finir = () => {
      poignee.couper();
      if (activeRunIdRef.current !== runId) return;
      audioLevelRef.current = 0;
      setIsSpeaking(false);
      onEnd();
    };
    contexte.resume().catch(() => undefined);

    return {
      pousser(pcm) {
        if (clos) return;
        const octets = Uint8Array.from(atob(pcm), (c) => c.charCodeAt(0));
        const echantillons = new Int16Array(octets.buffer, 0, octets.length >> 1);
        if (!echantillons.length) return;
        const tampon = contexte.createBuffer(1, echantillons.length, TAUX_PCM);
        const canal = tampon.getChannelData(0);
        for (let i = 0; i < echantillons.length; i += 1) canal[i] = echantillons[i] / 32768;
        const source = contexte.createBufferSource();
        source.buffer = tampon;
        source.connect(analyseur);
        const debut = Math.max(suite, contexte.currentTime + (demarre ? 0.02 : AVANCE_S));
        source.start(debut);
        suite = debut + tampon.duration;
        sources.add(source);
        source.onended = () => {
          sources.delete(source);
          if (fini && sources.size === 0) finir();
        };
        if (!demarre) {
          demarre = true;
          // Le texte et l'animation partent avec le premier son, pas avant
          setTimeout(() => {
            if (clos) return;
            onStart?.();
            setIsSpeaking(true);
          }, (debut - contexte.currentTime) * 1000);
        }
      },
      terminer() {
        fini = true;
        if (sources.size === 0) finir();
      },
    };
  }, [stop]);

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

    const enFlux = fluxLisible();
    const limit = pLimit(2);
    const pending = blocks.map((block, index) =>
      limit(async (): Promise<PreparedChunk> => {
        if (isStale()) return { type: 'client', text: block };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
        abortControllersRef.current.add(ctrl);
        let chunk: PreparedChunk = { type: 'client', text: block };
        try {
          // Le premier bloc se lit pendant qu'il arrive ; les suivants arrivent entiers pendant sa lecture
          chunk = await fetchChunk(block, ctrl.signal, enFlux && index === 0);
        } catch {
          // Serveur injoignable ou trop lent : voix du navigateur
        } finally {
          clearTimeout(timer);
          // Un flux garde sa requête pendant sa lecture, pour qu'un arrêt la coupe aussi
          if (chunk.type !== 'stream') abortControllersRef.current.delete(ctrl);
        }
        return chunk;
      }),
    );

    // En flux, la voix part dès les premiers octets du premier bloc ; sinon, deux blocs prêts avant de parler
    await Promise.all(pending.slice(0, enFlux ? 1 : 2));
    if (isStale()) return;
    onStart?.();
    setIsSpeaking(true);

    for (const promise of pending) {
      const chunk = await promise;
      if (isStale()) return;
      if (chunk.type === 'stream') {
        await playStreamQueued(chunk.body, setupVisualization, runId);
      } else if (chunk.type === 'audio') {
        await playAudioQueued(chunk.blob, setupVisualization, runId);
      } else {
        await speakBrowserQueued(chunk.text, runId);
      }
    }

    if (isStale()) return;
    audioLevelRef.current = 0;
    setIsSpeaking(false);
    onEnd();
  }, [playAudioQueued, playStreamQueued, speakBrowserQueued, stop]);

  return { isSpeaking, getAudioLevel, stop, speakWithUrl, speakWithQueue, ouvrirFlux };
}
