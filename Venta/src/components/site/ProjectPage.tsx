'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Bloc, Projet, Visuel } from '@/lib/projets';
import { useUIStore } from '@/lib/state/uiStore';

export const ETIQUETTE = 'text-[10px] font-bold uppercase tracking-[0.25em] text-white/60';
export const VERRE = 'rounded-2xl border border-white/[0.18] bg-[rgba(135,135,135,0.15)] backdrop-blur-[60px] backdrop-saturate-200';
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
            <li key={e.titre} className={`${VERRE} p-4`}>
              <span className="font-mono text-xs text-white/50">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-2 font-semibold text-white">{e.titre}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{e.texte}</p>
            </li>
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
                <div><dt className={`${ETIQUETTE} inline`}>Choix · </dt><dd className="inline text-white">{d.choix}</dd></div>
                <div><dt className={`${ETIQUETTE} inline`}>Pourquoi · </dt><dd className="inline text-white/75">{d.pourquoi}</dd></div>
                {d.ecarte && <div><dt className={`${ETIQUETTE} inline`}>Écarté · </dt><dd className="inline text-white/60">{d.ecarte}</dd></div>}
              </dl>
            </div>
          ))}
        </div>
      );
    case 'encadre':
      return (
        <aside className={`${VERRE} max-w-3xl p-5 md:p-6`}>
          <p className={ETIQUETTE}>{bloc.titre}</p>
          <p className="mt-2 leading-relaxed text-white/85">{bloc.texte}</p>
        </aside>
      );
  }
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
  return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 font-sans text-white md:px-8">
        <header>
          <p className={ETIQUETTE}>Étude de cas · {String(rang).padStart(2, '0')} / {String(total).padStart(2, '0')} · {minutesDeLecture(projet)} min de lecture</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{projet.titre}</h1>
          <p className="mt-4 max-w-3xl text-base text-white/70 md:text-lg">{projet.accroche}</p>

          <div className={`${VERRE} mt-8 grid divide-y divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0`}>
            {([['Problème', projet.tldr.probleme], ['Solution', projet.tldr.solution], ['Impact', projet.tldr.impact]] as const).map(([titre, texte]) => (
              <div key={titre} className="p-5">
                <p className={ETIQUETTE}>{titre}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{texte}</p>
              </div>
            ))}
          </div>

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
          <button type="button" onClick={() => setPage(null)} className={`${VERRE} group p-5 text-left transition hover:border-white/40`}>
            <p className={ETIQUETTE}>Une question sur {projet.nom} ?</p>
            <p className="mt-2 font-semibold">Demandez à l&apos;IA d&apos;Ovrane <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></p>
          </button>
          <button type="button" onClick={() => setPage(suivant.slug)} className={`${VERRE} group p-5 text-right transition hover:border-white/40`}>
            <p className={ETIQUETTE}>Projet suivant</p>
            <p className="mt-2 font-semibold">{suivant.nom} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></p>
          </button>
          <button type="button" onClick={() => setPage('legal')} className={`${ETIQUETTE} mt-6 justify-self-center transition-colors hover:text-white sm:col-span-2`}>
            Informations légales
          </button>
        </footer>
      </div>
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
                className={`text-left text-xs transition-[color,filter] duration-500 ${courant ? 'text-white drop-shadow-[0_0_3px_#fff]' : 'text-white/50 hover:text-white'}`}
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
