type LevelHandler = (level: number) => void;

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

export function startLevelLoop(
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

