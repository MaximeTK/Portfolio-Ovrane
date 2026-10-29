'use client';

import { ETIQUETTE, Verre } from './ProjectPage';
import { useUIStore, VERRE_DEFAUT } from '@/lib/uiStore';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { COLOR_PALETTES } from '@/features/fond/colorPalettes';

// Réglages d'affichage provisoires : fond enregistré dans le profil, teinte des boîtes dans ce navigateur
export function ReglagesPage() {
  const opacite = useUIStore((s) => s.verreOpacite);
  const reglerVerre = useUIStore((s) => s.reglerVerre);
  const fond = useBackgroundStore((s) => s.currentPalette.id);
  const choisirFond = useBackgroundStore((s) => s.choisirFond);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-28 font-sans text-white md:px-8">
      <p className={ETIQUETTE}>Réglages</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Affichage</h1>

      <Verre as="section" className="mt-10 p-5" aria-labelledby="titre-fond">
        <h2 id="titre-fond" className="font-semibold">Fond</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">La palette s&apos;applique tout de suite et reste à votre prochaine visite.</p>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Object.values(COLOR_PALETTES).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choisirFond(p.id)}
                aria-pressed={fond === p.id}
                className="group w-full text-left"
              >
                <span
                  className={`block h-12 rounded-xl border transition ${fond === p.id ? 'border-white ring-2 ring-white/60' : 'border-white/15 group-hover:border-white/50'}`}
                  style={{ background: `linear-gradient(180deg, ${p.topColor}, ${p.bottomColor})` }}
                />
                <span className={`mt-1.5 block truncate text-xs first-letter:uppercase ${fond === p.id ? 'text-white' : 'text-white/70'}`}>{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Verre>

      <Verre as="section" className="mt-4 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="teinte-verre" className="font-semibold">Teinte des boîtes</label>
          <output htmlFor="teinte-verre" className="font-mono text-sm text-white/80">{Math.round(opacite * 100)} %</output>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          Vos messages et le champ de saisie. Plus sombres, ils restent lisibles sur les fonds clairs.
        </p>
        <input
          id="teinte-verre"
          type="range"
          min={0}
          max={0.9}
          step={0.05}
          value={opacite}
          onChange={(e) => reglerVerre(Number(e.target.value))}
          className="mt-5 w-full accent-white"
        />
        <div className="mt-1 flex justify-between text-xs text-white/60">
          <span>Transparente</span>
          <span>Opaque</span>
        </div>
        <button
          type="button"
          onClick={() => reglerVerre(VERRE_DEFAUT)}
          className="mt-4 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/50 hover:text-white"
        >
          Revenir à {Math.round(VERRE_DEFAUT * 100)} %
        </button>
      </Verre>

      {/* L'aperçu montre un message du visiteur, que la teinte règle */}
      <Verre as="section" className="mt-4 p-5" aria-label="Aperçu">
        <p className={ETIQUETTE}>Aperçu</p>
        <p className="ml-auto mt-3 w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-(--verre) px-4 py-3 text-sm leading-relaxed text-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] md:text-base">
          Pouvez-vous changer le fond, pour voir si le texte reste lisible ?
        </p>
      </Verre>
    </div>
  );
}
