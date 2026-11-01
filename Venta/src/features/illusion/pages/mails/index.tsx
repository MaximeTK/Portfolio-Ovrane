'use client';

import './mails.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { useSondage } from '../../activite/sondage';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  ICONES, NATURES, Nature, RATTACHEMENTS, adresseSeule, formaterDate, message, nomAffiche,
  ongletFil, useOngletEcrire, useOngletEtiqueter, useOngletExecuter, useOngletReglages, type Avis, type MailLu,
} from './panneaux';

// Ce que /mails rend : la page de la boîte, son résumé et l'état de l'écoute
type EtatBoite = {
  ecoute: boolean; etape: string; adresse: string; page: number; taille: number; total_filtre: number; pages: number; mails: MailLu[];
  resume: { total: number; rattaches: number; envoyes: number; recus: number; fils: number; par_etiquette: Record<string, number> };
};
type Filtres = { etiquette: string; sens: string; recherche: string };
const SENS: Record<string, string> = { '': 'Reçus et envoyés', entrant: 'Reçus', sortant: 'Envoyés' };
const TAILLES = [25, 50];
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function PageMails({ compte }: ProprietesPage) {
  // La boîte lue et ce qui l'a choisie restent d'une visite à l'autre : en revenant, elle s'affiche aussitôt et se relit derrière
  const [etat, setEtat] = useState(() => repris<EtatBoite | null>('mails:etat', null));
  const [erreurBoite, setErreurBoite] = useState('');
  const [filtres, setFiltres] = useState(() => repris<Filtres>('mails:filtres', { etiquette: '', sens: '', recherche: '' }));
  const [page, setPage] = useState(() => repris('mails:page', 1));
  const [taille, setTaille] = useState(() => repris<number | 'auto'>('mails:taille', 'auto'));
  const [auto, setAuto] = useState(() => repris('mails:auto', 15));
  useGarder('mails', { etat, filtres, page, taille, auto });
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [avis, setAvis] = useState<Avis>(null);
  // L'API lit au moins 10 lignes ; en « auto », le défileur garde celles qui ne tiennent pas
  const adresse = `/mails?${new URLSearchParams({ ...filtres, page: String(page), taille: String(taille === 'auto' ? Math.max(10, auto) : taille) })}`;
  const relire = useCallback(async () => {
    try {
      const lu = await appeler<EtatBoite>(adresse);
      setEtat(lu);
      setErreurBoite('');
      if (lu.page > lu.pages) setPage(lu.pages);
    } catch (e) {
      setErreurBoite(message(e));
    }
  }, [adresse]);
  // La boîte et l'état de l'écoute relus toutes les 5 s, comme le bandeau et l'écoute de l'ancien dashboard
  useSondage(relire, 5000, true, adresse);
  const relireVite = useCallback(() => void relire(), [relire]);

  return (
    <Dock id="mails" principal="boite" panneau={null}>
      <Activite />
      <Boite admin={compte.admin} etat={etat} erreurBoite={erreurBoite} filtres={filtres} setFiltres={(f) => { setFiltres(f); setPage(1); }}
        page={page} setPage={setPage} taille={taille} setTaille={(t) => { setTaille(t); setPage(1); }} auto={auto} setAuto={setAuto}
        selection={selection} setSelection={setSelection} avis={avis} setAvis={setAvis} relire={relire} />
      <PanneauDePage admin={compte.admin} adresseBoite={etat?.adresse ?? ''} selection={selection} setAvis={setAvis} relire={relireVite} setPage={setPage} />
    </Dock>
  );
}

type ProprietesBoite = {
  admin: boolean; etat: EtatBoite | null; erreurBoite: string; filtres: Filtres; setFiltres: (f: Filtres) => void;
  page: number; setPage: (p: number) => void; taille: number | 'auto'; setTaille: (t: number | 'auto') => void; auto: number; setAuto: (n: number) => void;
  selection: Set<string>; setSelection: (s: Set<string>) => void; avis: Avis; setAvis: (a: Avis) => void; relire: () => Promise<void>;
};

