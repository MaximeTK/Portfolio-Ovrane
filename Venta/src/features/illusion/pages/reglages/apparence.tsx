'use client';

import { useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useUIStore, VERRE_DEFAUT, FLOU_DEFAUT, FLOU_MAX, PLEIN_DEFAUT, VERRE_MAX } from '@/lib/uiStore';
import { PHOTOS, urlPhoto, useBackgroundStore, type Fond } from '@/features/fond/backgroundStore';
import { COLOR_PALETTES } from '@/features/fond/colorPalettes';
import { useApparence, type Matiere, type Theme } from '../../apparence';
import type { DefFenetre } from '../../dock/moteur';
import { Action } from '../../elements/Action';
import type { Dire } from '../../elements/Avis';
import { Interrupteur, SectionFiche } from '../../elements/Champ';
import { message } from '../../elements/format';
import { ICONES } from '../../elements/icones';

// Les tailles de la fenêtre Réglages et de son panneau
export const FENETRES_REGLAGES: Record<string, DefFenetre> = { reglages: { mini: [540, 320], pref: [780, 420], flot: [900, 600] }, panneau: { flot: [440, 600] } };

const PALETTES = Object.values(COLOR_PALETTES);
// L'arc-en-ciel montre toutes ses couleurs, pas celles qu'il prête au verre
const ARC = 'linear-gradient(135deg,#ff4d4d,#ffb31a,#f5f53d,#3dff7a,#2ee6ff,#5c6bff,#c04dff)';
const MATIERES: { cle: Matiere; nom: string; detail: string }[] = [
  { cle: 'verre', nom: 'Verre', detail: 'Flou, reflets et liseré' },
  { cle: 'teinte', nom: 'Teinte', detail: 'Voile sombre, sans reflets' },
];
const nomFond = (f: Fond) => (f === 'organique' ? 'Organique' : f === 'bokeh' ? 'Bokeh' : f === 'degrade' ? 'Dégradé' : PHOTOS.find((p) => f === `photo:${p.id}`)?.nom);
const THEMES: { cle: Theme; nom: string; detail: string }[] = [
  { cle: 'verre', nom: 'Glassmorphisme', detail: 'Verre, texte en glyphes' },
  { cle: 'clair', nom: 'Clair', detail: 'Fenêtres blanches, simple fondu' },
  { cle: 'sombre', nom: 'Sombre', detail: 'Fenêtres sombres, simple fondu' },
];

// Thème, fond, palette d'Ovrane (compte), matière ; Annuler défait l'essai.
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

