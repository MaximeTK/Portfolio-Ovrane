/**
 * Hook pour la visualisation audio - max 5 fonctions, max 20 lignes
 */
import { useRef, useCallback } from 'react';

export const useAudioVisualization = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  const setupAudioVisualization = useCallback((audio: HTMLAudioElement, onLevelUpdate: (level: number) => void) => {
    const audioContext = ensureAudioContext();
    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyserRef.current = analyser;
    
    const bufferData = new Uint8Array(analyser.frequencyBinCount);
    startVisualizationLoop(bufferData, onLevelUpdate);
    
    audio.onplay = () => {
      try { audioContext.resume(); } catch {}
    };
    audio.onended = () => {
      stopVisualization();
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {}
    };
  }, [ensureAudioContext]);

  const startVisualizationLoop = (bufferData: Uint8Array, onLevelUpdate: (level: number) => void) => {
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
    }
  };

  const cleanup = useCallback(() => {
    stopVisualization();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    setupAudioVisualization,
    cleanup
  };
};
