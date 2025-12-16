/**
 * Hook pour la visualisation audio
 * Analyse directement la source audio fournie (HTMLAudioElement) au lieu de capturer le flux système/micro.
 * Cela permet de visualiser le TTS même si le son de l'ordinateur est coupé.
 * 
 * Fusionne les anciennes fonctionnalités de audioGraph.ts et audioLoop.ts pour simplifier la structure.
 */
import { useEffect, useRef } from 'react';

// === TYPES ===

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

// Types pour la configuration des filtres (issus de audioGraph.ts)
type FilterKey = 'lowShelf' | 'peak' | 'highShelf';

type FilterConfig = {
  type: BiquadFilterType;
  frequency?: number;
  gain?: number;
  Q?: number;
};

type PresetConfig = {
  filters: Record<FilterKey, FilterConfig>;
  mix: {
    wet: number;
    dry: number;
  };
};

type AudioGraph = {
  analyser: AnalyserNode;
  nodes: AudioNode[];
};

// === CONSTANTS ===

const PRESET: PresetConfig = {
  filters: {
    lowShelf: { type: 'lowshelf', frequency: 100, gain: 6, Q: 0.7 },
    peak: { type: 'peaking', frequency: 400, gain: 2, Q: 1.2 },
    highShelf: { type: 'highshelf', frequency: 6000, gain: -3, Q: 0.7 },
  },
  mix: { wet: 0.12, dry: 0.95 },
};

const FILTER_ORDER: FilterKey[] = ['lowShelf', 'peak', 'highShelf'];

// === AUDIO GRAPH LOGIC (ex audioGraph.ts) ===

function configureFilterNode(
  context: AudioContext,
  filter: BiquadFilterNode,
  config: FilterConfig,
) {
  const { currentTime } = context;
  if (config.frequency !== undefined) filter.frequency.setValueAtTime(config.frequency, currentTime);
  if (config.gain !== undefined) filter.gain.setValueAtTime(config.gain, currentTime);
  if (config.Q !== undefined) filter.Q.setValueAtTime(config.Q, currentTime);
}

function createFilterChain(
  context: AudioContext,
  source: AudioNode,
  filters: Record<FilterKey, FilterConfig>,
) {
  const nodes = FILTER_ORDER.reduce<BiquadFilterNode[]>((list, key) => {
    const config = filters[key];
    if (!config) return list;
    const filter = context.createBiquadFilter();
    filter.type = config.type;
    configureFilterNode(context, filter, config);
    const previous = list.length ? list[list.length - 1] : source;
    previous.connect(filter);
    return [...list, filter];
  }, []);
  const output = nodes.length ? nodes[nodes.length - 1] : source;
  return { output, nodes };
}

function createAnalyser(context: AudioContext) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.85;
  return analyser;
}

function createGain(context: AudioContext, value: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(value, context.currentTime);
  return gain;
}

function buildAudioGraph(
  context: AudioContext,
  audio: HTMLAudioElement,
): AudioGraph {
  const source = context.createMediaElementSource(audio);
  const analyser = createAnalyser(context);
  const dryGain = createGain(context, PRESET.mix.dry);
  const wetGain = createGain(context, PRESET.mix.wet);
  const { output, nodes } = createFilterChain(context, source, PRESET.filters);
  
  source.connect(dryGain); 
  output.connect(wetGain);
  
  const depthBus = context.createGain(); 
  dryGain.connect(depthBus);
  wetGain.connect(depthBus);
  
  const outputGain = createGain(context, 1);
  depthBus.connect(outputGain); 
  outputGain.connect(analyser);
  analyser.connect(context.destination);
  
  return {
    analyser,
    nodes: [source, analyser, dryGain, wetGain, depthBus, outputGain, ...nodes],
  };
}

// === AUDIO LOOP LOGIC (ex audioLoop.ts) ===

function computeLevel(buffer: Uint8Array) {
  let sum = 0;
  const { length } = buffer;
  for (let index = 0; index < length; index += 1) {
    const value = (buffer[index] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / length);
  return Math.min(1, Math.pow(rms * 3, 2));
}

function startLevelLoop(
  analyser: AnalyserNode,
  onLevel: LevelHandler,
): () => void {
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let frameId: number | null = null;
  const tick = () => {
    analyser.getByteTimeDomainData(buffer);
    onLevel(computeLevel(buffer));
    frameId = window.requestAnimationFrame(tick);
  };
  frameId = window.requestAnimationFrame(tick);
  return () => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }
  };
}

// === HOOK CORE LOGIC ===

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
  
  if (!audio.crossOrigin) {
    audio.crossOrigin = "anonymous";
  }

  const graph = buildAudioGraph(state.context, audio);
  state.analyser = graph.analyser;
  state.nodes = graph.nodes;
  state.stop = startLevelLoop(graph.analyser, onLevel);
  
  const resume = () => state.context?.resume().catch(() => undefined);
  const handleEnd = () => cleanupAudio(state, { closeContext: false }); 
  
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
  if (audio) {
    if (state.play) audio.removeEventListener('play', state.play);
    if (state.end) audio.removeEventListener('ended', state.end);
  }
  
  state.listenerAudio = state.play = state.end = null;
  
  if (state.nodes.length) {
    state.nodes.forEach((node) => {
        try { node.disconnect(); } catch (e) { /* ignore */ }
    });
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
