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
  preDelay?: number;
  impulse: {
    duration: number;
    decay: number;
    highCut: number;
  };
  filters: Record<'lowShelf' | 'peak' | 'highShelf', FilterConfig>;
  mix: {
    wet: number;
    dry: number;
  };
};

const REVERB_PRESET: PresetConfig = {
  description: 'Réverbération ample et brillante simulant une église.',
  preDelay: 0.055,
  impulse: {
    duration: 3.5,
    decay: 3.4,
    highCut: 12000,
  },
  filters: {
    lowShelf: {
      type: 'lowshelf',
      frequency: 150,
      gain: -1,
    },
    peak: {
      type: 'peaking',
      frequency: 2000,
      gain: 4,
      Q: 0.9,
    },
    highShelf: {
      type: 'highshelf',
      frequency: 6000,
      gain: 1,
    },
  },
  mix: {
    wet: 0.6,
    dry: 0.4,
  },
};

const DEPTH_PRESET: PresetConfig = {
  description: 'Effet chaud et grave simulant une voix proche et profonde.',
  impulse: {
    duration: 1.2,
    decay: 1.8,
    highCut: 8000,
  },
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

const createImpulseResponse = (context: AudioContext, duration: number, decay: number) => {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const position = length - i;
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(position / length, decay);
    }
  }
  return impulse;
};

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

  const disconnectNodes = () => {
    nodesRef.current.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    nodesRef.current = [];
  };

  const setupAudioVisualization = useCallback((audio: HTMLAudioElement, onLevelUpdate: (level: number) => void) => {
    const audioContext = ensureAudioContext();
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

    // Réverbération (eglise_3)
    const wetDelay = audioContext.createDelay();
    wetDelay.delayTime.setValueAtTime(REVERB_PRESET.preDelay ?? 0, audioContext.currentTime);

    const convolver = audioContext.createConvolver();
    convolver.buffer = createImpulseResponse(audioContext, REVERB_PRESET.impulse.duration, REVERB_PRESET.impulse.decay);

    const reverbHighCut = audioContext.createBiquadFilter();
    reverbHighCut.type = 'lowpass';
    reverbHighCut.frequency.setValueAtTime(REVERB_PRESET.impulse.highCut, audioContext.currentTime);

    depthBus.connect(wetDelay);
    wetDelay.connect(convolver);
    convolver.connect(reverbHighCut);

    const reverbFilterChain = applyFilterChain(audioContext, reverbHighCut, REVERB_PRESET.filters);

    const wetGain = audioContext.createGain();
    wetGain.gain.setValueAtTime(REVERB_PRESET.mix.wet, audioContext.currentTime);
    reverbFilterChain.output.connect(wetGain);

    const dryGain = audioContext.createGain();
    dryGain.gain.setValueAtTime(REVERB_PRESET.mix.dry, audioContext.currentTime);
    depthBus.connect(dryGain);

    dryGain.connect(analyser);
    wetGain.connect(analyser);
    analyser.connect(audioContext.destination);

    analyserRef.current = analyser;
    nodesRef.current = [
      source,
      analyser,
      depthDryGain,
      depthWetGain,
      depthBus,
      wetDelay,
      convolver,
      reverbHighCut,
      wetGain,
      dryGain,
      ...depthFilterChain.nodes,
      ...reverbFilterChain.nodes,
    ];

    startVisualizationLoop(analyser, onLevelUpdate);

    audio.onplay = () => {
      try {
        audioContext.resume();
      } catch {}
    };
    audio.onended = () => {
      stopVisualization();
      disconnectNodes();
    };
  }, [ensureAudioContext]);

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

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
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
