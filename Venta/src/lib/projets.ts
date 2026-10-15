/**
 * Études de cas des projets : contenu tiré du RAG (Hikup, Pico, Ovrane) et de la présentation d'Illusion.
 */

export interface Visuel {
  src: string;
  w: number;
  h: number;
  alt: string;
  legende?: string;
}

export type Bloc =
  | { type: 'texte'; paragraphes: string[] }
  | { type: 'points'; items: { titre: string; texte: string }[] }
  | { type: 'visuels'; images: Visuel[]; colonnes?: 1 | 2 | 3 | 4; legende?: string }
  | { type: 'chiffres'; items: { valeur: string; libelle: string }[] }
  | { type: 'etapes'; items: { titre: string; texte: string }[] }
  | { type: 'barres'; titre: string; unite?: string; items: { libelle: string; valeur: number }[]; note?: string }
  | { type: 'decisions'; items: { question: string; choix: string; pourquoi: string; ecarte?: string }[] }
  | { type: 'encadre'; titre: string; texte: string };

export interface Section {
  id: string;
  etape: string;
  titre: string;
  blocs: Bloc[];
}

export interface Projet {
  slug: string;
  nom: string;
  titre: string;
  accroche: string;
  tldr: { probleme: string; solution: string; impact: string };
  fiche: { libelle: string; valeur: string }[];
  couverture?: Visuel;
  sections: Section[];
}

const A = '/assets/';

