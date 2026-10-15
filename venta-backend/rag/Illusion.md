# Illusion

## Présentation

Illusion : comment j'ai automatisé une recherche d'emploi de bout en bout, pour un centime par candidature.

Une chaîne complète de candidature : chercher, comprendre, postuler, suivre, sans y passer ses journées.

- Le problème : chercher un emploi prend des journées entières, et une lettre écrite à la chaîne se reconnaît dès la première ligne.
- La solution : une chaîne qui lit les entreprises et leurs offres, trie en trois passes, écrit un CV et une lettre pour chaque poste, dépose le dossier et suit les réponses.
- L'impact : 23 114 annonces lues et 652 offres retenues en 17 jours ; environ 1 centime par candidature déposée.

## Fiche du projet

- Rôle : seul, de la conception à l'architecture, au développement et au design.
- Période : depuis août 2026.
- Stack : Python, FastAPI, navigateur automatisé, MongoDB, modèles d'IA.
- Livrables : un pipeline, sept briques spécialisées et un tableau de bord.
- Statut : en service, en cours d'intégration à Ovrane.

## Le problème : sans portrait de l'entreprise, une lettre vaut pour n'importe qui

Une recherche sérieuse, c'est trouver les offres, comprendre l'entreprise, adapter son CV, écrire une lettre, remplir des formulaires tous différents, puis suivre des dizaines d'échanges. Fait à la main, c'est un temps plein ; fait à la chaîne, c'est inefficace.

Illusion fait tout le travail, mais pour chaque poste, comme le ferait un candidat qui prend le temps.

## Vue d'ensemble : cinq étapes, et deux portes vers la même fiche entreprise

1. Capter : un registre public d'entreprises (secteur, zone, taille) et onze sources d'offres.
2. Trier : trois passes, de la règle fixe à la lecture complète de l'annonce.
3. Connaître : le site de l'entreprise est lu (contacts, recrutement), puis son portrait est dressé.
4. Préparer : un CV et une lettre écrits pour ce poste-là.
5. Postuler et suivre : par formulaire ou par courriel, puis chaque réponse revient sur sa fiche.

Ce qui est lu sur le site sert deux fois : pour candidater, et pour écrire la lettre. Une société qui recrute entre aussi dans la chaîne par ses offres, sans qu'on l'ait cherchée.

## Le tri : chaque passe coûte plus cher que la précédente

L'ordre n'est pas neutre : les trois passes vont de la moins chère à la plus chère.
1. Mots bannis : une règle fixe, sans lecture, rapide et gratuite.
2. L'intitulé : « Développeur » et « Développeur commercial » ne visent pas le même métier.
3. L'annonce entière : lue et comparée au profil, elle écarte ce qui ressemble sans correspondre.

Que faire d'une offre écartée ? La garder, avec son motif : elle ne repasse pas au tri quand une autre source la republie, et on ne paie jamais deux fois la même lecture.

Que mesurer au passage ? Les compétences demandées, présentes, manquantes et implicites : agrégé sur des centaines d'offres, c'est la liste de ce qu'il faudrait apprendre.

## Le dossier : le CV est réordonné pour chaque poste, mais rien n'y est jamais inventé

Le CV et la lettre sont fabriqués à partir de quatre sources : le portrait de l'entreprise, l'annonce, la fiche du candidat et ses projets. Les compétences demandées remontent en tête, les libellés reprennent les mots de l'annonce, et la lettre parle de l'entreprise parce qu'on est allé la lire.

Une règle qui ne bouge pas : le modèle assemble, il ne complète pas. Ce qui manque est noté comme manquant, pour le candidat seul ; une compétence oubliée s'ajoute au profil d'un geste et compte dès la candidature suivante.

## La candidature : un dossier qui n'aboutit pas n'est pas un « échec », sa raison est nommée

- Par formulaire : un navigateur automatisé ouvre l'annonce, se connecte ou crée le compte, relève le code de validation dans le courrier, répond aux questions libres et dépose les pièces.
- Par courriel : quand l'entreprise ne publie pas d'offre mais laisse une adresse, une candidature spontanée est envoyée, adressée, avec les pièces jointes.
- Le verdict : posté, ou bloqué pour une raison précise (vérification humaine, compte refusé, pièce refusée, offre retirée, page muette).

## Le suivi : l'état d'une candidature se lit sur les faits, il n'est jamais saisi

La boîte mail est relevée en continu. Chaque message est classé (information, relance, refus, code de validation, rendez-vous) puis rattaché à l'offre qui l'a provoqué, du plus sûr au moins sûr : identifiant du message, puis domaine de l'expéditeur, puis nom de l'entreprise.

Un refus reçu ne peut donc pas laisser une ligne « en attente ». Chaque poste porte un minuteur de relance ; l'envoi automatique de la relance reste, à ce jour, la dernière porte fermée à clé.

## IA et humain : le modèle lit et rédige, les règles fixes et l'humain gardent la main

- Ce que décide le modèle : la lecture d'un intitulé ou d'une annonce, le portrait d'une entreprise, la rédaction du dossier, le remplissage d'un formulaire.
- Ce qui reste en règle fixe : les mots bannis, la fenêtre de fraîcheur, le rattachement des mails, l'état des candidatures.
- Ce qui reste humain : les compétences du profil, la relance, et toute page qui exige une vérification humaine.

## Résultats : 17 jours de collecte continue, mesurés au 10 septembre 2026

- 23 114 annonces lues en 334 passages.
- 3 370 offres distinctes, doublons réunis.
- 652 offres retenues après les trois passes.
- Environ 1 centime par candidature déposée, tout compris.

D'où viennent les 652 offres retenues : LinkedIn 280, APEC 225, Adzuna 44, Welcome to the Jungle 41, Arbeitnow 21, Careerjet 16, Free-Work 12, France Travail 8, Jooble 4. Sur 1 958 offres présentées au tri, 1 305 sont tombées sur une règle fixe, avant toute lecture payante.

Pourquoi un filtre de fraîcheur en premier ? Pour écarter les annonces trop anciennes sans les lire : 2 523 des 3 370 offres collectées étaient déjà retirées quand on les a revues, trois sur quatre.

Où gagner du temps ? En ne copiant le profil du navigateur qu'une fois, puis en le vérifiant : la copie de 5 Go refaite à chaque lancement prenait 66,7 s ; elle prend moins d'un dixième de seconde.

## Suite : Illusion dans Ovrane, derrière une connexion

Les données quittent le poste pour une base partagée avec Ovrane : chaque utilisateur aura son profil, ses CV et ses candidatures, accessibles partout. Le tableau de bord est en refonte avec l'identité d'Ovrane, en trois couches : l'essentiel pour tous, les réglages à part, les détails techniques derrière un interrupteur.
