'use client';

import { useEffect } from 'react';

interface LottieAnimationsProps {
  standbyContainerRef: React.RefObject<HTMLDivElement>;
  thinkingContainerRef: React.RefObject<HTMLDivElement>;
  speakContainerRef: React.RefObject<HTMLDivElement>;
  standbyAnimRef: React.MutableRefObject<any>;
  thinkingAnimRef: React.MutableRefObject<any>;
  speakAnimRef: React.MutableRefObject<any>;
  currentAnimation: 'standby' | 'thinking' | 'speak';
  isSpeaking: boolean;
  audioLevel: number;
  startStandbyAnimation: () => void;
}

export function LottieAnimations({
  standbyContainerRef,
  thinkingContainerRef,
  speakContainerRef,
  standbyAnimRef,
  thinkingAnimRef,
  speakAnimRef,
  currentAnimation,
  isSpeaking,
  audioLevel,
  startStandbyAnimation
}: LottieAnimationsProps) {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lottie) {
      const lottie = (window as any).lottie;
      
      const createAnimation = (container: HTMLElement, path: string, loop = true) => {
        return lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop,
          autoplay: false,
          path
        });
      };

      if (standbyContainerRef.current) {
        standbyAnimRef.current = createAnimation(standbyContainerRef.current, '/assets/standby.json', true);
      }
      if (thinkingContainerRef.current) {
        thinkingAnimRef.current = createAnimation(thinkingContainerRef.current, '/assets/thinking.json', true);
      }
      if (speakContainerRef.current) {
        speakAnimRef.current = createAnimation(speakContainerRef.current, '/assets/speak.json', true);
      }

      startStandbyAnimation();
    }
  }, []);

  useEffect(() => {
    if (isSpeaking && audioLevel > 0) {
      const minScale = 0.99;
      const maxScale = 1.05;
      const scale = minScale + (audioLevel * (maxScale - minScale));
      
      [standbyContainerRef, thinkingContainerRef, speakContainerRef].forEach(ref => {
        if (ref.current) {
          ref.current.style.transform = `scale(${scale})`;
          ref.current.style.transition = 'transform 0.1s ease-out';
        }
      });
    } else {
      [standbyContainerRef, thinkingContainerRef, speakContainerRef].forEach(ref => {
        if (ref.current) {
          ref.current.style.transform = 'scale(1)';
        }
      });
    }
  }, [isSpeaking, audioLevel]);

  return (
    <div className="w-[400px] h-[400px] drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
      <div 
        ref={standbyContainerRef}
        className={`absolute inset-0 w-full h-full will-change-transform ${currentAnimation === 'standby' ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      <div 
        ref={thinkingContainerRef}
        className={`absolute inset-0 w-full h-full will-change-transform ${currentAnimation === 'thinking' ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      <div 
        ref={speakContainerRef}
        className={`absolute inset-0 w-full h-full will-change-transform ${currentAnimation === 'speak' ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
    </div>
  );
}

