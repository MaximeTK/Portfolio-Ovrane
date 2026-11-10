'use client';

import { LienIllusion } from '../../partage/LienIllusion';
import { useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { AuPied, type Onglet } from '../../dock/Panneau';
import { SOURCES_SAISIE, signalable, type Saisie } from '../../partage/FicheOffre';
import { Action } from '../../elements/Action';
import { Champ, Interrupteur, ChampSaisie, ChampListe, SectionFiche } from '../../elements/Champ';
import { ICONES } from '../../elements/icones';
import { jourMoisIso, message, nomProfil } from '../../elements/format';
import { CHAMP_VIERGE, ChampsDuProfil, champVersEnvoi, useFormChamp } from '../profil/FormChampProfil';
import { useGeste } from '../commun';

// Ce que /workflows/rejeu rend : dernier passage, étape en attente, journal.
type Geste = { geste?: string; cible?: string; valeur?: string; ligne?: string; jade?: boolean };
type Comparaison = { arbres?: { page: string; identiques: string[]; nouvelles: string[]; changees: string[]; absentes: string[] }[] };
export type EtatRejeu = {
  en_cours: boolean; url?: string; site?: string; mode?: string; sorte?: string; profil?: string;
  attente?: { url?: string; titre?: string; gestes?: Geste[]; vu?: number } | null; pas?: number; pas_total?: number; journal?: string[];
  statut?: string; fin?: string; erreur?: string; comparaison?: Comparaison | null; conclusion?: string; champs?: Saisie[];
};
export type Signalement = { cle: string; site: string; ligne: string; question?: string; source?: { sorte?: string; donnee?: string }; compte: number; dernier: string };
export type Verification = { signalements: Signalement[]; donnees: { cle: string; libelles?: string[]; sites?: string[]; compte?: number }[]; champs: { cle: string; libelle: string }[] };
export type Incomplet = { message: string; profils: { nom: string; manquants: { cle: string; libelle: string }[] }[] };
export type DemandeRejeu = { url: string; profil: string; mode: 'manuel' | 'auto'; sorte: 'rejouer' | 'corriger' | 'refaire' };
export type Champ = { cle: string; libelle: string; section: string; type: string; choix: string[]; obligatoire: boolean };

const sansProtocole = (u?: string) => (u ?? '').replace(/^https?:\/\//i, '');

// Chaque sorte de passage telle que la page la nomme
const SORTES: Record<string, string> = { rejouer: 'Rejeu sans IA', corriger: "Rejeu avec l'IA en repli", refaire: "Refonte par l'IA" };
const CONCLUSIONS: Record<string, string> = { fusionner: 'fusionné à celui en base', remplacer: 'mis à la place de celui en base', annuler: 'annulé' };
// Une valeur déduite ou inventée demande l'attention
const A_VERIFIER = ['deduite', 'inventee'];
// « Ville de naissance » → ville_de_naissance
const cleDe = (texte?: string) => (texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);



// La source d'une valeur saisie : son nom, la donnée de la fiche à la suite
function Source({ s, saut }: { s?: { sorte?: string; donnee?: string }; saut?: boolean }) {
  const sorte = s?.sorte ?? '';
  return <><span className={`src${A_VERIFIER.includes(sorte) ? ' att' : ''}`}>{SOURCES_SAISIE[sorte] ?? sorte}</span>{s?.donnee && <>{saut ? <br /> : ' '}<code>{s.donnee}</code></>}</>;
}

// Rejouer : offre, profil, mode de lot ; rien n'est jamais envoyé.
export function useOngletRejouer({ actif, adresse, site, lancer }: { actif: boolean; adresse: string; site: string; lancer: (d: DemandeRejeu) => Promise<void> }): Onglet {
  // Profils lus gardés d'une visite à l'autre, relus à la première ouverture.
  const [profils, setProfils] = useState(() => repris<string[] | null>('workflows:profils', null));
  useGarder('workflows', { profils });
  const lus = useRef(false);
  const [url, setUrl] = useState('');
  const [profil, setProfil] = useState(() => profils?.[0] ?? '');
  const [manuel, setManuel] = useState(true);
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  // L'adresse d'une offre cherchée préremplit le passage
  useEffect(() => setUrl(/^https?:\/\//i.test(adresse) ? adresse : ''), [adresse]);
  useEffect(() => {
    if (!actif || lus.current) return;
    lus.current = true;
    appeler<{ nom: string }[]>('/profils-candidature').then((l) => {
      setProfils(l.map((p) => p.nom));
      setProfil((p) => p || l[0]?.nom || '');
    }).catch((e) => {
      lus.current = false;
      setErreur(message(e));
    });
  }, [actif]);
  const partir = (sorte: DemandeRejeu['sorte']) => {
    if (!url.trim()) return setErreur("Donnez l'adresse d'une offre du site.");
    return geste(async () => {
      setErreur('');
      await lancer({ url: url.trim(), profil, mode: manuel ? 'manuel' : 'auto', sorte });
    });
  };
  return {
    cle: 'rejouer', titre: 'Rejouer',
    corps: (
      <div className="wf-p">
        <ChampSaisie id="wf-url" libelle="Adresse d&apos;une offre" type="url" placeholder={site ? `Une offre de ${site}` : 'https://…'} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !occupe && void partir('rejouer')} />
        <ChampListe id="wf-profil" libelle="Profil" aide="Le profil dont les réponses servent." value={profil} onChange={(e) => setProfil(e.target.value)}>
            {(profils ?? []).map((n) => <option key={n} value={n}>{nomProfil(n)}</option>)}
          </ChampListe>
        <Interrupteur libelle="Lot par lot, à mon ordre" checked={manuel} onChange={(e) => setManuel(e.target.checked)} />
        <p className="aide-champ">Sans IA, le workflow enregistré se rejoue sans rien écrire. Avec l&apos;IA, elle ne fait que ce que l&apos;arbre ne sait pas et sa correction s&apos;y greffe. De zéro, l&apos;IA refait tout le chemin, à comparer ensuite. Rien n&apos;est jamais envoyé.</p>
        {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      </div>
    ),
    pied: (
      <>
        <Action className="gauche" disabled={occupe} title="L'IA refait tout le chemin, appris à part ; à la fin, on le compare à celui en base" onClick={() => void partir('refaire')}>Refaire de zéro</Action>
        <Action disabled={occupe} title="Le workflow enregistré, rejoué avec l'IA en repli" onClick={() => void partir('corriger')}>Avec l&apos;IA</Action>
        <Action iconeApres={ICONES.jouer} plein disabled={occupe} title="Le workflow enregistré, rejoué sans l'IA et sans rien écrire" onClick={() => void partir('rejouer')}>Rejouer sans IA</Action>
      </>
    ),
  };
}

type ProprietesRejeu = {
  rejeu: EtatRejeu; occupe: boolean; signales: Set<number>;
  lirePas: (sens: number) => void; ordonner: (ordre: 'suivant' | 'auto' | 'arreter') => void; signaler: (n: number) => void;
};

// Rejeu : état allumé, offre rejouée, journal pas à pas, lot en attente.
export function ongletRejeu({ rejeu: e, occupe, signales, lirePas, ordonner, signaler }: ProprietesRejeu): Onglet {
  const total = e.pas_total ?? 0;
  const dit = e.en_cours
    ? (e.attente ? 'attend ton ordre avant le lot suivant' : `en cours — ${e.mode}`)
    : `fini${e.statut ? ` (${e.statut})` : ''} : ${e.erreur || e.fin || 'sans compte rendu'}${e.conclusion ? ` — workflow refait ${CONCLUSIONS[e.conclusion] ?? e.conclusion}` : ''}`;
  const champs = e.champs ?? [];
  return {
    cle: 'rejeu', titre: 'Rejeu', label: `Rejeu · ${e.site ?? ''}`,
    corps: (
      <div className="wf-p wf-rejeu">
        <div className="section-f">
          <p className="etat-rejeu">{e.en_cours && <span className="voyant" aria-hidden="true" />}<b>{SORTES[e.sorte ?? ''] ?? 'Passage'} {e.mode}</b><span className={e.en_cours ? 'on' : ''}>{dit}</span></p>
          <p className="adresse" title={e.url}>{sansProtocole(e.url)} · {nomProfil(e.profil ?? '')}</p>
          {total > 0 && (
            <p className="journal">Journal
              <button type="button" className="pl" aria-label="Étape précédente du journal" disabled={!e.pas} onClick={() => lirePas(-1)}>‹</button>
              <span>{e.pas ? `Étape ${e.pas} / ${total - 1} — envoi puis réponse` : 'Préparation'}</span>
              <button type="button" className="pl" aria-label="Étape suivante du journal" disabled={(e.pas ?? 0) >= total - 1} onClick={() => lirePas(1)}>›</button>
            </p>
          )}
          {(e.journal ?? []).length > 0 && (
            <details className="bloc-f lignes-journal"><summary>Lignes de l&apos;étape{ICONES.suite}</summary><pre>{(e.journal ?? []).join('\n')}</pre></details>
          )}
        </div>
        {e.attente && (
          <SectionFiche titre="Lot à jouer">
            <p className="lot-page" title={e.attente.url}>{[e.attente.titre, sansProtocole(e.attente.url)].filter(Boolean).join(' — ')}</p>
            <div className="lot">
              <ol className="gestes">
                {(e.attente.gestes ?? []).map((g, n) => (
                  <li key={n} title={g.ligne ? `ligne ${g.ligne}` : undefined}><span>{g.geste}</span>
                    <span>« {g.cible || '?'} »{g.valeur ? ` = « ${g.valeur} »` : ''}{g.jade && <> <small>JADE</small></>}</span></li>
                ))}
              </ol>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="capture" src={`/api/illusion/app/workflows/rejeu/capture?v=${e.attente.vu ?? 0}`} alt="La page avant le lot" />
            </div>
          </SectionFiche>
        )}
        {champs.length > 0 && (
          <SectionFiche titre="Ce qui a été saisi">
            <table className="tab-wf saisi">
              <thead><tr><th>Question</th><th>Valeur</th><th>Source</th><th><span className="cache">Signaler</span></th></tr></thead>
              <tbody>
                {champs.map((c, n) => {
                  const signal = c.signalement === 'valide' ? <span className="signalee">valeur signalée fausse sur ce site</span>
                    : c.signalement === 'en_attente' || signales.has(n) ? <span className="signalee">signalée, en attente</span>
                      : signalable(c) ? <button type="button" className="btn-l" onClick={() => signaler(n)}>Signaler</button> : null;
                  return <tr key={n}><td>{c.question || '—'}</td><td>{c.valeur || '—'}</td><td><Source s={c.source} /></td><td>{signal}</td></tr>;
                })}
              </tbody>
            </table>
          </SectionFiche>
        )}
      </div>
    ),
    pied: e.en_cours ? (
      <>
        <Action icone={ICONES.arreter} className="gauche" disabled={occupe} onClick={() => ordonner('arreter')}>Arrêter</Action>
        {e.mode === 'manuel' && (
          <>
            <Action icone={ICONES.auto} disabled={occupe} onClick={() => ordonner('auto')}>Continuer en auto</Action>
            <Action iconeApres={ICONES.fleche} plein disabled={occupe || !e.attente} onClick={() => ordonner('suivant')}>Suivant</Action>
          </>
        )}
      </>
    ) : undefined,
  };
}

// Comparaison : le refait de zéro face à celui en base, à fusionner ou annuler.
export function ongletComparaison(rejeu: EtatRejeu, occupe: boolean, conclure: (geste: 'fusionner' | 'remplacer' | 'annuler') => void): Onglet {
  const noms = (liste: string[]) => (liste.length ? liste.map((n) => <code key={n}>{n}</code>) : '—');
  return {
    cle: 'comparaison', titre: 'Comparaison', label: 'Le workflow refait, comparé à celui en base',
    corps: (
      <div className="wf-p">
        <SectionFiche titre="Le workflow refait, comparé à celui en base">
          {(rejeu.comparaison?.arbres ?? []).map((a) => {
            const nouveaux = [...a.nouvelles, ...a.changees.map((n) => `${n} (changée)`)];
            return (
              <div key={a.page} className="comparaison">
                <p className="page-c"><code>{a.page}</code></p>
                <dl className="def">
                  <dt>Identiques <span className="compteur">{a.identiques.length}</span></dt><dd>{noms(a.identiques)}</dd>
                  <dt>Nouveaux <span className="compteur">{nouveaux.length}</span></dt><dd>{noms(nouveaux)}</dd>
                  <dt>Absents du refait <span className="compteur">{a.absentes.length}</span></dt><dd>{noms(a.absentes)}</dd>
                </dl>
              </div>
            );
          })}
        </SectionFiche>
      </div>
    ),
    pied: (
      <>
        <Action className="gauche" disabled={occupe} title="Le refait est effacé ; celui en base ne bouge pas" onClick={() => conclure('annuler')}>Annuler</Action>
        <Action disabled={occupe} title="Le refait prend toute la place de celui en base" onClick={() => conclure('remplacer')}>Remplacer</Action>
        <Action iconeApres={ICONES.valider} plein disabled={occupe} title="Les deux réunis : ce qui est identique est écrasé par le refait, le reste des deux est gardé" onClick={() => conclure('fusionner')}>Fusionner</Action>
      </>
    ),
  };
}

// Vérification : valeurs signalées fausses, données sans profil.
export function ongletVerification({ verif, erreur, occupe, valider, rejeter, fermer }: {
  verif: Verification | null; erreur: string; occupe: boolean; valider: (s: Signalement) => void; rejeter: (s: Signalement) => void; fermer: () => void;
}): Onglet {
  return {
    cle: 'verification', titre: 'Vérification', admin: true,
    corps: (
      <div className="wf-p wf-verif">
        {erreur && <p className="erreur-f" role="alert">Vérification illisible : {erreur}</p>}
        <SectionFiche titre="Valeurs signalées fausses">
          {verif && !verif.signalements.length ? <p className="texte-f">Aucun signalement en attente.</p> : (
            <table className="tab-wf verif-s">
              <thead><tr><th>Site</th><th>Question</th><th>Source</th><th>Signalée</th><th><span className="cache">Décision</span></th></tr></thead>
              <tbody>
                {(verif?.signalements ?? []).map((s) => (
                  <tr key={s.cle}>
                    <td>{s.site}</td><td>{s.question || '—'}</td>
                    <td><Source s={s.source} saut /></td>
                    <td>{s.compte} fois,<br /><span className="d">dernière {jourMoisIso(s.dernier)}</span></td>
                    <td className="pile">
                      <button type="button" className="btn-l" aria-haspopup="dialog" disabled={occupe} data-ouvre="champ" data-objet={s.cle} onClick={() => valider(s)}>Valider…</button>
                      <button type="button" className="btn-l gris" disabled={occupe} onClick={() => rejeter(s)}>Rejeter</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionFiche>
        <SectionFiche titre="Données demandées hors du profil">
          {verif && !verif.donnees.length ? <p className="texte-f">Rien de demandé hors du profil.</p> : (
            <table className="tab-wf verif-d">
              <thead><tr><th>Donnée</th><th>Libellés vus</th><th>Sites</th><th>Demandée</th><th><span className="cache">Ajouter</span></th></tr></thead>
              <tbody>
                {(verif?.donnees ?? []).map((d) => (
                  <tr key={d.cle}>
                    <td><code>{d.cle}</code></td><td>{(d.libelles ?? []).join(' · ')}</td><td>{(d.sites ?? []).join(', ')}</td><td>{d.compte ?? 0} fois</td>
                    <td><LienIllusion className="btn-l" vers={`profil?${new URLSearchParams({ champ: d.cle, libelle: d.libelles?.[0] ?? d.cle })}`}>Ajouter au profil…</LienIllusion></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionFiche>
      </div>
    ),
    pied: (
      <>
        <span className="aide-champ gauche">Rien ne change avant validation.</span>
        <Action onClick={fermer}>Fermer</Action>
      </>
    ),
  };
}

type ProprietesChamp = { champs: { cle: string; libelle: string }[]; valider: (s: Signalement, champ: Champ) => Promise<void>; annuler: () => void };

// Champ du profil : valider un signalement le crée ou le rend obligatoire.
export function ongletChamp(cible: Signalement, proprietes: ProprietesChamp): Onglet {
  return { cle: 'champ', titre: 'Champ du profil', admin: true, corps: <ChampDuProfil cible={cible} {...proprietes} />, pied: true };
}

function ChampDuProfil({ cible, champs, valider, annuler }: ProprietesChamp & { cible: Signalement }) {
  // Le signalement préremplit la clé et le libellé de sa question
  const { f, poser } = useFormChamp(() => ({ ...CHAMP_VIERGE, cle: cleDe(cible.question || cible.ligne), libelle: cible.question ?? '' }));
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  const partir = () => geste(async () => {
    setErreur('');
    await valider(cible, champVersEnvoi(f));
  });
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && !occupe && void partir();
  return (
    <div className="wf-p">
      <p className="texte-f">Valider « {cible.question || cible.ligne} » sur {cible.site}. Une clé déjà au profil le rend obligatoire ; une nouvelle l&apos;y ajoute pour tous.</p>
      <ChampsDuProfil f={f} poser={poser} entree={entree} cles={champs} libelleCle="Clé du profil" />
      {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      <AuPied>
          <Action onClick={annuler}>Annuler</Action>
          <Action iconeApres={ICONES.valider} plein disabled={occupe} onClick={() => void partir()}>Valider</Action>
      </AuPied>
    </div>
  );
}

// Profil incomplet : champs obligatoires vides, aucun passage ne part avec.
export function ongletIncomplet(incomplet: Incomplet | null, fermer: () => void): Onglet {
  return {
    cle: 'profil-incomplet', titre: 'Profil incomplet', label: 'Profil incomplet : aucun passage ne part',
    corps: (
      <div className="wf-p section-f">
        <h3>Aucun passage ne part</h3>
        <p className="texte-f">{incomplet?.message}</p>
        <ul className="liste-f">
          {(incomplet?.profils ?? []).map((p) => <li key={p.nom}><b>{nomProfil(p.nom)}</b><span className="d">{p.manquants.map((m) => m.libelle).join(', ')}</span></li>)}
        </ul>
      </div>
    ),
    pied: (
      <>
        <Action onClick={fermer}>Fermer</Action>
        {(incomplet?.profils ?? []).map((p) => (
          <LienIllusion key={p.nom} vers={`profil?fiche=${encodeURIComponent(`${nomProfil(p.nom)}.json`)}`} className="action plein">Compléter {nomProfil(p.nom)}<span className="ico">{ICONES.fleche}</span></LienIllusion>
        ))}
      </>
    ),
  };
}
