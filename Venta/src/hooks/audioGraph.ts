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

const PRESET: PresetConfig = {
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

const FILTER_ORDER: FilterKey[] = ['lowShelf', 'peak', 'highShelf'];

function configureFilterNode(
  context: AudioContext,
  filter: BiquadFilterNode,
  config: FilterConfig,
) {
  const { currentTime } = context;
  if (config.frequency !== undefined) {
    filter.frequency.setValueAtTime(config.frequency, currentTime);
  }
  if (config.gain !== undefined) {
    filter.gain.setValueAtTime(config.gain, currentTime);
  }
  if (config.Q !== undefined) {
    filter.Q.setValueAtTime(config.Q, currentTime);
  }
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

export function buildAudioGraph(
  context: AudioContext,
  audio: HTMLAudioElement,
): AudioGraph {
  const source = context.createMediaElementSource(audio);
  const analyser = createAnalyser(context);
  const dryGain = createGain(context, PRESET.mix.dry);
  const wetGain = createGain(context, PRESET.mix.wet);
  const { output, nodes } = createFilterChain(context, source, PRESET.filters);
  source.connect(dryGain); output.connect(wetGain);
  const depthBus = context.createGain(); dryGain.connect(depthBus);
  wetGain.connect(depthBus);
  const outputGain = createGain(context, 1);
  depthBus.connect(outputGain); outputGain.connect(analyser);
  analyser.connect(context.destination);
  return {
    analyser,
    nodes: [source, analyser, dryGain, wetGain, depthBus, outputGain, ...nodes],
  };
}

