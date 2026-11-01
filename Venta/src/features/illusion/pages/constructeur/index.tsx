'use client';

import './constructeur.css';
import { useEffect, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre } from '../../dock/Dock';
import { Confirmer, MarqueAdmin } from '../../dock/Panneau';
import type { ProprietesPage } from '../liste';
import { Couleurs, ICONES, ListeFichiers, message, poids, useAvis, useFichiers, type Fichier } from '../documents/commun';

type Reglages = { constructeur_fond: string; constructeur_palette: string[] };
type Sorte = 'background' | 'structure' | 'title';
// Les trois sortes d'éléments que le Constructeur tire au sort, dans l'ordre de la planche
const SORTES: { cle: Sorte; titre: string; sorte: string; accept: string; apercu: 'image' | 'feuille' | 'police'; aide: string; mot: string }[] = [
  { cle: 'background', titre: 'Images de fond', sorte: 'Image de fond', accept: '.jpg,.jpeg,.png,.webp', apercu: 'image', mot: 'image de fond',
    aide: 'Photos mises derrière la feuille. JPEG, PNG ou WebP, 10 Mo au plus.' },
  { cle: 'structure', titre: 'Structures', sorte: 'Structure', accept: '.svg', apercu: 'feuille', mot: 'structure',
    aide: 'Feuilles A4 en SVG : leurs grands rectangles blancs donnent les marges du texte.' },
  { cle: 'title', titre: 'Polices des titres', sorte: 'Police des titres', accept: '.woff2,.woff,.ttf,.otf', apercu: 'police', mot: 'police',
    aide: 'Le nom, le poste et les titres en tirent une au hasard ; une police variable est écartée.' },
];
const FONDS = ['', 'aplat', 'degrade', 'photo', 'photo-teintee', 'blanc'];
const pluriel = (n: number, mot: string) => `${n} ${n > 1 ? mot.replace(/^(\w+)/, '$1s') : mot}`;

// Page d'administration : le registre ne la sert qu'au compte du serveur
export default function PageConstructeur(_: ProprietesPage) {
  return (
    <Dock id="constructeur" principal="elements" fenetres={{ elements: { mini: [620, 400] } }}>
      <Activite />
      <Elements />
    </Dock>
  );
}

// Les éléments des CV, pour tous les comptes : trois gestionnaires de fichiers côte à côte, puis le fond et la palette imposés
function Elements() {
  const { dire, vue } = useAvis();
  const gestions: Record<Sorte, ReturnType<typeof useFichiers>> = {
    background: useFichiers('/elements-cv/background', dire, true, 'constructeur'),
    structure: useFichiers('/elements-cv/structure', dire, true, 'constructeur'),
    title: useFichiers('/elements-cv/title', dire, true, 'constructeur'),
  };
  const [aSupprimer, setASupprimer] = useState<{ sorte: Sorte; f: Fichier } | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Le fond et la palette lus restent d'une visite à l'autre et le formulaire en repart, avant d'être relus
  const [reglages, setReglages] = useState(() => repris<Reglages | null>('constructeur:reglages', null));
  useGarder('constructeur', { reglages });
  const [fond, setFond] = useState(reglages?.constructeur_fond ?? '');
  const [palette, setPalette] = useState<string[]>(reglages?.constructeur_palette ?? []);
  const poser = (r: Reglages) => {
    setReglages(r);
    setFond(r.constructeur_fond);
    setPalette(r.constructeur_palette);
  };
  useEffect(() => {
    appeler<Reglages>('/parametres').then(poser).catch((e) => dire(message(e), true));
  }, [dire]);
  const change = !!reglages && (fond !== reglages.constructeur_fond || JSON.stringify(palette) !== JSON.stringify(reglages.constructeur_palette));
  const enregistrer = async () => {
    try {
      poser(await appeler<Reglages>('/parametres', { methode: 'PUT', corps: { constructeur_fond: fond, constructeur_palette: palette } }));
      dire('Réglages enregistrés — les prochains CV les reprennent.');
    } catch (e) {
      dire(`Enregistrement refusé : ${message(e)}`, true);
    }
  };
  const supprimer = async () => {
    if (!aSupprimer) return;
    setOccupe(true);
    await gestions[aSupprimer.sorte].supprimer(aSupprimer.f.nom);
    setOccupe(false);
    setASupprimer(null);
  };
  const compte = (s: (typeof SORTES)[number]) => gestions[s.cle].fichiers?.length ?? 0;

  return (
    <Fenetre id="elements" as="div" className="docs-constructeur" aria-label="Éléments des CV" titrePrise="Glisser pour détacher les éléments des CV"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).id === 'c-fond' && change) void enregistrer();
      }}>
      <div className="outils">
        <p className="resume"><b>Éléments des CV, pour tous les comptes</b>
          <span>{SORTES.map((s) => pluriel(compte(s), s.mot)).join(' · ')} · la galerie est dans Documents</span></p>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className="action plein" disabled={!change} title={change ? undefined : "Rien n'a changé"} onClick={() => void enregistrer()}>
            Enregistrer<span className="ico">{ICONES.coche}</span>
          </button>
        </div>
      </div>
      {aSupprimer && (
        <Confirmer question={`Supprimer ${aSupprimer.f.nom} ?`} admin occupe={occupe} action="Supprimer"
          detail={`${poids(aSupprimer.f.taille)} · elle ne sera plus tirée pour les CV de tous les comptes.`}
          onAnnuler={() => setASupprimer(null)} onConfirmer={() => void supprimer()} />
      )}
      <div className="elements">
        <div className="gest-cols">
          {SORTES.map((s) => (
            <section key={s.cle} className="gest" aria-labelledby={`g-${s.cle}`}>
              <h3 className="gest-tete" id={`g-${s.cle}`}>{s.titre}<MarqueAdmin /><span className="compteur">{compte(s)}</span></h3>
              <p className="aide-champ">{s.aide}</p>
              <ListeFichiers route={`/elements-cv/${s.cle}`} accept={s.accept} apercu={s.apercu} sorte={s.sorte} portee="pour les CV de tous les comptes"
                gestion={gestions[s.cle]} aSupprimer={(f) => setASupprimer({ sorte: s.cle, f })} vise={aSupprimer?.sorte === s.cle ? aSupprimer.f.nom : null} />
            </section>
          ))}
        </div>
        <div className="imposes">
          <div className="champ"><label htmlFor="c-fond">Fond imposé</label>
            <select id="c-fond" className="saisie" value={fond} onChange={(e) => setFond(e.target.value)}>
              {FONDS.map((f) => <option key={f} value={f}>{f || 'Aléatoire'}</option>)}
            </select>
            <p className="aide-champ">« Aléatoire » : un tirage différent à chaque CV, ce qui permet de comparer les retours.</p></div>
          <div className="champ"><span className="lib-champ">Palette imposée</span>
            <Couleurs valeurs={palette} changer={setPalette} libelle="Palette imposée" grand />
            <p className="aide-champ">Quatre couleurs au plus. Vide : la palette vient de l&apos;identité de l&apos;entreprise.</p></div>
        </div>
      </div>
      {vue}
    </Fenetre>
  );
}