export const PROJETS: Projet[] = [
  {
    slug: 'pico',
    nom: 'Pico',
    titre: 'Comment je ramène de 5‑6 à 1‑2 le nombre de clics pour atteindre un mot, quand on ne peut pas parler',
    accroche: 'Application de communication par pictogrammes, pensée pour les personnes autistes non verbales et leurs aidants.',
    tldr: {
      probleme: 'Les applications de communication par pictogrammes du marché sont lentes : composer une phrase demande trop de clics dans des interfaces saturées.',
      solution: "Une interface fixe en quatre zones, où chaque catégorie maîtresse reste à portée de doigt, et un modèle de langage qui transforme la suite de pictogrammes en vraie phrase.",
      impact: "De 5-6 clics à 1-2 au maximum pour atteindre un mot, sur le papier. Prototype à tester sur le terrain.",
    },
    fiche: [
      { libelle: 'Rôle', valeur: 'Seul : benchmark, UX/UI, architecture produit, modèle économique' },
      { libelle: 'Type', valeur: 'Projet personnel' },
      { libelle: 'Livrables', valeur: 'Benchmark, architecture d’interface, maquettes, modèle d’accès' },
      { libelle: 'Statut', valeur: 'Conception papier achevée, prototype à développer' },
    ],
    couverture: { src: `${A}Pico Interface.png`, w: 1920, h: 1080, alt: "Interface de Pico : barre de phrase en haut, grille de pictogrammes au centre, catégories en bas, temps et modalité à droite" },
    sections: [
      {
        id: 'contexte',
        etape: 'Contexte',
        titre: "Pour une personne non verbale, chaque clic est un mot qui attend",
        blocs: [
          { type: 'texte', paragraphes: [
            "Les applications de communication alternative (CAA) permettent de « parler » en assemblant des pictogrammes. Ce secteur est souvent délaissé par l'innovation logicielle et les abonnements y coûtent cher.",
            "Je n'ai pas de lien personnel avec l'autisme non verbal. J'y ai vu un défi technologique et humain où l'UX design et l'architecture logicielle pouvaient changer quelque chose : mettre le code au service de la dignité.",
          ] },
        ],
      },
      {
        id: 'benchmark',
        etape: 'Benchmark',
        titre: 'Trois leaders du marché, trois mêmes faiblesses',
        blocs: [
          { type: 'texte', paragraphes: ['J’ai audité Proloquo2Go, TD Snap et LetMeTalk. La critique qui revient : **faire une phrase est trop lent**.'] },
          { type: 'points', items: [
            { titre: 'Surcharge cognitive', texte: 'Des écrans saturés de pictogrammes rarement utilisés.' },
            { titre: "Profondeur d'arborescence", texte: 'Trop de clics pour atteindre un terme précis.' },
            { titre: 'Incohérence logique', texte: 'Des parcours sinueux qui ralentissent la construction de la pensée.' },
          ] },
          { type: 'visuels', images: [{ src: `${A}Proloquo2Go.png`, w: 1390, h: 1062, alt: 'Interface de Proloquo2Go, dense et en arborescence' }], legende: "Proloquo2Go : tout est là, mais il faut descendre dans l'arborescence pour chaque mot." },
          { type: 'encadre', titre: 'Pourquoi les leaders ne changent pas', texte: "Leurs interfaces sont utilisées par des milliers de personnes : tout refondre est un risque qu'ils ne prennent pas. C'est la place d'un nouvel entrant." },
        ],
      },
      {
        id: 'parti-pris',
        etape: 'Parti pris',
        titre: "Un parcours fixe plutôt qu'un catalogue : l'utilisateur sait par habitude où est chaque mot",
        blocs: [
          { type: 'decisions', items: [
            { question: 'Exhaustivité ou rapidité ?', choix: 'Un parcours fixe mais optimisé, qui limite le bruit visuel au langage fonctionnel.', pourquoi: "La vitesse de parole prime sur la taille du catalogue.", ecarte: 'Un catalogue exhaustif et désordonné.' },
            { question: 'Prédire le prochain mot ?', choix: "Non. L'interface reste absolument statique.", pourquoi: "La mémoire spatiale fait gagner plus de temps qu'une suggestion qui déplace les boutons.", ecarte: 'Une prédiction façon clavier de smartphone.' },
          ] },
        ],
      },
      {
        id: 'solution',
        etape: 'Solution',
        titre: 'Quatre zones fixes, chacune réglable selon la motricité et la cognition de l’utilisateur',
        blocs: [
          { type: 'etapes', items: [
            { titre: 'La phrase (haut)', texte: "Toucher court neutralisé contre les suppressions accidentelles ; toucher long pour réordonner par glisser-déposer ou supprimer d'un geste." },
            { titre: 'Les mots (centre)', texte: 'Toucher court : le pictogramme est ajouté. Toucher long : sa thématique s’ouvre (ex. Alimentation).' },
            { titre: 'Les catégories (bas)', texte: 'Logique, Position, Émotions, Favoris : un code couleur saturé par bloc pour les retrouver sans chercher.' },
            { titre: 'Le temps (droite)', texte: 'Affirmation ou question ; passé, présent ou futur, en gros boutons.' },
          ] },
          { type: 'visuels', images: [{ src: `${A}Pico Interface.png`, w: 1920, h: 1080, alt: 'Interface de Pico en quatre zones' }], legende: 'Les catégories maîtresses sont physiquement séparées : on navigue en deux dimensions au lieu de descendre une arborescence.' },
          { type: 'chiffres', items: [
            { valeur: '5-6 → 1-2', libelle: 'clics pour atteindre un mot' },
            { valeur: '4', libelle: 'zones fixes, jamais réorganisées' },
          ] },
        ],
      },
      {
        id: 'decisions',
        etape: 'Arbitrages',
        titre: 'Chaque compromis assumé, et réglable par le tuteur',
        blocs: [
          { type: 'decisions', items: [
            { question: 'La barre de phrase en haut est loin du pouce sur grande tablette.', choix: 'Elle reste en haut.', pourquoi: "C'est l'élément qu'on touche le moins ; la déplacer rendrait un autre élément difficile d'accès." },
            { question: 'Le toucher long est-il intuitif pour un enfant ?', choix: "Pas forcément : il se désactive selon le profil.", pourquoi: 'Le tuteur calibre le « bruit » dès l’inscription pour éviter la surcharge sensorielle.' },
            { question: 'Et la motricité fine très limitée ?', choix: 'Le glisser-déposer est désactivé.', pourquoi: 'Aucune interaction ne doit exiger une précision que l’utilisateur n’a pas.' },
            { question: "Comment guider l'apprentissage ?", choix: 'Un parcours dirigé Pronom → Verbe → Sujet, débrayable.', pourquoi: "Le tuteur rend la liberté totale dès que l'autonomie est acquise." },
          ] },
          { type: 'visuels', images: [{ src: `${A}Pico Interface Login.png`, w: 1920, h: 1080, alt: 'Écran de connexion de Pico' }], legende: 'Connexion : le compte du tuteur porte les réglages du profil.' },
        ],
      },
      {
        id: 'technique',
        etape: 'Technique',
        titre: '« Je vouloir manger » devient une vraie phrase, pour un coût proche de zéro',
        blocs: [
          { type: 'points', items: [
            { titre: 'Un modèle de langage', texte: 'Il transforme la suite de pictogrammes en phrase complète et grammaticale : la tâche idéale pour un LLM, même petit.' },
            { titre: 'Un cache de phrases', texte: "Des phrases pré-générées en local évitent la plupart des appels : le coût en tokens devient quasi nul." },
            { titre: 'Hors ligne', texte: 'Sans réseau, le cache local répond ; à défaut, les pictogrammes sont énoncés un par un.' },
            { titre: 'Données', texte: "Profils anonymisés : impossible de deviner à qui ils appartiennent. Les données de santé visées en établissement imposent un hébergeur certifié HDS." },
          ] },
        ],
      },
      {
        id: 'modele',
        etape: 'Modèle économique',
        titre: 'Gratuit pour les familles, payant pour les établissements',
        blocs: [
          { type: 'points', items: [
            { titre: 'Standard, gratuit', texte: 'Parents et aidants : pictogrammes, decks à créer et partager, sauvegarde sur serveur.' },
            { titre: 'Praticien', texte: 'Orthophonistes, éducateurs : plusieurs patients sur un terminal, partage de profils entre collègues, connexion SSO.' },
            { titre: 'Administrateur', texte: "Directions d'établissement : licences, invitations, clé de sécurité professionnelle." },
          ] },
        ],
      },
      {
        id: 'suite',
        etape: 'Limites et suite',
        titre: "Tout cela reste une hypothèse : la prochaine étape est le terrain",
        blocs: [
          { type: 'texte', paragraphes: [
            "Il n'y a pas encore eu de recherche utilisateur hors d'internet, faute de contacts. Les choix ergonomiques sont une théorie, qui doit être testée en conditions réelles avec un prototype.",
          ] },
          { type: 'points', items: [
            { titre: 'Bêta-testeurs', texte: 'Les recruter via les groupes de familles concernées.' },
            { titre: 'Pictogrammes', texte: 'Trancher entre banques libres de droits et génération par IA.' },
            { titre: 'Financement', texte: "Équilibrer la gratuité des familles avec le coût de l'infrastructure." },
          ] },
        ],
      },
    ],
  },
  {
    slug: 'ovrane',
    nom: 'Ovrane',
    titre: "Comment j'ai remplacé les pages d'un portfolio par une IA qu'on interroge",
    accroche: 'Le portfolio que vous visitez : un agent conversationnel qui présente mon parcours et pilote lui-même l’interface.',
    tldr: {
      probleme: "Un portfolio statique force le recruteur à parcourir des pages de texte pour trouver la seule réponse qui l'intéresse.",
      solution: "Une IA comme point d'entrée unique : elle répond en langage naturel, à l'écrit ou à la voix, et commande l'interface (images, thème, profils).",
      impact: '3 mois sur mon temps libre, tout le périmètre prévu livré, 0,20 € de coût API pour l’ensemble du développement et des tests.',
    },
    fiche: [
      { libelle: 'Rôle', valeur: 'Seul : concept, UX/UI, développement front et back' },
      { libelle: 'Période', valeur: '3 mois pour la V1, en continu depuis' },
      { libelle: 'Stack', valeur: 'Next.js, TypeScript, Tailwind, Node.js, Express, MongoDB' },
      { libelle: 'IA', valeur: 'OpenAI (texte et voix), RAG hybride maison' },
      { libelle: 'Statut', valeur: 'En production sur ovrane.net' },
    ],
    couverture: { src: `${A}Interface/Ovrane Default.png`, w: 3036, h: 1788, alt: "Maquette d'Ovrane : l'œil hexagonal au centre, des fenêtres de verre autour" },
    sections: [
      {
        id: 'constat',
        etape: 'Constat',
        titre: "À l'ère de l'IA, le portfolio statique est un format dépassé",
        blocs: [
          { type: 'texte', paragraphes: [
            "Je voulais un support qui ne se contente pas d'afficher des projets, mais qui en soit un. Ovrane montre mes deux métiers à la fois : le designer qui cherche une interface mémorable, le développeur qui explore les LLM, le RAG et l'automatisation.",
            "L'idée : passer du GUI au **LUI**, une interface de langage. Le visiteur pose sa question, l'IA synthétise mon parcours pour lui.",
          ] },
        ],
      },
      {
        id: 'design',
        etape: 'Design',
        titre: "Un œil plutôt qu'un chatbot : l'IA comme une présence qui observe et réagit",
        blocs: [
          { type: 'decisions', items: [
            { question: "Quelle forme donner à l'IA ?", choix: "Un hexagone, qui ressemble à un œil.", pourquoi: "Il symbolise une présence constante, qui réagit aux actions du visiteur.", ecarte: "Une sphère 3D à anneaux : trop lourde à animer côté navigateur." },
            { question: 'Quelle voix ?', choix: 'Une voix de synthèse, volontairement non humaine.', pourquoi: "Une esthétique d'assistant de science-fiction ; une voix trop humaine rendait l'écoute moins intéressante.", ecarte: 'ElevenLabs : trop cher et trop humain.' },
            { question: 'Et sans le son ?', choix: 'Un mode messagerie, silencieux.', pourquoi: "On ne peut pas toujours écouter : la messagerie garde tout l'historique à l'écrit." },
          ] },
          { type: 'visuels', colonnes: 2, images: [
            { src: `${A}Interface/Ovrane Default.png`, w: 3036, h: 1788, alt: 'Maquette Ovrane, palette par défaut' },
            { src: `${A}Interface/Frame 90.png`, w: 3036, h: 1788, alt: 'Maquette Ovrane, palette bleue' },
          ], legende: "Le verre laisse passer la couleur du fond : une seule interface, des dizaines d'ambiances que l'IA change à la demande." },
        ],
      },
      {
        id: 'defi-ux',
        etape: 'Défi UX',
        titre: "Faire découvrir le clic sur l'œil sans ajouter un seul bouton",
        blocs: [
          { type: 'texte', paragraphes: [
            "Le plus difficile a été de rendre compréhensible le passage du tableau de bord à la messagerie, qui se fait en cliquant sur l'œil. Un bouton ou un message intrusif aurait ruiné l'interface.",
            "Le conseil n'apparaît qu'**après la première réponse** de l'IA : le visiteur découvre d'abord le tableau de bord, puis la messagerie. L'afficher pendant le chargement aurait cassé l'effet d'une IA qui s'éveille, et personne ne lit un écran de chargement.",
            "Je l'ai testé sur mon entourage sans jamais expliquer le site : leurs blocages ont guidé chaque réglage.",
          ] },
        ],
      },
      {
        id: 'architecture',
        etape: 'Architecture',
        titre: "Chaque message traverse le même circuit : contexte, modèle, commandes",
        blocs: [
          { type: 'etapes', items: [
            { titre: 'Question', texte: 'Écrite ou dictée, envoyée au backend Express avec le profil du visiteur.' },
            { titre: 'RAG', texte: 'Recherche hybride (mots-clés + sens) dans ma base de connaissances ; les passages utiles rejoignent la question.' },
            { titre: 'Modèle', texte: 'Il répond, et peut appeler des outils pour agir sur la page.' },
            { titre: 'Commandes', texte: 'Le front exécute les commandes JSON reçues : afficher une image, changer de thème.' },
            { titre: 'Voix', texte: 'La réponse est découpée en morceaux, lus pendant que la suite se génère.' },
          ] },
          { type: 'decisions', items: [
            { question: 'RAG ou fine-tuning ?', choix: 'Le RAG.', pourquoi: "Plus rapide à itérer, plus simple à mettre à jour, plus prévisible ; le fine-tuning demandait un volume de données et un temps que je n'avais pas." },
            { question: 'Comment rendre le RAG fiable ?', choix: "Le mesurer d'abord : 41 questions de référence. Puis une base en Markdown découpée par section, une recherche hybride BM25 + embeddings fusionnée par RRF, et une porte de pertinence calibrée.", pourquoi: "La V1 ne transmettait le bon passage au modèle que pour 45 % des questions, et jamais sur une relance ; la refonte monte à 93 %, sans faux positif sur les questions hors sujet.", ecarte: 'Une base vectorielle distante : sous quelques milliers de passages, elle n’ajoute que de la latence.' },
            { question: 'Comment garder la facture basse ?', choix: "Un prompt système strictement fixe, le contexte variable placé en fin de message.", pourquoi: "OpenAI réutilise alors le préfixe en cache : plus de 1 500 tokens servis depuis le cache dès le deuxième message." },
            { question: 'Comment réduire la latence de la voix ?', choix: 'Un streaming par morceaux.', pourquoi: "La voix démarre dès que deux morceaux sont prêts ; la génération des suivants est masquée par la lecture des premiers." },
            { question: "Comment l'IA agit-elle sur la page ?", choix: 'Des appels d’outils qui ajoutent des commandes JSON à la réponse.', pourquoi: "Le front reste maître du DOM : il n'exécute que des commandes connues." },
            { question: 'Pourquoi filtrer les outils par intention ?', choix: "N'exposer au modèle que les outils liés à la demande.", pourquoi: "Exposer tous les outils provoquait des boucles d'appels et des réponses vides." },
          ] },
        ],
      },
      {
        id: 'methode',
        etape: 'Méthode',
        titre: "L'IA a écrit l'essentiel du code ; mon rôle était de la diriger et de la contredire",
        blocs: [
          { type: 'texte', paragraphes: [
            "Je ne connaissais pas Next.js. J'ai utilisé l'IA comme outil de programmation, et mon rôle est devenu celui d'un superviseur technique : guider, relire, déboguer, garantir une structure propre.",
          ] },
          { type: 'encadre', titre: 'La règle', texte: "L'IA veut satisfaire la demande et pose volontiers des « pansements » tant que ça marche. Je lis tout ce qu'elle produit, et je lui impose de privilégier la suppression à l'ajout." },
        ],
      },
      {
        id: 'resultats',
        etape: 'Résultats',
        titre: 'Tout ce qui était prévu est en ligne, pour quelques centimes',
        blocs: [
          { type: 'chiffres', items: [
            { valeur: '3 mois', libelle: 'sur mon temps libre pour la V1' },
            { valeur: '0,20 €', libelle: "d'API pour tout le développement et les tests" },
            { valeur: '25', libelle: "palettes que l'IA applique à la demande" },
            { valeur: '45 → 93 %', libelle: 'des questions où le bon passage arrive au modèle' },
          ] },
          { type: 'texte', paragraphes: [
            "Ma plus grande fierté : avoir livré tout ce que j'avais prévu sans jamais changer de route faute de savoir faire. Ma déception : je n'ai pas encore la voix robotique dont je rêvais.",
          ] },
        ],
      },
      {
        id: 'suite',
        etape: 'Suite',
        titre: "D'un portfolio à un portail : mes outils derrière une seule connexion",
        blocs: [
          { type: 'points', items: [
            { titre: 'Portail de connexion', texte: 'Ovrane devient la porte d’entrée de mes outils, Illusion en premier.' },
            { titre: 'Souveraineté', texte: 'Un modèle de langage local pour la confidentialité et des coûts d’API nuls.' },
            { titre: 'Une voix sur mesure', texte: 'Un modèle de synthèse auto-hébergé, pour une identité sonore propre.' },
          ] },
        ],
      },
    ],
  },
  {
    slug: 'illusion',
    nom: 'Illusion',
    titre: 'Comment j’ai automatisé une recherche d’emploi de bout en bout, pour un centime par candidature',
    accroche: 'Une chaîne complète de candidature : chercher, comprendre, postuler, suivre, sans y passer ses journées.',
    tldr: {
      probleme: 'Chercher un emploi prend des journées entières, et une lettre écrite à la chaîne se reconnaît dès la première ligne.',
      solution: "Une chaîne qui lit les entreprises et leurs offres, trie en trois passes, écrit un CV et une lettre pour chaque poste, dépose le dossier et suit les réponses.",
      impact: '23 114 annonces lues et 652 offres retenues en 17 jours ; environ 1 centime par candidature déposée.',
    },
    fiche: [
      { libelle: 'Rôle', valeur: 'Seul : conception, architecture, développement, design' },
      { libelle: 'Période', valeur: 'Depuis août 2026' },
      { libelle: 'Stack', valeur: 'Python, FastAPI, navigateur automatisé, MongoDB, modèles d’IA' },
      { libelle: 'Livrables', valeur: 'Pipeline, sept briques spécialisées, tableau de bord' },
      { libelle: 'Statut', valeur: 'En service, en cours d’intégration à Ovrane' },
    ],
    sections: [
      {
        id: 'probleme',
        etape: 'Problème',
        titre: 'Sans portrait de l’entreprise, une lettre vaut pour n’importe qui, et ça se lit',
        blocs: [
          { type: 'texte', paragraphes: [
            "Une recherche sérieuse, c'est trouver les offres, comprendre l'entreprise, adapter son CV, écrire une lettre, remplir des formulaires tous différents, puis suivre des dizaines d'échanges. Fait à la main, c'est un temps plein ; fait à la chaîne, c'est inefficace.",
            "Illusion fait tout le travail, mais pour chaque poste, comme le ferait un candidat qui prend le temps.",
          ] },
        ],
      },
      {
        id: 'chaine',
        etape: 'Vue d’ensemble',
        titre: 'Cinq étapes, et deux portes vers la même fiche entreprise',
        blocs: [
          { type: 'etapes', items: [
            { titre: 'Capter', texte: "Un registre public d'entreprises (secteur, zone, taille) et onze sources d'offres." },
            { titre: 'Trier', texte: 'Trois passes, de la règle fixe à la lecture complète de l’annonce.' },
            { titre: 'Connaître', texte: "Le site de l'entreprise est lu : contacts, recrutement, puis son portrait." },
            { titre: 'Préparer', texte: 'Un CV et une lettre écrits pour ce poste-là.' },
            { titre: 'Postuler et suivre', texte: 'Formulaire ou courriel, puis chaque réponse revient sur sa fiche.' },
          ] },
          { type: 'texte', paragraphes: [
            "Ce qui est lu sur le site sert deux fois : pour candidater, et pour écrire la lettre. Une société qui recrute entre aussi dans la chaîne par ses offres, sans qu'on l'ait cherchée.",
          ] },
        ],
      },
      {
        id: 'tri',
        etape: 'Le tri',
        titre: "L'ordre n'est pas neutre : chaque passe coûte plus cher que la précédente",
        blocs: [
          { type: 'etapes', items: [
            { titre: 'Mots bannis', texte: 'Une règle fixe, sans lecture : rapide et gratuite.' },
            { titre: "L'intitulé", texte: '« Développeur » et « Développeur commercial » ne visent pas le même métier.' },
            { titre: "L'annonce entière", texte: 'Lue et comparée au profil : elle écarte ce qui ressemble sans correspondre.' },
          ] },
          { type: 'decisions', items: [
            { question: 'Que faire d’une offre écartée ?', choix: 'La garder, avec son motif.', pourquoi: "Elle ne repasse pas au tri quand une autre source la republie : on ne paie jamais deux fois la même lecture." },
            { question: 'Que mesurer au passage ?', choix: 'Les compétences demandées, présentes, manquantes et implicites.', pourquoi: "Agrégé sur des centaines d'offres, c'est la liste de ce qu'il faudrait apprendre." },
          ] },
        ],
      },
      {
        id: 'documents',
        etape: 'Le dossier',
        titre: "Le CV est réordonné pour chaque poste, mais rien n'y est jamais inventé",
        blocs: [
          { type: 'texte', paragraphes: [
            "Le CV et la lettre sont fabriqués à partir de quatre sources : le portrait de l'entreprise, l'annonce, la fiche du candidat et ses projets. Les compétences demandées remontent en tête, les libellés reprennent les mots de l'annonce, et la lettre parle de l'entreprise parce qu'on est allé la lire.",
          ] },
          { type: 'encadre', titre: 'Une règle qui ne bouge pas', texte: "Le modèle assemble, il ne complète pas. Ce qui manque est noté comme manquant, pour le candidat seul ; une compétence oubliée s'ajoute au profil d'un geste et compte dès la candidature suivante." },
        ],
      },
      {
        id: 'candidature',
        etape: 'La candidature',
        titre: "Un dossier qui n'aboutit pas n'est pas un « échec » : sa raison est nommée",
        blocs: [
          { type: 'points', items: [
            { titre: 'Par formulaire', texte: "Un navigateur automatisé ouvre l'annonce, se connecte ou crée le compte, relève le code de validation dans le courrier, répond aux questions libres et dépose les pièces." },
            { titre: 'Par courriel', texte: "Quand l'entreprise ne publie pas d'offre mais laisse une adresse : candidature spontanée, adressée, avec les pièces jointes." },
            { titre: 'Le verdict', texte: 'Posté, ou bloqué pour une raison précise : vérification humaine, compte refusé, pièce refusée, offre retirée, page muette.' },
          ] },
        ],
      },
      {
        id: 'suivi',
        etape: 'Le suivi',
        titre: "L'état d'une candidature se lit sur les faits, il n'est jamais saisi",
        blocs: [
          { type: 'texte', paragraphes: [
            "La boîte mail est relevée en continu. Chaque message est classé (information, relance, refus, code de validation, rendez-vous) puis rattaché à l'offre qui l'a provoqué, du plus sûr au moins sûr : identifiant du message, puis domaine de l'expéditeur, puis nom de l'entreprise.",
            "Un refus reçu ne peut donc pas laisser une ligne « en attente ». Chaque poste porte un minuteur de relance ; l'envoi automatique de la relance reste, à ce jour, la dernière porte fermée à clé.",
          ] },
        ],
      },
      {
        id: 'humain',
        etape: 'IA et humain',
        titre: "Le modèle lit et rédige ; les règles fixes et l'humain gardent la main",
        blocs: [
          { type: 'points', items: [
            { titre: 'Ce que décide le modèle', texte: "La lecture d'un intitulé ou d'une annonce, le portrait d'une entreprise, la rédaction du dossier, le remplissage d'un formulaire." },
            { titre: 'Ce qui reste en règle fixe', texte: 'Les mots bannis, la fenêtre de fraîcheur, le rattachement des mails, l’état des candidatures.' },
            { titre: 'Ce qui reste humain', texte: "Les compétences du profil, la relance, et toute page qui exige une vérification humaine." },
          ] },
        ],
      },
      {
        id: 'resultats',
        etape: 'Résultats',
        titre: '17 jours de collecte continue, mesurés au 10 septembre 2026',
        blocs: [
          { type: 'chiffres', items: [
            { valeur: '23 114', libelle: 'annonces lues en 334 passages' },
            { valeur: '3 370', libelle: 'offres distinctes, doublons réunis' },
            { valeur: '652', libelle: 'offres retenues après les trois passes' },
            { valeur: '≈ 1 ct', libelle: 'par candidature déposée, tout compris' },
          ] },
          { type: 'barres', titre: 'D’où viennent les 652 offres retenues', items: [
            { libelle: 'LinkedIn', valeur: 280 }, { libelle: 'APEC', valeur: 225 }, { libelle: 'Adzuna', valeur: 44 },
            { libelle: 'Welcome to the Jungle', valeur: 41 }, { libelle: 'Arbeitnow', valeur: 21 }, { libelle: 'Careerjet', valeur: 16 },
            { libelle: 'Free-Work', valeur: 12 }, { libelle: 'France Travail', valeur: 8 }, { libelle: 'Jooble', valeur: 4 },
            { libelle: 'Saisie manuelle', valeur: 1 },
          ], note: 'Sur 1 958 offres présentées au tri, 1 305 sont tombées sur une règle fixe, avant toute lecture payante.' },
          { type: 'decisions', items: [
            { question: 'Pourquoi un filtre de fraîcheur en premier ?', choix: 'Écarter les annonces trop anciennes sans les lire.', pourquoi: '2 523 des 3 370 offres collectées étaient déjà retirées quand on les a revues : trois sur quatre.' },
            { question: 'Où gagner du temps ?', choix: 'Ne copier le profil du navigateur qu’une fois, puis le vérifier.', pourquoi: 'La copie de 5 Go refaite à chaque lancement prenait 66,7 s ; elle prend moins d’un dixième de seconde.' },
          ] },
        ],
      },
      {
        id: 'suite',
        etape: 'Suite',
        titre: 'Prochaine étape : Illusion dans Ovrane, derrière une connexion',
        blocs: [
          { type: 'texte', paragraphes: [
            "Les données quittent le poste pour une base partagée avec Ovrane : chaque utilisateur aura son profil, ses CV et ses candidatures, accessibles partout. Le tableau de bord est en refonte avec l'identité d'Ovrane, en trois couches : l'essentiel pour tous, les réglages à part, les détails techniques derrière un interrupteur.",
          ] },
        ],
      },
    ],
  },
  {
    slug: 'hikup',
    nom: 'Hikup',
    titre: "Comment j'ai redressé une application en un mois, avant le barrage qui pouvait l'arrêter",
    accroche: "Application mobile de randonnée gamifiée, projet de fin d'études Epitech.",
    tldr: {
      probleme: "Une application vieillissante, jugée misérable graphiquement et ergonomiquement, à un mois du « Barrage Bêta » d'Epitech : sans niveau professionnel, le projet était arrêté.",
      solution: "Un audit UX/UI express, une refonte graphique complète et une direction artistique « outdoor racing » empruntée aux jeux de course.",
      impact: 'Barrage Bêta validé, équipe sauvée, et une DA citée parmi les points clés du succès à l’Epitech Experience.',
    },
    fiche: [
      { libelle: 'Rôle', valeur: 'UX/UI designer et directeur artistique, recruté comme développeur Flutter' },
      { libelle: 'Période', valeur: 'Avril 2023 → fin du cursus (projet lancé en 2021)' },
      { libelle: 'Équipe', valeur: '6 personnes : 2 fullstack, 3 front, moi' },
      { libelle: 'Outils', valeur: 'Figma, Flutter' },
      { libelle: 'Livrables', valeur: 'Audit, refonte UI, DA, affiches, import des randonnées' },
      { libelle: 'Statut', valeur: "Terminé, l'application n'est plus en ligne" },
    ],
    couverture: { src: `${A}Evolution Design Hikup.png`, w: 1920, h: 1080, alt: "Écrans de Hikup en 2021 puis en 2023 : d'une interface verte générique à une interface sombre aux codes du jeu de course" },
    sections: [
      {
        id: 'contexte',
        etape: 'Contexte',
        titre: "Un projet de deux ans, une équipe qui change, et un mois pour passer le cap",
        blocs: [
          { type: 'texte', paragraphes: [
            "Hikup simplifie l'organisation de randonnées et y ajoute des mécaniques de jeu, pour en faire une activité sociale accessible aux débutants comme aux confirmés.",
            "Le projet est né en septembre 2021 dans un groupe précédent. J'arrive en avril 2023, un mois avant le **Barrage Bêta** : le test de survie du cursus Epitech. Si le produit n'atteint pas un standard professionnel, il est arrêté définitivement.",
          ] },
          { type: 'visuels', images: [{ src: `${A}Evolution Parcours Hikup.png`, w: 1920, h: 1080, alt: 'Frise du projet de septembre 2021 au sprint bêta de mai 2023, avec les arrivées et départs de membres chaque année' }], legende: "Onze arrivées, cinq départs en trois ans : l'équipe a souvent changé, la dette de design s'est accumulée." },
        ],
      },
      {
        id: 'probleme',
        etape: 'Problème',
        titre: "L'UX était le point le plus critique : c'est pour elle qu'on m'a recruté en urgence",
        blocs: [
          { type: 'texte', paragraphes: [
            "Interface obsolète, lacunes de structure, et surtout un parcours qui rendait l'organisation d'une randonnée compliquée. Recruté comme développeur Flutter, j'ai pris la double casquette d'UX designer, car c'est là que le projet allait échouer.",
          ] },
        ],
      },
      {
        id: 'audit',
        etape: 'Audit',
        titre: "D'abord lister les points de friction, puis seulement redessiner",
        blocs: [
          { type: 'points', items: [
            { titre: 'Audit UX', texte: "Repérer ce qui rendait l'organisation d'une sortie complexe et corriger les ruptures de parcours." },
            { titre: 'Audit UI', texte: "Relever les erreurs d'interface : incohérences, hiérarchie, lisibilité." },
            { titre: 'Priorisation', texte: "Un mois seulement : ne garder que ce qui changeait le verdict du barrage." },
          ] },
          { type: 'visuels', colonnes: 3, images: [
            { src: `${A}Evolution Beta Hikup Inscription.png`, w: 563, h: 567, alt: "Écran d'inscription avant et après", legende: 'Inscription : une seule colonne, des champs lisibles.' },
            { src: `${A}Evolution Beta Hikup Menu.png`, w: 563, h: 567, alt: 'Menu avant et après', legende: 'Menu : la navigation passe en barre basse contrastée.' },
            { src: `${A}Evolution Beta Hikup Map.png`, w: 563, h: 567, alt: 'Carte avant et après', legende: 'Carte : la barre système et la navigation ne mangent plus la carte.' },
          ] },
        ],
      },
      {
        id: 'parti-pris',
        etape: 'Parti pris',
        titre: "Transformer l'effort en course : la randonnée vue comme un jeu de racing",
        blocs: [
          { type: 'texte', paragraphes: [
            "Pour briser les codes de la randonnée classique, j'ai emprunté à l'univers du jeu vidéo, et plus précisément aux jeux de course. L'objectif : que chaque sortie devienne une progression ludique et gratifiante.",
          ] },
          { type: 'points', items: [
            { titre: 'Interface « racing »', texte: 'Vitesse, dénivelé et position affichés comme un tableau de bord de compétition.' },
            { titre: 'Skins', texte: "L'avatar se personnalise : chacun se distingue dans la communauté." },
            { titre: 'Loot sur sentier', texte: 'Des pièces virtuelles posées sur les vrais tracés GPS : il faut marcher pour les ramasser.' },
            { titre: 'Économie', texte: 'Les pièces achètent des cosmétiques : chaque sortie devient une quête de ressources.' },
          ] },
        ],
      },
      {
        id: 'solution',
        etape: 'Solution',
        titre: "Une identité sombre et contrastée, livrée par cinq développeurs en temps record",
        blocs: [
          { type: 'texte', paragraphes: [
            "J'ai piloté la refonte graphique et encadré l'équipe (2 fullstack, 3 front) pour l'implémenter. Paradoxe : recruté pour coder, je n'ai presque pas codé, tant il y avait à faire en design.",
          ] },
          { type: 'visuels', colonnes: 3, images: [
            { src: `${A}Interface Map Hikup Final.png`, w: 419, h: 838, alt: 'Écran final de la carte', legende: 'Carte' },
            { src: `${A}Interface Menu Hikup Final.png`, w: 419, h: 838, alt: 'Écran final du menu', legende: 'Menu' },
            { src: `${A}Interface Profil Hikup Final.png`, w: 419, h: 838, alt: 'Écran final du profil', legende: 'Profil' },
          ] },
          { type: 'visuels', colonnes: 4, images: [
            { src: `${A}Interface Rando Yellow Hikup.png`, w: 1080, h: 2292, alt: "Fiche d'une randonnée, thème jaune" },
            { src: `${A}Interface Rando Purple Hikup.png`, w: 1080, h: 2292, alt: "Fiche d'une randonnée, thème violet" },
            { src: `${A}Interface Liste Rando Hikup.png`, w: 1080, h: 1920, alt: "Liste des invitations d'une randonnée" },
            { src: `${A}Interface Commentaire Hikup.png`, w: 1080, h: 1920, alt: "Commentaires d'une randonnée" },
          ], legende: "Une couleur par randonnée : on reconnaît sa sortie d'un coup d'œil, sur la carte comme dans les listes." },
        ],
      },
      {
        id: 'code',
        etape: 'Technique',
        titre: 'Ma seule ligne de code : remplir le catalogue avant la présentation',
        blocs: [
          { type: 'texte', paragraphes: [
            "Quelques jours avant le rendu, le catalogue était vide. J'ai écrit l'algorithme qui convertit les randonnées publiées sur internet au format de l'application, ce qui a permis de présenter un produit rempli.",
          ] },
          { type: 'visuels', images: [{ src: `${A}Architecture Hikup.png`, w: 4320, h: 3021, alt: 'Schéma de l’architecture globale de Hikup : application, serveur et services' }], legende: 'Architecture globale du projet.' },
        ],
      },
      {
        id: 'resultats',
        etape: 'Résultats',
        titre: 'Le barrage est passé et le projet a pu enfin avancer sereinement',
        blocs: [
          { type: 'chiffres', items: [
            { valeur: '1 mois', libelle: 'entre mon arrivée et le Barrage Bêta' },
            { valeur: '5', libelle: 'développeurs encadrés sur la refonte' },
            { valeur: 'Validé', libelle: "le barrage, l'équipe n'est pas dissoute" },
          ] },
          { type: 'texte', paragraphes: [
            "Une fois la survie assurée, l'équipe s'est concentrée sur l'essentiel : création d'itinéraires, suivi GPS, gamification. La direction artistique a été l'un des points clés du succès à l'Epitech Experience.",
          ] },
          { type: 'visuels', colonnes: 3, images: [
            { src: `${A}Affiche Hikup 1.png`, w: 1701, h: 2398, alt: 'Affiche Hikup 1' },
            { src: `${A}Affiche Hikup 2.png`, w: 1701, h: 2398, alt: 'Affiche Hikup 2' },
            { src: `${A}Affiche Hikup 3.png`, w: 1701, h: 2398, alt: 'Affiche Hikup 3' },
          ], legende: "Les affiches de l'Epitech Experience prolongent la même DA." },
        ],
      },
      {
        id: 'refonte-2025',
        etape: 'Et après',
        titre: "Deux ans plus tard, je l'ai redessinée pour mesurer le chemin parcouru",
        blocs: [
          { type: 'texte', paragraphes: [
            "En 2025, hors de toute contrainte de cursus, j'ai repris Hikup pour une refonte personnelle : un mode jour et nuit pour la carte, des écrans de quêtes, de messagerie et de tchat qui assument pleinement la gamification.",
          ] },
          { type: 'visuels', images: [{ src: `${A}Refonte Visuel Hikup.png`, w: 7830, h: 4389, alt: 'Planche de la refonte 2025 de Hikup' }] },
          { type: 'visuels', colonnes: 4, images: [
            { src: `${A}Interface Map Jour Hikup Refonte.png`, w: 1080, h: 1920, alt: 'Carte, mode jour, refonte 2025', legende: 'Carte, jour' },
            { src: `${A}Interface Map Nuit Hikup Refonte.png`, w: 1080, h: 1920, alt: 'Carte, mode nuit, refonte 2025', legende: 'Carte, nuit' },
            { src: `${A}Interface Quete Hikup Refonte.png`, w: 1080, h: 1920, alt: 'Écran des quêtes, refonte 2025', legende: 'Quêtes' },
            { src: `${A}Interface Messagerie Hikup Refonte.png`, w: 1080, h: 1920, alt: 'Messagerie, refonte 2025', legende: 'Messagerie' },
          ] },
        ],
      },
      {
        id: 'apprentissages',
        etape: 'Apprentissages',
        titre: 'Ce que ce projet a prouvé',
        blocs: [
          { type: 'points', items: [
            { titre: 'Intervenir en urgence', texte: 'Reprendre un projet chargé de dette technique et de dette de design, et le remettre en route.' },
            { titre: 'Trancher sous pression', texte: 'Décider vite, sur ce qui change réellement le verdict.' },
            { titre: 'Fédérer', texte: "Rassembler une équipe autour d'une vision design claire, pour transformer un échec probable en réussite." },
          ] },
        ],
      },
    ],
  },
];

export function trouverProjet(slug: string) {
  return PROJETS.find((p) => p.slug === slug);
}
