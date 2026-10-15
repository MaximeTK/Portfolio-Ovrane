# Pico

## Présentation

Pico est une application de communication pour les personnes non verbales. Le projet est actuellement en phase de prototypage : la conception papier est achevée et le développement est imminent.

## Analyse comparative et genèse du projet

Le développement de PICO repose sur un audit approfondi des solutions leaders du marché (Proloquo2Go, TD Snap, LetMeTalk). Cette phase de benchmarking a révélé trois faiblesses structurelles majeures :
- La surcharge cognitive : des interfaces saturées de pictogrammes rarement utilisés.
- La profondeur d'arborescence : une quantité excessive de clics pour accéder à des termes spécifiques.
- L'incohérence logique : des parcours utilisateurs sinueux qui ralentissent la construction de la pensée.

La réponse de PICO : plutôt que d'offrir un catalogue exhaustif et désordonné, PICO propose un parcours utilisateur fixe mais optimisé, limitant le bruit visuel pour se concentrer sur l'essentiel du langage fonctionnel.

## Ingénierie de l'interface : l'architecture en quatre quadrants

L'interface de PICO est sectorisée en quatre zones stratégiques, chacune dotée d'interactions paramétrables pour s'ajuster aux capacités motrices et cognitives de l'utilisateur.

### Zone de construction syntaxique (supérieure)

Faisant office de « barre de lecture », cette zone matérialise la phrase en cours. Elle intègre un système de sécurité interactionnelle pour pallier les troubles de la motricité fine :
- Neutralisation du toucher court : évite toute suppression accidentelle lors de la manipulation.
- Mode édition par toucher long : active le module Drag & Drop pour la restructuration syntaxique ou la suppression par glissement (swipe) vers l'extérieur.

### Noyau lexical dynamique (centrale)

Cœur informationnel hébergeant les « decks » (classeurs) thématiques. L'ergonomie repose sur une navigation à double niveau :
- Sélection immédiate (toucher court) : ajout instantané du pictogramme.
- Exploration sémantique (toucher long) : ouverture d'une thématique (ex : « Alimentation »). Cette distinction permet de maintenir une profondeur de vocabulaire sans multiplier les boutons à l'écran.

### Barre de fonctions transversales (inférieure)

Dédiée à l'ancrage mnémotechnique, cette zone regroupe les catégories statiques : Logique, Positionnement, Émotions et Favoris. Chaque bloc bénéficie d'un code couleur unique et saturé, réduisant drastiquement la charge mentale liée à la recherche d'information spatiale.

### Panneau de modulation temporelle (latérale droite)

Ce volet transforme le besoin en expression construite via deux leviers :
- Modalité : bascule instantanée entre Affirmation et Question.
- Temporalité : sélection simplifiée du Passé, Présent ou Futur, permettant une narration complexe avec un minimum d'efforts cognitifs.

## Philosophie UX : le dilemme « densité vs rapidité »

PICO résout le conflit traditionnel entre exhaustivité et célérité grâce à plusieurs piliers :
- Calibrage du « noise » : le tuteur (parent ou soignant) peut désactiver les modules non essentiels dès l'inscription pour prévenir la surcharge sensorielle.
- Réduction de la distance de clic : la séparation physique des catégories « maîtresses » permet une navigation multidimensionnelle, supprimant les allers-retours fastidieux propres aux systèmes en arborescence fermée et réduisant significativement le nombre de clics (de 5-6 clics à 1-2 clics maximum).
- Guidage syntaxique : un moteur de parcours dirigé (Pronom → Verbe → Sujet) accompagne l'apprentissage. Ce système est totalement débrayable pour laisser place à une liberté totale dès l'acquisition de l'autonomie.

## Viabilité technique et sécurité des données

Actuellement en phase de prototypage (conception papier achevée, développement imminent), PICO intègre les exigences du secteur médico-social :
- Conformité RGPD : sécurisation totale des flux pour une utilisation professionnelle en milieu hospitalier.
- Modèle hybride LLM : les phrases sont traitées par un Large Language Model (LLM). Pour optimiser les coûts et la latence, PICO utilise une API partagée couplée à une base de données locale de phrases pré-générées. Cette stratégie réduit le coût en tokens à un niveau quasi nul, garantissant la pérennité du service.

## Modèle économique et écosystème d'accès

Le déploiement de PICO repose sur une segmentation stratégique des accès, conçue pour équilibrer l'accessibilité sociale (pour les familles) et la robustesse administrative (pour les institutions médicales). Cette structure garantit que la communication ne soit jamais entravée par des barrières financières, tout en offrant des outils d'analyse de pointe pour les professionnels.

### Compte Standard (particuliers et familles)

Destiné aux parents, tuteurs légaux et particuliers. Ce niveau d'accès est le socle éthique du projet et le pilier de son engagement social : il est entièrement gratuit afin de garantir qu'aucun parent ou aidant ne soit privé d'un outil de communication pour son proche, sans compromis sur la qualité des outils.

