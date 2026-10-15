# Ovrane — audit et assainissement

Branche `dev`, le 15/10/2026. Quatre audits en lecture seule (backend, front, sécurité, UX/UI et accessibilité), puis correction. Remplace l'audit de dette technique du 17/08/2026, dont la phase « relai unique » était faite et le reste repris ici.

Objectif : une base saine pour porter Illusion **dans** Ovrane, derrière une zone de connexion.

## Bilan chiffré

| | Avant | Après |
|---|---|---|
| Code backend (`venta-backend/src`) | 5 082 lignes | 1 858 lignes |
| Code front (`Venta/src`, TS/TSX/CSS) | 7 089 lignes | 4 415 lignes |
| First Load JS de l'accueil | 487 Ko | 202 Ko |
| `Venta/public/assets` | 150 Mo | 46 Mo |
| Tests backend hors ligne | 3 harnais maison, 2 cassés, 1 exigeant un serveur lancé | `npm test` (`node --test`) : 50/50 |
| Vulnérabilités npm (prod) | front : 2 critiques (next) ; back : 1 critique, 3 modérées | front : postcss (corrigé seulement par Next 16) ; back : 0 |

212 fichiers touchés, 11 490 lignes supprimées, 5 222 ajoutées.

## 1. Sécurité

Le dépôt GitHub est **public**.

### Corrigé

| Gravité | Constat | Correctif |
|---|---|---|
| Critique | L'identité était un `userId` envoyé par le navigateur ; pour un compte, `sha256("name:"+pseudo)` tronqué : connaître un pseudo suffisait pour lire son historique ou parler en son nom | Sessions opaques : jeton de 256 bits en cookie `ovrane_session` (httpOnly, SameSite=Lax, Secure en https), stocké haché dans `sessions` (TTL 30 jours glissants), rotation à la connexion, `POST /api/auth/logout`. Plus aucun `userId` lu dans une requête |
| Critique | L'outil IA `SwitchUserProfile` changeait de compte sans mot de passe (« je suis Maxime ») | Outils `checkUser` et `SwitchUserProfile` supprimés ; changer de compte = `/connexion` |
| Critique | Contexte de requête en variable globale du module : deux chats simultanés s'échangeaient identité, commandes et historique | Contexte passé explicitement jusqu'aux outils ; un test fait échouer toute régression |
| Haute | Nom dicté au modèle injecté dans une `RegExp` MongoDB (bascule sur un compte, ReDoS sur le cluster partagé avec Illusion) | Disparu avec les outils ; égalité stricte partout |
| Haute | Backend appelable par n'importe qui ; limites de débit communes à tous les visiteurs (IP de Vercel) | Secret de service `X-Ovrane-Service` exigé (temps constant) ; le navigateur ne parle plus qu'à Next ; IP réelle relayée ; limites : connexion 10 / 15 min, création de visiteur 30 / h, chat 10 / min, TTS 30 / min |
| Haute | Facture sans plafond : `isEphemeral` contournait la limite de 50 messages, `/api/tts` acceptait 1 Mo sans identité | Message compté avant l'appel au modèle ; TTS limité à 1 000 caractères et réservé aux sessions |
| Haute | `.oldenv` (vraies clés) non ignoré par git ; jeton ngrok commité dans `tmp/ngrok.yml` | `*oldenv` et `tmp/` ignorés, `tmp/` retiré du suivi |
| Haute | next 15.5.23 vulnérable ; express, qs, proxy-addr | next 15.5.28 ; `npm audit fix` côté back |
| Moyenne | CORS accepté pour toute origine contenant « ngrok », avec credentials | CORS supprimé : aucun navigateur n'appelle le backend |
| Moyenne | Énumération de comptes, code d'invitation comparé avec `!==`, mots de passe de 8 caractères | Message et durée identiques que le compte existe ou non, comparaisons en temps constant, 12 à 128 caractères à l'inscription |
| Moyenne | Erreurs détaillées renvoyées au client, `NODE_ENV` facultatif, aucun en-tête de sécurité au front | Middleware d'erreur JSON final ; démarrage refusé sans `NODE_ENV` ou, en production, sans `SERVICE_SECRET` ; CSP en Report-Only, `X-Frame-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy` |
| Basse | Images du chat acceptées depuis n'importe quel domaine ; texte TTS et réponses du modèle journalisés ; `/health` donnait le nom de la base | Images limitées à `/assets/` ; journaux sans données personnelles ; `/health` minimal |

