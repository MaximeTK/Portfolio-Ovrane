# Ovrane

## Présentation

OVRANE : l'architecture d'un portfolio intelligent, à la fusion de l'UX Design et de l'IA générative.

Ovrane est un site web (portfolio) doté d'une intelligence artificielle intégrée.

## Genèse et vision stratégique

OVRANE est né d'un constat simple : à l'ère de l'intelligence artificielle, le portfolio statique est devenu un format obsolète. L'objectif était de concevoir un support de présentation qui ne se contente pas d'afficher des projets, mais qui en devienne un lui-même.

Ce projet est une vitrine de ma double identité :
- L'UX Designer, qui cherche à créer une interface disruptive, mémorable et centrée sur l'utilisateur.
- Le Développeur, qui explore les nouvelles frontières du Web en intégrant des technologies de pointe (LLM, RAG, automatisation).

Plutôt que de forcer le visiteur à parcourir des pages de texte, l'assistant IA devient un point d'entrée unique capable de synthétiser mon parcours de manière personnalisée et interactive.

## Design et expérience utilisateur (UX)

Le design d'OVRANE s'éloigne des conventions du Web actuel pour adopter une esthétique plus douce et très minimaliste.

- L'Oeil Central (Hexagone) : véritable cœur de l'interface, ce polygone n'est pas qu'un élément décoratif. Il symbolise une présence constante, une entité qui observe et réagit aux actions de l'utilisateur. C'est le point d'ancrage visuel de l'IA.
- Interactions dynamiques : l'interface a été conçue pour être pilotable par le langage naturel. L'IA possède un accès direct au système (DOM), lui permettant de modifier le thème visuel, de naviguer entre les profils ou d'afficher des médias spécifiques (image, code, texte) sur simple demande de l'utilisateur.
- La voix de l'IA (TTS) : pour parfaire l'immersion, j'ai réfléchi à une identité sonore spécifique. Le choix s'est porté pour l'instant vers une synthèse vocale issue des TTS d'OpenAI, ceux d'ElevenLabs étant beaucoup trop chers et beaucoup trop « humains ».

## Ingénierie logicielle et optimisation de l'IA

Le défi technique majeur résidait dans l'équilibre entre la puissance de calcul et la fluidité de l'expérience web.

### Modèle de langage

Ovrane tourne par défaut sur gpt-5-mini pour les réponses écrites, via l'API Responses d'OpenAI ; le modèle, l'effort de raisonnement et la verbosité se règlent sans toucher au code. La voix passe par la synthèse vocale d'OpenAI (tts-1, voix nova).

Stratégie LLM : après plusieurs itérations, j'avais d'abord sélectionné GPT-4o mini. Ce modèle offrait une fenêtre de contexte suffisante et une pertinence de réponse optimale pour les requêtes, tout en garantissant des coûts d'API réduits et une vitesse de réponse idéale. Ovrane est depuis passé à gpt-5-mini, toujours un modèle « mini ». J'ai également exploré l'intégration de Gemini 3 Flash, notant son immense potentiel, malgré une complexité de configuration accrue sur la Google Cloud Console qui demande beaucoup trop d'investissement pour le temps à ma disposition.

### Architecture RAG (Retrieval-Augmented Generation)

Pour éviter les hallucinations et réduire la consommation de tokens, j'ai développé un RAG sur mesure. Au lieu d'injecter tout mon CV et toutes mes informations dans chaque requête, le système retrouve les passages pertinents (projets, diplômes, expériences) et ne les transmet à l'IA que si la question le nécessite.

