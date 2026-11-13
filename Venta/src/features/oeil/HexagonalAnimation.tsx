'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { horsAccueil, partiesIllusion, useUIStore, vueIllusion } from '@/lib/uiStore';
import { CENTRE_HEADER_PX } from '@/features/site/SiteHeader';

// Largeur du conteneur une fois l'œil logé dans le header (hexagone ~29 px)
const LARGEUR_EN_HAUT_PX = 96;
const HEX_POINTS = '0,-60.3 37.8,-31.6 37.8,31.6 0,60.3 -37.8,31.6 -37.8,-31.6';
const MAX_WAVES = 3;
const MAX_EYE_MOVEMENT_X = 9;
const MAX_EYE_MOVEMENT_Y = 18;
// Regard en réflexion : bas droite, bas gauche, haut droite, haut gauche
const THINKING_SEQUENCE = [
  { x: MAX_EYE_MOVEMENT_X, y: MAX_EYE_MOVEMENT_Y },
  { x: -MAX_EYE_MOVEMENT_X, y: MAX_EYE_MOVEMENT_Y },
  { x: MAX_EYE_MOVEMENT_X, y: -MAX_EYE_MOVEMENT_Y },
  { x: -MAX_EYE_MOVEMENT_X, y: -MAX_EYE_MOVEMENT_Y },
];

export interface HexagonalAnimationHandle {
  triggerWave: () => void;
}

export type AnimationOeil = 'standby' | 'thinking' | 'speak';

interface HexagonalAnimationProps {
  currentAnimation: AnimationOeil;
  isSpeaking: boolean;
  getAudioLevel: () => number;
  mode?: 'sleep' | 'awake';
  ref?: React.Ref<HexagonalAnimationHandle>;
}

