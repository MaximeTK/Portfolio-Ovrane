'use client';

import { useEffect, useRef } from 'react';
import { useUIStore, VERRE_DEFAUT } from '@/lib/uiStore';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { COLOR_PALETTES } from '@/features/fond/colorPalettes';
import { useApparence, type Matiere, type Theme } from '../../apparence';
import type { Onglet } from '../../dock/Panneau';

const PALETTES = Object.values(COLOR_PALETTES);
const MATIERES: { cle: Matiere; nom: string; detail: string }[] = [
  { cle: 'verre', nom: 'Verre', detail: 'Flou, halos et liseré' },
  { cle: 'teinte', nom: 'Teinte', detail: 'Fond sombre uni' },
];
const THEMES: { cle: Theme; nom: string; detail: string }[] = [
  { cle: 'verre', nom: 'Glassmorphisme', detail: 'Verre, texte en glyphes' },
  { cle: 'clair', nom: 'Clair', detail: 'Fenêtres blanches, simple fondu' },
  { cle: 'sombre', nom: 'Sombre', detail: 'Fenêtres sombres, simple fondu' },
];

// Thème, palette d'Ovrane (compte) et matière ; Fermer défait l'essai.
export function useOngletApparence({ actif, fermer, dire }: { actif: boolean; fermer: () => void; dire: (t: string, e?: boolean) => void }): Onglet {
  const palette = useBackgroundStore((s) => s.currentPalette);
  const matiere = useApparence((s) => s.matiere);
  const theme = useApparence((s) => s.theme);
  const opacite = useUIStore((s) => s.verreOpacite);
  const gardee = useRef<string | null>(null);

  // À la fermeture, ce qui n'a pas été enregistré se défait.
  useEffect(() => {
    if (actif) {
      gardee.current = useBackgroundStore.getState().currentPalette.id;
      return;
    }
    if (gardee.current === null) return;
    if (useBackgroundStore.getState().currentPalette.id !== gardee.current) useBackgroundStore.getState().setBackground(gardee.current);
    const { matiere: essayee, enregistree, choisirMatiere, theme: themeEssaye, themeEnregistre, choisirTheme } = useApparence.getState();
    if (essayee !== enregistree) choisirMatiere(enregistree);
    if (themeEssaye !== themeEnregistre) choisirTheme(themeEnregistre);
    gardee.current = null;
  }, [actif]);

  const enregistrer = async () => {
    try {
      if (palette.id !== gardee.current) useBackgroundStore.getState().choisirFond(palette.id);
      const { enregistree, themeEnregistre, enregistrer: garder } = useApparence.getState();
      if (matiere !== enregistree || theme !== themeEnregistre) await garder({ matiere, theme });
      gardee.current = palette.id;
      dire('Apparence enregistrée : elle suit le compte partout.');
      fermer();
    } catch (e) {
      dire(`Apparence non enregistrée : ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  return {
    cle: 'apparence', titre: 'Apparence',
    corps: (
      <div className="apparence">
        <div className="section-f">
          <h3>Thème</h3>
          <div className="matieres themes" role="radiogroup" aria-label="Thème d'Illusion">
            {THEMES.map((t) => (
              <label key={t.cle} className="choix matiere">
                <input type="radio" name="theme" className="cache" checked={theme === t.cle} onChange={() => useApparence.getState().choisirTheme(t.cle)} />
                <span className={`apercu-mat t-${t.cle}`} aria-hidden="true" />
                <span><b>{t.nom}</b><small>{t.detail}</small></span>
              </label>
            ))}
          </div>
        </div>
        {theme === 'verre' && <><div className="section-f">
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
        </div></>}
        <div className="section-f teinte">
          <h3 className="h3-val">Teinte des boîtes<span className="val">{Math.round(opacite * 100)} %</span></h3>
          <p className="aide-champ">Vos messages et le champ de saisie du chat d&apos;Ovrane.</p>
          <input type="range" min={0} max={0.9} step={0.05} value={opacite} aria-label="Teinte des boîtes" onChange={(e) => useUIStore.getState().reglerVerre(Number(e.target.value))} />
          <p className="apercu-teinte">Le texte reste-t-il lisible sur ce fond ?</p>
          <button type="button" className="lien-d" onClick={() => useUIStore.getState().reglerVerre(VERRE_DEFAUT)}>Revenir à {Math.round(VERRE_DEFAUT * 100)} %</button>
        </div>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action gauche" onClick={() => {
          useBackgroundStore.getState().setBackground('default');
          useApparence.getState().choisirMatiere('teinte');
          useApparence.getState().choisirTheme('verre');
        }}>Par défaut</button>
        <button type="button" className="action" onClick={fermer}>Fermer</button>
        <button type="button" className="action plein" onClick={enregistrer}>Enregistrer<span className="ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        </span></button>
      </>
    ),
  };
}