/** Réglages d'apparence, posés dans la grande fenêtre des réglages */
export function useApparenceReglages({ actif, dire }: { actif: boolean; dire: Dire }) {
  const palette = useBackgroundStore((s) => s.currentPalette);
  const fond = useBackgroundStore((s) => s.fond);
  const matiere = useApparence((s) => s.matiere);
  const theme = useApparence((s) => s.theme);
  const opacite = useUIStore((s) => s.verreOpacite);
  const flou = useUIStore((s) => s.verreFlou);
  const plein = useUIStore((s) => s.verrePlein);
  // Palette et fond d'avant l'essai, rendus par Annuler
  const gardee = useRef<{ palette: string; fond: Fond } | null>(null);

  // Annuler défait ce qui n'a pas été enregistré
  const defaire = useCallback(() => {
    const g = gardee.current, f = useBackgroundStore.getState();
    if (!g) return;
    if (f.currentPalette.id !== g.palette) f.setBackground(g.palette);
    if (f.fond !== g.fond) f.essayerFond(g.fond);
    const { matiere: essayee, enregistree, choisirMatiere, theme: themeEssaye, themeEnregistre, choisirTheme } = useApparence.getState();
    if (essayee !== enregistree) choisirMatiere(enregistree);
    if (themeEssaye !== themeEnregistre) choisirTheme(themeEnregistre);
  }, []);

  // Enregistre ce qui a changé depuis l'ouverture, lu dans les magasins
  const garder = useCallback(async () => {
    const g = gardee.current, f = useBackgroundStore.getState(), a = useApparence.getState();
    if (!g) return;
    if (f.currentPalette.id !== g.palette) f.choisirFond(f.currentPalette.id);
    if (f.fond !== g.fond) f.garderFond(f.fond);
    if (a.matiere !== a.enregistree || a.theme !== a.themeEnregistre) await a.enregistrer({ matiere: a.matiere, theme: a.theme });
    gardee.current = { palette: f.currentPalette.id, fond: f.fond };
  }, []);

  useEffect(() => {
    if (!actif) return;
    const { currentPalette, fond: courant } = useBackgroundStore.getState();
    gardee.current = { palette: currentPalette.id, fond: courant };
    // En quittant, le choix affiché reste et s'enregistre de lui-même
    return () => {
      void garder().catch(() => undefined);
      gardee.current = null;
    };
  }, [actif, garder]);

  const enregistrer = async () => {
    try {
      await garder();
      dire('Apparence enregistrée : elle suit le compte partout.');
    } catch (e) {
      dire(`Apparence non enregistrée : ${message(e)}`, true);
    }
  };
  const essayer = (f: Fond) => useBackgroundStore.getState().essayerFond(f);

  return {
    corps: (
      <div className="apparence">
        <ChoixApercus titre="Thème" nom="theme" label="Thème d'Illusion" classe="matieres themes" choix={THEMES} courant={theme} prefixe="t" choisir={(c) => useApparence.getState().choisirTheme(c as typeof theme)} />
        <SectionFiche titre={<>Fond<span className="val">{nomFond(fond)}</span></>} classeTitre="h3-val">
          <Interrupteur libelle="Bokeh animés" checked={fond === 'organique' || fond === 'bokeh'} onChange={(e) => essayer(e.target.checked ? 'organique' : 'degrade')} />
          <Interrupteur libelle="Fond organique" checked={fond === 'organique'} disabled={fond !== 'organique' && fond !== 'bokeh'}
            onChange={(e) => essayer(e.target.checked ? 'organique' : 'bokeh')} />
          <p className="aide-champ">Le fond organique dessine les coulisses d&apos;Ovrane dans les bokeh. Sans bokeh, le dégradé de la palette ; une photo les éteint aussi.</p>
          <div className="photos" role="radiogroup" aria-label="Photo de fond">
            <label className="choix photo aucune" title="Aucune photo">
              <input type="radio" name="photo" className="cache" aria-label="Aucune photo" checked={!fond.startsWith('photo:')} onChange={() => essayer('degrade')} />
              <span aria-hidden="true">Aucune</span>
            </label>
            {PHOTOS.map((p) => (
              <label key={p.id} className="choix photo" title={p.nom}>
                <input type="radio" name="photo" className="cache" aria-label={p.nom} checked={fond === `photo:${p.id}`} onChange={() => essayer(`photo:${p.id}`)} />
                <Image src={urlPhoto(p.id)} alt="" width={96} height={64} sizes="96px" />
              </label>
            ))}
          </div>
        </SectionFiche>
        <SectionFiche titre={<>Palette<span className="val">{palette.name}</span></>} classeTitre="h3-val">
          <div className="palettes" role="radiogroup" aria-label="Palettes">
            {PALETTES.map((p) => (
              <label key={p.id} className="choix palette" title={p.name}
                style={{ background: p.arc ? ARC : `linear-gradient(135deg,${p.lumiere} 0 22%,${p.bottomColor} 22% 62%,${p.topColor} 62%)` }}>
                <input type="radio" name="palette" className="cache" aria-label={p.name} checked={p.id === palette.id}
                  onChange={() => useBackgroundStore.getState().setBackground(p.id)} />
              </label>
            ))}
          </div>
        </SectionFiche>
        {theme === 'verre' && <><ChoixApercus titre="Matière" nom="matiere" label="Matière des fenêtres" classe="matieres" choix={MATIERES} courant={matiere} prefixe="m" choisir={(c) => useApparence.getState().choisirMatiere(c as typeof matiere)}
          style={(c) => (c === 'verre' ? { ['--haut' as string]: palette.topColor, ['--bas' as string]: palette.bottomColor } : undefined)} />
        <SectionFiche titre={<>Flou des fenêtres<span className="val">{flou ? `${flou} px` : 'Aucun'}</span></>} classeTitre="h3-val" className="teinte">
          <p className="aide-champ">Le verre des fenêtres d&apos;Illusion floute ce qu&apos;il recouvre ; à zéro, il le laisse net.</p>
          <input type="range" min={0} max={FLOU_MAX} step={2} value={flou} aria-label="Flou des fenêtres" onChange={(e) => useUIStore.getState().reglerFlou(Number(e.target.value))} />
        </SectionFiche>
        <SectionFiche titre={<>Opacité des fenêtres<span className="val">{plein >= 1 ? 'Opaque' : `${Math.round(plein * 100)} %`}</span></>} classeTitre="h3-val" className="teinte">
          <p className="aide-champ">Du verre flouté, à zéro, jusqu&apos;à l&apos;opaque de l&apos;ancien Illusion.</p>
          <input type="range" min={0} max={1} step={0.05} value={plein} aria-label="Opacité des fenêtres" onChange={(e) => useUIStore.getState().reglerPlein(Number(e.target.value))} />
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
          essayer('organique');
          useApparence.getState().choisirMatiere('verre');
          useApparence.getState().choisirTheme('verre');
          useUIStore.getState().reglerFlou(FLOU_DEFAUT);
          useUIStore.getState().reglerPlein(PLEIN_DEFAUT);
        }}>Par défaut</Action>
        <Action onClick={defaire}>Annuler</Action>
        <Action plein iconeApres={ICONES.valider_metriques} onClick={enregistrer}>Enregistrer</Action>
      </>
    ),
  };
}