### Reste à faire (propriétaire)

1. **Révoquer le jeton ngrok** (public depuis le commit `362969a`). La purge de l'historique git reste facultative une fois le jeton révoqué.
2. **`venta-backend/.oldenv`** : si ses valeurs sont encore celles de la production (`ADMIN_API_KEY`, `INVITE_CODE`, `OPENAI_API_KEY`, `MONGODB_URI`), les changer.
3. **Plafonds de dépense** chez OpenAI et ElevenLabs. Le coût reste le risque principal : une session peut faire lire du texte arbitraire (limité par la seule limite de débit), et le plafond de 50 messages se contourne en recréant des visiteurs.
4. **Atlas** : un utilisateur par service et par base (`venta` / `venta_dev`), liste d'IP restreinte.

### Décisions prises le 15/10

- **Conservation : 90 jours sans activité.** Une purge quotidienne (`services/conservation.js`) applique la règle :
  - les visiteurs sans visite depuis 90 jours sont supprimés, avec leurs conversations ;
  - les comptes inactifs perdent leurs conversations, liens et empreintes d'IP, mais gardent leurs identifiants ;
  - les clics d'une candidature vivent tant que sa dernière activité (`activite_le` sur `illusion_candidatures`) a moins de 90 jours. Cette activité est montée par un clic humain ou par le retour du recruteur sur le site ; Illusion doit la monter à chaque mail reçu (demandé à la session de purge d'Illusion) ;
  - les clics sans candidature partent 90 jours après leur date ;
  - l'ancien index TTL d'un an est retiré au démarrage.
- **Pixel de suivi supprimé** : ajouté en janvier (commit `651c934`), il n'avait aucun appelant.
- **Bouton son** dans la barre de saisie. Voix coupée : aucune synthèse n'est demandée, la réponse s'affiche en fenêtre, et le choix est gardé dans le navigateur.
- **Fenêtres flottantes** : 10 au plus, la plus ancienne se ferme.

### Décisions en attente

- `ipHashes` en sha256 sans sel.
- Budget journalier global d'appels au modèle et de caractères TTS.

## 2. Architecture

```
venta-backend/src
  server.js        démarrage : config, Mongo, RAG, écoute
  app.js           middlewares, routes, erreur finale
  config.js        process.env lu et validé une fois
  log.js           debug / info / warn / error
  http.js          sendError, requireService, requireSession, limites
  messages.js      prompt fixe, textes renvoyés au client
  models/          User, Session, RagChunk, RedirectLog, Illusion*
  routes/          auth, chat, preferences, tracking, tts, illusion, health
  services/        utilisateurs, sessions, tts, chat/{generer,agent,outils,reponse}, rag/

Venta/src
  app/             layout, [[...slug]], api/[...chemin] (relai à liste blanche), api/{tts,illusion}
  features/        accueil, oeil, chat, fenetres, site, fond
  lib/             proxy (seul à connaître le backend), messages, redirections, uiStore
```

- Un outil de l'IA = un objet `{ description, parametres, executer(args, ctx) }` dans un seul fichier, au lieu de quatre.
- Boucle d'appels d'outils bornée par nombre de tours : elle pouvait boucler sans fin sur un appel répété.
- `getUserProfile` : un aller-retour MongoDB au lieu de sept, historique par `$slice`.
- Fenêtres image et texte dans un seul store (`CommandProcessor` supprimé, ce qui corrige les images rouvertes au retour de messagerie).
- Préférence de fond enregistrée une seule fois (par le backend).

### Supprimé

