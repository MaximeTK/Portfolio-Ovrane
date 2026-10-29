// Forme d'un profil de candidature, reprise de l'éditeur de l'ancien dashboard (cf. src/profil/normalisation.py)
export type Forme = 'text' | 'email' | 'nombre' | 'choix' | 'liste' | 'lignes' | 'texte_long' | 'riche' | 'lieu';
export type Champ = {
  cle: string;
  libelle: string;
  type?: Forme;
  choix?: string[];
  // « identite.nom » : là où un profil d'avant range la valeur
  repli?: string;
  exemple?: string;
  portee?: 'adresse' | 'commune' | 'pays';
  obligatoire?: boolean;
  // Colonnes prises sur six dans une entrée répétable : 3 par défaut, 2 pour trois par ligne, 6 pour toute la largeur
  col?: 2 | 3 | 6;
  large?: boolean;
};

export const CHAMPS_IDENTITE: Champ[] = [
  { cle: 'civilite', libelle: 'Civilité', type: 'choix', choix: ['Madame', 'Monsieur'] },
  { cle: 'prenom', libelle: 'Prénom', exemple: 'Prénom' },
  { cle: 'nom', libelle: 'Nom', repli: 'identite.nom', exemple: 'Nom' },
  { cle: 'titre', libelle: 'Titre visé', repli: 'identite.titre_par_defaut', exemple: 'Développeur Python' },
  { cle: 'email', libelle: 'E-mail', type: 'email', repli: 'identite.email', exemple: 'prenom.nom@exemple.fr' },
  { cle: 'email_secondaire', libelle: 'E-mail secondaire', type: 'email' },
  { cle: 'telephone', libelle: 'Téléphone', repli: 'identite.telephone', exemple: '06 00 00 00 00' },
  { cle: 'indicatif pays', libelle: 'Indicatif pays', exemple: '+33' },
  { cle: 'adresse', libelle: 'Adresse', type: 'lieu', portee: 'adresse', exemple: '12 rue de la République, Lyon', large: true },
  { cle: 'ville', libelle: 'Ville', type: 'lieu', portee: 'commune', repli: 'identite.ville', exemple: 'Lyon' },
  { cle: 'code_postal', libelle: 'Code postal', exemple: '69000' },
  { cle: 'pays', libelle: 'Pays', type: 'lieu', portee: 'pays', exemple: 'France' },
  { cle: 'nationalite', libelle: 'Nationalité', exemple: 'Française' },
  { cle: 'genre', libelle: 'Genre (facultatif)', type: 'choix', choix: ['Homme', 'Femme', 'Ne pas préciser'] },
  { cle: 'linkedin', libelle: 'LinkedIn', repli: 'identite.linkedin', exemple: 'linkedin.com/in/prenomnom' },
  { cle: 'github', libelle: 'GitHub', repli: 'identite.github' },
  { cle: 'portfolio', libelle: 'Portfolio', repli: 'identite.site' },
];

export const CHAMPS_PRESENTATION: Champ[] = [
  { cle: 'annees_experience', libelle: "Années d'expérience", type: 'nombre' },
  { cle: 'niveaux de diplomes', libelle: 'Niveau de diplôme', exemple: 'Bac +5' },
  { cle: 'motivation', libelle: 'Accroche', type: 'texte_long', repli: 'accroche_par_defaut', large: true,
    exemple: 'Deux ou trois phrases sur ce que vous faites et ce que vous cherchez.' },
];

// Ce qu'un formulaire d'embauche demande et qu'aucun CV n'imprime
export const CHAMPS_SITUATION: Champ[] = [
  { cle: 'disponibilite', libelle: 'Disponibilité', exemple: 'Immédiate, ou 01/12/2026' },
  { cle: 'preavis', libelle: 'Préavis', exemple: '1 mois, négociable' },
  { cle: 'autorisation_travail', libelle: 'Autorisé(e) à travailler en', type: 'liste', exemple: 'France, Union européenne' },
  { cle: 'besoin_sponsor', libelle: "Besoin d'un parrainage de visa", type: 'choix', choix: ['non', 'oui'] },
  { cle: 'teletravail', libelle: 'Télétravail', type: 'choix', choix: ['sur site', 'hybride', 'à distance', 'indifférent'] },
  { cle: 'demenagement', libelle: 'Prêt(e) à déménager', type: 'choix', choix: ['oui', 'non'] },
  { cle: 'permis', libelle: 'Permis', exemple: 'B' },
  { cle: 'mobilite', libelle: 'Mobilité', exemple: 'Lyon et alentours' },
];

