'use client';

import { useEffect, useRef } from 'react';
import { useUIStore, VERRE_DEFAUT, FLOU_MAX, VERRE_MAX } from '@/lib/uiStore';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { COLOR_PALETTES } from '@/features/fond/colorPalettes';
import { useApparence, type Matiere, type Theme } from '../../apparence';
import type { DefFenetre } from '../../dock/moteur';
import type { Onglet } from '../../dock/Panneau';
import { Action } from '../../elements/Action';
import type { Dire } from '../../elements/Avis';
import { SectionFiche } from '../../elements/Champ';
import { message } from '../../elements/format';
import { ICONES } from '../../elements/icones';

// Les tailles de la fenêtre Réglages et de son panneau
export const FENETRES_REGLAGES: Record<string, DefFenetre> = { reglages: { mini: [540, 320], pref: [780, 420], flot: [900, 600] }, panneau: { flot: [440, 600] } };

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
// Une section de choix exclusifs, chacun avec son aperçu, son nom et son détail
function ChoixApercus({ titre, nom, label, classe, choix, courant, prefixe, choisir, style }: {
  titre: string; nom: string; label: string; classe: string; choix: { cle: string; nom: string; detail: string }[]; courant: string; prefixe: string;
  choisir: (cle: string) => void; style?: (cle: string) => React.CSSProperties | undefined;
}) {
  return (
    <SectionFiche titre={titre}>
      <div className={classe} role="radiogroup" aria-label={label}>
        {choix.map((c) => (
          <label key={c.cle} className="choix matiere">
            <input type="radio" name={nom} className="cache" checked={courant === c.cle} onChange={() => choisir(c.cle)} />
            <span className={`apercu-mat ${prefixe}-${c.cle}`} aria-hidden="true" style={style?.(c.cle)} />
            <span><b>{c.nom}</b><small>{c.detail}</small></span>
          </label>
        ))}
      </div>
    </SectionFiche>
  );
}

export function useOngletApparence({ actif, fermer, dire }: { actif: boolean; fermer: () => void; dire: Dire }): Onglet {
  const palette = useBackgroundStore((s) => s.currentPalette);
  const matiere = useApparence((s) => s.matiere);
  const theme = useApparence((s) => s.theme);
  const opacite = useUIStore((s) => s.verreOpacite);
  const flou = useUIStore((s) => s.verreFlou);
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
      dire(`Apparence non enregistrée : ${message(e)}`, true);
    }
  };

  return {
    cle: 'apparence', titre: 'Apparence',
    corps: (
      <div className="apparence">
        <ChoixApercus titre="Thème" nom="theme" label="Thème d'Illusion" classe="matieres themes" choix={THEMES} courant={theme} prefixe="t" choisir={(c) => useApparence.getState().choisirTheme(c as typeof theme)} />
        {theme === 'verre' && <><SectionFiche titre={<>Palette<span className="val">{palette.name}</span></>} classeTitre="h3-val">
          <div className="palettes" role="radiogroup" aria-label="Palettes">
            {PALETTES.map((p) => (
              <label key={p.id} className="choix palette" title={p.name} style={{ background: `linear-gradient(180deg,${p.topColor},${p.bottomColor})` }}>
                <input type="radio" name="palette" className="cache" aria-label={p.name} checked={p.id === palette.id}
                  onChange={() => useBackgroundStore.getState().setBackground(p.id)} />
              </label>
            ))}
          </div>
        </SectionFiche>
        <ChoixApercus titre="Matière" nom="matiere" label="Matière des fenêtres" classe="matieres" choix={MATIERES} courant={matiere} prefixe="m" choisir={(c) => useApparence.getState().choisirMatiere(c as typeof matiere)}
          style={(c) => (c === 'verre' ? { ['--haut' as string]: palette.topColor, ['--bas' as string]: palette.bottomColor } : undefined)} />
        <SectionFiche titre={<>Flou des fenêtres<span className="val">{flou ? `${flou} px` : 'Aucun'}</span></>} classeTitre="h3-val" className="teinte">
          <p className="aide-champ">Une fenêtre détachée laisse voir, flouté, ce qu&apos;elle recouvre.</p>
          <input type="range" min={0} max={FLOU_MAX} step={2} value={flou} aria-label="Flou des fenêtres" onChange={(e) => useUIStore.getState().reglerFlou(Number(e.target.value))} />
        </SectionFiche></>}
        <SectionFiche titre={<>Teinte des boîtes<span className="val">{Math.round(opacite * 100)} %</span></>} classeTitre="h3-val" className="teinte">
          <p className="aide-champ">Vos messages et le champ de saisie du chat d&apos;Ovrane.</p>
          <input type="range" min={0} max={VERRE_MAX} step={0.05} value={opacite} aria-label="Teinte des boîtes" onChange={(e) => useUIStore.getState().reglerVerre(Number(e.target.value))} />
          <p className="apercu-teinte">Le texte reste-t-il lisible sur ce fond ?</p>
          <button type="button" className="lien-d" onClick={() => useUIStore.getState().reglerVerre(VERRE_DEFAUT)}>Revenir à {Math.round(VERRE_DEFAUT * 100)} %</button>
        </SectionFiche>
      </div>
    ),
    pied: (
      <>
        <Action className="gauche" onClick={() => {
          useBackgroundStore.getState().setBackground('default');
          useApparence.getState().choisirMatiere('teinte');
          useApparence.getState().choisirTheme('verre');
          useUIStore.getState().reglerFlou(0);
        }}>Par défaut</Action>
        <Action onClick={fermer}>Fermer</Action>
        <Action plein iconeApres={ICONES.valider_metriques} onClick={enregistrer}>Enregistrer</Action>
      </>
    ),
  };
}
