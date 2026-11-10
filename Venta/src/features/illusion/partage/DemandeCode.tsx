'use client';

import './demande-code.css';
import { useCallback, useState } from 'react';
import { appeler } from '../api';
import { useSondage } from '../activite/sondage';
import { Action } from '../elements/Action';
import { ChampSaisie } from '../elements/Champ';
import { message } from '../elements/format';

// Ce que /adresses/demande rend : le site qui attend, s'il y en a un
type Lue = { allume: boolean; demande: { site: string; cree_le: string } | null };

// Bandeau de toutes les pages : le code ou le lien qu'aucun mail n'a apporté
export function DemandeCode() {
  const [lue, setLue] = useState<Lue | null>(null);
  const [valeur, setValeur] = useState('');
  const [expediteur, setExpediteur] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const lire = useCallback(async () => {
    try {
      setLue(await appeler<Lue>('/adresses/demande', { signal: null }));
    } catch {
      // Une panne passagère ne montre rien : la lecture suivante la rattrape
    }
  }, []);
  useSondage(lire, 5000, lue === null || lue.allume);

  const demande = lue?.demande;
  if (!demande) return null;
  const envoyer = async () => {
    if (!valeur.trim() || occupe) return;
    setOccupe(true);
    try {
      await appeler('/adresses/demande/repondre', { methode: 'POST', corps: { site: demande.site, valeur, expediteur } });
      setValeur('');
      setExpediteur('');
      setErreur('');
      await lire();
    } catch (e) {
      setErreur(message(e));
    } finally {
      setOccupe(false);
    }
  };
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && void envoyer();
  return (
    <section className="demande-code" aria-label="Code de validation attendu">
      <p className="texte-f"><b>{demande.site}</b> attend un code ou un lien de validation. S&apos;il est arrivé dans votre boîte, collez-le ici.</p>
      <div className="demande-champs">
        <ChampSaisie id="demande-valeur" libelle="Code ou lien" autoComplete="off" value={valeur} onChange={(e) => setValeur(e.target.value)} onKeyDown={entree} />
        <ChampSaisie id="demande-expediteur" libelle="Adresse de l'expéditeur (facultatif)" autoComplete="off" value={expediteur} placeholder="no-reply@site.fr" onChange={(e) => setExpediteur(e.target.value)} onKeyDown={entree} />
        <Action plein disabled={occupe || !valeur.trim()} onClick={() => void envoyer()}>Envoyer</Action>
      </div>
      {erreur && <p className="aide-champ erreur" role="alert">{erreur}</p>}
    </section>
  );
}
