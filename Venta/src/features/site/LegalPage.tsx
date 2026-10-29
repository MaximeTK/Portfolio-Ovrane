'use client';

import { ETIQUETTE, Verre, allerA } from './ProjectPage';

const CONTACT = 'maxime.thiong-kay@proton.me';
const MAJ = '15 octobre 2026';

const SECTIONS = [
  { id: 'mentions', titre: 'Mentions légales' },
  { id: 'donnees', titre: 'Données personnelles' },
  { id: 'traceurs', titre: 'Traceurs' },
  { id: 'ia', titre: 'Intelligence artificielle' },
  { id: 'propriete', titre: 'Propriété intellectuelle' },
];

const HEBERGEURS = [
  { role: 'Site', nom: 'Vercel Inc.', adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis', contact: 'vercel.com' },
  { role: 'Serveur', nom: 'Render Services, Inc.', adresse: '525 Brannan St, Suite 300, San Francisco, CA 94107, États-Unis', contact: '+1 415-319-8186' },
  { role: 'Base de données', nom: 'MongoDB, Inc. (MongoDB Atlas)', adresse: '1633 Broadway, 38th Floor, New York, NY 10019, États-Unis', contact: '+1 646-727-4092' },
];

const TRAITEMENTS = [
  {
    titre: 'Votre visite',
    donnees: "Un jeton de session aléatoire gardé dans un cookie de votre navigateur, une empreinte non réversible de votre adresse IP, la date et le nombre de vos visites, les pages ouvertes, le fond choisi, le nombre de messages.",
    pourquoi: 'Reprendre votre conversation et vos préférences quand vous revenez.',
    base: 'Intérêt légitime : faire fonctionner le service que vous utilisez.',
    duree: '90 jours après votre dernière visite, puis suppression automatique ; plus tôt sur simple demande.',
  },
  {
    titre: 'Vos conversations',
    donnees: "Vos messages et les réponses de l'IA.",
    pourquoi: "Vous répondre et garder l'historique de la messagerie.",
    base: 'Exécution du service que vous demandez.',
    duree: '90 jours après votre dernière visite, puis suppression automatique ; plus tôt sur simple demande.',
  },
  {
    titre: 'Votre compte (facultatif)',
    donnees: 'Pseudo, adresse e-mail, mot de passe conservé uniquement sous forme hachée, illisible même pour moi. Un lien « mot de passe oublié » n’est gardé que 30 minutes, lui aussi haché.',
    pourquoi: 'Vous reconnecter, depuis n’importe quel appareil, et vous envoyer le lien pour changer de mot de passe si vous le demandez.',
    base: 'Exécution du service que vous demandez.',
    duree: 'Jusqu’à la suppression du compte ; après 90 jours sans visite, ses conversations et ses traces de connexion sont effacées.',
  },
  {
    titre: 'Les liens de mes candidatures',
    donnees: "Quand vous ouvrez un lien envoyé avec une de mes candidatures (CV, LinkedIn, GitHub, portfolio) : le lien, sa destination, l'adresse IP, le navigateur, la date et la référence de la candidature.",
    pourquoi: 'Savoir si ma candidature a été consultée.',
    base: 'Intérêt légitime : suivre mes propres candidatures.',
    duree: "90 jours après la dernière activité liée à la candidature (visite, clic, réponse reçue), puis suppression automatique.",
  },
];

const DESTINATAIRES = [
  ['OpenAI', 'vos messages, pour générer les réponses et la voix'],
  ['ElevenLabs', 'le texte des réponses, quand cette voix est utilisée'],
  ['Resend', 'votre adresse e-mail et votre pseudo, pour envoyer le lien « mot de passe oublié »'],
  ['Vercel, Render, MongoDB', 'l’hébergement du site, du serveur et de la base'],
];

const LIEN = 'underline decoration-white/40 underline-offset-2 hover:decoration-white';
const TEXTE = 'max-w-[68ch] leading-relaxed text-white/80';

export function LegalPage() {
  return (
      <article aria-labelledby="legal-titre" className="mx-auto max-w-4xl px-4 pb-24 pt-28 font-sans text-white md:px-8">
        <p className={ETIQUETTE}>Annexe · mise à jour le {MAJ}</p>
        <h1 id="legal-titre" className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Informations légales</h1>
        <p className={`mt-4 ${TEXTE}`}>Qui édite ce site, ce qu&apos;il garde de votre visite, et comment le faire effacer.</p>

        <nav aria-label="Sommaire" className="mt-8 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => allerA(`legal-${s.id}`)} className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white/75 transition hover:border-white/40 hover:text-white">{s.titre}</button>
          ))}
        </nav>

        <section id="legal-mentions" className="scroll-mt-24 border-t border-white/10 py-10 mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Mentions légales</h2>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className={ETIQUETTE}>Éditeur</dt>
              <dd className="mt-1 text-white/85">Maxime Thiong-kay, particulier. Site personnel édité à titre non professionnel.</dd>
            </div>
            <div>
              <dt className={ETIQUETTE}>Directeur de la publication</dt>
              <dd className="mt-1 text-white/85">Maxime Thiong-kay</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={ETIQUETTE}>Contact</dt>
              <dd className="mt-1 text-white/85"><a className={LIEN} href={`mailto:${CONTACT}`}>{CONTACT}</a></dd>
            </div>
          </dl>
          <h3 className={`${ETIQUETTE} mt-8`}>Hébergement</h3>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {HEBERGEURS.map((h) => (
              <Verre as="li" key={h.nom} className="p-4 text-sm">
                <p className="text-white/60">{h.role}</p>
                <p className="mt-1 font-semibold text-white">{h.nom}</p>
                <p className="mt-1 leading-relaxed text-white/75">{h.adresse}</p>
                <p className="mt-1 text-white/75">{h.contact}</p>
              </Verre>
            ))}
          </ul>
        </section>

        <section id="legal-donnees" className="scroll-mt-24 border-t border-white/10 py-10">
          <h2 className="text-2xl font-semibold tracking-tight">Données personnelles</h2>
          <p className={`mt-4 ${TEXTE}`}>
            Le responsable du traitement est Maxime Thiong-kay (<a className={LIEN} href={`mailto:${CONTACT}`}>{CONTACT}</a>).
            Aucune donnée n&apos;est vendue ni utilisée pour de la publicité.
          </p>
          <div className="mt-6 space-y-3">
            {TRAITEMENTS.map((t) => (
              <Verre as="article" key={t.titre} className="p-5">
                <h3 className="font-semibold text-white">{t.titre}</h3>
                <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm leading-relaxed sm:grid-cols-2">
                  <div className="sm:col-span-2"><dt className={ETIQUETTE}>Données</dt><dd className="mt-1 text-white/80">{t.donnees}</dd></div>
                  <div><dt className={ETIQUETTE}>Pourquoi</dt><dd className="mt-1 text-white/80">{t.pourquoi}</dd></div>
                  <div><dt className={ETIQUETTE}>Base légale</dt><dd className="mt-1 text-white/80">{t.base}</dd></div>
                  <div className="sm:col-span-2"><dt className={ETIQUETTE}>Conservation</dt><dd className="mt-1 text-white/80">{t.duree}</dd></div>
                </dl>
              </Verre>
            ))}
          </div>

          <h3 className={`${ETIQUETTE} mt-8`}>Qui y a accès</h3>
          <ul className="mt-3 space-y-2 text-white/80">
            {DESTINATAIRES.map(([qui, quoi]) => <li key={qui}><span className="font-semibold text-white">{qui}</span> : {quoi}.</li>)}
          </ul>
          <p className={`mt-4 ${TEXTE}`}>
            Ces prestataires traitent les données aux États-Unis. Les transferts reposent sur le cadre de protection des données UE–États-Unis
            (Data Privacy Framework) ou sur les clauses contractuelles types de la Commission européenne prévues dans leurs conditions.
          </p>

          <h3 className={`${ETIQUETTE} mt-8`}>Vos droits</h3>
          <p className={`mt-3 ${TEXTE}`}>
            Vous pouvez accéder à vos données, les corriger, les faire effacer, en limiter l&apos;usage, vous y opposer ou les récupérer :
            écrivez à <a className={LIEN} href={`mailto:${CONTACT}`}>{CONTACT}</a>, réponse sous un mois. Si la réponse ne vous satisfait pas,
            vous pouvez saisir la <a className={LIEN} href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">CNIL</a>.
          </p>
        </section>

        <section id="legal-traceurs" className="scroll-mt-24 border-t border-white/10 py-10">
          <h2 className="text-2xl font-semibold tracking-tight">Traceurs</h2>
          <ul className={`mt-4 list-disc space-y-2 pl-5 ${TEXTE}`}>
            <li>Un cookie de session, <code className="rounded bg-white/10 px-1 text-[0.9em]">ovrane_session</code>, illisible par les scripts de la page, garde votre visite : sans lui, la conversation ne peut pas reprendre.</li>
            <li>Un cookie de session, <code className="rounded bg-white/10 px-1 text-[0.9em]">ovrane_jeton</code>, n&apos;est posé que si vous arrivez par le lien d&apos;une de mes candidatures : il sert à vous accueillir en conséquence.</li>
            <li>Le stockage local de votre navigateur garde seulement vos réglages d&apos;affichage : voix coupée ou non, teinte des boîtes.</li>
            <li>Aucun cookie publicitaire, aucune mesure d&apos;audience tierce (ni Google Analytics, ni équivalent).</li>
          </ul>
          <p className={`mt-4 ${TEXTE}`}>Pour tout effacer, supprimez les données de ce site dans les réglages de votre navigateur.</p>
        </section>

        <section id="legal-ia" className="scroll-mt-24 border-t border-white/10 py-10">
          <h2 className="text-2xl font-semibold tracking-tight">Intelligence artificielle</h2>
          <ul className={`mt-4 list-disc space-y-2 pl-5 ${TEXTE}`}>
            <li>Sur l&apos;accueil, vous échangez avec une intelligence artificielle, pas avec moi.</li>
            <li>Ses réponses sont générées automatiquement par un modèle d&apos;OpenAI à partir de mes contenus. Elles peuvent contenir des erreurs : les pages projets et mon CV font foi.</li>
            <li>La voix est une voix de synthèse, générée par IA.</li>
            <li>Ne partagez pas d&apos;informations sensibles dans la conversation.</li>
          </ul>
        </section>

        <section id="legal-propriete" className="scroll-mt-24 border-t border-white/10 py-10">
          <h2 className="text-2xl font-semibold tracking-tight">Propriété intellectuelle</h2>
          <p className={`mt-4 ${TEXTE}`}>
            Les textes, maquettes, visuels et le code de ce site appartiennent à Maxime Thiong-kay, sauf mention contraire ; toute reproduction
            demande son accord. Hikup est un projet d&apos;équipe Epitech : ses visuels appartiennent à leurs auteurs. Les captures d&apos;applications
            tierces, comme Proloquo2Go, restent la propriété de leurs éditeurs et ne sont reproduites qu&apos;à des fins d&apos;analyse.
          </p>
        </section>
      </article>
  );
}