// Le salaire en chiffres : un formulaire demande un nombre, une lettre une phrase
export const CHAMPS_REMUNERATION: Champ[] = [
  { cle: 'salaire_minimum', libelle: 'Salaire minimum', type: 'nombre', exemple: '36000' },
  { cle: 'salaire_cible', libelle: 'Salaire visé', type: 'nombre', exemple: '40000' },
  { cle: 'salaire_base', libelle: 'Brut ou net', type: 'choix', choix: ['brut', 'net'] },
  { cle: 'salaire_periode', libelle: 'Période', type: 'choix', choix: ['annuel', 'mensuel'] },
  { cle: 'pretentions', libelle: 'Prétentions, en clair', exemple: '38–42 k€ brut annuel', large: true },
];

export const CHAMPS_REPONSES_FIXES: Champ[] = [
  { cle: 'source_par_defaut', libelle: '« Comment nous avez-vous connus ? »', exemple: 'LinkedIn', large: true },
  { cle: 'consentement_autres_offres', libelle: "Être contacté(e) pour d'autres offres", type: 'choix', choix: ['oui', 'non'], large: true },
  { cle: 'consentement_ia', libelle: "Accepter l'IA dans le recrutement", type: 'choix', choix: ['oui', 'non'], large: true },
  { cle: 'consentement_communications', libelle: 'Recevoir e-mails et actualités', type: 'choix', choix: ['oui', 'non'], large: true },
];

// La matière des lettres et des questions ouvertes : ce que le candidat veut, dit une fois pour toutes
export const CHAMPS_MOTIVATIONS: Champ[] = [
  { cle: 'projet_professionnel', libelle: 'Projet professionnel', type: 'texte_long', large: true, exemple: 'Deux ou trois phrases : où vous allez, et pourquoi.' },
  { cle: 'motivation_esn', libelle: 'Pourquoi une ESN', type: 'texte_long', large: true },
  { cle: 'motivation_startup', libelle: 'Pourquoi une start-up', type: 'texte_long', large: true },
  { cle: 'motivation_grand_groupe', libelle: 'Pourquoi un grand groupe', type: 'texte_long', large: true },
  { cle: 'ton', libelle: 'Ton des lettres', type: 'choix', choix: ['formel', 'direct', 'chaleureux', "miroir de l'annonce"] },
];

export const CHAMPS_RECHERCHE: Champ[] = [
  { cle: 'intitule', libelle: 'Intitulé visé', exemple: 'Développeur Python' },
  { cle: 'mots_a_taper', libelle: 'Mots à taper', type: 'liste', exemple: 'Développeur, Python, Backend' },
  { cle: 'lieu', libelle: 'Lieu', exemple: 'Lyon' },
  { cle: 'contrat', libelle: 'Contrat', exemple: 'CDI' },
  { cle: 'a_eviter', libelle: 'Intitulés à éviter', type: 'liste', exemple: 'Alternance, Stage', large: true },
];

export const CHAMPS_DIVERS: Champ[] = [
  { cle: 'savoir_etre', libelle: 'Savoir-être', type: 'lignes', exemple: 'Un par ligne.', large: true },
  { cle: 'centres_interet', libelle: "Centres d'intérêt", type: 'liste', exemple: 'Randonnée, Photographie', large: true },
];

export type Rubrique = { cle: string; titre: string; singulier: string; champs: Champ[] };