Inclus :
- Bibliothèque de pictogrammes : accès illimité à la banque de pictogrammes de base.
- Gestion de contenu : création, édition et modularité complète des « Decks » (classeurs thématiques).
- Partage communautaire : possibilité de partager des decks personnalisés avec d'autres familles.
- Continuité numérique : sauvegarde sur serveur sécurisé pour prévenir la perte de données en cas de changement d'appareil.
- Support : un service d'assistance standard accompagne les familles dans la configuration initiale.

Limites : ce compte ne permet pas l'analyse statistique des données de communication, l'accès aux modules de suivi médical, la gestion de dossiers médicaux complexes ni la connexion via SSO (Single Sign-On).

### Compte Praticien (Pro Salarié)

Destiné aux orthophonistes, éducateurs spécialisés et personnels soignants exerçant au sein d'une structure (hôpitaux, IME, SESSAD, cabinets). Ce compte est payant via une licence institutionnelle et transforme l'application en un véritable outil de suivi clinique.
- Gestion de file active et profils multiples : création et gestion de profils illimités pour suivre l'intégralité de sa patientèle sur un seul terminal.
- Partage inter-services : transfert de profils de communication entre collègues du même service pour assurer la continuité des soins.
- Analytique de communication : outils d'analyse statistique pour mesurer les progrès et observer l'évolution de l'acquisition du langage.
- Suivi de santé : module de saisie des données médicales pertinentes pour la communication, sécurisées.
- Sécurité entreprise : inscription simplifiée par mail d'invitation institutionnel et connexion sécurisée via SSO.
- Gouvernance : ce compte ne permet pas la création d'autres comptes professionnels ; il est géré de manière centralisée pour garantir la conformité des licences.

### Compte Administrateur (Pro Admin)

Destiné aux directions d'établissements, hôpitaux et grands réseaux spécialisés. C'est le centre de pilotage pour toute entité sous licence globale, dédié à la gestion administrative et technique de la flotte d'appareils.
- Gouvernance des accès et gestion des licences : droit exclusif de générer des invitations pour les profils « Pro Salarié », de gérer les clés de licence de l'établissement, et d'activer ou révoquer les accès de l'ensemble du personnel soignant.
- Sécurité renforcée : l'accès nécessite une Clé Pro physique ou numérique pour garantir l'intégrité des données à haut niveau.
- Gestion de flotte : vue d'ensemble sur les profils pro et création d'invitations pour les nouveaux collaborateurs.
- Vision globale : accès à l'intégralité des modules (statistiques, médical, support prioritaire) et supervision du stockage des données médicales et statistiques à l'échelle de l'institution, dans le respect des protocoles de sécurité les plus stricts.

## Axes de réflexion et recherche & développement

