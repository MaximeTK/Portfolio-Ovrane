'use client';

import './ma-veille.css';
import { useEffect, useState } from 'react';
import { appeler } from '../../api';
import { Fenetre } from '../../dock/Dock';
import { PageDock } from '../../activite/PageDock';
import { Action } from '../../elements/Action';
import { useAvis } from '../../elements/Avis';
import { ICONES } from '../../elements/icones';
import { useGeste, useLecture } from '../commun';

// Ce que /veille/jobboards rend : les miens, ni ceux des autres ni ceux d'Illusion
type MonJobboard = { url: string; nom: string };

export default function PageMaVeille() {
  return (
    <PageDock id="ma-veille" principal="ma-veille" panneau={null}>
      <MaVeille />
    </PageDock>
  );
}

function MaVeille() {
  const { lu, erreur, relire } = useLecture<MonJobboard[]>('ma-veille', 'liste', '/veille/jobboards');
  const { dire, vue } = useAvis('avis', true, erreur);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const [url, setUrl] = useState('');
  const [nom, setNom] = useState('');
  useEffect(() => {
    void relire();
  }, [relire]);

  const ajouter = () => geste(async () => {
    await appeler('/veille/jobboards', { methode: 'POST', corps: { url: url.trim(), nom: nom.trim() } });
    dire(`${nom.trim() || url.trim()} : ajouté, fouillé avec vos recherches dès le prochain cycle de veille.`);
    setUrl('');
    setNom('');
  }, relire);
  const retirer = (j: MonJobboard) => geste(async () => {
    await appeler(`/veille/jobboards?url=${encodeURIComponent(j.url)}`, { methode: 'DELETE' });
    dire(`${j.nom || j.url} : retiré de votre veille.`);
  }, relire);

  return (
    <Fenetre id="ma-veille" as="main" className="tableau ma-veille" aria-label="Ma veille" titrePrise="Glisser pour détacher votre veille">
      <form className="outils" onSubmit={(e) => {
        e.preventDefault();
        if (url.trim() && !occupe) void ajouter();
      }}>
        <input className="saisie" type="url" placeholder="https://…/offres" aria-label="Adresse du jobboard" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="saisie" placeholder="Nom (facultatif)" aria-label="Nom du jobboard" value={nom} onChange={(e) => setNom(e.target.value)} />
        <span className="espace" />
        <Action plein iconeApres={ICONES.plus_pages} disabled={occupe || !url.trim()} title="Le site rejoint la veille : ses offres sont cherchées avec vos profils de recherche." onClick={() => void ajouter()}>
          Ajouter un jobboard
        </Action>
      </form>
      <div className="defile">
        <table>
          <thead>
            <tr><th>Nom</th><th>Adresse</th><th aria-label="Geste" /></tr>
          </thead>
          <tbody>
            {(lu ?? []).map((j) => (
              <tr key={j.url}>
                <td title={j.nom}>{j.nom || '—'}</td>
                <td className="d" title={j.url}>{j.url}</td>
                <td><Action disabled={occupe} title="Il ne sera plus fouillé pour vous" onClick={() => void retirer(j)}>Retirer</Action></td>
              </tr>
            ))}
            {lu && !lu.length && (
              <tr className="vide-f"><td colSpan={3}>Aucun jobboard : ajoutez l&apos;adresse d&apos;un site d&apos;offres, il sera fouillé avec vos recherches à chaque cycle de veille.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {vue}
    </Fenetre>
  );
}
