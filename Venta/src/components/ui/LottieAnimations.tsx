'use client';

import { useEffect } from 'react';

type AnimationHandle = {
  destroy?: () => void;
};

type LottieModule = {
  loadAnimation: (params: {
    container: HTMLElement;
    renderer: 'svg';
    loop: boolean;
    autoplay: boolean;
    path: string;
  }) => AnimationHandle;
};

type LottieAnimationsProps = {
  standbyContainerRef: React.RefObject<HTMLDivElement>;
  thinkingContainerRef: React.RefObject<HTMLDivElement>;
  speakContainerRef: React.RefObject<HTMLDivElement>;
  standbyAnimRef: React.MutableRefObject<AnimationHandle | null>;
  thinkingAnimRef: React.MutableRefObject<AnimationHandle | null>;
  speakAnimRef: React.MutableRefObject<AnimationHandle | null>;
  currentAnimation: 'standby' | 'thinking' | 'speak';
  isSpeaking: boolean;
  audioLevel: number;
  startStandbyAnimation: () => void;
};

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
    if (typeof window === 'undefined') return;
    const lottie = (window as unknown as { lottie?: LottieModule }).lottie;
    if (!lottie) return;
    const createAnimation = (container: HTMLElement, path: string) =>
      lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        path,
      });
    if (standbyContainerRef.current) {
      standbyAnimRef.current = createAnimation(
        standbyContainerRef.current,
        '/assets/standby.json',
      );
    }
    if (thinkingContainerRef.current) {
      thinkingAnimRef.current = createAnimation(
        thinkingContainerRef.current,
        '/assets/thinking.json',
      );
    }
    if (speakContainerRef.current) {
      speakAnimRef.current = createAnimation(
        speakContainerRef.current,
        '/assets/speak.json',
      );
    }
    startStandbyAnimation();
    return () => {
      standbyAnimRef.current?.destroy?.();
      thinkingAnimRef.current?.destroy?.();
      speakAnimRef.current?.destroy?.();
    };
  }, [
    standbyContainerRef,
    thinkingContainerRef,
    speakContainerRef,
    standbyAnimRef,
    thinkingAnimRef,
    speakAnimRef,
    startStandbyAnimation,
  ]);

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
  }, [
    isSpeaking,
    audioLevel,
    standbyContainerRef,
    thinkingContainerRef,
    speakContainerRef,
  ]);

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

