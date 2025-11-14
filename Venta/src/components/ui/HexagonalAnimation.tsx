'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface HexagonalAnimationProps {
  currentAnimation: 'standby' | 'thinking' | 'speak';
  isSpeaking: boolean;
  audioLevel: number;
}

export function HexagonalAnimation({
  currentAnimation,
  isSpeaking,
  audioLevel
}: HexagonalAnimationProps) {
  const wavesSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerHexRef = useRef<SVGGElement>(null);
  const outerHexRef = useRef<SVGPolygonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastWaveTimeRef = useRef<number>(0);
  const bounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hexColor, setHexColor] = useState('#ffffff');
  const HEX_POINTS =
    '0,-60.3 37.8,-31.6 37.8,31.6 0,60.3 -37.8,31.6 -37.8,-31.6';
  const MAX_WAVES = 3; // Réduit de 10 à 5 pour meilleures performances
  const MAX_EYE_MOVEMENT_X = 9; // Distance maximale horizontale en unités SVG
  const MAX_EYE_MOVEMENT_Y = 18; // Distance maximale verticale en unités SVG (plus grande car l'hexagone est plus haut)

  // Mettre à jour la couleur en fonction de l'état
  useEffect(() => {
    switch (currentAnimation) {
      case 'thinking':
        setHexColor('#fff9c4'); // Jaune pâle
        break;
      case 'speak':
        setHexColor('#ffffff'); // Blanc
        break;
      case 'standby':
      default:
        setHexColor('#ffffff'); // Blanc
        break;
    }
  }, [currentAnimation]);

  // Fonction pour créer l'effet de bounce sur les hexagones
  const bounceHexagons = useCallback(() => {
    if (!innerHexRef.current || !outerHexRef.current) return;
    
    // Annuler le timeout précédent si existe
    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current);
    }
    
    // Grossir de 5% l'hexagone extérieur
    outerHexRef.current.style.transform = 'scale(1.05)';
    
    // Pour l'hexagone intérieur, on doit préserver sa transformation actuelle
    const currentTransform = innerHexRef.current.getAttribute('transform') || 'scale(0.25)';
    
    // Parser la transformation actuelle
    if (currentTransform.includes('translate')) {
      // Si l'œil suit le curseur : translate(x, y) scale(0.25)
      const match = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/);
      if (match) {
        const x = match[1];
        const y = match[2];
        innerHexRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(0.2625)`);
      }
    } else {
      // Si l'œil est centré : scale(0.25)
      innerHexRef.current.setAttribute('transform', 'scale(0.2625)');
    }
    
    // Remettre à la taille normale après 150ms
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
  }, []);

  // Fonction pour émettre une onde - optimisée avec bounce
  const emitWave = useCallback((color: string) => {
    if (!wavesSvgRef.current) return;
    
    const currentWaves = wavesSvgRef.current.children.length;
    if (currentWaves >= MAX_WAVES) {
      // Si trop d'ondes, supprimer la plus ancienne
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
    
    // Déclencher l'effet de bounce
    bounceHexagons();
    
    // Nettoyage automatique après 2s
    setTimeout(() => {
      try {
        wave.remove();
      } catch (_error) {
        // Déjà supprimé
      }
    }, 2000);
  }, [bounceHexagons]);

  // Remettre l'œil au centre quand l'IA parle
  useEffect(() => {
    if (currentAnimation === 'speak' && innerHexRef.current) {
      // L'IA parle : remettre l'œil au centre
      innerHexRef.current.setAttribute('transform', 'scale(0.25)');
    }
  }, [currentAnimation]);

  // Effet "œil qui suit le curseur" - manipulation directe du DOM pour zéro lag
  useEffect(() => {
    let cachedRect: DOMRect | null = null;
    
    // Recalculer le rect toutes les 500ms
    const updateRect = () => {
      if (containerRef.current) {
        cachedRect = containerRef.current.getBoundingClientRect();
      }
    };
    
    updateRect();
    const recalcInterval = setInterval(updateRect, 500);
    
    const handleMouseMove = (e: MouseEvent) => {
      // Ne pas suivre le curseur quand l'IA parle
      if (currentAnimation === 'speak') return;
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
        
        // Manipulation directe du DOM - pas de re-render React !
        innerHexRef.current.setAttribute(
          'transform', 
          `translate(${movementX}, ${movementY}) scale(0.25)`
        );
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(recalcInterval);
    };
  }, [currentAnimation]);

  // Audio visualizer - les ondes se déclenchent selon l'intensité audio en temps réel
  useEffect(() => {
    if (currentAnimation === 'speak' && isSpeaking) {
      const animate = () => {
        const now = Date.now();
        
        // Seuil minimum pour déclencher des ondes
        const threshold = 0.05;
        
        if (audioLevel > threshold) {
          // Visualiseur audio : plus c'est intense, moins on attend entre les ondes
          // audioLevel va de 0 à 1, on calcule un intervalle inversement proportionnel
          const minInterval = 25;  // Très intense : une onde toutes les 200ms (réduit pour performances)
          const maxInterval = 250;  // Peu intense : une onde toutes les 600ms
          
          // Formule : plus audioLevel est élevé, plus interval est petit
          const normalizedLevel = Math.min(1, Math.max(0, (audioLevel - threshold) / (1 - threshold)));
          const interval = maxInterval - (normalizedLevel * (maxInterval - minInterval));
          
          // Émettre une onde selon l'intensité actuelle
          if (now - lastWaveTimeRef.current >= interval) {
            emitWave(hexColor);
            lastWaveTimeRef.current = now;
            
            // Commenté pour améliorer les performances
            // if (audioLevel > 0.7 && Math.random() > 0.5) {
            //   setTimeout(() => emitWave(hexColor), 50);
            // }
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // Nettoyer l'animation si on n'est plus en mode speak
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastWaveTimeRef.current = 0;
    }
  }, [currentAnimation, isSpeaking, audioLevel, hexColor, emitWave]);

  return (
    <>
      <style jsx global>{`
        @keyframes hexagon-wave-animation {
          0% {
            transform: scale(1) translateZ(0);
            opacity: 0.9;
          }
          100% {
            transform: scale(12) translateZ(0);
            opacity: 0;
          }
        }
      `}</style>
      
      <div ref={containerRef} className="relative w-[min(78vmin,900px)] aspect-square">
        {/* Conteneur des ondes */}
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

        {/* Logo hexagonal */}
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
            
            {/* Hexagone extérieur */}
            <polygon 
              ref={outerHexRef}
              points={HEX_POINTS}
              stroke={hexColor}
              strokeWidth="12" 
              filter="url(#glow)" 
              opacity="0.98"
              className="transition-colors duration-500"
              style={{ 
                willChange: 'stroke',
                transformOrigin: '50% 50%',
                transformBox: 'fill-box',
                transition: 'transform 0.15s ease-out'
              }}
            />
            
            {/* Hexagone intérieur - "l'œil" qui suit le curseur */}
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
                filter="url(#glow)" 
                opacity="0.98"
                className="transition-colors duration-500"
                style={{ willChange: 'stroke' }}
              />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}

