# Ovrane — arborescence des fonctions et chemin d'exécution

Branche `dev`, le 15/10/2026, après l'assainissement (`Analyse-simplification-dev.md`). **6 273 lignes**, 64 fichiers : `venta-backend/src` (1 858 lignes, 30 fichiers) et `Venta/src` (4 415 lignes, 34 fichiers).

## Comment lire

Le **numéro** indique l'ordre d'exécution réel : le programme passe dans la fonction 1, puis 2, puis 3. Le compteur suit une session complète, du démarrage du serveur jusqu'à l'affichage d'une réponse.

- **`12`** — la fonction est sur le chemin, à cette position.
- **`12b`** — variante du même point : une seule des deux s'exécute.
- **`12a`, `12c`…** — plusieurs fonctions possibles au même point (outils, fournisseurs de voix).
- **`—`** — **la fonction n'est sur aucun chemin tracé.**

Chemins relatifs : `venta-backend/src/` pour le backend, `Venta/src/` pour le front.

---

## Modèle de sécurité

- **Le navigateur ne parle qu'à Next.** Seul `lib/proxy.ts` (`server-only`) connaît `BACKEND_URL` et le secret. Le relai unique `app/api/[...chemin]/route.ts` n'accepte que 9 routes ; trois routes dédiées s'y ajoutent : `tts` (audio), `illusion/accueil`, `illusion/cv/[jeton]`. Le middleware relaie le suivi des liens.
- **Next signe chaque appel** : `X-Ovrane-Service` (secret de service), `X-Ovrane-Client-Ip` (IP réelle, crue seulement avec le secret et si c'est bien une IP), `X-Ovrane-Session` (cookie de session).
- **Le backend refuse tout appel non signé** : `requireService` couvre toutes les routes sauf `/health` et le pixel, et compare le secret en temps constant. Sans `SERVICE_SECRET` en production, le backend ne démarre pas et le relai répond 503 ; hors production, les deux côtés prennent `dev-ovrane-service`.
- **Session opaque** : jeton de 256 bits dans le cookie httpOnly `ovrane_session` (SameSite=Lax, Secure en https), posé par Next. La collection `sessions` n'en garde que le sha256, avec un TTL de 30 jours glissants et une rotation à la connexion.
- **`requireSession`** tire `req.user.id` de la session pour le chat, l'historique, les préférences, la visite et la voix. **Plus aucun `userId` ne vient du client** ; `activeUserId` ne sert qu'à l'affichage.
- **Migration unique** : l'ancien `venta_userId` du localStorage part une seule fois avec l'arrivée (76), puis il est effacé.
- **Limites** : 300 requêtes / 15 min par IP relayée en production (une IPv6 compte pour son /64), connexion 10 / 15 min par IP et par identifiant, création de visiteur 30 / h, chat 10 / min, voix 30 / min par utilisateur.

---

## A. Démarrage du serveur — 1 à 16

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 1 | `config.js` · `config` | Lit `process.env` une seule fois. Refus de démarrer si `NODE_ENV` n'est pas `production`, `development` ou `test`, sans `SERVICE_SECRET` en production, sans `MONGODB_URI`, `MONGODB_DB` ou `OPENAI_API_KEY`. |
| 2 | `server.js` · refus de démarrer | Journalise `config.erreurs`, puis `process.exit(1)`. |
| 3 | `server.js` · `mongoose.connect` | Base `MONGODB_DB`, sans repli : injoignable, le serveur s'arrête. |
| 4 | `server.js` · `new OpenAI`, `initializeRAG` | Un client pour le RAG, le chat et la voix : 60 s par appel, une reprise. |
| 5 | `server.js` · `indexer` | Lance l'indexation ; un échec laisse le chat sans RAG. |
| 6 | `services/rag/ragSystem.js` · `reindexFolder` | Lit les `.md` de `rag/`, reprend par hash les embeddings connus de `rag_chunks`, garde tout en mémoire. |
| 7 | `services/rag/chunker.js` · `decouperMarkdown` | Un passage par section `#`/`##`/`###`, préfixé de son fil d'Ariane. Via `regrouperParagraphes` au-delà de ~350 tokens. |
| 8 | `ragSystem.js` · `embedder` | **N'embedde que les passages manquants**, par lots de 100 (`text-embedding-3-small`). |
| 9 | `RagChunk.bulkWrite`, `RagChunk.deleteMany` | Persiste les nouveaux passages et retire les hash obsolètes. |
| 10 | `services/rag/recherche.js` · `indexerBm25` | Index BM25 en mémoire sur les textes préfixés. Via `termes`, `normaliser`. |
| 11 | `server.js` · `fs.watch` | Réindexe une seconde après la dernière modification d'un `.md`, jamais deux fois à la fois. |
| 12 | `app.js` · `createApp` | Express sans `x-powered-by`, `trust proxy` en production ou avec `TRUST_PROXY`, helmet sans CSP (le pixel s'affiche dans des clients mail). |
| 13 | `routes/health.js` · `setupHealthRoute` | Branchée **avant** la limite et le secret : la sonde de Render passe toujours. |
| 14 | `http.js` · `limite`, `requireService` | Limite globale (300 / 15 min en production, 5 000 sinon), puis secret exigé partout (24-25). |
| 15 | `routes/*` · `setupAuthRoutes`, `setupChatRoutes`, `setupPreferencesRoutes`, `setupTrackingRoutes`, `setupTTSRoutes`, `setupIllusionRoutes` | Les routes, puis 404 JSON et `sendInternalError` : erreur journalisée, jamais détaillée au client. |
| 16 | `server.js` · `listen` | Port `PORT` (3001), après l'indexation. |

---

## B. Envoyer un message — 17 à 49

### Front, saisie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 17 | `features/chat/InputArea.tsx` · `handleSubmit` | Valide, vide le champ, onde, remonte le texte. |
| 18 | `features/accueil/HomeClient.tsx` · `handleSubmit` | Réinitialise le transcript, œil en `thinking`, marque la question. |
| 19 | `features/chat/useChatController.ts` · `send` | Pose le message, `POST /api/chat` avec le seul `prompt`. |

### Front, relai (serveur Next)
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 20 | `app/api/[...chemin]/route.ts` · `relayer` | Liste blanche « méthode chemin » de 9 routes, 404 sinon. Pour `chat` : jeton Illusion du cookie (116-117), délai de 60 s. |
| 21 | `lib/proxy.ts` · `relayerJson` | Relaie statut et corps, 503 si injoignable, 502 si illisible. Une `session` dans le corps devient le cookie (79). |
| 22 | `lib/proxy.ts` · `forward` | `fetch` vers `BACKEND_URL`, 30 s par défaut (réveil d'un service Render endormi). `null` en production sans `SERVICE_SECRET`. |
| 23 | `lib/proxy.ts` · `enTetes` | `X-Ovrane-Service`, `X-Ovrane-Client-Ip` (premier `x-forwarded-for`, sinon `x-real-ip`), `X-Ovrane-Session`, user-agent. Via `backendUrl`. |

### Back, réception
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 24 | `http.js` · `limite` | Limite globale par IP relayée. Via `clePourLimite`, `ipClient`. |
| 25 | `http.js` · `requireService` | 401 sans secret valide. Via `serviceValide`, `egal` (sha256 puis `timingSafeEqual`). |
| 26 | `http.js` · `requireSession` | 401 sans session ; pose `req.user.id`, seule identité des routes. |
| 27 | `services/sessions.js` · `lireSession` | Jeton de 43 caractères base64url, cherché par son sha256, non expiré ; prolongé de 30 jours au plus une fois par jour. Via `estJeton`, `empreinte`. |
| 28 | `routes/chat.js` · `parSession` | 10 messages par minute et par utilisateur. |
| 29 | `routes/chat.js` · handler `POST /api/chat` | Prompt non vide, 4 000 caractères au plus (413). Via `isNonEmptyString`. |
| 30 | `services/utilisateurs.js` · `getUserProfile` | Un seul `findOneAndUpdate` en pipeline : visite comptée au plus une fois par heure (`visite`, IP gardée en sha256 tronqué), message compté **avant** l'appel au modèle, 8 derniers échanges par `$slice`. |
| 31 | `routes/chat.js` · `loadCandidature` | Candidature du jeton, `null` si absente, mal formée ou en erreur (118). |
| 31b | `routes/chat.js` · limite atteinte | Au-delà de 50 messages : `LockInterface` et `/endmessage.mp3`, sans appel au modèle. |

### Back, construction du prompt
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 32 | `services/chat/generer.js` · `generateResponse` | Chef d'orchestre de l'appel au modèle. |
| 33 | `services/utilisateurs.js` · `aPlat` | Les 8 échanges en messages ; le dernier message du visiteur sert de requête secondaire. |
| 34 | `generer.js` · `buildRAGContextForPrompt` | Bloc `<contexte>` de `<source document section>` sans score, vide si la porte reste fermée. Via `attribut`. |
| 35 | `services/rag/ragSystem.js` · `rechercher` | Question (poids 1) et message précédent (poids 0,5), top 6 passages. |
| 36 | `ragSystem.js` · `vecteursRequetes` | Les deux embeddings en un seul appel, cache de 200 questions. Via `embedder`. |
| 37 | `services/rag/recherche.js` · `listesClassees` | Classements par cosinus (tous les passages) et par BM25. Via `bm25`, `termes`, `normaliser`, `ordre`. |
| 38 | `recherche.js` · `fusionner` | Reciprocal Rank Fusion, `Σ poids/(60+rang)`. |
| 39 | `recherche.js` · `porteOuverte` | **Seule la question juge** : cosinus ≥ 0,45, ou couverture ≥ 0,6 avec cosinus ≥ 0,3 (`SEUILS`). |
| 40 | `generer.js` · `buildVisitorContext` | Second message système : candidature en tête (119), `formatUserInfo`, fond actuel. Le premier, `SYSTEM_FIXE` (`mainContext`, `prompts/instructions.txt`, `contextRule`), ne change jamais : c'est le préfixe en cache. |
| 41 | `generer.js` · `outilsPour` | N'expose que les outils dont l'intention est détectée : images (`IMAGE`) ou couleurs (`COULEUR`). |

### Back, boucle d'agent
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 42 | `services/chat/agent.js` · `callOpenAI` | API Responses avec `config.openai` (`gpt-5-mini` par défaut, effort et verbosité `medium`), 5 tours au plus. |
| 43 | `services/chat/outils.js` · `executeToolCall` | Nom inconnu ou hérité d'`Object` refusé, arguments lus sans lever, outil exécuté avec le `ctx` de **sa** requête. Le résultat repart au modèle en message. |
| 44a | `outils.js` · `getRulePicture` | Règles d'affichage d'image. |
| 44b | `outils.js` · `getAvailableAssets` | Liste des visuels, lue une fois dans `prompts/assets.txt` (`ASSETS`). |
| 44c | `outils.js` · `getAvailableColors` | Les 25 palettes de `prompts/colors.txt` (`PALETTES`). Via `estIdPalette`. |
| 44d | `outils.js` · `uiShowPicture` | Empile `ShowPicture` dans `ctx.uiCommands`, seulement pour un nom de la liste (`IMAGES`). Via `normalizeAssetParamToFilename`, `isValidAssetFilename`. |
| 44e | `outils.js` · `uiSetBackground` | Empile `SetBackground`. |
| 45 | `agent.js` · fin de tour | Si le tour n'appelle que `uiShowPicture`, le texte part sans nouveau tour ; sinon retour en 42. |

### Back, sortie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 46 | `services/chat/reponse.js` · `processResponse` | Retire le Markdown des images déjà affichées, ajoute `SetBackground` si la question le demande sans outil, dédoublonne. Via `demandeChangementFond`, `paletteDuTexte`, `mots`, `echapper`. |
| 47 | `services/utilisateurs.js` · `saveUserPreference` | Le backend enregistre le fond retenu : le modèle le connaît au message suivant. |
| 48 | `services/utilisateurs.js` · `addConversation` | Échange ajouté sans attendre (500 derniers), sauf message éphémère. |
| 49 | `services/utilisateurs.js` · `profilPublic` | Réponse `{ reply, commands, userProfile, activeUserId }`. |

---

## C. Restituer la réponse — 50 à 65

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 50 | `features/chat/useChatController.ts` · `send` (suite) | JSON lu sans lever ; réponse vide ou en erreur : `INDISPONIBLE`. |
| 51 | `useChatController.ts` · `applyResponse` | Ajoute le message (`createMessage`), applique les commandes (66), pose le transcript et la voix. |
| 52 | `features/accueil/HomeClient.tsx` · effet de restitution | Nouveau transcript : en messagerie ou sur une page, fenêtre seule et pas de voix ; sinon la voix. |
| 53 | `HomeClient.tsx` · `onStart` | Fenêtre texte (`openWindow`, une fois, seulement pour la réponse à une question), astuce, œil en `speak`, passage en `awake`. **Commun aux deux voies sonores.** |
| 54 | `features/oeil/useTTS.ts` · `speakWithQueue` | Blocs de 4 phrases, deux générés à la fois (`p-limit`), parole dès que les deux premiers sont prêts. Via `splitTextIntoTTSBlocks`, `isStale`. |
| 54b | `useTTS.ts` · `speakWithUrl` | Fichier statique, ex. `/endmessage.mp3` à la limite. |
| 55 | `useTTS.ts` · `fetchChunk` | Un bloc audio à `/api/tts`, abandonné après 8 s. |
| 56 | `app/api/tts/route.ts` · `POST` | Seule route qui relaie du binaire ; tout échec rend `{ useClientTTS: true }`. Via `forward`. |
| 57 | `routes/tts.js` · handler `POST /api/tts` | Secret, session, 30 blocs par minute et par utilisateur, 1 000 caractères au plus. |
| 58 | `services/tts.js` · `generateTTS` | Texte sans code, liens ni Markdown (`nettoyer`) ; `TTS_DEFAULT=true` laisse tout à la voix du navigateur. |
| 58a | `services/tts.js` · `elevenLabs` | Premier choix, `eleven_multilingual_v2`, 15 s. |
| 58b | `services/tts.js` · `voixOpenAI` | Repli : `tts-1`, voix `nova`. |
| 58c | `useTTS.ts` · `speakBrowserQueued` | Dernier repli : voix française du navigateur. |
| 59 | `useTTS.ts` · `playAudioQueued` | Lit un bloc, attend sa fin. |
| 60 | `features/oeil/useAudioVisualization.ts` · `setupAudio` | Branche l'audio sur l'analyseur. Via `getAudioCtor`, `buildAudioGraph`, `createFilterChain`, `configureFilterNode`, `createAnalyser`, `createGain`, `cleanupAudio`. |
| 61 | `useAudioVisualization.ts` · `startLevelLoop` | Boucle de mesure. Via `tick`, `computeLevel`. |
| 62 | `features/oeil/HexagonalAnimation.tsx` · `animate` | Ondes au rythme de la voix, de 250 à 25 ms d'écart. Via `getAudioLevel`. |
| 63 | `HexagonalAnimation.tsx` · `emitWave` | Onde visuelle. Via `bounceHexagons`, `placerOeil`. |
| 64 | `HomeClient.tsx` · `onEnd` | Retour en `standby`. |
| 65 | `useTTS.ts` · `stop` | Annule tout : runId, fetch, audio, voix. Au début de chaque lecture, à l'ouverture d'une page, au démontage. |

---

## D. Commandes d'interface — 66 à 71

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 66 | `features/chat/useChatController.ts` · `applyResponse` (commandes) | `SetBackground`, `ShowPicture` (ou `ShowImage`), `LockInterface`, traités une fois, à la réception. |
| 67 | `features/fond/backgroundStore.ts` · `setBackground` | Résout la palette, sans rien écrire : le backend l'a enregistrée (47). Via `resolvePalette`, `normalizeKey`. |
| 68 | `features/fond/Background.tsx` · `Background` | Fondu croisé de 2,5 s vers la nouvelle palette. |
| 69 | `lib/uiStore.ts` · `addWindow` | Une fenêtre par image, décalées de 50 px ; le texte près du centre ; plan au-dessus (`maxZIndex`). |
| 69b | `lib/uiStore.ts` · `setAppLocked` | `LockInterface` : interface verrouillée, retour au tableau de bord ; `IntroSequence` réveille l'œil et affiche le message. |
| 70 | `features/fenetres/GlassmorphismeWindow.tsx` · `WindowsManager` | Rend les fenêtres, jamais en messagerie, sur une page ni sous `md` ; Échap ferme celle du dessus. |
| 71 | `GlassmorphismeWindow.tsx` · `Window` | Markdown (images `/assets/` seules) ou image ; glissé par `handlePointerDown`, `handlePointerMove`, `handlePointerUp` (Pointer Events, `clamp`), zoom, `handleMinimize`. Via `moveWindow`, `focusWindow`, `closeWindow`. |

---

## E. Arrivée et authentification — 72 à 86

Toute arrivée crée ou reprend un profil visiteur sans saisie, `/connexion` compris. Connexion et inscription se font dans la vue Compte, porte d'entrée d'Illusion. Chaque profil ouvert reçoit sa session.

### Arrivée sans saisie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 72 | `features/accueil/IntroSequence.tsx` · effet d'arrivée | Une seule fois, même en StrictMode (`visitStartedRef`). |
| 73 | `IntroSequence.tsx` · `startVisit` | Onde, `processing`, accueil du recruteur (111), puis l'ancien `venta_userId` du localStorage s'il existe. |
| 74 | `features/chat/useChatController.ts` · `sendAuth('visitor')` | `POST /api/auth/visitor` avec `{ ancienId }` éventuel, relayé par 20 à 23. |
| 75 | `routes/auth.js` · `reprendreVisiteur` | Session valide : profil repris. Via `lireSession`, `accueil`. |
| 76 | `routes/auth.js` · `reprendreVisiteur` (migration) | **Migration unique** : seulement un visiteur `v` + 24 hexadécimaux sans nom, email, mot de passe ni `migreLe`. Marqué `migreLe`, il reçoit une session. Jamais un compte ni un identifiant calculable. |
| 77 | `routes/auth.js` · `creerVisiteur` | Sinon, nouveau visiteur `v` + 24 hexadécimaux, né avec sa session. Seule la création compte dans la limite (30 / h). |
| 78 | `services/sessions.js` · `creerSession` | Jeton de 32 octets en base64url. `sessions` n'en garde que le sha256 (`_id`), avec `utilisateur`, `creeLe`, `vuLe` et `expireLe` à 30 jours (index TTL). |
| 79 | `lib/proxy.ts` · `relayerJson` (session) | `session` retirée du corps et posée en cookie `ovrane_session` : httpOnly, SameSite=Lax, Secure en https, expiration du backend. |
| 80 | `IntroSequence.tsx` · `startVisit` (fin) | Ancien identifiant effacé du localStorage. Échec : `sleeping`, `INDISPONIBLE`, bouton « Réessayer ». |
| 81 | `useChatController.ts` · `applyResponse` (nouveau profil) | Ferme les fenêtres, signale l'URL d'arrivée (97). Nouveau profil : fond par défaut ; sinon préférence (98) et historique (`fetchHistory`), l'accueil en dernier. |

### Connexion, dans la vue Compte
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 82 | `features/site/ConnexionPage.tsx` · `ConnexionPage` | Vue `connexion` (icône Compte du header, ou lien `/connexion`, ramené à `/`). Lit `GET /api/auth/compte` à chaque changement de profil : formulaire, ou pseudo, e-mail et « Se déconnecter ». |
| 83 | `ConnexionPage.tsx` · `envoyer`, `deconnecter` | Connexion (identifiant, mot de passe) ou inscription (pseudo, e-mail, mot de passe de 8 caractères au moins, code d'invitation) par `sendAuth(mode)`, l'erreur du backend sous le formulaire. Déconnexion : `POST /api/auth/logout`, puis un nouveau visiteur par `sendAuth('visitor')`. |
| 83b | `routes/auth.js` · handler `GET /api/auth/compte` | Pseudo et e-mail du compte de la session ; `null` pour un visiteur ou sans session. |
| 84 | `routes/auth.js` · handler `POST /api/auth/login` | 10 essais / 15 min par IP et par identifiant ; bcrypt comparé même sans compte (`HASH_FACTICE`), même message. Via `identifiant`, `compterVisite`. |
| 84b | `routes/auth.js` · handler `POST /api/auth/register` | Code d'invitation en temps constant (`egal`), email ≤ 254, mot de passe de 8 à 128 (le minimum d'Illusion, comptes partagés), pseudo ≤ 25 ; bcrypt avant la recherche de doublon ; identifiant calculé côté serveur. |
| 85 | `routes/auth.js` · `ouvrirSession` | Rotation : la session reçue est révoquée (`revoquerSession`), une neuve est créée (78), puis posée en cookie (79). |
| 85b | `routes/auth.js` · handler `POST /api/auth/oubli` | Répond `{ envoye: true }` aussitôt, compte existant ou non, puis `demanderReinitialisation` ; 10 / 15 min par IP, 3 / h par adresse. |
| 85c | `services/reinitialisation.js` · `demanderReinitialisation` | Jeton de 32 octets, seul son sha256 gardé dans `reinitialisations` (30 min, index TTL), le précédent effacé ; lien `SITE_URL/connexion#reinit=…`, le jeton dans le fragment, envoyé par `envoyerMail` (`services/mails.js`, API Resend). |
| 85d | `routes/auth.js` · handler `POST /api/auth/reinitialiser` → `reinitialiser` | Mot de passe de 8 à 128 ; jeton consommé en une fois (`findOneAndDelete`, non expiré) ; nouveau hash, `motDePasseChangeLe`, toutes les sessions du compte fermées, e-mail de confirmation. |
| 85e | `PageView.tsx` · état `reinit`, `ConnexionPage.tsx` modes `oubli` et `reinit` | Le jeton est lu dans le fragment de `/connexion` avant le retour à `/` ; « Mot de passe oublié ? » demande le lien, le lien ouvre « Nouveau mot de passe », puis un visiteur valable reprend le chat. |
| 86 | `IntroSequence.tsx` · `OverlayMessage` | Sous l'œil : accueil (10 s), astuce de messagerie ou message de verrouillage. |

---

## F. Messagerie et galerie — 87 à 96

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 87 | `features/oeil/HexagonalAnimation.tsx` · `handleClick` | L'œil ouvre ou ferme la messagerie ; depuis une page, il ramène à l'accueil. |
| 88 | `features/accueil/HomeClient.tsx` · `MessagingView` dynamique | Chargée et rendue à la première ouverture seulement. |
| 89 | `features/chat/MessagingView.tsx` · `MessagingView` | Liste, séparateurs de date, scroll collant, molette captée hors de la liste. Via `formatDateDivider`, `formatMessageTime`, `scrollToBottom`, `handleGlobalWheel`. |
| 90 | `MessagingView.tsx` · `handleScroll` | En haut : charge l'historique et garde la position. |
| 91 | `features/chat/useChatController.ts` · `loadMoreMessages` | Page suivante de 20. Via `fetchHistory`. |
| 92 | `routes/chat.js` · handler `GET /api/chat/history` | Session exigée, `limit` ≤ 100, `skip` ≤ 1 000 ; relayé par 20 à 23. |
| 93 | `services/utilisateurs.js` · `historique` | `$slice` depuis la fin, mis à plat par `aPlat`. |
| 94 | `MessagingView.tsx` · `stickToBottomIfNeeded` | Recolle en bas quand une image charge. |
| 95 | `features/chat/MessageBubble.tsx` · `MessageBubble` | Bulle, Markdown assaini (`rehype-sanitize`, seule classe `image-grid`), code coloré, images de `/assets/` seulement. Via `messageImages`. |
| 96 | `features/chat/ImageGallery.tsx` · `ImageGallery` | `<dialog>` natif ouvert au clic d'une image, focus rendu à la vignette. Via `goTo`, `onTouchEnd`, `renderSlide`, `getImageName`. |

---

## G. Chemins secondaires — 97 à 102

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 97 | `routes/tracking.js` · handler `POST /api/tracking/visit` | URL d'arrivée signalée en 81 : sans doublon, 100 au plus. Via `saveVisitedLink`. |
| 98 | `features/fond/backgroundStore.ts` · `loadPreference` | `GET /api/preferences` (5 s), sinon le fond par défaut. Côté backend, `routes/preferences.js` en lecture seule. |
| 99 | `features/site/SiteHeader.tsx` · `Onglet` | Pico, Ovrane, Illusion, Hikup ; « Informations légales » au pied d'une étude de cas. Via `setPage`. |
| 100 | `features/site/PageView.tsx` · `PageView` | Une vue sans changer d'URL : `pushState`, `popstate` rouvre la précédente, titre d'onglet. Via `ProjectPage`, `Sommaire`, `allerA`, `LegalPage`, `trouverProjet`. |
| 101 | `features/chat/InputArea.tsx` · `lireLignes` | Propositions et astuces de `public/`, lues une fois par visite. |
| 102 | `routes/health.js` · `/health` | Sonde de Render, sans secret : 200 ou 503 selon Mongo, nombre de passages du RAG, jamais le nom de la base. Via `getSystemStats`. |

---

## I. Recruteur venu d'Illusion — 103 à 120

Illusion range la candidature dans la base partagée (`MONGODB_URI`, `MONGODB_DB`). Le recruteur clique un lien du CV ou de la lettre, arrive sur l'accueil sans rien saisir et parle à un agent orienté vers son poste. Illusion relit ensuite les visites dans la même base. Aucune clé entre les deux ; comme partout, le navigateur ne passe que par Next.

### Illusion range la candidature
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 103 | `models/IllusionCandidature.js` · schéma | Collection `illusion_candidatures`, écrite par Illusion : jeton unique, utilisateur, statut, langue, offre, entreprise, CV et lettre (texte et fichier). Sans TTL : la purge d'Illusion l'efface selon sa durée de conservation. |
| 104 | `models/IllusionFichier.js` · schéma | Collection `illusion_fichiers` : le PDF du CV et de la lettre, rangés par Illusion avec leur jeton et leur utilisateur. |
| 105 | `routes/illusion.js` · `setupIllusionRoutes` | Deux routes en lecture seule, derrière le secret de service comme les autres ; plus de limiteur propre, la limite globale s'applique. |

### Le recruteur clique
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 106 | `middleware.ts` · `middleware` | Chemin en minuscules, `parseRedirectPath` et `REDIRECT_TARGETS` de `lib/redirections.ts`. `redirectcv` ou `redirectcvdesign` avec jeton mènent au CV envoyé (109) ; `redirectportfolio` avec jeton pose le cookie httpOnly `ovrane_jeton`. Ni `/api`, ni `_next`, ni `assets`. |
| 107 | `middleware.ts` · suivi | `forward` vers `/api/tracking/redirect` sous `event.waitUntil` : chemin, cible, jeton et user-agent, sans retarder la redirection. |
| 108 | `routes/tracking.js` · handler `POST /api/tracking/redirect` | Journalise dans `redirectlogs` cible, jeton, IP relayée et `robot`, toujours calculé ici. Via `isValidJeton`, `isRobotUserAgent`. |
| 109 | `app/api/illusion/cv/[jeton]/route.ts` · `GET` | Relaie le PDF ; jeton invalide, 404 ou backend injoignable : CV générique (`REDIRECT_TARGETS.cv`). |
| 110 | `routes/illusion.js` · handler `GET /api/illusion/cv/:jeton` | PDF du CV envoyé, toujours en `application/pdf` (jamais le type rangé en base), `private, no-store`, ou 404. Via `contenu`. |

### Arrivée sur l'accueil, sans saisie (chemin E)
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 111 | `features/accueil/IntroSequence.tsx` · `startVisit` | Avant `sendAuth('visitor')` (74), `GET /api/illusion/accueil`. |
| 112 | `app/api/illusion/accueil/route.ts` · `GET` | Relit le jeton du cookie (`sessionJeton`), 404 sans ; relaie vers `/api/illusion/accueil?jeton=`. |
| 113 | `routes/illusion.js` · handler `GET /api/illusion/accueil` | Entreprise, poste et langue du `?jeton=`, ou 404. Jamais la lettre, le CV ni l'offre. |
| 114 | `lib/messages.ts` · `CHAT_UI.recruiterWelcome` | Accueil en français ou en anglais, vide sans poste ni entreprise. |
| 115 | `features/chat/useChatController.ts` · `sendAuth('visitor', …, welcome)` | Même arrivée qu'en 74 à 81 ; l'accueil du recruteur remplace celui du backend. |

### Chat orienté, sur le chemin B
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 116 | `lib/proxy.ts` · `sessionJeton` | Jeton du cookie `ovrane_jeton`, validé par `isValidJeton`. |
| 117 | `app/api/[...chemin]/route.ts` · `relayer` | L'ajoute au corps du chat (étape 20), par-dessus tout `jeton` envoyé par le navigateur. |
| 118 | `routes/chat.js` · `loadCandidature` | Candidature du jeton (étape 31). |
| 119 | `messages.js` · `formatCandidatureContext` | Bloc en tête du contexte visiteur (étape 40) : `SYSTEM_PROMPTS.recruiterContext`, offre, entreprise, CV, lettre, une ligne par champ renseigné. |

### Illusion relève les visites
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 120 | `models/RedirectLog.js` · collection `redirectlogs` | Illusion y lit elle-même les visites à jeton arrivées depuis sa dernière relevée, par date croissante ; aucune route. Effacées après 365 jours. |

---

## H. Hors chemin — à examiner

Aucun numéro : rien dans les parcours ci-dessus n'y mène, ou le chemin est rompu.

| Fichier · Fonction | Constat |
|---|---|
| `ragSystem.js` · `etatIndex`, `embedder` (exports) | Pour `scripts/eval-rag.js` seulement. Légitime. |
| `scripts/test-connexion.js` | Diagnostic MongoDB manuel, absent des scripts npm. |

---

## Ce que la numérotation révèle

**Du clic sur Envoyer à la sauvegarde en base, 33 étapes** (17 à 49). Près de la moitié se joue entre 32 et 45 : construction du prompt et boucle d'agent. C'est le cœur du produit, la densité y est justifiée.

**Les étapes 20 à 27 sont du transport et de la garde.** Quatre fonctions côté Next pour relayer, quatre côté backend pour la limite, le secret et la session. C'est le prix d'un backend que seul Next appelle : plus de CORS, plus d'adresse du backend dans le navigateur, plus d'identité envoyée par le client.

**Le bloc H est presque vide** depuis l'assainissement. Il reste un chemin rompu à réparer (accueil du recruteur) et deux routes en liste blanche sans appelant.