- La base : un fichier Markdown par sujet (mon profil, Hikup, Pico, Ovrane, Illusion), découpé en sections et sous-sections. Chaque passage porte son fil d'Ariane (par exemple « Hikup > Gamification ») pour ne jamais perdre son contexte.
- Une recherche hybride : une recherche par mots-clés (BM25) et une recherche par le sens (embeddings OpenAI text-embedding-3-small) sont fusionnées par leurs rangs (Reciprocal Rank Fusion). Les mots-clés retrouvent les noms propres, le sens retrouve les reformulations.
- Les relances : le message précédent du visiteur participe aussi à la recherche, avec un poids moindre, pour qu'une question elliptique comme « Et son interface ? » retrouve encore le bon projet, sans appel supplémentaire au modèle.
- Une porte de pertinence : le contexte n'est injecté que si la question est assez proche d'un passage ou en partage les mots-clés ; une salutation ou une commande d'interface n'injecte rien. Les seuils sont calibrés sur un jeu de questions de test.
- Le cache : les consignes de l'IA forment un début de prompt identique pour tous les messages, et les passages retrouvés arrivent avec la question. OpenAI réutilise ainsi ce début de prompt d'un message à l'autre, ce qui réduit le coût et la latence.
- La persistance : les embeddings des passages sont conservés dans MongoDB ; au démarrage, seuls les passages nouveaux ou modifiés sont recalculés.

### Optimisation de la latence (audio streaming)

La génération de voix via IA est traditionnellement lente. J'ai contourné cet obstacle en implémentant une génération « en continu » (chunk-based generation). Le système découpe la réponse écrite en morceaux et commence à diffuser les premiers morceaux du message dès qu'ils sont prêts, tandis que la suite est générée en arrière-plan pendant la diffusion des blocs précédents. Résultat : le délai de réponse a été réduit de manière considérable pour les longs messages.

## Méthodologie

Le projet a été mené sur une période de 3 mois, exclusivement sur mon temps libre. Cette contrainte m'a poussé à adopter une approche de développement ultra-moderne :

- Levier de l'IA générative : j'ai utilisé l'IA (Gemini 3 Pro, GPT) comme outil de programmation pour la majorité du code. Mon rôle a évolué vers celui d'un superviseur technique. Grâce à ma connaissance approfondie de l'architecture logicielle, j'ai pu guider l'IA, déboguer ses sorties et m'assurer que le code produit était propre, optimisé et sécurisé malgré mon niveau « inexistant » sur NextJS et les technologies employées. Ne passant plus la majorité du temps à coder, j'ai pu me focaliser beaucoup plus sur des thématiques que je n'avais jamais pu développer auparavant, comme MongoDB.
- Vigilance critique : utiliser l'IA demande une vigilance constante. J'ai dû filtrer les solutions « pansements » parfois proposées par les modèles pour maintenir une structure de code cohérente, modulaire et sans nœuds inutiles, garantissant ainsi la pérennité du projet. L'utilisation de l'IA est toujours très débattue, mais il faut parfois accepter de coder différemment quand les contraintes y obligent.

## Roadmap : vers un dashboard de vie omniscient

La version actuelle (V1) d'OVRANE n'est que la fondation d'un écosystème plus vaste. Mon objectif est de transformer ce portfolio en un dashboard personnel global :