function Boite({ admin, etat, erreurBoite, filtres, setFiltres, page, setPage, taille, setTaille, auto, setAuto, selection, setSelection, avis, setAvis, relire }: ProprietesBoite) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [confirmation, setConfirmation] = useState<'supprimer' | 'vider' | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [menu, setMenu] = useState<'etiquette' | 'sens' | null>(null);
  const [saisie, setSaisie] = useState(filtres.recherche);
  const [aller, setAller] = useState('');
  const defile = useRef<HTMLDivElement>(null);

  // La recherche part au serveur quand la frappe se pose, sinon chaque lettre lancerait une requête aussitôt périmée
  useEffect(() => {
    if (saisie === filtres.recherche) return;
    const t = setTimeout(() => setFiltres({ ...filtres, recherche: saisie }), 250);
    return () => clearTimeout(t);
  }, [saisie, filtres, setFiltres]);
  // Échap ferme un menu, sinon la confirmation, sinon le panneau
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(null);
      else if (confirmation) setConfirmation(null);
      else fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [menu, confirmation, fermer]);
  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);
  // « auto » : autant de lignes que la hauteur du défileur en montre sans en couper une ; remesuré quand les premières lignes donnent leur hauteur
  const garnie = !!etat?.mails.length;
  useLayoutEffect(() => {
    const zone = defile.current;
    if (!zone) return;
    const mesurer = () => {
      const tete = zone.querySelector('thead')?.getBoundingClientRect().height ?? 34;
      const ligne = zone.querySelector('tbody tr')?.getBoundingClientRect().height || 36;
      setAuto(Math.max(1, Math.floor((zone.clientHeight - tete) / ligne)));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, [setAuto, garnie]);

  const mails = etat?.mails ?? [];
  const resume = etat?.resume;
  const n = selection.size;
  const toutes = mails.length > 0 && mails.every((m) => selection.has(m.message_id));
  const cocher = (ids: string[], oui: boolean) => {
    const s = new Set(selection);
    ids.forEach((id) => (oui ? s.add(id) : s.delete(id)));
    setSelection(s);
  };
  const ouvrirFil = (id: string) => ouvrir('fil', id);
  const geste = async (faire: () => Promise<Avis>) => {
    setOccupe(true);
    try {
      setAvis(await faire());
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
      setConfirmation(null);
      await relire();
    }
  };
  const supprimer = () => geste(async () => {
    const r = await appeler<{ efface: number }>('/mails/supprimer', { methode: 'POST', corps: { identifiants: [...selection] } });
    setSelection(new Set());
    return { texte: `${r.efface} mail(s) supprimé(s).` };
  });
  const vider = () => geste(async () => {
    const r = await appeler<{ efface: number }>('/mails/vider', { methode: 'POST' });
    setSelection(new Set());
    setPage(1);
    return { texte: `${r.efface} mail(s) effacé(s).` };
  });
  const basculerEcoute = () => geste(async () => {
    const armee = !!etat?.ecoute;
    await appeler(armee ? '/mails/ecoute/arreter' : '/mails/ecoute', { methode: 'POST' });
    setTimeout(() => void relire(), 1500);
    return { texte: armee ? 'Écoute arrêtée.' : 'Écoute démarrée : la boîte est vérifiée toutes les 10 s, sans fin.' };
  });
  const rattacher = () => geste(async () => {
    const r = await appeler<{ reetiquetes: number; recolles: number; erreur: string }>('/mails/rattacher', { methode: 'POST' });
    const bouge = r.reetiquetes || r.recolles;
    return {
      texte: r.erreur ? `${r.recolles} mail(s) rattaché(s), tri non repassé : ${r.erreur}`
        : bouge ? `${r.reetiquetes} mail(s) réétiqueté(s), ${r.recolles} rattaché(s).` : 'Rien de plus à trier ni à rattacher.',
      erreur: !!r.erreur || !bouge,
    };
  });

  const natures = Object.entries(resume?.par_etiquette ?? {});
  if (filtres.etiquette && !natures.some(([t]) => t === filtres.etiquette)) natures.push([filtres.etiquette, 0]);
  const pages = etat?.pages ?? 1;
  const numeros = [...new Set([1, 2, 3, page - 1, page, page + 1, pages - 2, pages - 1, pages])].filter((x) => x >= 1 && x <= pages).sort((a, b) => a - b);
  const allerA = () => {
    const x = Number(aller);
    if (Number.isInteger(x) && x >= 1 && x <= pages) setPage(x);
    setAller('');
  };
  // Les numéros proches du début, de la page et de la fin ; le premier trou devient le « … » où taper la page voulue
  const boutons: React.ReactNode[] = [];
  let trou = false;
  numeros.forEach((x, i) => {
    if (i > 0 && x - numeros[i - 1] > 1) {
      boutons.push(trou
        ? <span key={`trou-${x}`} className="pl trou" aria-hidden="true">…</span>
        : <input key="aller" type="text" className="aller" inputMode="numeric" placeholder="…" size={3} aria-label="Aller à la page" value={aller}
            onChange={(e) => setAller(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && allerA()} onBlur={() => aller && allerA()} />);
      trou = true;
    }
    boutons.push(<button key={x} type="button" className={`pl${x === page ? ' actif' : ''}`} aria-current={x === page ? 'page' : undefined} onClick={() => setPage(x)}>{x}</button>);
  });

  return (
    <Fenetre id="boite" as="main" className="tableau boite" aria-label="Mails" titrePrise="Glisser pour détacher la boîte">
      <div className="outils">
        <MenuFiltre ouvert={menu === 'etiquette'} basculer={() => setMenu(menu === 'etiquette' ? null : 'etiquette')} fermer={() => setMenu(null)}
          lib="Nature" actif={!!filtres.etiquette} valeur={filtres.etiquette ? NATURES[filtres.etiquette] ?? filtres.etiquette : 'toutes'}
          options={[{ valeur: '', nom: 'Toutes', compte: resume?.total ?? -1 }, ...natures.map(([t, c]) => ({ valeur: t, nom: NATURES[t] ?? t, compte: c }))]}
          courant={filtres.etiquette} choisir={(v) => { setFiltres({ ...filtres, etiquette: v }); setMenu(null); }} />
        <MenuFiltre ouvert={menu === 'sens'} basculer={() => setMenu(menu === 'sens' ? null : 'sens')} fermer={() => setMenu(null)}
          lib="Sens" actif={!!filtres.sens} valeur={SENS[filtres.sens]}
          options={Object.entries(SENS).map(([v, nom]) => ({ valeur: v, nom, compte: v === 'entrant' ? resume?.recus ?? -1 : v === 'sortant' ? resume?.envoyes ?? -1 : -1 }))}
          courant={filtres.sens} choisir={(v) => { setFiltres({ ...filtres, sens: v }); setMenu(null); }} />
        <label className="recherche" title="Rechercher dans la boîte">
          {ICONES.loupe}
          <input type="search" placeholder="Expéditeur, destinataire, objet…" aria-label="Rechercher dans la boîte" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </label>
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <button type="button" className={`action selon${onglet === 'etiqueter' ? ' allume' : ''}`} title={`Étiqueter ${pluriel(n, 'mail')}`} aria-haspopup="dialog" aria-expanded={onglet === 'etiqueter'} onClick={() => ouvrir('etiqueter')}>
            <span className="ico">{ICONES.tag}</span><span className="txt">Étiqueter</span>
          </button>
          <button type="button" className="action rouge" title={`Supprimer ${pluriel(n, 'mail')}`} aria-haspopup="dialog" aria-expanded={confirmation === 'supprimer'} onClick={() => setConfirmation('supprimer')}>
            <span className="ico">{ICONES.supprimer}</span><span><span className="txt">Supprimer </span>({n})</span>
          </button>
          <button type="button" className={`action${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" aria-haspopup="dialog" aria-expanded={onglet === 'reglages'} onClick={() => ouvrir('reglages')}>
            <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
          </button>
          <button type="button" className="action plein" aria-haspopup="dialog" aria-expanded={onglet === 'ecrire'} onClick={() => ouvrir('ecrire')}>
            Écrire<span className="ico">{ICONES.plus}</span>
          </button>
        </div>
      </div>
      {confirmation === 'supprimer' && (
        <Confirmer question={`Supprimer ${pluriel(n, 'mail')} ?`} detail={n > 1 ? "Ils sont effacés du dashboard, la vraie boîte n'est pas touchée." : "Il est effacé du dashboard, la vraie boîte n'est pas touchée."}
          action="Supprimer" occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void supprimer()} />
      )}
      {confirmation === 'vider' && (
        <Confirmer question="Vider la boîte ?" admin detail={`Ses ${resume?.total ?? 0} mails sont effacés du dashboard, brouillons et fils compris.`} action="Vider"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void vider()} />
      )}
      <p className="etat-boite">
        <span className="adresse-boite"><span className="lib-champ">Boîte</span>{etat ? etat.adresse || 'adresse non renseignée' : '…'}</span>
        <span className="volume"><span className="lib-champ">Volume</span>{resume ? `${pluriel(resume.recus, 'reçu')} · ${pluriel(resume.envoyes, 'envoyé')} · ${pluriel(resume.fils, 'fil')} · ${pluriel(resume.rattaches, 'rattaché')}` : '…'}</span>
        {admin && (
          <>
            <span className="espace" />
            <span className="actions actions-etat" role="group" aria-label="Actions réservées à l'admin">
              <MarqueAdmin />
              <button type="button" className="action" disabled={occupe || !etat} onClick={() => void basculerEcoute()}
                title={etat?.ecoute ? `Écoute en marche${etat.etape ? ` · ${etat.etape}` : ''} : l'arrêter` : "La boîte est vérifiée toutes les 10 s tant que l'écoute tourne : chaque mail arrivé est rangé aussitôt, étiqueté et rattaché à son offre."}>
                <span className={`voyant-ecoute${etat?.ecoute ? '' : ' arrete'}`} aria-hidden="true" />
                <span className="txt">{etat?.ecoute ? "Arrêter l'écoute" : "Démarrer l'écoute"}</span>
              </button>
              <button type="button" className="action" disabled={occupe} onClick={() => void rattacher()}
                title="Repasser le tri du jour et rejouer le rattachement des mails : un mail arrivé avant sa fiche y retrouve son offre.">
                <span className="ico">{ICONES.rattacher}</span><span className="txt">Rattacher</span>
              </button>
              <button type="button" className="action" title="Effacer tous les mails du dashboard" aria-haspopup="dialog" aria-expanded={confirmation === 'vider'} onClick={() => setConfirmation('vider')}>
                <span className="ico">{ICONES.vider}</span><span className="txt">Vider</span>
              </button>
              <button type="button" className={`action${onglet === 'executer' ? ' allume' : ''}`} title="Lancer la brique Mail à la main" aria-haspopup="dialog" aria-expanded={onglet === 'executer'} onClick={() => ouvrir('executer')}>
                <span className="ico">{ICONES.executer}</span><span className="txt">Exécuter</span>
              </button>
            </span>
          </>
        )}
      </p>
      <div className="defile" ref={defile}>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(mails.map((m) => m.message_id), e.target.checked)} /></th>
              <th aria-label="Sens" /><th>Date</th><th>De</th><th>Objet</th><th>PJ</th><th>Nature</th><th>Sur</th><th>Brouillon</th>
            </tr>
          </thead>
          <tbody>
            {mails.map((m) => {
              const sortant = m.sens === 'sortant';
              const nom = sortant ? adresseSeule(m.destinataire) : nomAffiche(m.expediteur);
              const ouverte = onglet === 'fil' && objet === m.message_id;
              return (
                <tr key={m.message_id} className={`${selection.has(m.message_id) ? 'coche' : ''}${ouverte ? ' ouverte' : ''}`} tabIndex={0} data-ouvre="fil" data-objet={m.message_id}
                  onClick={() => ouvrirFil(m.message_id)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrirFil(m.message_id)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="case" aria-label={`Sélectionner le mail de ${nom || '—'}`} checked={selection.has(m.message_id)} onChange={(e) => cocher([m.message_id], e.target.checked)} />
                  </td>
                  <td>{sortant ? <span className="sens envoye" title="Envoyé — d'ici ou à la main">↗</span> : <span className="sens recu" title="Reçu">↘</span>}</td>
                  <td className="d">{formaterDate(m.recu_le)}</td>
                  <td title={sortant ? m.destinataire : m.expediteur}>{sortant && <span className="vers">à</span>}{nom || '—'}</td>
                  <td className={m.lu ? 'd' : 'non-lu'} title={m.sujet}>{m.sujet || '(sans objet)'}</td>
                  <td>{m.pieces_jointes.length > 0 && <span className="pj" title={m.pieces_jointes.map((p) => p.nom).join(', ')}>{ICONES.trombone}{m.pieces_jointes.length}</span>}</td>
                  <td title={m.tags.map((t) => NATURES[t] ?? t).join(', ') || 'non classé'}>{m.tags.length ? m.tags.map((t) => <Nature key={t} tag={t} />) : <span className="vide-c">—</span>}</td>
                  <td className="sur" onClick={(e) => e.stopPropagation()}>
                    {m.entreprise_siren || m.offre_cle ? (
                      <>
                        {m.entreprise_siren && <button type="button" aria-haspopup="dialog" data-ouvre="fiche-entreprise" data-objet={m.entreprise_siren} onClick={() => ouvrir('fiche-entreprise', m.entreprise_siren!)}>la fiche</button>}
                        {m.entreprise_siren && m.offre_cle && ' · '}
                        {m.offre_cle && <button type="button" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={m.offre_cle} onClick={() => ouvrir('fiche-offre', m.offre_cle!)}>l&apos;offre</button>}
                      </>
                    ) : <span className="vide-c" title={RATTACHEMENTS[m.rattachement] ?? ''}>—</span>}
                  </td>
                  {m.reponse ? <td className="brouillon redige" title="Une réponse est rédigée : elle attend d'être relue dans le fil.">rédigé</td>
                    : m.reponse_erreur ? <td className="brouillon echec" title={m.reponse_erreur}>échec</td>
                      : <td><span className="vide-c">—</span></td>}
                </tr>
              );
            })}
            {etat && !mails.length && (
              <tr className="vide-f"><td colSpan={9}>{filtres.etiquette || filtres.sens || filtres.recherche ? 'Aucun mail sous ces filtres.'
                : 'Aucun mail. Renseignez la boîte dans les Réglages, puis relevez — ou écrivez le premier.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(avis || erreurBoite) && (
        <p className={`avis-boite${avis?.erreur || (!avis && erreurBoite) ? ' erreur' : ''}`} role={avis?.erreur || (!avis && erreurBoite) ? 'alert' : 'status'} onClick={() => setAvis(null)}>
          {avis?.texte ?? erreurBoite}
        </p>
      )}
      <div className="pagination">
        <select aria-label="Lignes par page" value={String(taille)} onChange={(e) => setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
          <option value="auto">auto ({auto})</option>
          {TAILLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled={page <= 1} aria-label="Page précédente" onClick={() => setPage(page - 1)}>‹</button>
          {boutons}
          <button type="button" className="pl" disabled={page >= pages} aria-label="Page suivante" onClick={() => setPage(page + 1)}>›</button>
        </nav>
      </div>
    </Fenetre>
  );
}

// Un filtre en texte seul et son menu : un clic ailleurs ou Échap le referme
function MenuFiltre({ ouvert, basculer, fermer, lib, actif, valeur, options, courant, choisir }: {
  ouvert: boolean; basculer: () => void; fermer: () => void; lib: string; actif: boolean; valeur: string;
  options: { valeur: string; nom: string; compte: number }[]; courant: string; choisir: (v: string) => void;
}) {
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert, fermer]);
  return (
    <div ref={hote} className="menu-hote filtre-hote">
      <button type="button" className={`filtre${actif ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={`${lib} : ${valeur}`} onClick={basculer}>
        <span><span className="lib">{lib}</span>{valeur}</span>{ICONES.chevron}
      </button>
      {ouvert && (
        <div className="menu verre" role="listbox" aria-label={lib}>
          <span className="verre-halos" aria-hidden="true" />
          {options.map((o) => (
            <button key={o.valeur || 'tous'} type="button" role="option" aria-selected={o.valeur === courant} className={`menu-option${o.valeur === courant ? ' actif' : ''}`} onClick={() => choisir(o.valeur)}>
              {o.nom}{o.compte >= 0 && <span className="compteur">{o.compte}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ProprietesPanneau = { admin: boolean; adresseBoite: string; selection: Set<string>; setAvis: (a: Avis) => void; relire: () => void; setPage: (p: number) => void };

// Les onglets du courrier ; les autres sont les outils de la boîte
const COURRIER = ['fil', 'etiqueter', 'fiche-offre', 'fiche-entreprise'];

// Le panneau : les éléments (fils et fiches, un par fenêtre), puis l'étiquetage dans le courrier ou les outils (Exécuter chez l'admin, Écrire, Réglages), selon l'onglet ouvert
function PanneauDePage({ admin, adresseBoite, selection, setAvis, relire, setPage }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const voirFiche = useCallback((s: string) => ouvrir('fiche-entreprise', s), [ouvrir]);
  const voirOffre = useCallback((c: string) => ouvrir('fiche-offre', c), [ouvrir]);
  const etiqueter = useOngletEtiqueter({ selection, setAvis, relire, fermer });
  const ecrire = useOngletEcrire({ adresse: adresseBoite, setAvis, apres: () => { fermer(); setPage(1); relire(); } });
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, setAvis, relire });
  const executer = useOngletExecuter({ actif: admin && onglet === 'executer', fermer, setAvis });
  const elements = {
    fil: (id: string) => ongletFil(id, { setAvis, relire, voirFiche, voirOffre, fermer }),
    'fiche-offre': (c: string) => ongletFicheOffre(c, { ouvrirEntreprise: voirFiche }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: voirOffre }),
  };
  const onglets = onglet && COURRIER.includes(onglet) ? (selection.size ? [etiqueter] : []) : [...(admin ? [executer] : []), ecrire, reglages];
  return <Panneau elements={elements} onglets={onglets} />;
}
