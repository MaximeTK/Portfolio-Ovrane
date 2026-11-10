import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { avecAbsent, optionsModele } from './format';

// Un champ de formulaire : libellé, saisie, aide ; `groupe` s'il ne vise pas une seule saisie
export function Champ({ libelle, pour, titre, groupe, aide, className, children, ...div }: Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  libelle: ReactNode; pour?: string; titre?: string; groupe?: boolean; aide?: ReactNode;
}) {
  return (
    <div className={`champ${className ? ` ${className}` : ''}`} {...div}>
      {groupe ? <span className="lib-champ" title={titre}>{libelle}</span> : <label htmlFor={pour} title={titre}>{libelle}</label>}
      {children}
      {aide && <p className="aide-champ">{aide}</p>}
    </div>
  );
}

type EnteteChamp = { libelle: ReactNode; titre?: string; aide?: ReactNode; classeChamp?: string };

// Un champ et sa seule saisie : le libellé vise la saisie par son id
export function ChampSaisie({ id, libelle, titre, aide, classeChamp, ...input }: ComponentPropsWithoutRef<'input'> & EnteteChamp) {
  return <Champ pour={id} libelle={libelle} titre={titre} aide={aide} className={classeChamp}><input id={id} className="saisie" {...input} /></Champ>;
}

export function ChampListe({ id, libelle, titre, aide, classeChamp, ...select }: ComponentPropsWithoutRef<'select'> & EnteteChamp) {
  return <Champ pour={id} libelle={libelle} titre={titre} aide={aide} className={classeChamp}><select id={id} className="saisie" {...select} /></Champ>;
}

export function ChampZone({ id, libelle, titre, aide, classeChamp, ...zone }: ComponentPropsWithoutRef<'textarea'> & EnteteChamp) {
  return <Champ pour={id} libelle={libelle} titre={titre} aide={aide} className={classeChamp}><textarea id={id} className="saisie" {...zone} /></Champ>;
}

// Une section de panneau : son titre, puis son contenu
export function SectionFiche({ titre, classeTitre, className, children, ...div }: Omit<ComponentPropsWithoutRef<'div'>, 'title'> & { titre: ReactNode; classeTitre?: string }) {
  return <div className={`section-f${className ? ` ${className}` : ''}`} {...div}><h3 className={classeTitre}>{titre}</h3>{children}</div>;
}

// Un interrupteur : libellé à gauche, case à droite ; `title` explique le réglage
export function Interrupteur({ libelle, title, className, ...input }: ComponentPropsWithoutRef<'input'> & { libelle: ReactNode }) {
  return (
    <label className={`inter${className ? ` ${className}` : ''}`} title={title}>
      <span>{libelle}</span>
      <input type="checkbox" {...input} />
    </label>
  );
}

// Un libellé et sa valeur, en lecture seule
export function LibelleValeur({ libelle, as: Balise = 'div', d, children }: { libelle: ReactNode; as?: 'div' | 'li'; d?: boolean; children: ReactNode }) {
  return <Balise><span className="lib-champ">{libelle}</span>{d ? <span className="d">{children}</span> : children}</Balise>;
}

// Un secret jamais relu : `pose` s'il existe, `efface` s'il part à l'enregistrement
export function SaisieSecrete({ id, valeur, pose, efface, changer, effacer, titre }: {
  id: string; valeur: string; pose: boolean; efface: boolean; changer: (v: string) => void; effacer: () => void; titre: string;
}) {
  return (
    <span className="secret">
      <input id={id} className="saisie" type="password" autoComplete="new-password" value={valeur}
        placeholder={efface ? "effacée à l'enregistrement" : pose ? 'enregistrée' : 'non renseignée'} onChange={(e) => changer(e.target.value)} />
      {pose && !efface && !valeur && <button type="button" className="effacer" title={titre} onClick={effacer}>Effacer</button>}
    </span>
  );
}

// Les options d'un choix de modèle ; une valeur sortie du catalogue reste visible
export function OptionsModele({ modeles, vide, valeur, detail = true }: { modeles: { nom: string; modele?: string }[]; vide: string; valeur: string; detail?: boolean }) {
  return <>{avecAbsent(optionsModele(modeles, vide, detail), valeur).map(([o, l]) => <option key={o} value={o}>{l}</option>)}</>;
}