- Souveraineté et confidentialité : le passage à un modèle de langage local est prioritaire afin de garantir une totale confidentialité des données et une indépendance vis-à-vis des coûts d'API.
- Hyper-connectivité (n8n) : l'IA sera reliée à mes flux professionnels via n8n. Elle pourra ainsi croiser mes mails de recrutement, mon calendrier et mes candidatures envoyées pour devenir un véritable agent de gestion de carrière.
- Centralisation de services : OVRANE intégrera à terme des flux API sociaux (Instagram, YouTube), des outils de productivité (to-do lists, agendas) et des utilitaires de création (génération d'images, téléchargement de ressources), me permettant de quitter les plateformes centralisées pour un outil unique, sur mesure et intelligent.

## Fonctionnement technique et règles du portfolio

### Concept et interaction API

Ovrane est le cerveau du portfolio. Il ne s'agit pas d'un simple widget ajouté sur une page, mais d'une architecture intégrée où le frontend et l'IA dialoguent en permanence.
Chaque action de l'utilisateur (message, clic, commande vocale) transite par l'API backend. Celle-ci orchestre la réponse en combinant :
- La compréhension du langage naturel (via gpt-5-mini).
- La récupération de contexte (RAG) pour fournir des réponses précises sur mon parcours.
- L'envoi de commandes UI (JSON) pour piloter l'interface (changer de page, modifier le thème).

### Stack technique (détail)

- Frontend : Next.js, TypeScript, Tailwind CSS, Framer Motion.
- Backend : Node.js, Express.
- Base de données : MongoDB (persistance des conversations, des utilisateurs et des embeddings du RAG).
- IA & RAG : OpenAI gpt-5-mini (API Responses), OpenAI TTS (audio), RAG hybride sur mesure (BM25 et embeddings text-embedding-3-small, fusion RRF).

## Questions fréquentes : IA et RAG

### Pourquoi avoir choisi le RAG (Retrieval-Augmented Generation) plutôt qu'un fine-tuning de modèle sur des données personnelles ?

Le RAG a la réputation d'être un outil pour fournir des données et d'être utilisable très facilement par les modèles, ce qui est bien plus avantageux pour un portfolio que de devoir entrainer une IA de 0. De plus, le manque de données sur certains projets aurait pu rendre la tâche plus complexe ; le manque de temps et de moyens n'aide pas non plus.

### Comment la base de connaissances est-elle structurée pour que le RAG soit le plus précis possible ?

Un fichier Markdown par sujet (mon profil et un fichier par projet), structuré en sections et sous-sections ; chaque question de cette FAQ est une sous-section. Les données sont écrites à la main : j'essaie d'avoir une présentation globale, comme si je devais présenter le projet devant une foule, pour couvrir un maximum d'informations, en plus d'une section questions/réponses. Chaque section devient un passage qui porte son fil d'Ariane, et les consignes de l'assistant (couleurs, images, outils) sont rangées à part : elles ne polluent plus la recherche.

### Comment fonctionne la « seconde barrière » contre les faux positifs du RAG ?

Avec les nombreux tests effectués, j'ai pu voir les limites du système : des boucles d'appels de fonctions, un RAG absent aux moments idéaux ou, au contraire, trop présent en permanence. La première version filtrait le contexte avec une liste de mots ; elle a été remplacée par une porte de pertinence mesurée : le contexte n'est injecté que si la question est assez proche d'un passage (similarité des embeddings au-dessus d'un seuil calibré sur un jeu de questions de test) ou si elle en partage les mots-clés. Les outils, eux, gardent des listes de mots dédiées pour apparaître au bon moment : si l'on demande de changer le fond puis qu'on enchaîne avec une réponse très courte, comme le seul nom d'une autre couleur, l'IA sait quoi faire.

### Comment gérer les hallucinations de l'IA lorsqu'elle parle des projets ?

Les réponses s'appuient sur les passages retrouvés dans ma base, et une règle fixe des consignes interdit à l'IA de prétendre savoir ce qui n'y est pas. À l'époque de GPT-4o mini, l'avantage était qu'il était trop petit pour halluciner, mais du coup pas assez grand pour être plus « créatif » dans ses phrases.

### Pourquoi un modèle « mini » (GPT-4o mini, puis gpt-5-mini) plutôt qu'un modèle plus large ?

La vitesse de réponse : c'était trop important d'avoir des réponses rapides, car les recruteurs ne vont pas rester 8 heures à attendre des réponses sur un portfolio.

### Quelle est la taille de la fenêtre de contexte laissée à l'IA pour se souvenir du début de la conversation ?

L'IA reçoit les 8 derniers échanges de la conversation, ce qui est largement suffisant pour l'usage que je veux offrir : il ne faut pas oublier que ça ne doit pas remplacer ChatGPT.

### Pourquoi MongoDB plutôt qu'une base de données vectorielle spécialisée (comme Pinecone ou Weaviate) ?

MongoDB sauvegarde et charge les profils et les conversations des visiteurs, ce qui donne aussi des données sur les visiteurs, et il conserve les embeddings des passages du RAG pour ne pas les recalculer à chaque démarrage. La recherche elle-même se fait en mémoire : avec environ 130 passages, une base vectorielle distante n'apporterait que de la latence. Une recherche vectorielle hébergée (comme Atlas Vector Search) n'aurait de sens qu'au-delà de quelques milliers de passages.

## Questions fréquentes : voix et interface technique

### Comment le streaming audio a-t-il été implémenté pour réduire la latence ?

La latence du TTS a été réduite grâce à un découpage en chunk du message écrit : sur une grande réponse, il peut y avoir 3-4 parties découpées, et elles sont toutes envoyées une par une. Au bout de 2 chunks prêts, l'IA commence à parler, mais en parallèle le TTS génère les chunks restants. Ainsi, le temps de génération est masqué par le TTS des chunks précédents et l'attente de l'utilisateur ne se fait que pour les 2 premiers chunks.

### Y a-t-il eu des problèmes de synchronisation entre le texte généré et la voix (TTS) ?

Aucun.

### Comment l'IA interagit-elle concrètement avec le DOM pour changer le thème ou naviguer ?

Elle utilise des commandes intégrées dans ses tools d'API, qu'elle déclenche ; ces tools ajoutent un objet commande à sa réponse, qui est ensuite traité par le front. Exemple :

```json
{
  "reply": "Voici l'image demandée.",
  "commands": [
    { "command": "ShowPicture", "parameter": "Pico Logo.png" }
  ],
  "activeUserId": "user-123..."
}
```

## Questions fréquentes : UX et design d'interface

### Pourquoi avoir choisi la forme de l'hexagone pour l'œil central ?

À la base, je voulais une sphere 3D avec des anneaux qui réagissaient aux interactions utilisateurs, mais c'était beaucoup trop lourd en animation calculée par le front, et je n'ai pas les compétences pour faire une animation si complexe en plusieurs versions. L'hexagone a été trouvé totalement par hasard : j'ai trouvé que ça ressemblait à un œil, donc je suis allé là-dessus.

### Le minimalisme d'Ovrane ne risque-t-il pas de perdre un utilisateur habitué aux sites standards ?

C'est le prix de l'originalité, mais tout le monde utilise ChatGPT : ce n'est plus une interface inconnue pour le grand public.

### Pourquoi avoir jugé la voix d'ElevenLabs « trop humaine » ? Quel est l'impact recherché avec une voix plus synthétique ?

Je voulais avoir une esthétique futuriste, avoir la voix d'un Jarvis ou d'un assistant comme dans les films de science-fiction. C'est toujours en cours, mais je trouve qu'une voix humaine rendait le portfolio moins intéressant à écouter.

### Un mode « silencieux » est-il prévu pour les utilisateurs qui ne peuvent pas utiliser l'audio ?

Le mode messagerie est déjà un mode silencieux.

### Comment l'IA adapte-t-elle son ton en fonction des questions du recruteur ?

L'IA est forcée sur le vouvoiement dans son prompt système.

### Quel a été le plus grand défi d'UX dans l'intégration d'un agent conversationnel ?

Le plus grand défi a été de rendre compréhensible le clic du milieu pour passer du Dashboard à la messagerie. Écrire un message intrusif ou rajouter un bouton aurait ruiné l'interface ; il a donc été décidé de mettre un message sur le Dashboard après le premier message reçu d'un utilisateur, ce qui le force à voir ce qu'est le Dashboard avant de découvrir la messagerie. Mettre ce message ailleurs, par exemple sur le chargement du début, aurait ruiné cet aspect « IA qui se lance », et les gens ne sont en général pas rivés sur leur écran pendant un chargement.

### Comment la navigation naturelle a-t-elle été testée pour éviter que l'utilisateur ne se sente « bloqué » ?

J'ai testé via mon entourage, à qui je n'ai jamais expliqué ce que c'était : j'ai ainsi pu avoir leurs retours très facilement.

## Questions fréquentes : méthodologie et développement avec l'IA

### Quelle est la compétence clé pour diriger une IA dans le code, en tant que « superviseur technique » ?

Savoir coder. L'IA a tendance à vouloir satisfaire notre demande et peut parfois mettre des pansements sur du code « tant que ça marche », ce qui est contre la volonté d'un bon développeur, qui se doit d'avoir un code structuré, optimisé et scalable.

### Quel a été le bug le plus complexe généré par l'IA qu'il a fallu corriger ?

Un jour, j'ai demandé à l'IA de supprimer tous les fichiers n'ayant pas une certaine séquence dans leur nom : elle l'a appliqué à tout mon PC et j'ai dû tout réinstaller.

### Pourquoi avoir choisi NextJS sans maîtriser cette technologie au départ ?

Il n'y a jamais besoin de maîtriser une technologie pour pouvoir intervenir dessus. NextJS demande une logique particulière qui m'est actuellement inconnue, mais cela reste du JavaScript et du web, donc lire le code ne pose aucun problème. Ce que je ne sais pas faire sur NextJS, ce sont les interactions complexes, la gestion des boucles d'actualisation : en clair, comment fonctionne le langage en profondeur. Mais NextJS est très facile à lire.

### Quelle méthode pour « filtrer » les solutions de type « pansements » proposées par l'IA ?

Lire le code fourni et lui imposer de prioriser la suppression plutôt que le rajout.

### Sans IA, combien de temps aurait pris le projet par rapport aux 3 mois actuels ?

Probablement le double, ou alors il n'y aurait pas toutes les fonctionnalités présentes. Non pas par incompétence, mais par manque de temps.

### Quelle vision de l'évolution du métier de développeur face à ces outils ?

Un bon développeur ne code pas, sauf si nécessaire.

## Questions fréquentes : vision et roadmap

### Quels sont les défis techniques pour passer d'une API cloud à un modèle de langage local ?

Aucune idée : je compte utiliser Ollama, mais je ne me suis pas renseigné et je n'ai surtout pas le PC pour ça, donc ce sera pour une prochaine fois.

### Comment garantir la confidentialité des données en connectant n8n aux mails ?

C'est toujours en réflexion.

### L'intégration de n8n permettrait-elle à l'IA de prendre des rendez-vous directement ?

Techniquement, oui.

### Pourquoi vouloir quitter les plateformes centralisées (Instagram, YouTube) pour les intégrer à Ovrane ?

Les pubs, et la liberté de filtrer ce qui m'intéresse réellement.

### Le code d'Ovrane sera-t-il ouvert en open source ?

Non.

## Questions fréquentes : business et soft skills

### Quel est le coût de revient mensuel (API OpenAI) pour maintenir ce portfolio en ligne ?

Pour l'instant, avec tous les tests effectués en 3 mois : 0.20 centimes.

### Comment expliquer le fonctionnement technique d'Ovrane à un client non technique ?

C'est un ChatGPT, mais pour mon portfolio.

### Quel aspect du projet rend le plus fier aujourd'hui ?

Avoir intégré la totalité de ce que j'avais prévu et n'avoir jamais changé de route à cause d'une incapacité X ou Y.

### Quelle a été la plus grande déception ou le plus grand échec de ces 3 mois de développement ?

Je n'ai pas de voix robotique magnifique, je suis triste de ça.

### Une version mobile d'Ovrane est-elle envisagée ? Quelles seraient les contraintes ?

Le site est déjà responsive, mais oui, à terme c'est envisageable, pour la prise de données notamment.

### Comment gérer les mises à jour des modèles sans tout casser ?

Le passage de GPT-4o mini à gpt-5-mini s'est fait sans tout casser : le modèle se règle par une variable d'environnement et le code est scalable.

### Si un investisseur donnait les moyens de transformer Ovrane en produit SaaS, par quoi commencer ?

Par une vraie inscription des utilisateurs.

### Peut-on accéder aux applications ou les tester ?

Il n'y a aucune application disponible : Pico est un prototype en cours de construction et Hik'up n'existe plus.
