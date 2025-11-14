/**
 * Hook pour la visualisation audio
 */
import { useEffect, useRef } from 'react';
import { buildAudioGraph } from './audioGraph';
import { startLevelLoop } from './audioLoop';

type LevelHandler = (level: number) => void;

type AudioVisualizationApi = {
  setupAudioVisualization: (
    audio: HTMLAudioElement,
    onLevel: LevelHandler,
  ) => void;
  cleanup: () => void;
};

type ControllerState = {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  nodes: AudioNode[];
  stop: (() => void) | null;
  listenerAudio: HTMLAudioElement | null;
  play: (() => void) | null;
  end: (() => void) | null;
};

type CleanupOptions = {
  closeContext?: boolean;
};

type ExtendedWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioCtor(): typeof AudioContext {
  const extendedWindow = window as ExtendedWindow;
  const ctor = window.AudioContext ?? extendedWindow.webkitAudioContext;
  if (!ctor) throw new Error('AudioContext non disponible');
  return ctor;
}

function setupAudio(
  state: ControllerState,
  audio: HTMLAudioElement,
  onLevel: LevelHandler,
) {
  cleanupAudio(state, { closeContext: false });
  const AudioCtor = getAudioCtor();
  state.context = state.context ?? new AudioCtor();
  const graph = buildAudioGraph(state.context, audio);
  state.analyser = graph.analyser;
  state.nodes = graph.nodes;
  state.stop = startLevelLoop(graph.analyser, onLevel);
  const resume = () => state.context?.resume().catch(() => undefined);
  const handleEnd = () => cleanupAudio(state);
  audio.addEventListener('play', resume);
  audio.addEventListener('ended', handleEnd);
  state.listenerAudio = audio;
  state.play = resume;
  state.end = handleEnd;
}

function cleanupAudio(
  state: ControllerState,
  options: CleanupOptions = { closeContext: true },
) {
  state.stop?.();
  state.stop = null;
  const audio = state.listenerAudio;
  if (audio && state.play) audio.removeEventListener('play', state.play);
  if (audio && state.end) audio.removeEventListener('ended', state.end);
  state.listenerAudio = state.play = state.end = null;
  if (state.nodes.length) {
    state.nodes.forEach((node) => node.disconnect());
    state.nodes = [];
  }
  state.analyser = null;
  if (!options.closeContext || !state.context) return;
  state.context.close().catch(() => undefined);
  state.context = null;
}

function createController(): AudioVisualizationApi {
  const state: ControllerState = {
    context: null,
    analyser: null,
    nodes: [],
    stop: null,
    listenerAudio: null,
    play: null,
    end: null,
  };
  return {
    setupAudioVisualization(audio, onLevel) {
      setupAudio(state, audio, onLevel);
    },
    cleanup() {
      cleanupAudio(state);
    },
  };
}

export function useAudioVisualization(): AudioVisualizationApi {
  const controllerRef = useRef<AudioVisualizationApi | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createController();
  }

  useEffect(() => {
    return () => controllerRef.current?.cleanup();
  }, []);

  return controllerRef.current;
}
