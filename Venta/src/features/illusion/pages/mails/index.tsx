'use client';

import './mails.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { appeler } from '../../api';

import { Fenetre, usePanneau } from '../../dock/Dock';
import { Confirmer, MarqueAdmin, Panneau } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { ongletFicheOffre } from '../../partage/FicheOffre';
import { LienIllusion, ouvrirIllusion } from '../../partage/LienIllusion';
import type { ProprietesPage } from '../liste';
import { NATURES, Nature, RATTACHEMENTS, adresseSeule, nomAffiche, ongletFil, useOngletEcrire, useOngletEtiqueter, useOngletExecuter, type MailLu, pluriel } from './panneaux';
import { PaginationAller, useEchap, useFileServeur, useGeste, useLignesAuto, type FileServeur } from '../commun';
import { useCoches } from '../../elements/Case';
import { MenuTenu, choixDe } from '../../elements/Menu';
import { Action } from '../../elements/Action';
import { Case } from '../../elements/Case';
import { ICONES } from '../../elements/icones';
import { ouvrable } from '../../elements/Case';
import { ActionSupprimer } from '../../elements/Action';
import { useAvis, type Dire } from '../../elements/Avis';
import { ActionOnglet } from '../../elements/Groupes';
import { quand } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

// Ce que /mails rend : la page de la boîte, son résumé et l'état de l'écoute
type EtatBoite = {
  ecoute: boolean; etape: string; page: number; taille: number; total_filtre: number; pages: number; mails: MailLu[]; facades: boolean;
  resume: { total: number; rattaches: number; envoyes: number; recus: number; fils: number; par_etiquette: Record<string, number> };
};
type Filtres = { etiquette: string; sens: string; recherche: string };
const SENS: Record<string, string> = { '': 'Reçus et envoyés', entrant: 'Reçus', sortant: 'Envoyés' };
const TAILLES = [25, 50];

export default function PageMails({ compte }: ProprietesPage) {
  // Boîte lue et son choix gardés d'une visite à l'autre, relus derrière.
  const file = useFileServeur<EtatBoite, Filtres>({ section: 'mails', nom: 'etat', chemin: '/mails', filtres: { etiquette: '', sens: '', recherche: '' }, autoDepart: 15 });
  const { relire } = file;
  const { dire, vue: avis } = useAvis('avis-boite', true, file.erreur);
  const relireVite = useCallback(() => void relire(), [relire]);

  return (
    <PageDock id="mails" principal="boite" panneau={null}>
      <Boite admin={compte.admin} file={file} avis={avis} dire={dire} />
      <PanneauDePage admin={compte.admin} allume={!!file.lu?.facades} selection={file.selection} dire={dire} relire={relireVite} setPage={file.setPage} />
    </PageDock>
  );
}

type ProprietesBoite = { admin: boolean; file: FileServeur<EtatBoite, Filtres>; avis: React.ReactNode; dire: Dire };

