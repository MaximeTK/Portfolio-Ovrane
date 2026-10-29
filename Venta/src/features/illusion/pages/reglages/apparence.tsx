'use client';

import { useEffect, useRef } from 'react';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { COLOR_PALETTES } from '@/features/fond/colorPalettes';
import { useApparence, type Matiere } from '../../apparence';
import type { Onglet } from '../../dock/Panneau';

const PALETTES = Object.values(COLOR_PALETTES);
const MATIERES: { cle: Matiere; nom: string; detail: string }[] = [
  { cle: 'verre', nom: 'Verre', detail: 'Flou, halos et liseré' },
  { cle: 'teinte', nom: 'Teinte', detail: 'Fond sombre uni' },
];

// Apparence : la palette d'Ovrane, gardée dans le compte d'Ovrane, et la matière des fenêtres, gardée dans les réglages d'Illusion ; le choix s'essaie sur la page derrière, Fermer sans enregistrer le défait
export function useOngletApparence({ actif, fermer, dire }: { actif: boolean; fermer: () => void; dire: (t: string, e?: boolean) => void }): Onglet {
  const palette = useBackgroundStore((s) => s.currentPalette);
  const matiere = useApparence((s) => s.matiere);
  const gardee = useRef<string | null>(null);

  // À l'ouverture, la palette en place est celle du compte ; à la fermeture, ce qui n'a pas été enregistré se défait
  useEffect(() => {
    if (actif) {
      gardee.current = useBackgroundStore.getState().currentPalette.id;
      return;
    }
    if (gardee.current === null) return;
    if (useBackgroundStore.getState().currentPalette.id !== gardee.current) useBackgroundStore.getState().setBackground(gardee.current);
    const { matiere: essayee, enregistree, choisirMatiere } = useApparence.getState();
    if (essayee !== enregistree) choisirMatiere(enregistree);
    gardee.current = null;
  }, [actif]);

  const enregistrer = async () => {
    try {
      if (palette.id !== gardee.current) useBackgroundStore.getState().choisirFond(palette.id);
      if (matiere !== useApparence.getState().enregistree) await useApparence.getState().enregistrer(matiere);
      gardee.current = palette.id;
      dire('Apparence enregistrée : elle suit le compte partout.');
      fermer();
    } catch (e) {
      dire(`Matière non enregistrée : ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  return {
    cle: 'apparence', titre: 'Apparence',
    corps: (
      <div className="apparence">
        <div className="section-f">
          <h3 className="h3-val">Palette<span className="val">{palette.name}</span></h3>
          <div className="palettes" role="radiogroup" aria-label="Palettes">
            {PALETTES.map((p) => (
              <label key={p.id} className="choix palette" title={p.name} style={{ background: `linear-gradient(180deg,${p.topColor},${p.bottomColor})` }}>
                <input type="radio" name="palette" className="cache" aria-label={p.name} checked={p.id === palette.id}
                  onChange={() => useBackgroundStore.getState().setBackground(p.id)} />
              </label>
            ))}
          </div>
        </div>
        <div className="section-f">
          <h3>Matière</h3>
          <div className="matieres" role="radiogroup" aria-label="Matière des fenêtres">
            {MATIERES.map((m) => (
              <label key={m.cle} className="choix matiere">
                <input type="radio" name="matiere" className="cache" checked={matiere === m.cle} onChange={() => useApparence.getState().choisirMatiere(m.cle)} />
                <span className={`apercu-mat m-${m.cle}`} aria-hidden="true" style={m.cle === 'verre' ? { ['--haut' as string]: palette.topColor, ['--bas' as string]: palette.bottomColor } : undefined} />
                <span><b>{m.nom}</b><small>{m.detail}</small></span>
              </label>
            ))}
          </div>
        </div>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action gauche" onClick={() => {
          useBackgroundStore.getState().setBackground('default');
          useApparence.getState().choisirMatiere('teinte');
        }}>Par défaut</button>
        <button type="button" className="action" onClick={fermer}>Fermer</button>
        <button type="button" className="action plein" onClick={enregistrer}>Enregistrer<span className="ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        </span></button>
      </>
    ),
  };
}
