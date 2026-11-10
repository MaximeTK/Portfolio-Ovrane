'use client';

import { useId, useState } from 'react';
import { Champ, ChampListe, ChampSaisie, Interrupteur } from '../../elements/Champ';
import { parVirgules } from '../../elements/format';
import { FORMES_CHAMP, SECTIONS_DE_CHAMP } from './champs';

export const CHAMP_VIERGE = { cle: '', libelle: '', section: 'identite', type: 'text', choix: '', obligatoire: true };

// Le champ tel qu'il part au serveur
export const champVersEnvoi = (f: typeof CHAMP_VIERGE) => ({
  cle: f.cle.trim(), libelle: f.libelle.trim(), section: f.section, type: f.type, obligatoire: f.obligatoire, choix: parVirgules(f.choix),
});

// Le brouillon d'un champ du profil et ce qui le modifie
export function useFormChamp(depart: () => typeof CHAMP_VIERGE) {
  const [f, setF] = useState(depart);
  const poser = (cle: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [cle]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  return { f, setF, poser };
}

// Les champs du formulaire : Profil l'ouvre pour une donnée, Workflows pour un signalement
export function ChampsDuProfil({ f, poser, entree, cles, libelleCle = 'Clé', aideChoix = 'Séparés par des virgules.' }: {
  f: typeof CHAMP_VIERGE; poser: ReturnType<typeof useFormChamp>['poser']; entree: (e: React.KeyboardEvent) => unknown;
  cles: { cle: string; libelle: string }[]; libelleCle?: string; aideChoix?: React.ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div className="grille-2">
        <Champ pour={`${id}-cle`} libelle={libelleCle}>
          <input id={`${id}-cle`} className="saisie" type="text" list={`${id}-cles`} autoComplete="off" value={f.cle} onChange={poser('cle')} onKeyDown={entree} />
          <datalist id={`${id}-cles`}>{cles.map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}</datalist>
        </Champ>
        <ChampSaisie id={`${id}-lib`} libelle="Libellé" type="text" value={f.libelle} onChange={poser('libelle')} onKeyDown={entree} />
      </div>
      <div className="grille-2">
        <ChampListe id={`${id}-sec`} libelle="Section" value={f.section} onChange={poser('section')}>{Object.entries(SECTIONS_DE_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</ChampListe>
        <ChampListe id={`${id}-forme`} libelle="Forme" value={f.type} onChange={poser('type')}>{Object.entries(FORMES_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</ChampListe>
      </div>
      <ChampSaisie id={`${id}-choix`} libelle="Choix" aide={aideChoix} type="text" value={f.choix} onChange={poser('choix')} onKeyDown={entree} />
      <Interrupteur libelle="Obligatoire" checked={f.obligatoire} onChange={poser('obligatoire')} />
    </>
  );
}