// Les rubriques qui se répètent : une entrée par carte, ajoutée et retirée à la main
export const RUBRIQUES: Rubrique[] = [
  { cle: 'experiences', titre: 'Expériences', singulier: 'une expérience', champs: [
    { cle: 'poste', libelle: 'Poste', repli: 'intitule', exemple: 'Développeur backend' },
    { cle: 'employeur', libelle: 'Employeur', repli: 'entreprise', exemple: "Nom de l'entreprise" },
    { cle: 'contrat', libelle: 'Contrat', repli: 'contexte', exemple: 'CDI', col: 2 },
    { cle: 'lieu', libelle: 'Ville', type: 'lieu', portee: 'commune', exemple: 'Lyon', col: 2 },
    { cle: 'pays', libelle: 'Pays', type: 'lieu', portee: 'pays', exemple: 'France', col: 2 },
    { cle: 'debut', libelle: 'Début', exemple: '2023-01' },
    { cle: 'fin', libelle: 'Fin', exemple: "vide = aujourd'hui" },
    { cle: 'contenu', libelle: 'Le poste et ce qui y a été fait', type: 'riche', col: 6, exemple: 'Une phrase qui pose le poste, puis les travaux réalisés.' },
    { cle: 'stack', libelle: 'Technologies', type: 'liste', repli: 'competences', col: 6, exemple: 'Python, PostgreSQL' },
  ] },
  { cle: 'projets', titre: 'Projets', singulier: 'un projet', champs: [
    { cle: 'nom', libelle: 'Nom', exemple: 'Nom du projet' },
    { cle: 'annee', libelle: 'Année', exemple: '2025' },
    { cle: 'contenu', libelle: "Le projet et ce qu'il fait", type: 'riche', col: 6, exemple: 'Une phrase : ce que ça fait, et pourquoi. Puis les détails.' },
    { cle: 'lien', libelle: 'Lien', exemple: 'github.com/…' },
    { cle: 'stack', libelle: 'Technologies', type: 'liste', repli: 'competences', exemple: 'Python' },
  ] },
  { cle: 'formations', titre: 'Formations', singulier: 'une formation', champs: [
    { cle: 'diplome', libelle: 'Diplôme', repli: 'intitule', exemple: 'Master', col: 2 },
    { cle: 'domaine', libelle: 'Domaine', exemple: 'Informatique', col: 2 },
    { cle: 'etablissement', libelle: 'Établissement', exemple: 'École', col: 2 },
    { cle: 'lieu', libelle: 'Ville', type: 'lieu', portee: 'commune', exemple: 'Lyon' },
    { cle: 'pays', libelle: 'Pays', type: 'lieu', portee: 'pays', exemple: 'France' },
    { cle: 'debut', libelle: 'Début', exemple: '2020' },
    { cle: 'fin', libelle: 'Fin', repli: 'annee', exemple: '2022' },
  ] },
  { cle: 'certifications', titre: 'Certifications', singulier: 'une certification', champs: [
    { cle: 'nom', libelle: 'Certification', exemple: 'TOEIC' },
    { cle: 'organisme', libelle: 'Organisme', exemple: 'ETS' },
    { cle: 'annee', libelle: 'Année', exemple: '2025' },
    { cle: 'score', libelle: 'Score', exemple: '945' },
  ] },
  { cle: 'langues', titre: 'Langues', singulier: 'une langue', champs: [
    { cle: 'langue', libelle: 'Langue', exemple: 'Anglais', col: 2 },
    { cle: 'niveau', libelle: 'Niveau', exemple: 'courant', col: 2 },
    { cle: 'cecrl', libelle: 'Niveau CECRL', type: 'choix', choix: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Langue maternelle'], col: 2 },
  ] },
  { cle: 'forces', titre: 'Forces', singulier: 'une force', champs: [
    { cle: 'force', libelle: 'Force', exemple: 'Rigueur', col: 6 },
    { cle: 'preuve', libelle: 'Sa preuve', type: 'texte_long', col: 6, exemple: 'Un fait vécu qui la montre.' },
  ] },
  // Reprises mot pour mot : le chiffre n'est jamais inventé, il vient d'ici
  { cle: 'realisations', titre: 'Réalisations chiffrées', singulier: 'une réalisation', champs: [
    { cle: 'realisation', libelle: 'Réalisation', type: 'texte_long', col: 6, exemple: "Refonte du parcours d'inscription" },
    { cle: 'chiffre', libelle: 'Le chiffre', exemple: "−40 % d'abandons" },
    { cle: 'cadre', libelle: 'Où et quand', exemple: 'Stage chez Acme, 2025' },
  ] },
  // Une histoire vécue au format STAR : situation, tâche, action, résultat
  { cle: 'histoires', titre: 'Histoires vécues (STAR)', singulier: 'une histoire', champs: [
    { cle: 'titre', libelle: 'Titre', exemple: 'Le client qui changeait tout la veille' },
    { cle: 'qualites', libelle: "Ce qu'elle montre", type: 'liste', exemple: 'Adaptabilité, Écoute' },
    { cle: 'situation', libelle: 'Situation', type: 'texte_long', col: 6 },
    { cle: 'tache', libelle: 'Tâche', type: 'texte_long', col: 6 },
    { cle: 'action', libelle: 'Action', type: 'texte_long', col: 6 },
    { cle: 'resultat', libelle: 'Résultat', type: 'texte_long', col: 6, exemple: 'Avec un chiffre si possible.' },
  ] },
  // La version courte sert sous une limite de caractères, la longue partout ailleurs
  { cle: 'reponses_types', titre: 'Réponses types', singulier: 'une réponse', champs: [
    { cle: 'question', libelle: 'Question', exemple: 'Pourquoi quitter votre poste ?', col: 6 },
    { cle: 'courte', libelle: 'Réponse courte', type: 'texte_long', col: 6, exemple: '300 caractères au plus.' },
    { cle: 'longue', libelle: 'Réponse longue', type: 'texte_long', col: 6 },
  ] },
];

// Les sections à plat, avec les champs que la correction peut y ajouter
export const GROUPES: { cle: string; titre: string; champs: Champ[] }[] = [
  { cle: 'identite', titre: 'Identité', champs: CHAMPS_IDENTITE },
  { cle: 'presentation', titre: 'Présentation', champs: CHAMPS_PRESENTATION },
  { cle: 'situation', titre: 'Situation', champs: CHAMPS_SITUATION },
  { cle: 'remuneration', titre: 'Rémunération', champs: CHAMPS_REMUNERATION },
  { cle: 'motivations', titre: 'Motivations et ton', champs: CHAMPS_MOTIVATIONS },
  { cle: 'reponses_fixes', titre: 'Réponses fixes des formulaires', champs: CHAMPS_REPONSES_FIXES },
];

// L'ordre par défaut des sections ; celui du profil passe devant, et le CV le suit
export const SECTIONS = ['identite', 'presentation', 'situation', 'remuneration', 'recherche', 'experiences', 'projets', 'formations',
  'certifications', 'langues', 'competences', 'divers', 'motivations', 'forces', 'realisations', 'histoires', 'reponses_types', 'reponses_fixes'];

export const TITRES: Record<string, string> = {
  ...Object.fromEntries([...GROUPES, ...RUBRIQUES].map((g) => [g.cle, g.titre])),
  recherche: 'Recherche', competences: 'Compétences', divers: "Savoir-être et centres d'intérêt",
};

// Les champs ajoutés au profil de tous, tels que /schema-profil les rend
export type ChampSchema = { cle: string; libelle: string; section: string; type: string; obligatoire: boolean; choix?: string[] };

// Formes et sections d'un champ ajouté, comme Workflows · Vérification les proposait
export const SECTIONS_DE_CHAMP: Record<string, string> = { identite: 'Identité', presentation: 'Présentation', situation: 'Situation',
  remuneration: 'Rémunération', motivations: 'Motivations', reponses_fixes: 'Réponses fixes' };
export const FORMES_CHAMP: Record<string, string> = { text: 'Texte', texte_long: 'Texte long', nombre: 'Nombre', choix: 'Choix', liste: 'Liste',
  email: 'E-mail', lieu: 'Lieu (commune)' };

// Le nom lisible d'une donnée de la fiche : celui de l'éditeur, celui que la correction lui a donné, sinon sa clé
export function libelleDonnee(cle: string, schema: ChampSchema[]) {
  const connus = [...GROUPES.flatMap((g) => g.champs), ...schema];
  return connus.find((c) => c.cle === cle)?.libelle ?? cle.replace(/_/g, ' ').replace(/^./, (l) => l.toUpperCase());
}

// « developpeur-python-1561.json » → « developpeur-python », comme le titre d'un profil côté serveur
export const titreProfil = (nom: string) => nom.replace(/\.json$/i, '').replace(/-\d{4}$/, '');
