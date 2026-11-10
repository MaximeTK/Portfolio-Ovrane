'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import pLimit from 'p-limit';
import { posterJson } from '@/lib/reseau';
import { creerAnalyseur, creerContexteAudio, startLevelLoop } from './useAudioVisualization';

type SetupVisualizationFn = (audio: HTMLAudioElement, callback: (level: number) => void) => void;

type PreparedChunk =
  | { type: 'audio'; blob: Blob }
  | { type: 'stream'; body: ReadableStream<Uint8Array> }
  | { type: 'client'; text: string };

// Au-delà, le bloc est dit par la voix du navigateur
const TTS_TIMEOUT_MS = 8000;

// Lecture pendant la réception : MP3 versé dans une MediaSource si possible
const fluxLisible = () => typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg');

// Voix en flux : PCM 16 bits à 24 kHz, avance prise au premier son
const TAUX_PCM = 24000;
const AVANCE_S = 0.25;

/** Voix reçue morceau par morceau pendant que la réponse s'écrit. */
export type FluxVoix = { pousser: (pcm: string) => void; terminer: () => void };

// Le backend refuse plus de 1 000 caractères : coupe avant, entre deux phrases
const MAX_BLOC = 900;

/** Découpe en blocs de 4 phrases et MAX_BLOC caractères au plus */
function splitTextIntoTTSBlocks(text: string): string[] {
  const sentences = (text.replace(/\s+/g, ' ').trim().match(/[^.]+(?:\.)|[^.]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let bloc: string[] = [];
  for (const phrase of sentences) {
    if (bloc.length && (bloc.length === 4 || [...bloc, phrase].join(' ').length > MAX_BLOC)) {
      blocks.push(bloc.join(' '));
      bloc = [];
    }
    bloc.push(phrase);
  }
  if (bloc.length) blocks.push(bloc.join(' '));
  return blocks;
}

// Le passage part avec le texte entier et sa signature
async function fetchChunk(text: string, source: string, voix: string, signal: AbortSignal, enFlux: boolean): Promise<PreparedChunk> {
  const response = await posterJson('/api/tts', { text, source, voix }, { signal });
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

  const noterNiveau = useCallback((level: number) => {
    audioLevelRef.current = level;
  }, []);
  const debuterVoix = useCallback((onStart?: () => void) => {
    onStart?.();
    setIsSpeaking(true);
  }, []);
  const finirVoix = useCallback((onEnd?: () => void) => {
    audioLevelRef.current = 0;
    setIsSpeaking(false);
    onEnd?.();
  }, []);

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

    finirVoix();
  }, [finirVoix]);

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
    setupVisualization(audio, noterNiveau);
    const fin = () => {
      if (activeRunIdRef.current === runId) finirVoix(onEnd);
    };
    audio.onplay = () => debuterVoix(onStart);
    audio.onended = fin;
    audio.onerror = fin;
    audio.play().catch(fin);
  }, [stop, noterNiveau, debuterVoix, finirVoix]);

  // Lecteur d'une adresse provisoire : sa fin libère l'adresse et rend la main
  const preparerLecture = useCallback((audioUrl: string, setupVisualization: SetupVisualizationFn, resolve: () => void) => {
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    currentAudioUrlRef.current = audioUrl;
    setupVisualization(audio, noterNiveau);
    const fin = () => {
      audioLevelRef.current = 0;
      URL.revokeObjectURL(audioUrl);
      if (currentAudioUrlRef.current === audioUrl) currentAudioUrlRef.current = null;
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      resolve();
    };
    audio.onended = fin;
    audio.onerror = fin;
    return { audio, fin };
  }, [noterNiveau]);

  const playAudioQueued = useCallback((audioBlob: Blob, setupVisualization: SetupVisualizationFn, runId: number) =>
    new Promise<void>((resolve) => {
      if (activeRunIdRef.current !== runId) return resolve();
      const { audio, fin } = preparerLecture(URL.createObjectURL(audioBlob), setupVisualization, resolve);
      audio.play().catch(fin);
    }), [preparerLecture]);

  // Le flux se lit à l'arrivée : la lecture attend les morceaux en retard
  const playStreamQueued = useCallback((body: ReadableStream<Uint8Array>, setupVisualization: SetupVisualizationFn, runId: number) =>
    new Promise<void>((resolve) => {
      if (activeRunIdRef.current !== runId) return resolve();
      const source = new MediaSource();
      const { audio, fin } = preparerLecture(URL.createObjectURL(source), setupVisualization, resolve);
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
        // Fin du flux annoncée : lecture jusqu'au dernier reçu, puis « ended »
        if (source.readyState === 'open' && !tampon.updating) source.endOfStream();
        if (!lance) fin();
      }, { once: true });
    }), [preparerLecture]);

  // Chaque morceau PCM suit le précédent : la voix ne s'interrompt pas
  const ouvrirFlux = useCallback((onEnd: () => void, onStart?: () => void): FluxVoix => {
    stop();
    const runId = activeRunIdRef.current;
    const contexte = creerContexteAudio();
    const analyseur = creerAnalyseur(contexte);
    analyseur.connect(contexte.destination);
    const arreterNiveau = startLevelLoop(analyseur, noterNiveau);
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
      if (activeRunIdRef.current === runId) finirVoix(onEnd);
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
            if (!clos) debuterVoix(onStart);
          }, (debut - contexte.currentTime) * 1000);
        }
      },
      terminer() {
        fini = true;
        if (sources.size === 0) finir();
      },
    };
  }, [stop, noterNiveau, debuterVoix, finirVoix]);

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

  /** Lecture en file : blocs de 4 phrases, 2 générés à la fois, dans l'ordre */
  const speakWithQueue = useCallback(async (
    fullText: string,
    setupVisualization: SetupVisualizationFn,
    onEnd: () => void,
    onStart?: () => void,
    voix?: string | null,
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
        // Sans signature le serveur refuserait : la voix du navigateur le dit aussitôt
        if (isStale() || !voix) return { type: 'client', text: block };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
        abortControllersRef.current.add(ctrl);
        let chunk: PreparedChunk = { type: 'client', text: block };
        try {
          // Premier bloc lu à mesure ; les suivants arrivent entiers pendant sa lecture
          chunk = await fetchChunk(block, fullText, voix, ctrl.signal, enFlux && index === 0);
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

    // En flux la voix part aux premiers octets ; sinon, deux blocs prêts avant
    await Promise.all(pending.slice(0, enFlux ? 1 : 2));
    if (isStale()) return;
    debuterVoix(onStart);

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

    if (!isStale()) finirVoix(onEnd);
  }, [playAudioQueued, playStreamQueued, speakBrowserQueued, stop, debuterVoix, finirVoix]);

  return { isSpeaking, getAudioLevel, stop, speakWithUrl, speakWithQueue, ouvrirFlux };
}
