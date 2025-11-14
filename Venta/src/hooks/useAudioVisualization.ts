/**
 * Hook pour la visualisation audio - max 5 fonctions, max 20 lignes
 */
import { useRef, useCallback } from 'react';

type FilterConfig = {
  type: BiquadFilterType;
  frequency?: number;
  gain?: number;
  Q?: number;
};

type PresetConfig = {
  description: string;
  filters: Record<'lowShelf' | 'peak' | 'highShelf', FilterConfig>;
  mix: {
    wet: number;
    dry: number;
  };
};

const DEPTH_PRESET: PresetConfig = {
  description: 'Effet chaud et grave simulant une voix proche et profonde.',
  filters: {
    lowShelf: {
      type: 'lowshelf',
      frequency: 100,
      gain: 6,
      Q: 0.7,
    },
    peak: {
      type: 'peaking',
      frequency: 400,
      gain: 2,
      Q: 1.2,
    },
    highShelf: {
      type: 'highshelf',
      frequency: 6000,
      gain: -3,
      Q: 0.7,
    },
  },
  mix: {
    wet: 0.12,
    dry: 0.95,
  },
};

const FILTER_ORDER: Array<'lowShelf' | 'peak' | 'highShelf'> = ['lowShelf', 'peak', 'highShelf'];

const applyFilterChain = (
  context: AudioContext,
  sourceNode: AudioNode,
  filters: Record<'lowShelf' | 'peak' | 'highShelf', FilterConfig>,
) => {
  let currentNode: AudioNode = sourceNode;
  const createdNodes: BiquadFilterNode[] = [];

  FILTER_ORDER.forEach((key) => {
    const config = filters[key];
    if (!config) return;

    const filter = context.createBiquadFilter();
    filter.type = config.type;
    if (config.frequency !== undefined) {
      filter.frequency.setValueAtTime(config.frequency, context.currentTime);
    }
    if (config.gain !== undefined) {
      filter.gain.setValueAtTime(config.gain, context.currentTime);
    }
    if (config.Q !== undefined) {
      filter.Q.setValueAtTime(config.Q, context.currentTime);
    }

    currentNode.connect(filter);
    currentNode = filter;
    createdNodes.push(filter);
  });

  return { output: currentNode, nodes: createdNodes };
};

export const useAudioVisualization = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  const disconnectNodes = useCallback(() => {
    nodesRef.current.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    nodesRef.current = [];
  }, []);

  const stopVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const setupAudioVisualization = useCallback((audio: HTMLAudioElement, onLevelUpdate: (level: number) => void) => {
    const audioContext = ensureAudioContext();
    stopVisualization();
    disconnectNodes();

    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;

    // Profondeur (profond_2)
    const depthDryGain = audioContext.createGain();
    depthDryGain.gain.setValueAtTime(DEPTH_PRESET.mix.dry, audioContext.currentTime);

    const depthFilterChain = applyFilterChain(audioContext, source, DEPTH_PRESET.filters);
    const depthWetGain = audioContext.createGain();
    depthWetGain.gain.setValueAtTime(DEPTH_PRESET.mix.wet, audioContext.currentTime);
    depthFilterChain.output.connect(depthWetGain);

    source.connect(depthDryGain);

    const depthBus = audioContext.createGain();
    depthDryGain.connect(depthBus);
    depthWetGain.connect(depthBus);

    const outputGain = audioContext.createGain();
    outputGain.gain.setValueAtTime(1, audioContext.currentTime);
    depthBus.connect(outputGain);

    outputGain.connect(analyser);
    analyser.connect(audioContext.destination);

    analyserRef.current = analyser;
    nodesRef.current = [
      source,
      analyser,
      depthDryGain,
      depthWetGain,
      depthBus,
      outputGain,
      ...depthFilterChain.nodes,
    ];

    startVisualizationLoop(analyser, onLevelUpdate);

    const handleAudioPlay = () => {
      try {
        audioContext.resume();
      } catch {}
    };

    const handleAudioEnded = () => {
      stopVisualization();
      disconnectNodes();
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('ended', handleAudioEnded);
    };

    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('ended', handleAudioEnded);
  }, [ensureAudioContext, stopVisualization, disconnectNodes]);

  const startVisualizationLoop = (analyser: AnalyserNode, onLevelUpdate: (level: number) => void) => {
    const bufferData = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteTimeDomainData(bufferData);
        let sum = 0;
        for (let i = 0; i < bufferData.length; i++) {
          const v = (bufferData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferData.length);
        const level = Math.min(1, Math.pow(rms * 3, 2));
        onLevelUpdate(level);
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };
    loop();
  };

  const cleanup = useCallback(() => {
    stopVisualization();
    disconnectNodes();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    setupAudioVisualization,
    cleanup,
  };
};