Page et routes admin (la page n'envoyait jamais la clé : 401 à chaque fois), routes d'assets, `server.js` racine qui ne se chargeait plus, fusion de profils par fichiers JSON, mode mémoire sans base, outil `uiOpenWindow`, `CommandProcessor`, `useAnimations`, `UrlTracker`, bus d'événements de l'identifiant, 23 maquettes `Frame *.png` jamais affichées (82 Mo, toujours dans l'historique git), `test-pixel.html`, trois SVG, scripts de test morts, lockfile racine vide, dépendances `cors` et `cookie-parser`.

## 3. UX/UI et accessibilité

### Corrigé

- La saisie restait bloquée en « réflexion » après une erreur ou une réponse vide : l'œil revient au repos et un message lisible s'affiche, avec un bouton « Réessayer » si l'arrivée échoue.
- Écran noir infini possible à l'arrivée : garde-fou de 6 s et délai maximal de 8 s par requête TTS.
- Réponses annoncées aux lecteurs d'écran (`aria-live`) et statut « Ovrane réfléchit… ».
- Boutons des fenêtres en vrais boutons, Échap ferme la fenêtre du dessus, plus de faux `aria-modal`.
- Éléments cachés mais focusables neutralisés (`inert`).
- `prefers-reduced-motion` respecté.
- Libellé de l'œil selon l'action (« Ouvrir la messagerie », « Revenir à l'accueil »…) et focus visible.
- Contrastes relevés à `white/60` au minimum sur fond sombre.
- Galerie en `<dialog>` utilisable au clavier.
- Formulaire de connexion avec libellés reliés.
- Le retour arrière du navigateur ferme la vue au lieu de quitter le site ; le titre d'onglet suit la vue.
- La voix s'arrête à l'ouverture d'une étude de cas.
- Fenêtres illisibles en thème système clair et police Arial à la place de Geist.
- Textes : vouvoiement partout, « Cliquez sur l'œil au centre », fautes des astuces et propositions, messages d'erreur sans jargon technique.

### Décisions en attente

- **Mobile** : en mode œil, les réponses ne s'affichent pas, car les fenêtres sont masquées sous 768 px. La seule trace écrite y est la messagerie.
- **Palettes claires** : dix palettes (argenté, gris, jaune, orange, vert clair, feuille, aqua, hopa, gris ciel, rose) ont du texte blanc sous 4,5:1. Décidé le 15/10 : les boîtes passent en verre sombre, réglable dans la vue Réglages (icône en bout de header, 55 % par défaut, variable CSS `--verre-opacite`, gardée dans le navigateur). À 55 %, le texte des boîtes atteint 5,0:1 au pire (jaune). Le texte posé directement sur le fond (header, accueil, études de cas) reste peu lisible sur ces palettes : les palettes assombries (A à 4,5:1, B à 7:1) restent proposées, sans décision.

## 4. Pour porter Illusion dans Ovrane

- **Zone connectée** : un groupe de routes `app/(prive)/` du front, protégé par le cookie de session et revérifié côté serveur ; côté backend, `app.use('/api/illusion', requireSession, …)`. L'emplacement est noté dans `app.js`.
- **Propriété des données** : `illusion_*` désigne l'utilisateur par un `ObjectId`, Ovrane par la chaîne `User.id`. Il faut choisir une clé commune (`User._id` ou l'e-mail) avant d'ouvrir l'accès. Toute requête passe ensuite par un dépôt qui impose `{ utilisateur: req.user }`, jamais par un filtre fourni par le client.
- **Candidatures** : `illusion_candidatures` n'est pas encore filtré par `utilisateur`.
- **Avant d'ouvrir l'accès** :
  - rôles (`owner` / `user` / `visitor`) vérifiés côté serveur ;
  - 2FA pour le compte propriétaire ;
  - réinitialisation de mot de passe ;
  - chiffrement des secrets compatible avec Illusion (AES-256-GCM, AAD `utilisateur|champ`, version de clé).
- **Ce qui reste un choix** : sortir les conversations du document `User` vers leur propre collection.
