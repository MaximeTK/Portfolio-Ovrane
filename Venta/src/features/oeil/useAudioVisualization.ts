/** Visualisation audio : analyse la source fournie, même son du PC coupé */
import { useCallback, useEffect, useRef } from 'react';

type LevelHandler = (level: number) => void;

const FILTRES: { type: BiquadFilterType; frequency: number; gain: number; Q: number }[] = [
  { type: 'lowshelf', frequency: 100, gain: 6, Q: 0.7 },
  { type: 'peaking', frequency: 400, gain: 2, Q: 1.2 },
  { type: 'highshelf', frequency: 6000, gain: -3, Q: 0.7 },
];
const DIRECT = 0.95;
const FILTRE = 0.12;

function creerGain(context: AudioContext, valeur: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(valeur, context.currentTime);
  return gain;
}

// Contexte audio du navigateur, sous son ancien nom chez Safari
export const creerContexteAudio = () => new (window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();

// Le même analyseur pour les deux chemins de la voix : l'œil s'anime pareil
export function creerAnalyseur(contexte: AudioContext) {
  const analyseur = contexte.createAnalyser();
  analyseur.fftSize = 1024;
  analyseur.smoothingTimeConstant = 0.85;
  return analyseur;
}

export function startLevelLoop(analyser: AnalyserNode, onLevel: LevelHandler): () => void {
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(buffer);
    const somme = buffer.reduce((total, octet) => total + ((octet - 128) / 128) ** 2, 0);
    onLevel(Math.min(1, (Math.sqrt(somme / buffer.length) * 3) ** 2));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export function useAudioVisualization() {
  const contexteRef = useRef<AudioContext | null>(null);
  const detacherRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    detacherRef.current?.();
    contexteRef.current?.close().catch(() => undefined);
    contexteRef.current = null;
  }, []);

  // Son direct et son filtré se mêlent avant l'analyseur, relié à la sortie
  const setupAudioVisualization = useCallback((audio: HTMLAudioElement, onLevel: LevelHandler) => {
    detacherRef.current?.();
    const context = (contexteRef.current ??= creerContexteAudio());
    audio.crossOrigin ||= 'anonymous';

    const source = context.createMediaElementSource(audio);
    const analyser = creerAnalyseur(context);
    const direct = creerGain(context, DIRECT);
    const filtre = creerGain(context, FILTRE);
    const noeuds: AudioNode[] = [source, analyser, direct, filtre];
    let sortie: AudioNode = source;
    for (const { type, frequency, gain, Q } of FILTRES) {
      const noeud = context.createBiquadFilter();
      noeud.type = type;
      noeud.frequency.setValueAtTime(frequency, context.currentTime);
      noeud.gain.setValueAtTime(gain, context.currentTime);
      noeud.Q.setValueAtTime(Q, context.currentTime);
      sortie.connect(noeud);
      noeuds.push(noeud);
      sortie = noeud;
    }
    source.connect(direct);
    sortie.connect(filtre);
    direct.connect(analyser);
    filtre.connect(analyser);
    analyser.connect(context.destination);

    const arreter = startLevelLoop(analyser, onLevel);
    const reprendre = () => context.resume().catch(() => undefined);
    const detacher = () => {
      arreter();
      audio.removeEventListener('play', reprendre);
      audio.removeEventListener('ended', detacher);
      noeuds.forEach((noeud) => noeud.disconnect());
      detacherRef.current = null;
    };
    audio.addEventListener('play', reprendre);
    audio.addEventListener('ended', detacher);
    detacherRef.current = detacher;
  }, []);

  return { setupAudioVisualization };
}
