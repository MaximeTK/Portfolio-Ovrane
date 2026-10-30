'use client';

import { LienIllusion } from '../../partage/LienIllusion';
import { useEffect, useState } from 'react';
import { appeler } from '../../api';
import type { Onglet } from '../../dock/Panneau';
import { jourMois, nomProfil } from '../../partage/FicheOffre';

// Ce que /workflows/rejeu rend : le dernier passage du compte, l'étape qui attend son ordre, une étape du journal, sa fin
export type Saisie = { question?: string; valeur?: string; source?: { sorte?: string; donnee?: string }; signalement?: string; site?: string; ligne?: string; page?: string };
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

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sansProtocole = (u?: string) => (u ?? '').replace(/^https?:\/\//i, '');

// Chaque sorte de passage telle que la page la nomme
const SORTES: Record<string, string> = { rejouer: 'Rejeu sans IA', corriger: "Rejeu avec l'IA en repli", refaire: "Refonte par l'IA" };
const CONCLUSIONS: Record<string, string> = { fusionner: 'fusionné à celui en base', remplacer: 'mis à la place de celui en base', annuler: 'annulé' };
// D'où vient une valeur saisie ; déduite ou inventée, elle demande l'attention
export const SOURCES_SAISIE: Record<string, string> = {
  exacte: 'de la fiche', deduite: 'déduite', inventee: 'inventée', offre: "propre à l'offre", cv: "CV de l'offre", lettre: "lettre de l'offre",
  fixe: 'case', coffre: 'coffre', modele: "écrite par l'IA", non_declaree: 'non déclarée',
};
const A_VERIFIER = ['deduite', 'inventee'];
const SECTIONS_DE_CHAMP: Record<string, string> = { identite: 'Identité', presentation: 'Présentation', situation: 'Situation', remuneration: 'Rémunération', motivations: 'Motivations', reponses_fixes: 'Réponses fixes' };
const FORMES_CHAMP: Record<string, string> = { text: 'Texte', texte_long: 'Texte long', nombre: 'Nombre', choix: 'Choix', liste: 'Liste', email: 'E-mail', lieu: 'Lieu (commune)' };
// « Ville de naissance » → ville_de_naissance
const cleDe = (texte?: string) => (texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', 'aria-hidden': true } as const;
const ICONES = {
  arreter: <svg {...TRAIT}><rect x="6" y="6" width="12" height="12" /></svg>,
  auto: <svg {...TRAIT}><path d="m5 5 7 7-7 7M13 5l7 7-7 7" /></svg>,
  suivant: <svg {...TRAIT}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  jouer: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
  valider: <svg {...TRAIT} strokeWidth={2.6}><path d="m5 12 5 5 9-10" /></svg>,
  chevron: <svg {...TRAIT}><path d="m6 9 6 6 6-6" /></svg>,
};
const ico = (i: React.ReactNode) => <span className="ico">{i}</span>;

// La source d'une valeur saisie : son nom, la donnée de la fiche dessous
function Source({ s }: { s?: { sorte?: string; donnee?: string } }) {
  const sorte = s?.sorte ?? '';
  return <><span className={`src${A_VERIFIER.includes(sorte) ? ' att' : ''}`}>{SOURCES_SAISIE[sorte] ?? sorte}</span>{s?.donnee && <> <code>{s.donnee}</code></>}</>;
}

// Rejouer : l'offre, le profil, lot par lot ou d'une traite, puis la sorte de passage ; rien n'est jamais envoyé
export function useOngletRejouer({ actif, adresse, site, lancer }: { actif: boolean; adresse: string; site: string; lancer: (d: DemandeRejeu) => Promise<void> }): Onglet {
  const [profils, setProfils] = useState<string[] | null>(null);
  const [url, setUrl] = useState('');
  const [profil, setProfil] = useState('');
  const [manuel, setManuel] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  // L'adresse d'une offre cherchée préremplit le passage
  useEffect(() => setUrl(/^https?:\/\//i.test(adresse) ? adresse : ''), [adresse]);
  useEffect(() => {
    if (!actif || profils) return;
    appeler<{ nom: string }[]>('/profils-candidature').then((l) => {
      setProfils(l.map((p) => p.nom));
      setProfil((p) => p || l[0]?.nom || '');
    }).catch((e) => setErreur(message(e)));
  }, [actif, profils]);
  const partir = async (sorte: DemandeRejeu['sorte']) => {
    if (!url.trim()) return setErreur("Donnez l'adresse d'une offre du site.");
    setOccupe(true);
    setErreur('');
    try {
      await lancer({ url: url.trim(), profil, mode: manuel ? 'manuel' : 'auto', sorte });
    } catch (e) {
      setErreur(message(e));
    }
    setOccupe(false);
  };
  return {
    cle: 'rejouer', titre: 'Rejouer',
    corps: (
      <div className="wf-p">
        <div className="champ"><label htmlFor="wf-url">Adresse d&apos;une offre</label>
          <input id="wf-url" className="saisie" type="url" placeholder={site ? `Une offre de ${site}` : 'https://…'} value={url}
            onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !occupe && void partir('rejouer')} />
        </div>
        <div className="champ"><label htmlFor="wf-profil">Profil</label>
          <select id="wf-profil" className="saisie" value={profil} onChange={(e) => setProfil(e.target.value)}>
            {(profils ?? []).map((n) => <option key={n} value={n}>{nomProfil(n)}</option>)}
          </select>
          <p className="aide-champ">Le profil dont les réponses servent.</p>
        </div>
        <label className="inter">Lot par lot, à mon ordre<input type="checkbox" checked={manuel} onChange={(e) => setManuel(e.target.checked)} /></label>
        <p className="aide-champ">Sans IA, le workflow enregistré se rejoue sans rien écrire. Avec l&apos;IA, elle ne fait que ce que l&apos;arbre ne sait pas et sa correction s&apos;y greffe. De zéro, l&apos;IA refait tout le chemin, à comparer ensuite. Rien n&apos;est jamais envoyé.</p>
        {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action gauche" disabled={occupe} title="L'IA refait tout le chemin, appris à part ; à la fin, on le compare à celui en base" onClick={() => void partir('refaire')}>Refaire de zéro</button>
        <button type="button" className="action" disabled={occupe} title="Le workflow enregistré, rejoué avec l'IA en repli" onClick={() => void partir('corriger')}>Avec l&apos;IA</button>
        <button type="button" className="action plein" disabled={occupe} title="Le workflow enregistré, rejoué sans l'IA et sans rien écrire" onClick={() => void partir('rejouer')}>Rejouer sans IA{ico(ICONES.jouer)}</button>
      </>
    ),
  };
}

type ProprietesRejeu = {
  rejeu: EtatRejeu; occupe: boolean; signales: Set<number>;
  lirePas: (sens: number) => void; ordonner: (ordre: 'suivant' | 'auto' | 'arreter') => void; signaler: (n: number) => void;
};

// Rejeu : l'état allumé tant qu'il tourne, l'offre rejouée, le journal pas à pas, le lot qui attend et ce qui a été saisi
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
            <details className="bloc-f lignes-journal"><summary>Lignes de l&apos;étape{ICONES.chevron}</summary><pre>{(e.journal ?? []).join('\n')}</pre></details>
          )}
        </div>
        {e.attente && (
          <div className="section-f"><h3>Lot à jouer</h3>
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
          </div>
        )}
        {champs.length > 0 && (
          <div className="section-f"><h3>Ce qui a été saisi</h3>
            <table className="tab-wf saisi">
              <thead><tr><th>Question</th><th>Valeur</th><th>Source</th><th><span className="cache">Signaler</span></th></tr></thead>
              <tbody>
                {champs.map((c, n) => {
                  const sorte = c.source?.sorte ?? '';
                  const signal = c.signalement === 'valide' ? <span className="signalee">valeur signalée fausse sur ce site</span>
                    : c.signalement === 'en_attente' || signales.has(n) ? <span className="signalee">signalée, en attente</span>
                      : c.ligne && !['cv', 'lettre', 'coffre'].includes(sorte) ? <button type="button" className="btn-l" onClick={() => signaler(n)}>Signaler</button> : null;
                  return <tr key={n}><td>{c.question || '—'}</td><td>{c.valeur || '—'}</td><td><Source s={c.source} /></td><td>{signal}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),
    pied: e.en_cours ? (
      <>
        <button type="button" className="action gauche" disabled={occupe} onClick={() => ordonner('arreter')}>{ico(ICONES.arreter)}Arrêter</button>
        {e.mode === 'manuel' && (
          <>
            <button type="button" className="action" disabled={occupe} onClick={() => ordonner('auto')}>{ico(ICONES.auto)}Continuer en auto</button>
            <button type="button" className="action plein" disabled={occupe || !e.attente} onClick={() => ordonner('suivant')}>Suivant{ico(ICONES.suivant)}</button>
          </>
        )}
      </>
    ) : undefined,
  };
}

// Comparaison : le workflow refait de zéro face à celui en base, page par page, à fusionner, mettre à sa place ou annuler
export function ongletComparaison(rejeu: EtatRejeu, occupe: boolean, conclure: (geste: 'fusionner' | 'remplacer' | 'annuler') => void): Onglet {
  const noms = (liste: string[]) => (liste.length ? liste.map((n) => <code key={n}>{n}</code>) : '—');
  return {
    cle: 'comparaison', titre: 'Comparaison', label: 'Le workflow refait, comparé à celui en base',
    corps: (
      <div className="wf-p">
        <div className="section-f"><h3>Le workflow refait, comparé à celui en base</h3>
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
        </div>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action gauche" disabled={occupe} title="Le refait est effacé ; celui en base ne bouge pas" onClick={() => conclure('annuler')}>Annuler</button>
        <button type="button" className="action" disabled={occupe} title="Le refait prend toute la place de celui en base" onClick={() => conclure('remplacer')}>Remplacer</button>
        <button type="button" className="action plein" disabled={occupe} title="Les deux réunis : ce qui est identique est écrasé par le refait, le reste des deux est gardé" onClick={() => conclure('fusionner')}>Fusionner{ico(ICONES.valider)}</button>
      </>
    ),
  };
}

// Vérification : les valeurs signalées fausses, puis les données demandées qu'aucun profil ne porte ; rien ne change avant validation
export function ongletVerification({ verif, erreur, occupe, valider, rejeter, fermer }: {
  verif: Verification | null; erreur: string; occupe: boolean; valider: (s: Signalement) => void; rejeter: (s: Signalement) => void; fermer: () => void;
}): Onglet {
  return {
    cle: 'verification', titre: 'Vérification', admin: true,
    corps: (
      <div className="wf-p wf-verif">
        {erreur && <p className="erreur-f" role="alert">Vérification illisible : {erreur}</p>}
        <div className="section-f"><h3>Valeurs signalées fausses</h3>
          {verif && !verif.signalements.length ? <p className="texte-f">Aucun signalement en attente.</p> : (
            <table className="tab-wf verif-s">
              <thead><tr><th>Site</th><th>Question</th><th>Source</th><th>Signalée</th><th><span className="cache">Décision</span></th></tr></thead>
              <tbody>
                {(verif?.signalements ?? []).map((s) => (
                  <tr key={s.cle}>
                    <td>{s.site}</td><td>{s.question || '—'}</td>
                    <td><span className={`src${A_VERIFIER.includes(s.source?.sorte ?? '') ? ' att' : ''}`}>{SOURCES_SAISIE[s.source?.sorte ?? ''] ?? s.source?.sorte ?? ''}</span>{s.source?.donnee && <><br /><code>{s.source.donnee}</code></>}</td>
                    <td>{s.compte} fois,<br /><span className="d">dernière {jourMois(s.dernier)}</span></td>
                    <td className="pile">
                      <button type="button" className="btn-l" aria-haspopup="dialog" disabled={occupe} onClick={() => valider(s)}>Valider…</button>
                      <button type="button" className="btn-l gris" disabled={occupe} onClick={() => rejeter(s)}>Rejeter</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="section-f"><h3>Données demandées hors du profil</h3>
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
        </div>
      </div>
    ),
    pied: (
      <>
        <span className="aide-champ gauche">Rien ne change avant validation.</span>
        <button type="button" className="action" onClick={fermer}>Fermer</button>
      </>
    ),
  };
}

// Champ du profil : la validation d'un signalement crée ce champ au profil de tous, ou le rend obligatoire
const VIERGE = { cle: '', libelle: '', section: 'identite', type: 'text', choix: '', obligatoire: true };
export function useOngletChamp({ cible, champs, valider, annuler }: {
  cible: Signalement | null; champs: { cle: string; libelle: string }[]; valider: (s: Signalement, champ: Champ) => Promise<void>; annuler: () => void;
}): Onglet {
  const [f, setF] = useState(VIERGE);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  // Un nouveau signalement à valider préremplit la clé et le libellé de sa question
  useEffect(() => {
    if (!cible) return;
    setF({ ...VIERGE, cle: cleDe(cible.question || cible.ligne), libelle: cible.question ?? '' });
    setErreur('');
  }, [cible]);
  const partir = async () => {
    if (!cible) return;
    setOccupe(true);
    setErreur('');
    try {
      await valider(cible, { cle: f.cle.trim(), libelle: f.libelle.trim(), section: f.section, type: f.type, obligatoire: f.obligatoire,
        choix: f.choix.split(',').map((c) => c.trim()).filter(Boolean) });
    } catch (e) {
      setErreur(message(e));
    }
    setOccupe(false);
  };
  const poser = (cle: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [cle]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && !occupe && void partir();
  return {
    cle: 'champ', titre: 'Champ du profil', admin: true,
    corps: (
      <div className="wf-p">
        {cible && <p className="texte-f">Valider « {cible.question || cible.ligne} » sur {cible.site}. Une clé déjà au profil le rend obligatoire ; une nouvelle l&apos;y ajoute pour tous.</p>}
        <div className="grille-2">
          <div className="champ"><label htmlFor="wf-cle">Clé du profil</label>
            <input id="wf-cle" className="saisie" type="text" list="wf-cles" autoComplete="off" value={f.cle} onChange={poser('cle')} onKeyDown={entree} />
            <datalist id="wf-cles">{champs.map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}</datalist>
          </div>
          <div className="champ"><label htmlFor="wf-lib">Libellé</label><input id="wf-lib" className="saisie" type="text" value={f.libelle} onChange={poser('libelle')} onKeyDown={entree} /></div>
        </div>
        <div className="grille-2">
          <div className="champ"><label htmlFor="wf-sec">Section</label>
            <select id="wf-sec" className="saisie" value={f.section} onChange={poser('section')}>{Object.entries(SECTIONS_DE_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </div>
          <div className="champ"><label htmlFor="wf-forme">Forme</label>
            <select id="wf-forme" className="saisie" value={f.type} onChange={poser('type')}>{Object.entries(FORMES_CHAMP).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </div>
        </div>
        <div className="champ"><label htmlFor="wf-choix">Choix</label>
          <input id="wf-choix" className="saisie" type="text" value={f.choix} onChange={poser('choix')} onKeyDown={entree} />
          <p className="aide-champ">Séparés par des virgules.</p>
        </div>
        <label className="inter">Obligatoire<input type="checkbox" checked={f.obligatoire} onChange={poser('obligatoire')} /></label>
        {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={annuler}>Annuler</button>
        <button type="button" className="action plein" disabled={occupe} onClick={() => void partir()}>Valider{ico(ICONES.valider)}</button>
      </>
    ),
  };
}

// Profil incomplet : le profil choisi a des champs obligatoires vides, aucun passage ne part avec lui
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
        <button type="button" className="action" onClick={fermer}>Fermer</button>
        {(incomplet?.profils ?? []).map((p) => (
          <LienIllusion key={p.nom} vers={`profil?fiche=${encodeURIComponent(`${nomProfil(p.nom)}.json`)}`} className="action plein">Compléter {nomProfil(p.nom)}{ico(ICONES.suivant)}</LienIllusion>
        ))}
      </>
    ),
  };
}
