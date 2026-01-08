'use client';

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useUIStore } from '@/lib/state/uiStore';

export interface HexagonalAnimationHandle {
  triggerWave: () => void;
}

interface HexagonalAnimationProps {
  currentAnimation: 'standby' | 'thinking' | 'speak';
  isSpeaking: boolean;
  getAudioLevel: () => number;
  mode?: 'sleep' | 'awake';
}

export const HexagonalAnimation = forwardRef<HexagonalAnimationHandle, HexagonalAnimationProps>(({
  currentAnimation,
  isSpeaking,
  getAudioLevel,
  mode = 'awake'
}, ref) => {
  const wavesSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerHexRef = useRef<SVGGElement>(null);
  const outerHexRef = useRef<SVGPolygonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastWaveTimeRef = useRef<number>(0);
  const bounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Initialisation à #333333 (gris foncé) pour éviter le flash blanc au chargement
  const [hexColor, setHexColor] = useState('#333333');
  const [isBreathingIn, setIsBreathingIn] = useState(true);
  const [isLogoHover, setIsLogoHover] = useState(false);
  
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const isAppLocked = useUIStore((state) => state.isAppLocked);
  const isInteractive = mode !== 'sleep' && !isAppLocked;
  
  const HEX_POINTS = '0,-60.3 37.8,-31.6 37.8,31.6 0,60.3 -37.8,31.6 -37.8,-31.6';
  const MAX_WAVES = 3;
  const MAX_EYE_MOVEMENT_X = 9;
  const MAX_EYE_MOVEMENT_Y = 18;

  // Gestion de la respiration en mode SLEEP
  useEffect(() => {
    if (mode !== 'sleep') return;

    const breathe = () => {
      setIsBreathingIn((prev) => !prev);
    };

    // Cycle de respiration: 2s transition + 0.5s pause = 2.5s
    const interval = setInterval(breathe, 2500);
    return () => clearInterval(interval);
  }, [mode]);

  // Gestion de la couleur
  useEffect(() => {
    if (mode === 'sleep') {
      // Mode Sleep: Respiration Gris (#A9A9A9) <-> Gris Foncé (#333333)
      setHexColor(isBreathingIn ? '#A9A9A9' : '#333333');
      return;
    }

    // Mode Awake: Couleurs standard
    switch (currentAnimation) {
      case 'thinking':
        setHexColor('#fff9c4');
        break;
      case 'speak':
        setHexColor('#ffffff');
        break;
      case 'standby':
      default:
        setHexColor('#ffffff');
        break;
    }
  }, [currentAnimation, mode, isBreathingIn]);

  // Fonction bounce (Désactivée en mode Sleep)
  const bounceHexagons = useCallback(() => {
    if (mode === 'sleep') return; // Pas de bounce en mode sleep
    if (!innerHexRef.current || !outerHexRef.current) return;
    
    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current);
    }
    
    outerHexRef.current.style.transform = 'scale(1.05)';
    
    const currentTransform = innerHexRef.current.getAttribute('transform') || 'scale(0.25)';
    
    if (currentTransform.includes('translate')) {
      const match = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/);
      if (match) {
        const x = match[1];
        const y = match[2];
        innerHexRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(0.2625)`);
      }
    } else {
      innerHexRef.current.setAttribute('transform', 'scale(0.2625)');
    }
    
    bounceTimeoutRef.current = setTimeout(() => {
      if (outerHexRef.current) {
        outerHexRef.current.style.transform = 'scale(1)';
      }
      if (innerHexRef.current) {
        const currentTransform = innerHexRef.current.getAttribute('transform') || 'scale(0.25)';
        if (currentTransform.includes('translate')) {
          const match = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/);
          if (match) {
            const x = match[1];
            const y = match[2];
            innerHexRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(0.25)`);
          }
        } else {
          innerHexRef.current.setAttribute('transform', 'scale(0.25)');
        }
      }
    }, 150);
  }, [mode]);

  // Émettre une onde
  const emitWave = useCallback((color: string, force = false) => {
    if (mode === 'sleep' && !force) return; // Pas d'ondes en mode sleep sauf si forcé
    if (!wavesSvgRef.current) return;
    
    const currentWaves = wavesSvgRef.current.children.length;
    if (currentWaves >= MAX_WAVES) {
      if (wavesSvgRef.current.firstChild) {
        wavesSvgRef.current.firstChild.remove();
      }
    }

    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    wave.setAttribute('points', HEX_POINTS);
    wave.setAttribute('class', 'hexagon-wave');
    wave.style.fill = 'none';
    wave.style.stroke = color;
    wave.style.strokeWidth = '4';
    wave.style.vectorEffect = 'non-scaling-stroke';
    wave.style.opacity = '0.9';
    wave.style.transformOrigin = '50% 50%';
    wave.style.transformBox = 'fill-box';
    wave.style.animation = 'hexagon-wave-animation 2s ease-out forwards';
    
    wavesSvgRef.current.appendChild(wave);
    bounceHexagons();
    
    setTimeout(() => {
      try { wave.remove(); } catch (_error) {}
    }, 2000);
  }, [bounceHexagons, mode]);

  // Gestion du clic pour changer de mode
  const handleClick = () => {
    if (mode === 'sleep' || isAppLocked) return;
    
    if (viewMode === 'dashboard') {
      setViewMode('messaging');
    } else {
      setViewMode('dashboard');
    }
  };

  // Suivre la souris (Désactivé en mode Sleep ou Thinking)
  useEffect(() => {
    if (mode === 'sleep') return; // Pas de suivi en mode sleep

    let cachedRect: DOMRect | null = null;
    const updateRect = () => {
      if (containerRef.current) {
        cachedRect = containerRef.current.getBoundingClientRect();
      }
    };
    
    updateRect();
    const recalcInterval = setInterval(updateRect, 500);
    
    const handleMouseMove = (e: MouseEvent) => {
      // Désactiver le suivi de souris pendant l'animation "thinking" ou "speak"
      if (currentAnimation === 'speak' || currentAnimation === 'thinking') return;
      
      if (!cachedRect || !innerHexRef.current) return;
      
      const centerX = cachedRect.left + cachedRect.width / 2;
      const centerY = cachedRect.top + cachedRect.height / 2;
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > 0) {
        const normalizedX = Math.min(Math.abs(deltaX) / (cachedRect.width / 2), 1);
        const normalizedY = Math.min(Math.abs(deltaY) / (cachedRect.height / 2), 1);
        const movementX = normalizedX * MAX_EYE_MOVEMENT_X * Math.sign(deltaX);
        const movementY = normalizedY * MAX_EYE_MOVEMENT_Y * Math.sign(deltaY);
        
        innerHexRef.current.setAttribute('transform', `translate(${movementX}, ${movementY}) scale(0.25)`);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(recalcInterval);
    };
  }, [currentAnimation, mode]);

  // Animation "Thinking" (Regard aux 4 coins)
  useEffect(() => {
    if (currentAnimation !== 'thinking' || mode === 'sleep') return;

    // Séquence: Bas Droite -> Bas Gauche -> Haut Droite -> Haut Gauche
    const sequence = [
      { x: MAX_EYE_MOVEMENT_X, y: MAX_EYE_MOVEMENT_Y },   // Coin droite bas
      { x: -MAX_EYE_MOVEMENT_X, y: MAX_EYE_MOVEMENT_Y },  // Coin gauche bas
      { x: MAX_EYE_MOVEMENT_X, y: -MAX_EYE_MOVEMENT_Y },  // Coin droite haut
      { x: -MAX_EYE_MOVEMENT_X, y: -MAX_EYE_MOVEMENT_Y }, // Coin gauche haut
    ];

    let step = 0;

    const animateThinking = () => {
      if (!innerHexRef.current) return;
      
      const pos = sequence[step];
      // On applique la translation tout en gardant l'échelle de 0.25
      innerHexRef.current.setAttribute('transform', `translate(${pos.x}, ${pos.y}) scale(0.25)`);
      
      // Passage à l'étape suivante
      step = (step + 1) % sequence.length;
    };

    // Lancer la première étape immédiatement
    animateThinking();

    // Changer de position toutes les 800ms
    const interval = setInterval(animateThinking, 800);

    return () => clearInterval(interval);
  }, [currentAnimation, mode]);

  // Centrer l'hexagone quand l'IA parle
  useEffect(() => {
    if (currentAnimation === 'speak' && innerHexRef.current) {
      innerHexRef.current.setAttribute('transform', 'scale(0.25)');
    }
  }, [currentAnimation]);

  // Audio Visualizer
  useEffect(() => {
    if (mode === 'sleep') return; // Pas de visualizer en mode sleep
    if (currentAnimation === 'speak' && isSpeaking) {
      const animate = () => {
        const now = Date.now();
        const threshold = 0.05;
        const currentAudioLevel = getAudioLevel();
        if (currentAudioLevel > threshold) {
          const minInterval = 25;
          const maxInterval = 250;
          const normalizedLevel = Math.min(1, Math.max(0, (currentAudioLevel - threshold) / (1 - threshold)));
          const interval = maxInterval - (normalizedLevel * (maxInterval - minInterval));
          
          if (now - lastWaveTimeRef.current >= interval) {
            emitWave(hexColor);
            lastWaveTimeRef.current = now;
          }
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastWaveTimeRef.current = 0;
    }
  }, [currentAnimation, isSpeaking, getAudioLevel, hexColor, emitWave, mode]);

  // Exposer la méthode triggerWave
  useImperativeHandle(ref, () => ({
    triggerWave: () => {
      // Forcer une vague blanche
      emitWave('#ffffff', true);
    }
  }));

  return (
    <>
      <style jsx global>{`
        @keyframes hexagon-wave-animation {
          0% { transform: scale(1) translateZ(0); opacity: 0.9; }
          100% { transform: scale(12) translateZ(0); opacity: 0; }
        }
      `}</style>
      
      <div 
        ref={containerRef} 
        className={`relative w-[90vmin] md:w-[min(78vmin,900px)] aspect-square transition-all duration-500 ease-out ${
          viewMode === 'messaging' ? 'translate-y-[-38vh] scale-[0.35] md:scale-[0.40]' : ''
        }`}
      >
        {/* Wrapper de hover: plein-size + origin-center pour grossir sans décaler */}
        <div
          className={
            isInteractive
              ? `absolute inset-0 origin-center transition-transform duration-200 ease-out ${isLogoHover ? 'scale-[1.05]' : ''}`
              : 'absolute inset-0'
          }
        >
        <div 
          className="absolute inset-0 m-auto w-full h-full grid place-items-center"
          style={{ scale: '0.25', willChange: 'transform', transform: 'translateZ(0)' }}
        >
          <svg 
            ref={wavesSvgRef}
            className="w-full h-full overflow-visible"
            viewBox="-50 -60.3 100 120.6" 
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          />
        </div>

        <div 
          className="absolute inset-0 m-auto w-full h-full grid place-items-center transition-colors duration-500"
          style={{ scale: '0.25', willChange: 'transform', transform: 'translateZ(0)' }}
        >
          <svg 
            className="w-full h-full overflow-visible" 
            viewBox="-50 -60.3 100 120.6" 
            fill="none" 
            preserveAspectRatio="xMidYMid meet"
            aria-label="Logo hexagonal"
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b1"/>
                <feMerge>
                  <feMergeNode in="b1"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <polygon 
              ref={outerHexRef}
              points={HEX_POINTS}
              stroke={hexColor}
              strokeWidth="12" 
              filter={mode === 'awake' ? "url(#glow)" : undefined} // Pas de glow en sleep
              opacity="0.98"
              className="transition-colors duration-500" // Transition douce des couleurs
              style={{ 
                willChange: 'stroke',
                transformOrigin: '50% 50%',
                transformBox: 'fill-box',
                transition: mode === 'sleep' ? 'stroke 2s ease-in-out' : 'transform 0.15s ease-out'
              }}
            />
            
            <g 
              ref={innerHexRef}
              transform="scale(0.25)"
              style={{
                transition: 'transform 0.15s ease-out',
                transformOrigin: '50% 50%',
                transformBox: 'fill-box'
              }}
            >
              <polygon 
                points="0,-67 42,-35 42,35 0,67 -42,35 -42,-35"
                stroke={hexColor}
                strokeWidth="40" 
                filter={mode === 'awake' ? "url(#glow)" : undefined}
                opacity="0.98"
                className="transition-colors duration-500"
                style={{ 
                  willChange: 'stroke',
                  transition: mode === 'sleep' ? 'stroke 2s ease-in-out' : undefined
                }}
              />
            </g>
          </svg>
        </div>

        {/* Zone de clic agrandie pour le mode mobile/messagerie */}
        <button
          type="button"
          aria-label="Basculer affichage"
          className={`absolute z-50 bg-transparent rounded-full transition-all duration-500 ease-out ${
            // Réduction ~20% de la hitbox:
            // - Dashboard: 80% -> 64% (inset 10% -> 18%)
            // - Messaging: 144% -> ~115% (-22% -> ~-8%)
            viewMode === 'messaging' ? '-inset-[8%]' : 'inset-[18%]'
          } ${isInteractive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
          onClick={handleClick}
          onMouseEnter={() => isInteractive && setIsLogoHover(true)}
          onMouseLeave={() => setIsLogoHover(false)}
          onFocus={() => isInteractive && setIsLogoHover(true)}
          onBlur={() => setIsLogoHover(false)}
        />
        </div>
      </div>
    </>
  );
});

HexagonalAnimation.displayName = 'HexagonalAnimation';
