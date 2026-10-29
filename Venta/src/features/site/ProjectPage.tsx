'use client';

import { useEffect, useState, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import Image from 'next/image';
import type { Bloc, Projet, Scene, Visuel } from './projets';
import { useUIStore } from '@/lib/uiStore';

export const ETIQUETTE = 'text-[10px] font-bold uppercase tracking-[0.25em] text-white/60';

// Bloc en verre (Figma 333-2359) : la classe .verre et le calque de ses halos, toujours premier enfant
export function Verre<T extends ElementType = 'div'>({
  as,
  className = '',
  children,
  ...props
}: { as?: T; className?: string; children?: ReactNode } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>) {
  const Balise: ElementType = as ?? 'div';
  return (
    <Balise className={`verre ${className}`} {...props}>
      <span className="verre-halos" aria-hidden="true" />
      {children}
    </Balise>
  );
}
const PARAGRAPHE = 'max-w-[68ch] text-[15px] leading-relaxed text-white/80 md:text-base';

const GRILLE = { 1: '', 2: 'sm:grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' } as const;
const TAILLES = { 1: '(min-width: 1024px) 900px, 100vw', 2: '(min-width: 640px) 450px, 100vw', 3: '(min-width: 768px) 300px, 50vw', 4: '(min-width: 768px) 220px, 50vw' } as const;

// Met en gras les passages entre ** **
function Riche({ texte }: { texte: string }) {
  return <>{texte.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <strong key={i} className="font-semibold text-white">{t}</strong> : t))}</>;
}

function Figure({ image, colonnes }: { image: Visuel; colonnes: 1 | 2 | 3 | 4 }) {
  return (
    <figure className="flex flex-col gap-2">
      <a href={encodeURI(image.src)} target="_blank" rel="noopener" title="Ouvrir en taille réelle" className="block overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-white/30">
        <Image src={image.src} alt={image.alt} width={image.w} height={image.h} sizes={TAILLES[colonnes]} className="h-auto w-full" />
        <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
      </a>
      {image.legende && <figcaption className="text-xs text-white/60">{image.legende}</figcaption>}
    </figure>
  );
}

function RenduBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case 'texte':
      return <div className="space-y-4">{bloc.paragraphes.map((p, i) => <p key={i} className={PARAGRAPHE}><Riche texte={p} /></p>)}</div>;
    case 'points':
      return (
        <ul className={`grid gap-x-8 gap-y-5 ${bloc.items.length % 3 === 0 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {bloc.items.map((it) => (
            <li key={it.titre} className="border-l border-white/20 pl-4">
              <p className="font-semibold text-white">{it.titre}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{it.texte}</p>
            </li>
          ))}
        </ul>
      );
    case 'visuels': {
      const colonnes = bloc.colonnes ?? 1;
      return (
        <div className="space-y-3">
          <div className={`grid gap-4 ${GRILLE[colonnes]}`}>{bloc.images.map((img) => <Figure key={img.src} image={img} colonnes={colonnes} />)}</div>
          {bloc.legende && <p className="max-w-[68ch] text-sm text-white/60">{bloc.legende}</p>}
        </div>
      );
    }
    case 'chiffres':
      return (
        <dl className={`grid grid-cols-2 gap-6 ${bloc.items.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {bloc.items.map((c) => (
            <div key={c.libelle} className="border-t border-white/15 pt-4">
              <dt className="sr-only">{c.libelle}</dt>
              <dd className="text-3xl font-semibold tabular-nums tracking-tight text-white md:text-4xl">{c.valeur}</dd>
              <dd className="mt-1 text-sm text-white/60">{c.libelle}</dd>
            </div>
          ))}
        </dl>
      );
    case 'etapes':
      return (
        <ol className={`grid gap-3 sm:grid-cols-2 ${bloc.items.length === 3 ? 'lg:grid-cols-3' : bloc.items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}>
          {bloc.items.map((e, i) => (
            <Verre as="li" key={e.titre} className="p-4">
              <span className="font-mono text-xs text-white/50">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-2 font-semibold text-white">{e.titre}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{e.texte}</p>
            </Verre>
          ))}
        </ol>
      );
    case 'barres': {
      const max = Math.max(...bloc.items.map((b) => b.valeur));
      return (
        <figure className="space-y-3">
          <figcaption className={ETIQUETTE}>{bloc.titre}</figcaption>
          <ul className="space-y-1.5">
            {bloc.items.map((b, i) => (
              <li key={b.libelle} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm md:grid-cols-[11rem_1fr_3rem]">
                <span className="truncate text-right text-white/70">{b.libelle}</span>
                <span className="h-3 rounded-sm bg-white/[0.06]">
                  <span className={`block h-full rounded-sm ${i < 2 ? 'bg-white/80' : 'bg-white/30'}`} style={{ width: `${(b.valeur / max) * 100}%` }} />
                </span>
                <span className="font-mono tabular-nums text-white/80">{b.valeur}{bloc.unite ?? ''}</span>
              </li>
            ))}
          </ul>
          {bloc.note && <p className="max-w-[68ch] text-sm text-white/60">{bloc.note}</p>}
        </figure>
      );
    }
    case 'decisions':
      return (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {bloc.items.map((d) => (
            <div key={d.question} className="grid gap-3 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
              <h3 className="font-semibold text-white">{d.question}</h3>
              <dl className="space-y-2 text-sm leading-relaxed">
                <div><dt className={`${ETIQUETTE} inline`}>Choix<span aria-hidden="true"> · </span></dt><dd className="inline text-white">{d.choix}</dd></div>
                <div><dt className={`${ETIQUETTE} inline`}>Pourquoi<span aria-hidden="true"> · </span></dt><dd className="inline text-white/75">{d.pourquoi}</dd></div>
                {d.ecarte && <div><dt className={`${ETIQUETTE} inline`}>Écarté<span aria-hidden="true"> · </span></dt><dd className="inline text-white/60">{d.ecarte}</dd></div>}
              </dl>
            </div>
          ))}
        </div>
      );
    case 'encadre':
      return (
        <Verre as="aside" className="max-w-3xl p-5 md:p-6">
          <p className={ETIQUETTE}>{bloc.titre}</p>
          <p className="mt-2 leading-relaxed text-white/85">{bloc.texte}</p>
        </Verre>
      );
  }
}

// Premier écran : les mots touchés deviennent une phrase, et les touches économisées se comptent en points
function ScenePremierEcran({ scene, nom }: { scene: Scene; nom: string }) {
  const points = (n: number, vif: boolean) => (
    <span aria-hidden="true" className="mt-3 flex gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${vif ? 'bg-white drop-shadow-[0_0_3px_#fff]' : 'bg-white/30'}`} />
      ))}
    </span>
  );
  return (
    <Verre as="figure" className="mt-8 p-5 md:p-7">
      <figcaption className="sr-only">Exemple : les mots {scene.mots.join(', ')} deviennent « {scene.phrase} »</figcaption>
      <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
        {scene.mots.map((mot) => (
          <span key={mot} className="rounded-xl bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider text-[#1f2140]">{mot}</span>
        ))}
        <span className="px-1 text-2xl text-white/60">→</span>
        <span className="text-xl font-semibold leading-snug text-white md:text-2xl">« {scene.phrase} »</span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-white/10 pt-5">
        <div>
          <dt className={ETIQUETTE}>Aujourd’hui</dt>
          <dd className="mt-1 text-lg font-semibold text-white/70 md:text-2xl">{scene.avant.libelle}</dd>
          <dd>{points(scene.avant.touches, false)}</dd>
        </div>
        <div>
          <dt className={ETIQUETTE}>Avec {nom}</dt>
          <dd className="mt-1 text-lg font-semibold text-white md:text-2xl">{scene.apres.libelle}</dd>
          <dd>{points(scene.apres.touches, true)}</dd>
        </div>
      </dl>
    </Verre>
  );
}

// Temps de lecture à 200 mots par minute
function minutesDeLecture(projet: Projet) {
  const mots = JSON.stringify(projet.sections).split(/\s+/).length;
  return Math.max(1, Math.round(mots / 200));
}

