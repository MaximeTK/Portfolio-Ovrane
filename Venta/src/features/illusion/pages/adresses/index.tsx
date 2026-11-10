'use client';

import './adresses.css';
import { appeler } from '../../api';
import { Fenetre } from '../../dock/Dock';
import { PageDock } from '../../activite/PageDock';
import { useSondage } from '../../activite/sondage';
import { Action } from '../../elements/Action';
import { useAvis } from '../../elements/Avis';
import { jourMois } from '../../elements/format';
import { useGeste, useLecture } from '../commun';

// Ce que /adresses rend : les adresses de façade, la fixe et celle de suivi
type Adresse = { adresse: string; site: string; actif: boolean; cree_le: string; coupee_le: string | null };
type Liste = { allume: boolean; adresses: Adresse[]; fixe: Omit<Adresse, 'site'> | null; suivi: Omit<Adresse, 'site'> | null };

export default function PageAdresses() {
  return (
    <PageDock id="adresses" principal="adresses" panneau={null}>
      <Adresses />
    </PageDock>
  );
}

function Adresses() {
  const { lu, erreur, relire } = useLecture<Liste>('adresses', 'liste', '/adresses');
  const { dire, vue } = useAvis('avis', true, erreur);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  useSondage(relire, 5000);

  const basculer = (a: Adresse) => geste(async () => {
    await appeler(`/adresses/${a.actif ? 'couper' : 'reactiver'}`, { methode: 'POST', corps: { adresse: a.adresse } });
    dire(a.actif ? `${a.site} : adresse coupée, ses mails sont refusés.` : `${a.site} : adresse réactivée.`);
  }, relire);

  // Les adresses fixe et de suivi se coupent comme les autres, en tête
  const adresses = [...(lu?.fixe ? [{ ...lu.fixe, site: 'Adresse fixe' }] : []), ...(lu?.suivi ? [{ ...lu.suivi, site: 'Adresse de suivi' }] : []), ...(lu?.adresses ?? [])];
  return (
    <Fenetre id="adresses" as="main" className="tableau" aria-label="Adresses" titrePrise="Glisser pour détacher les adresses">
      <div className="outils">
        <p className="filtre titre-groupe"><span>Adresses par site</span></p>
        <span className="espace" />
      </div>
      <div className="defile">
        <table>
          <thead>
            <tr><th>Site</th><th>Adresse</th><th>État</th><th>Depuis</th><th aria-label="Geste" /></tr>
          </thead>
          <tbody>
            {adresses.map((a) => (
              <tr key={a.adresse}>
                <td title={a.site}>{a.site}</td>
                <td className="d" title={a.adresse}>{a.adresse}</td>
                <td><span className={`eo ${a.actif ? 'env' : 'ech'}`}>{a.actif ? 'Active' : 'Coupée'}</span></td>
                <td className="d">{jourMois(a.actif ? a.cree_le : a.coupee_le)}</td>
                <td><Action disabled={occupe} title={a.actif ? 'Refuser désormais tout mail vers cette adresse' : 'Accepter de nouveau les mails vers cette adresse'} onClick={() => void basculer(a)}>{a.actif ? 'Couper' : 'Réactiver'}</Action></td>
              </tr>
            ))}
            {lu && !adresses.length && (
              <tr className="vide-f"><td colSpan={5}>Les adresses par site ne sont pas allumées sur ce serveur.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {vue}
    </Fenetre>
  );
}