function Boite({ admin, file, avis, dire }: ProprietesBoite) {
  const { lu: etat, filtres, setFiltres, page, setPage, taille, setTaille, auto, setAuto, selection, setSelection, relire } = file;
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [confirmation, setConfirmation] = useState<'supprimer' | 'vider' | null>(null);
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const [menu, setMenu] = useState<'etiquette' | 'sens' | null>(null);
  const [saisie, setSaisie] = useState(filtres.recherche);
  const defile = useRef<HTMLDivElement>(null);

  // La recherche part quand la frappe se pose, pas à chaque lettre.
  useEffect(() => {
    if (saisie === filtres.recherche) return;
    const t = setTimeout(() => setFiltres({ ...filtres, recherche: saisie }), 250);
    return () => clearTimeout(t);
  }, [saisie, filtres, setFiltres]);
  // Échap ferme un menu, sinon la confirmation, sinon le panneau s'il est libre
  useEchap((e) => {
    if (menu) setMenu(null);
    else if (confirmation) setConfirmation(null);
    else if (!e.defaultPrevented) fermer();
  }, true);
  useLignesAuto(defile, setAuto, !!etat?.mails.length);

  const mails = etat?.mails ?? [];
  const resume = etat?.resume;
  const n = selection.size;
  const { toutes, cocher } = useCoches(selection, setSelection, mails.map((m) => m.message_id));
  const ouvrirFil = (id: string) => ouvrir('fil', id);
  const agir = (faire: () => Promise<unknown>) => geste(faire, () => {
    setConfirmation(null);
    return relire();
  });
  const supprimer = () => agir(async () => {
    const r = await appeler<{ efface: number }>('/mails/supprimer', { methode: 'POST', corps: { identifiants: [...selection] } });
    setSelection(new Set());
    dire(`${r.efface} mail(s) supprimé(s).`);
  });
  const vider = () => agir(async () => {
    const r = await appeler<{ efface: number }>('/mails/vider', { methode: 'POST' });
    setSelection(new Set());
    setPage(1);
    dire(`${r.efface} mail(s) effacé(s).`);
  });
  const basculerEcoute = () => agir(async () => {
    const armee = !!etat?.ecoute;
    await appeler(armee ? '/mails/ecoute/arreter' : '/mails/ecoute', { methode: 'POST' });
    setTimeout(() => void relire(), 1500);
    dire(armee ? 'Écoute arrêtée.' : 'Écoute démarrée : la boîte est vérifiée toutes les 10 s, sans fin.');
  });
  const rattacher = () => agir(async () => {
    const r = await appeler<{ reetiquetes: number; recolles: number; erreur: string }>('/mails/rattacher', { methode: 'POST' });
    const bouge = r.reetiquetes || r.recolles;
    dire(r.erreur ? `${r.recolles} mail(s) rattaché(s), tri non repassé : ${r.erreur}`
      : bouge ? `${r.reetiquetes} mail(s) réétiqueté(s), ${r.recolles} rattaché(s).` : 'Rien de plus à trier ni à rattacher.', !!r.erreur || !bouge);
  });

  const natures = Object.entries(resume?.par_etiquette ?? {});
  if (filtres.etiquette && !natures.some(([t]) => t === filtres.etiquette)) natures.push([filtres.etiquette, 0]);
  const pages = etat?.pages ?? 1;

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
          <ActionOnglet cle="etiqueter" className="selon" icone={ICONES.tag} title={`Étiqueter ${pluriel(n, 'mail')}`}>Étiqueter
          </ActionOnglet>
          <ActionSupprimer n={n} title={`Supprimer ${pluriel(n, 'mail')}`} aria-haspopup="dialog" aria-expanded={confirmation === 'supprimer'} onClick={() => setConfirmation('supprimer')} />
          <Action icone={ICONES.reglages} txt title="Les réglages des mails, dans la page Réglages" onClick={() => ouvrirIllusion('reglages?groupe=mails')}>Réglages
          </Action>
          <ActionOnglet cle="ecrire" allume={false} txt={false} plein iconeApres={ICONES.plus_pages}>
            Écrire
          </ActionOnglet>
        </div>
      </div>
      {confirmation === 'supprimer' && (
        <Confirmer question={`Supprimer ${pluriel(n, 'mail')} ?`} detail={n > 1 ? "Ils sont effacés d'Ovrane, sans retour possible." : "Il est effacé d'Ovrane, sans retour possible."}
          action="Supprimer" occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void supprimer()} />
      )}
      {confirmation === 'vider' && (
        <Confirmer question="Vider la boîte ?" admin detail={`Ses ${resume?.total ?? 0} mails sont effacés du dashboard, brouillons et fils compris.`} action="Vider"
          occupe={occupe} onAnnuler={() => setConfirmation(null)} onConfirmer={() => void vider()} />
      )}
      <p className="etat-boite">
        <span className="adresse-boite"><span className="lib-champ">Boîte</span>{!etat ? '…' : etat.facades ? 'Adresses de façade' : "Le suivi des mails n'est pas encore en service : rien n'est reçu ni envoyé."}</span>
        <span className="volume"><span className="lib-champ">Volume</span>{resume ? `${pluriel(resume.recus, 'reçu')} · ${pluriel(resume.envoyes, 'envoyé')} · ${pluriel(resume.fils, 'fil')} · ${pluriel(resume.rattaches, 'rattaché')}` : '…'}</span>
        {etat?.facades && <span><LienIllusion vers="adresses" title="Voir, couper ou réactiver l'adresse de chaque site">Adresses par site</LienIllusion></span>}
        {admin && (
          <>
            <span className="espace" />
            <span className="actions actions-etat" role="group" aria-label="Actions réservées à l'admin">
              <MarqueAdmin />
              <Action disabled={occupe || !etat} onClick={() => void basculerEcoute()} title={etat?.ecoute ? `Écoute en marche${etat.etape ? ` · ${etat.etape}` : ''} : l'arrêter` : "La boîte est vérifiée toutes les 10 s tant que l'écoute tourne : chaque mail arrivé est rangé aussitôt, étiqueté et rattaché à son offre."}>
                <span className={`voyant-ecoute${etat?.ecoute ? '' : ' arrete'}`} aria-hidden="true" />
                <span className="txt">{etat?.ecoute ? "Arrêter l'écoute" : "Démarrer l'écoute"}</span>
              </Action>
              <Action icone={ICONES.rattacher} txt disabled={occupe} onClick={() => void rattacher()} title="Repasser le tri du jour et rejouer le rattachement des mails : un mail arrivé avant sa fiche y retrouve son offre.">Rattacher
              </Action>
              <Action icone={ICONES.vider_mails} txt title="Effacer tous les mails du dashboard" aria-haspopup="dialog" aria-expanded={confirmation === 'vider'} onClick={() => setConfirmation('vider')}>Vider
              </Action>
              <ActionOnglet cle="executer" icone={ICONES.executer_mails} title="Lancer la brique Mail à la main">Exécuter
              </ActionOnglet>
            </span>
          </>
        )}
      </p>
      <div className="defile" ref={defile}>
        <table>
          <thead>
            <tr>
              <th><Case aria-label="Tout sélectionner" checked={toutes} onChange={(e) => cocher(mails.map((m) => m.message_id), e.target.checked)} /></th>
              <th aria-label="Sens" /><th>Date</th><th>De</th><th>Objet</th><th>PJ</th><th>Nature</th><th>Sur</th><th>Brouillon</th>
            </tr>
          </thead>
          <tbody>
            {mails.map((m) => {
              const sortant = m.sens === 'sortant';
              const nom = sortant ? adresseSeule(m.destinataire) : nomAffiche(m.expediteur);
              const ouverte = onglet === 'fil' && objet === m.message_id;
              return (
                <tr key={m.message_id} className={`${selection.has(m.message_id) ? 'coche' : ''}${ouverte ? ' ouverte' : ''}`} {...ouvrable('fil', m.message_id, () => ouvrirFil(m.message_id))}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Case aria-label={`Sélectionner le mail de ${nom || '—'}`} checked={selection.has(m.message_id)} onChange={(e) => cocher([m.message_id], e.target.checked)} />
                  </td>
                  <td>{sortant ? <span className="sens envoye" title="Envoyé — d'ici ou à la main">↗</span> : <span className="sens recu" title="Reçu">↘</span>}</td>
                  <td className="d">{quand(m.recu_le)}</td>
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
                : 'Aucun mail pour l’instant.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {avis}
      <PaginationAller page={page} pages={pages} setPage={setPage} taille={taille} tailles={TAILLES} setTaille={setTaille} auto={auto} />
    </Fenetre>
  );
}

// Un filtre en texte seul et son menu : un clic ailleurs ou Échap le referme
function MenuFiltre({ lib, valeur, options, ...menu }: Omit<React.ComponentProps<typeof MenuTenu>, 'valeur' | 'choix'> & { lib: string; valeur: string; options: Parameters<typeof choixDe>[0] }) {
  return <MenuTenu {...menu} classeHote="filtre-hote" aria-label={`${lib} : ${valeur}`} lib={lib} valeur={valeur} choix={choixDe(options)} />;
}

type ProprietesPanneau = { admin: boolean; allume: boolean; selection: Set<string>; dire: Dire; relire: () => void; setPage: (p: number) => void };

// Les onglets du courrier ; les autres sont les outils de la boîte
const COURRIER = ['fil', 'etiqueter', 'fiche-offre', 'fiche-entreprise'];

// Panneau : fils et fiches, puis étiquetage ou outils selon l'onglet ouvert.
function PanneauDePage({ admin, allume, selection, dire, relire, setPage }: ProprietesPanneau) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const voirFiche = useCallback((s: string) => ouvrir('fiche-entreprise', s), [ouvrir]);
  const voirOffre = useCallback((c: string) => ouvrir('fiche-offre', c), [ouvrir]);
  const etiqueter = useOngletEtiqueter({ selection, dire, relire, fermer });
  const ecrire = useOngletEcrire({ allume, dire, apres: () => { fermer(); setPage(1); relire(); } });
  const executer = useOngletExecuter({ actif: admin && onglet === 'executer', fermer, dire });
  const elements = {
    fil: (id: string) => ongletFil(id, { dire, relire, voirFiche, voirOffre, fermer }),
    'fiche-offre': (c: string) => ongletFicheOffre(c, { ouvrirEntreprise: voirFiche }),
    'fiche-entreprise': (s: string) => ongletFicheEntreprise(s, { ouvrirOffre: voirOffre }),
  };
  const onglets = onglet && COURRIER.includes(onglet) ? (selection.size ? [etiqueter] : []) : [...(admin ? [executer] : []), ecrire];
  return <Panneau elements={elements} onglets={onglets} />;
}