export function HexagonalAnimation({ currentAnimation, isSpeaking, getAudioLevel, mode = 'awake', ref }: HexagonalAnimationProps) {
  const wavesSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerHexRef = useRef<SVGGElement>(null);
  const outerHexRef = useRef<SVGPolygonElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const regardRef = useRef({ x: 0, y: 0 });
  const lastWaveTimeRef = useRef(0);
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pendant son trajet de 0,5 s, l'œil ignore un nouveau clic
  const basculeRef = useRef(0);
  const [isBreathingIn, setIsBreathingIn] = useState(false);
  const [isLogoHover, setIsLogoHover] = useState(false);
  const [cible, setCible] = useState<{ y: number; echelle: number } | null>(null);

  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const isAppLocked = useUIStore((state) => state.isAppLocked);
  const page = useUIStore((state) => state.page);
  const setPage = useUIStore((state) => state.setPage);
  const awake = useUIStore((state) => state.appState === 'awake');
  const compteIllusion = useUIStore((state) => state.compteIllusion);
  const cote = useUIStore((state) => state.cote);
  const setCote = useUIStore((state) => state.setCote);
  const isSleep = mode === 'sleep';
  // Côté Illusion, son logo prend la place de l'œil, ici comme dans le header
  const illusion = cote === 'illusion' && !isSleep;
  const accueilIllusion = useUIStore((state) => partiesIllusion(state.page)?.slug === 'accueil');
  // Page ou messagerie : l'emblème monte ; les deux accueils le gardent au centre
  const horsDuCentre = useUIStore((state) => horsAccueil(state) && partiesIllusion(state.page)?.slug !== 'accueil');
  const enHaut = !isSleep && horsDuCentre;
  const isInteractive = !isSleep && !isAppLocked;
  // Endormi : deux gris ; éveillé : blanc ; en réflexion : jaune pâle
  const hexColor = isSleep ? (isBreathingIn ? '#A9A9A9' : '#333333') : currentAnimation === 'thinking' ? '#fff9c4' : '#ffffff';
  const libelle = illusion
    ? accueilIllusion ? "Illusion · clic droit : accueil d'Ovrane" : "Illusion : accueil"
    : page ? "Revenir à l'accueil" : viewMode === 'messaging' ? 'Fermer la messagerie' : 'Ouvrir la messagerie';

  // L'œil d'intro respire jusqu'au réveil : 2 s de transition, 0,5 s de pause
  useEffect(() => {
    if (!isSleep || awake) return;
    const respirer = () => setIsBreathingIn((v) => !v);
    respirer();
    const interval = setInterval(respirer, 2500);
    return () => clearInterval(interval);
  }, [isSleep, awake]);

  // Le parent n'est jamais transformé : son centre est le repos de l'œil
  useEffect(() => {
    const conteneur = containerRef.current;
    if (isSleep || !conteneur) return;
    const mesurerRect = () => {
      rectRef.current = conteneur.getBoundingClientRect();
    };
    const mesurer = () => {
      mesurerRect();
      const repos = conteneur.parentElement?.getBoundingClientRect();
      if (repos) setCible({ y: CENTRE_HEADER_PX - (repos.top + repos.height / 2), echelle: LARGEUR_EN_HAUT_PX / conteneur.offsetWidth });
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    // Œil monté ou redescendu : le suivi de la souris repart de sa nouvelle place
    conteneur.addEventListener('transitionend', mesurerRect);
    return () => {
      window.removeEventListener('resize', mesurer);
      conteneur.removeEventListener('transitionend', mesurerRect);
    };
  }, [isSleep]);

  const placerOeil = useCallback((x: number, y: number, echelle = 0.25) => {
    regardRef.current = { x, y };
    innerHexRef.current?.setAttribute('transform', `translate(${x}, ${y}) scale(${echelle})`);
  }, []);

  const bounceHexagons = useCallback(() => {
    if (isSleep || !outerHexRef.current) return;
    if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    outerHexRef.current.style.transform = 'scale(1.05)';
    placerOeil(regardRef.current.x, regardRef.current.y, 0.2625);
    bounceTimeoutRef.current = setTimeout(() => {
      if (outerHexRef.current) outerHexRef.current.style.transform = 'scale(1)';
      placerOeil(regardRef.current.x, regardRef.current.y);
    }, 150);
  }, [isSleep, placerOeil]);

  // Onde hexagonale ; endormi, seulement si elle est forcée
  const emitWave = useCallback((color: string, force = false) => {
    const ondes = wavesSvgRef.current;
    if ((isSleep && !force) || !ondes) return;
    if (ondes.children.length >= MAX_WAVES) ondes.firstChild?.remove();
    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    wave.setAttribute('points', HEX_POINTS);
    wave.setAttribute('class', 'hexagon-wave');
    wave.style.stroke = color;
    ondes.appendChild(wave);
    bounceHexagons();
    setTimeout(() => wave.remove(), 2000);
  }, [bounceHexagons, isSleep]);

  const handleClick = () => {
    if (!isInteractive || performance.now() - basculeRef.current < 500) return;
    basculeRef.current = performance.now();
    // Côté Illusion, le logo ramène à l'accueil d'Illusion
    if (illusion) {
      if (!accueilIllusion) setPage(vueIllusion('accueil'));
      return;
    }
    // Depuis une page, l'œil ramène à l'écran de base, sans toucher à la session
    if (page) setPage(null);
    else setViewMode(viewMode === 'dashboard' ? 'messaging' : 'dashboard');
  };

  // Clic droit : l'autre côté, sur place ; au centre, d'un accueil à l'autre
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isInteractive || !compteIllusion) return;
    e.preventDefault();
    if (illusion) {
      if (accueilIllusion) setPage(null);
      else setCote('ovrane');
    } else if (enHaut) setCote('illusion');
    else setPage(vueIllusion('accueil'));
  };

  // Le regard suit la souris, sauf endormi, en réflexion ou en parole
  useEffect(() => {
    if (isSleep || currentAnimation !== 'standby') return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = rectRef.current;
      if (!rect) return;
      const deltaX = e.clientX - (rect.left + rect.width / 2);
      const deltaY = e.clientY - (rect.top + rect.height / 2);
      placerOeil(
        Math.min(Math.abs(deltaX) / (rect.width / 2), 1) * MAX_EYE_MOVEMENT_X * Math.sign(deltaX),
        Math.min(Math.abs(deltaY) / (rect.height / 2), 1) * MAX_EYE_MOVEMENT_Y * Math.sign(deltaY),
      );
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [currentAnimation, isSleep, placerOeil]);

  // En parole il se centre ; en réflexion il regarde les coins toutes les 800 ms
  useEffect(() => {
    if (currentAnimation === 'speak') placerOeil(0, 0);
    if (isSleep || currentAnimation !== 'thinking') return;
    let step = 0;
    const regarder = () => {
      const { x, y } = THINKING_SEQUENCE[step++ % THINKING_SEQUENCE.length];
      placerOeil(x, y);
    };
    regarder();
    const interval = setInterval(regarder, 800);
    return () => clearInterval(interval);
  }, [currentAnimation, isSleep, placerOeil]);

  // Ondes au rythme de la voix : plus elle est forte, plus elles se rapprochent
  useEffect(() => {
    lastWaveTimeRef.current = 0;
    if (isSleep || currentAnimation !== 'speak' || !isSpeaking) return;
    const threshold = 0.05;
    let frame = 0;
    const animate = () => {
      const level = getAudioLevel();
      if (level > threshold) {
        const interval = 250 - Math.min(1, (level - threshold) / (1 - threshold)) * 225;
        const now = Date.now();
        if (now - lastWaveTimeRef.current >= interval) {
          emitWave(hexColor);
          lastWaveTimeRef.current = now;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [currentAnimation, isSpeaking, getAudioLevel, hexColor, emitWave, isSleep]);

  useImperativeHandle(ref, () => ({ triggerWave: () => emitWave('#ffffff', true) }), [emitWave]);

  return (
    <div
      ref={containerRef}
      className="relative w-[90vmin] md:w-[min(78vmin,900px)] aspect-square transition-all duration-500 ease-out"
      style={enHaut && cible ? { transform: `translateY(${cible.y}px) scale(${cible.echelle})` } : undefined}
    >
      {/* Survol : grossit sur place, depuis le centre */}
      <div
        className={
          isInteractive
            ? `absolute inset-0 origin-center transition-transform duration-200 ease-out ${isLogoHover ? 'scale-[1.05]' : ''}`
            : 'absolute inset-0'
        }
      >
        <div
          className={`absolute inset-0 m-auto w-full h-full grid place-items-center transition-opacity duration-200 ${illusion ? 'opacity-0' : ''}`}
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
          className={`absolute inset-0 m-auto w-full h-full grid place-items-center transition-opacity duration-200 ${illusion ? 'opacity-0' : ''}`}
          style={{ scale: '0.25', willChange: 'transform', transform: 'translateZ(0)' }}
        >
          {/* data-cache : l'œil effacé, le fond vivant ne le protège plus */}
          <svg
            className="w-full h-full overflow-visible"
            viewBox="-50 -60.3 100 120.6"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            data-cache={illusion || undefined}
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b1" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <polygon
              ref={outerHexRef}
              points={HEX_POINTS}
              stroke={hexColor}
              strokeWidth="12"
              // Néon au survol seulement
              filter={!isSleep && isLogoHover ? 'url(#glow)' : undefined}
              opacity="0.98"
              className="transition-colors duration-500"
              style={{
                willChange: 'stroke',
                transformOrigin: '50% 50%',
                transformBox: 'fill-box',
                transition: isSleep ? 'stroke 2s ease-in-out' : 'transform 0.15s ease-out',
              }}
            />

            <g
              ref={innerHexRef}
              transform="scale(0.25)"
              style={{ transition: 'transform 0.15s ease-out', transformOrigin: '50% 50%', transformBox: 'fill-box' }}
            >
              <polygon
                points="0,-67 42,-35 42,35 0,67 -42,35 -42,-35"
                stroke={hexColor}
                strokeWidth="40"
                filter={!isSleep && isLogoHover ? 'url(#glow)' : undefined}
                opacity="0.98"
                className="transition-colors duration-500"
                style={{ willChange: 'stroke', transition: isSleep ? 'stroke 2s ease-in-out' : undefined }}
              />
            </g>
          </svg>
        </div>

        {/* Logo d'Illusion : place, trajet et survol de l'œil ; le fond suit sa forme */}
        <svg
          className={`absolute left-1/2 top-1/2 w-[22.4%] -translate-x-1/2 -translate-y-1/2 overflow-visible transition-[opacity,filter] duration-200 ${illusion ? '' : 'opacity-0'}`}
          style={illusion && isLogoHover ? { filter: 'drop-shadow(0 0 4px #fff) drop-shadow(0 0 12px rgb(255 255 255 / .7))' } : undefined}
          viewBox="0 0 325.934 274.525"
          fill="none"
          stroke="#fff"
          aria-hidden="true"
          data-protege={illusion ? 'logo' : undefined}
        >
          <path d="M9.4632 262.426L112.954 181.479V19.5844" strokeWidth="30.72" />
          <path d="M316.471 262.426L212.98 181.479V19.5844" strokeWidth="30.72" />
          <path d="M163.063 262.272V161.894V0" strokeWidth="30.72" />
        </svg>

        {/* Zone de clic : plus serrée quand l'œil est logé dans le header */}
        <button
          type="button"
          aria-label={libelle}
          className={`absolute z-50 rounded-full bg-transparent outline-none transition-all duration-500 ease-out focus-visible:outline-solid focus-visible:outline-white/70 ${
            enHaut ? 'inset-[30%] focus-visible:outline-[14px]' : 'inset-[18%] focus-visible:outline-2 focus-visible:outline-offset-4'
          } ${isInteractive ? 'cursor-pointer pointer-events-auto' : 'cursor-default pointer-events-none'}`}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => isInteractive && setIsLogoHover(true)}
          onMouseLeave={() => setIsLogoHover(false)}
          onFocus={() => isInteractive && setIsLogoHover(true)}
          onBlur={() => setIsLogoHover(false)}
        />
      </div>
    </div>
  );
}
