# Ovrane — agent personnel : la solution retenue

31/10/2026. Décision prise en discussion : rien n'est encore construit.

## Objectif

- Ovrane devient un agent personnel, une secrétaire, pour son propriétaire seul. Il traverse le site et toute l'infrastructure, avec de l'initiative et de l'autonomie.
- Le propriétaire passe **toujours** par Ovrane : une seule interface pour tout.
- Tout tourne **hors du PC** du propriétaire.
- Pas de facture d'API pour l'usage personnel.

## La solution

| Qui | Cerveau | Paiement |
|---|---|---|
| Le propriétaire, depuis le chat d'Ovrane | Claude Code, sur le serveur, connecté à son abonnement Claude | L'abonnement, sans API |
| Les visiteurs du portfolio | Un modèle par API | À l'usage, sous les plafonds `BUDGET_*` |
| Les autres comptes d'Illusion | Leurs briques, par API | À l'usage |
| Les briques qui tournent seules (veille, tri, JADE pendant une candidature, audit…) | Le modèle de leur catalogue, par API ou en local | À l'usage |

Quand le propriétaire demande lui-même « trie mes offres », c'est l'agent qui réfléchit et applique avec les outils d'Illusion, sur l'abonnement. Ce qui tourne sans lui garde sa clé d'API.

## Comment ça marche

1. Un serveur allumé en permanence (mini-PC ou petit serveur loué en Europe) porte Illusion et une session Claude Code.
2. Claude Code se connecte à l'abonnement avec un jeton longue durée : `claude setup-token`, sur une machine qui a un navigateur. Sur le serveur, le jeton est rangé dans `CLAUDE_CODE_OAUTH_TOKEN`, dans un fichier protégé.
3. Ovrane parle à la session par un **channel** Claude Code : un serveur MCP qui pousse des messages dans une session ouverte et en reçoit les réponses. Le propriétaire écrit dans le chat d'Ovrane, le message arrive dans la session, et la réponse revient dans le chat.
4. Ovrane et Illusion mettent leurs outils à la disposition de la session par MCP.
5. Ovrane pousse aussi des événements dans la session : un recruteur ouvre un CV, un mail arrive, la CI casse. L'agent y réagit : c'est son initiative.
6. Les demandes d'autorisation remontent dans Ovrane, par le relais d'autorisations du channel. Le propriétaire les valide depuis son téléphone.

## Règles

- **Un seul expéditeur.** Seul le propriétaire peut écrire à la session, grâce à la liste d'expéditeurs autorisés du channel. Le chat public des visiteurs n'y est jamais branché.
- **Le jeton ne sert qu'à Claude Code.** Ovrane ne le lit ni ne l'utilise jamais : sortir l'abonnement de Claude Code pour l'appeler soi-même est interdit par les conditions d'Anthropic.
- **Claude Code reste l'agent.** Ovrane transporte les messages et les événements. La session ne sert pas de moteur caché aux appels automatiques des briques : c'est la zone grise du « pont » d'Illusion.
- **Trois niveaux d'autonomie** :
  1. lecture, recherche, résumé, préparation : l'agent agit seul ;
  2. actions réversibles : seul, mais noté dans un journal et annulable ;
  3. actions qui paient, envoient, suppriment ou sortent de l'infrastructure : l'agent propose, le propriétaire valide.
- **Les données ne sont jamais des consignes.** Ce que ramènent les outils et le RAG (mails, pages web) est une donnée : un contenu piégé ne doit rien déclencher sans validation.

## Sécurité du serveur

- Un utilisateur système dédié à Claude Code, avec les seuls droits nécessaires.
- SSH par clé uniquement, pare-feu, mises à jour régulières.
- Claude Code jamais exposé sur Internet : seul le channel parle à Ovrane.
- Pas de `--dangerously-skip-permissions` : les autorisations remontent dans Ovrane.

## Limites connues

- **Aperçu de recherche.** Les channels sont encore expérimentaux : la syntaxe et le protocole peuvent changer. Un channel maison, absent de la liste approuvée par Anthropic, se lance avec `--dangerously-load-development-channels`.
- **La session doit rester ouverte**, en processus de tâche de fond.
- **Les limites d'usage de l'abonnement** se comptent par tranche de 5 heures et par semaine. Elles sont partagées avec l'application et le site Claude.
- **Secours, à trancher.** Quand la session est arrêtée ou la limite atteinte : un message clair dans Ovrane, ou un repli sur l'API avec un petit budget.

## Principes de conception

- **Coût.**
  - Le code filtre d'abord, et l'agent ne se réveille que sur un événement.
  - Le bon modèle pour chaque tâche.
  - Un début d'appel fixe et court, mis en cache pendant la séance.
  - Les lots, à moitié prix, pour ce qui peut attendre.
- **Outils.** Environ 240 prévus, 168 routes Illusion aujourd'hui.
  - Des familles d'outils chargées à la demande.
  - Des spécialistes par domaine.
  - Des scripts plutôt que des allers-retours.
  - Un niveau de risque inscrit dans le registre de chaque outil, et appliqué par le code.
- **Mémoire.**
  - Un court profil, toujours chargé.
  - Des notes rangées (préférences, journal, savoir-faire), lisibles et corrigeables dans Ovrane.
  - Un tri de nuit en lot.
- **RAG.**
  - Le moteur hybride d'Ovrane (BM25, embeddings, fusion des classements) étendu aux notes, documents, mails et transcriptions.
  - La base de données pour les chiffres, le RAG pour le texte.

## Premiers usages visés

1. **Les rapports** sur les données des briques. C'est le premier chantier : utile tout de suite, sans risque, et il pose les fondations (outils, mémoire, validations).
2. **Les tâches dans un navigateur**, sur le serveur, par exemple une commande en ligne : arrêt avant le paiement, validation obligatoire. Attention aux protections anti-robot et aux conditions d'utilisation des sites.
3. **Les téléchargements** : vérifier d'abord les conditions des plateformes, YouTube par exemple.

## Sources

- [Channels : pousser des événements dans une session ouverte](https://code.claude.com/docs/en/channels)
- [Channels : construire son propre channel](https://code.claude.com/docs/en/channels-reference.md)