Le développement de ces profils est un processus itératif, actuellement concentré sur trois défis techniques majeurs :
- Synchronisation en temps réel : optimisation de la latence entre le terminal de l'utilisateur final et l'interface de contrôle du professionnel.
- Stratégie de stockage hybride : détermination de la frontière entre les données locales (pour la réactivité et la confidentialité immédiate) et les données cloud (pour la sauvegarde et l'analyse statistique).
- Éthique des données : mise en conformité stricte pour le stockage de données médicales sensibles sur des serveurs certifiés HDS (Hébergeur de Données de Santé).

## Vision et engagement personnel

Le projet PICO ambitionne de révolutionner un secteur souvent délaissé par l'innovation logicielle moderne. Mon objectif est de briser le statu quo en agissant sur des leviers fondamentaux :
- Accessibilité financière : réduction drastique des coûts d'abonnement pour que la communication ne soit plus un luxe.
- Performance et vitesse : une interface sans latence pour une parole instantanée.
- Soutien communautaire : un service support humain et réactif.

Pourquoi cet engagement ? Bien que je n'aie pas de lien direct dans mon entourage avec le spectre autistique non verbal, j'ai identifié ici un défi technologique et humain majeur. Je suis convaincu que mes compétences en UX Design et en architecture logicielle peuvent apporter une solution concrète à ce problème. Pour moi, Pico n'est pas seulement un défi technique : c'est l'opportunité de mettre le code au service de la dignité humaine, en offrant une voix à ceux que la technologie actuelle a trop longtemps ignorés.

## Questions fréquentes : analyse et benchmarking

### Quelles ont été les critiques les plus récurrentes des utilisateurs envers Proloquo2Go lors de l'audit ?

C'est trop lent de faire une phrase.

### Comment la « surcharge cognitive » des solutions existantes a-t-elle été mesurée ?

Aucune mesure objective, c'est un simple constat.

### Pourquoi les leaders du marché n'ont-ils pas déjà implémenté cette réduction de clics ?

Je pense que les applications déjà en place ont trop de travail et de risque à prendre pour changer leurs interfaces, déjà utilisées par des milliers de gens.

### Quelle a été la part de la recherche utilisateur (interviews, observations) ?

Il n'y a pas eu de recherche utilisateur en dehors d'internet car je n'ai pas encore de contact. Pour l'heure, ce produit est une théorie qui devra être testée sur le terrain.

## Questions fréquentes : ingénierie de l'interface (UX/UI)

### Pourquoi une division en quatre quadrants plutôt qu'une autre structure ?

C'est une structure simple et facile à comprendre.

### Le « toucher long » est-il intuitif pour des enfants ou des personnes avec des troubles cognitifs sévères ?

Il peut ne pas être intuitif, mais c'est pour cela qu'il est désactivable selon le profil utilisateur.

### La zone de construction syntaxique en haut de l'écran ne risque-t-elle pas d'être difficile d'accès sur de grandes tablettes ?

Oui, mais la déplacer rendrait un autre élément difficile d'accès, et l'affichage de la phrase est l'élément qui n'a pas besoin d'être touché dans la majorité des cas.

### Comment gérer le Drag & Drop pour des utilisateurs ayant une motricité fine très limitée ?

On ne l'active pas.

### Pourquoi avoir séparé physiquement la temporalité (passé/présent/futur) dans un panneau latéral droit ?

Toutes les informations doivent être claires et compréhensibles facilement : des gros boutons sont donc parfaits.

### Un mode « nuit » ou « haut contraste » est-il prévu pour les hypersensibilités sensorielles ?

Oui, l'application doit être totalement personnalisable, que ce soit les icônes, les sons ou les tailles. Cela inclut donc des modes nuit ou haut contraste.

## Questions fréquentes : logique de langage et IA

### Le passage au mode « liberté totale » est-il décidé par l'IA ou par le tuteur ?

Par le tuteur, lors de l'inscription ou dans les paramètres.

### Pourquoi utiliser un LLM pour traiter les phrases au lieu d'un simple moteur de règles grammaticales ?

Pour pouvoir générer des phrases complètes plutôt qu'un simple « Je vouloir manger ». De plus, un LLM est littéralement idéal pour faire ça.

### Comment la base de données locale de phrases pré-générées est-elle mise à jour ?

C'est en réflexion.

### Le LLM aide-t-il à la prédiction du prochain mot (comme un clavier de smartphone) ?

Absolument pas : l'interface est absolument statique pour que l'utilisateur sache, avec l'habitude, où se trouve ce qu'il cherche.

### Quel modèle de LLM a été sélectionné pour le prototype, et pourquoi ?

N'importe quel LLM fera l'affaire, car les requêtes sont extrêmement simples.

## Questions fréquentes : sécurité et données (médico-social)

### Quelles sont les contraintes du RGPD pour une application traitant des données de handicap ?

Tout doit être anonymiser : il ne faut pas pouvoir deviner à qui appartient le profil. Mais l'application n'a absolument pas besoin de données médicales pour son bon fonctionnement.

### Comment garantir que les statistiques d'utilisation ne permettent pas d'identifier l'utilisateur final ?

Il n'y aura JAMAIS de sauvegarde de statistiques.

### Comment fonctionne la synchronisation si l'appareil est hors ligne pendant plusieurs jours ?

L'appareil ne sera simplement pas capable de générer de nouvelles phrases complètes grammaticalement : il utilisera alors le cache local, et si aucune phrase n'est disponible pour ce cas de figure, il devra énumérer chaque pictogramme.

## Questions fréquentes : modèle économique et stratégie

### Pourquoi avoir choisi la gratuité totale pour les familles ? Comment financer les coûts d'infrastructure ?

C'est en cours de réflexion.

### Comment convaincre les hôpitaux ou les IME de passer de TD Snap à PICO ?

Par l'efficacité et les outils mis à disposition des hôpitaux.

### Comment empêcher un professionnel d'utiliser un compte « Standard » pour contourner le paiement ?

C'est en cours de réflexion.

### Un partenariat avec des fabricants de matériel (tablettes durcies) est-il envisagé ?

Aucune idée, pourquoi pas.

### Quel est le coût estimé en tokens pour une utilisation quotidienne moyenne ?

Avec toutes les optimisations normalement prévues, 0, car l'utilisation d'un modèle local ne coûte rien.

## Questions fréquentes : développement et roadmap

### Comment constituer la bibliothèque de pictogrammes sans problème de droits d'auteur ?

C'est en cours de réflexion : il existe des pictogrammes libres de droits, mais une IA de génération d'images serait peut-être le mieux.

### Une version eye-tracking (poursuite oculaire) est-elle prévue pour les handicaps moteurs lourds ?

C'est extrêmement compliqué à faire et ce n'est pas prévu.

## Questions fréquentes : vision et engagement personnel

### Sans lien direct avec l'autisme, comment s'assurer de la pertinence des choix ergonomiques ?

Je ne suis assuré de rien du tout : ce n'est qu'une théorie qui doit être testée en conditions réelles via un prototype.

### Quel a été l'avis des professionnels de santé consultés ?

Très intéressant, et si j'y arrive, cela serait incroyable pour eux.

### Comment imaginer PICO dans 5 ans ?

Terminé.

### En quoi un profil d'UX Designer fait-il la différence sur ce projet par rapport à un développeur classique ?

L'expérience et la vision.

### Quel a été le défi le plus difficile lors de la phase de conception papier ?

Trouver une interface idéale pour résoudre tous les soucis énumérés.

### Comment recruter les premiers testeurs bêta ?

Via les groupes pour autistes.