// Fait défiler la vue jusqu'à une section sans toucher à l'URL
export function allerA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export function ProjectPage({ projet, rang, total, suivant }: { projet: Projet; rang: number; total: number; suivant: Projet }) {
  const setPage = useUIStore((s) => s.setPage);
  const ancre = (id: string) => `${projet.slug}-${id}`;
  const [l1, l2, l3] = projet.tldr.libelles ?? ['Problème', 'Solution', 'Impact'];
  // Un article nommé par son titre : les lecteurs d'écran y sautent directement
  return (
      <article aria-labelledby={ancre('titre')} className="mx-auto max-w-4xl px-4 pb-24 pt-28 font-sans text-white md:px-8">
        <header>
          <p className={ETIQUETTE}>Étude de cas · {String(rang).padStart(2, '0')} / {String(total).padStart(2, '0')} · {minutesDeLecture(projet)} min de lecture</p>
          <h1 id={ancre('titre')} className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{projet.titre}</h1>
          <p className="mt-4 max-w-3xl text-base text-white/70 md:text-lg">{projet.accroche}</p>

          {projet.scene && <ScenePremierEcran scene={projet.scene} nom={projet.nom} />}

          <Verre className="mt-8 grid divide-y divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
            {([[l1, projet.tldr.probleme], [l2, projet.tldr.solution], [l3, projet.tldr.impact]] as const).map(([titre, texte]) => (
              <div key={titre} className="p-5">
                <p className={ETIQUETTE}>{titre}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{texte}</p>
              </div>
            ))}
          </Verre>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
            {projet.fiche.map((f) => (
              <div key={f.libelle}>
                <dt className={ETIQUETTE}>{f.libelle}</dt>
                <dd className="mt-1 text-sm text-white/85">{f.valeur}</dd>
              </div>
            ))}
          </dl>

          {projet.couverture && (
            <div className="mt-10">
              <Image src={projet.couverture.src} alt={projet.couverture.alt} width={projet.couverture.w} height={projet.couverture.h} sizes="(min-width: 896px) 832px, 100vw" className="h-auto w-full rounded-2xl border border-white/10" />
            </div>
          )}
        </header>

        <div className="mt-12">
            {projet.sections.map((s, i) => (
              <section key={s.id} id={ancre(s.id)} aria-labelledby={`${ancre(s.id)}-titre`} className="scroll-mt-24 border-t border-white/10 py-12 md:py-16">
                <p className={ETIQUETTE}>{String(i + 1).padStart(2, '0')} · {s.etape}</p>
                <h2 id={`${ancre(s.id)}-titre`} className="mt-3 max-w-3xl text-2xl font-semibold leading-snug tracking-tight md:text-3xl">{s.titre}</h2>
                <div className="mt-8 space-y-8">{s.blocs.map((b, j) => <RenduBloc key={j} bloc={b} />)}</div>
              </section>
            ))}
        </div>

        <footer className="mt-4 grid gap-4 border-t border-white/10 pt-10 sm:grid-cols-2">
          <Verre as="button" type="button" onClick={() => setPage(null)} className="group p-5 text-left">
            <p className={ETIQUETTE}>Une question sur {projet.nom} ?</p>
            <p className="mt-2 font-semibold">Demandez à l&apos;IA d&apos;Ovrane <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></p>
          </Verre>
          <Verre as="button" type="button" onClick={() => setPage(suivant.slug)} className="group p-5 text-right">
            <p className={ETIQUETTE}>Projet suivant</p>
            <p className="mt-2 font-semibold">{suivant.nom} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></p>
          </Verre>
          <button type="button" onClick={() => setPage('legal')} className={`${ETIQUETTE} mt-6 justify-self-center transition-colors hover:text-white sm:col-span-2`}>
            Informations légales
          </button>
        </footer>
      </article>
  );
}

/**
 * Sommaire fixé à gauche, hors du conteneur qui défile ; la section qui traverse le milieu de l'écran s'allume
 */
export function Sommaire({ projet, visible }: { projet: Projet; visible: boolean }) {
  const [actif, setActif] = useState<string | null>(null);

  useEffect(() => {
    const observateur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        const id = e.target.id;
        setActif((a) => (e.isIntersecting ? id : a === id ? null : a));
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (const s of projet.sections) {
      const section = document.getElementById(`${projet.slug}-${s.id}`);
      if (section) observateur.observe(section);
    }
    return () => observateur.disconnect();
  }, [projet]);

  return (
    <nav
      aria-label="Sommaire"
      inert={!visible}
      className={`fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 font-sans transition-opacity duration-500 xl:block ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <ol className="space-y-3">
        {projet.sections.map((s, i) => {
          const id = `${projet.slug}-${s.id}`;
          const courant = actif === id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => allerA(id)}
                aria-current={courant ? 'location' : undefined}
                className={`py-1 text-left text-xs transition-[color,filter] duration-500 ${courant ? 'text-white drop-shadow-[0_0_3px_#fff]' : 'text-white/50 hover:text-white'}`}
              >
                <span className="font-mono">{String(i + 1).padStart(2, '0')}</span> {s.etape}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
