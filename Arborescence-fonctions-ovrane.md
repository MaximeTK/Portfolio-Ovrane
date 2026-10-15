# Ovrane — arborescence des fonctions et chemin d'exécution

Branche `dev`, le 18/08/2026, après nettoyage. **11 103 lignes**, 110 fichiers.

Mise à jour du 12/10/2026 : liens suivis d'Illusion et arrivée sans saisie, **section I** (102 à 121). Le 14/10/2026 : Illusion lit et écrit la même base, sans API entre les deux. Le 15/10/2026 : refonte du RAG, étapes 9 à 16 et 32 à 40.

## Comment lire

Le **numéro** indique l'ordre d'exécution réel : le programme passe dans la fonction 1, puis 2, puis 3. Le compteur suit une session complète, du démarrage du serveur jusqu'à l'affichage d'une réponse.

- **`12`** — la fonction est sur le chemin, à cette position.
- **`12b`** — variante du même point : une seule des deux s'exécute.
- **`—`** — **la fonction n'est sur aucun chemin tracé.** C'est ce que tu voulais repérer.
- **`(rendu)`** — appelé par React à chaque rendu, hors séquence.

---

## A. Démarrage du serveur — 1 à 17

### `venta-backend/src/server.js`
| № | Fonction | Rôle |
|---|---|---|
| 1 | `startServer` | Point d'entrée. Initialise puis `app.listen`. |
| 2 | `initializeServer` | Enchaîne config, base, tools, RAG, routes. |

### `lib/server/serverConfig.js`
| № | Fonction | Rôle |
|---|---|---|
| 3 | `configureServer` | Crée l'app Express : helmet, limite de corps (1 Mo par défaut), CORS, rate limit, `trust proxy`. |
| 4 | `createCorsMiddleware` | Construit le filtre d'origines depuis `CORS_ALLOWED_ORIGINS`. |
| 5 | `isNgrokOrigin` | Reconnaît une origine ngrok. Seulement si `ALLOW_NGROK_ORIGINS`. |

### `lib/database.js`
| № | Fonction | Rôle |
|---|---|---|
| 6 | `connectToDatabase` | Connexion Mongoose. **Refuse de démarrer si `MONGODB_DB` est absent.** |

### `lib/server/functionsRegistry.js` · `lib/openai/toolExecutor.js`
| № | Fonction | Rôle |
|---|---|---|
| 7 | `registerAllFunctions` | Déclare les 8 tools appelables par le modèle. |
| 8 | `registerFunction` | Range un handler dans la table `availableFunctions`. |

### `lib/server/ragInitializer.js` · `lib/rag/*`
| № | Fonction | Rôle |
|---|---|---|
| 9 | `initializeRAGSystem` | Orchestre l'init RAG, après la connexion MongoDB. |
| 10 | `initializeRAG` | Instancie le client OpenAI pour les embeddings. |
| 11 | `reindexFolder` | Lit les `.md` de `rag/`, reprend par hash les embeddings connus de `rag_chunks`, garde tout en mémoire. |
| 12 | `decouperMarkdown` | Un passage par section `#`/`##`/`###`, préfixé de son fil d'Ariane. Via `regrouperParagraphes` au-delà de ~350 tokens. |
| 13 | `embedder` | **N'embedde que les passages manquants**, par lots de 100 (`text-embedding-3-small`). |
| 14 | `RagChunk.bulkWrite`, `RagChunk.deleteMany` | Persiste les nouveaux passages et retire les hash obsolètes. Sans MongoDB, rien n'est persisté. |
| 15 | `indexerBm25` | Index BM25 en mémoire sur les textes préfixés. Via `termes`, `normaliser`. |
| 16 | `watchRAGFolder` | Surveille les `.md` de `rag/`, relance `handleReindex` à chaud. |
| 17 | `setupRoutes` | Branche toutes les routes. Puis `logServerStart`. |

---

## B. Envoyer un message — 18 à 52

### Front, saisie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 18 | `ui/InputArea.tsx` · `handleSubmit` | Valide, vide le champ, remonte le texte. |
| 19 | `HomeClient.tsx` · callback `onSubmit` | Réinitialise le transcript, lance l'animation. |
| 20 | `hooks/useAnimations.ts` · `startThinkingAnimation` | Œil en état « réflexion ». |
| 21 | `lib/stream/useChatController.ts` · `send` | Pose le message, appelle `/api/chat`. |

### Front, relai
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 22 | `app/api/chat/route.ts` · `POST` | Valide le prompt, ajoute IP, user-agent et jeton de session (voir 118). |
| 23 | `lib/api/proxy.ts` · `clientInfo` | IP réelle depuis les en-têtes, jamais du corps. |
| 24 | `lib/api/proxy.ts` · `proxyJson` | Relaie, transmet statut et corps, 503 si injoignable. |
| 25 | `lib/api/proxy.ts` · `forward` | `fetch` avec timeout unifié. Via `backendUrl`. |

### Back, réception
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 26 | `routes/chatRoute.js` · handler `POST /api/chat` | Valide, quota de 50 messages, candidature du jeton (voir 119). |
| 27 | `lib/validators.js` · `isNonEmptyString`, `isValidUserId` | Contrôles de forme. |
| 28 | `lib/chat/userProcessor.js` · `processUserInfo` | Résout le profil, pose le contexte. |
| 29 | `lib/user/userProfileLoader.js` · `getUserProfile` | Charge le profil. Via `loadExistingProfile`, `loadPermanentProfile`, `updateVisitStats`. |
| 30 | `lib/helpers/contextHelpers.js` · `setRequestContext` | Stocke userId, IP, et le tableau `uiCommands`. |

### Back, construction du prompt
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 31 | `lib/chat/responseGenerator.js` · `generateResponse` | Chef d'orchestre de l'appel modèle. |
| 32 | `lib/user/userConversations.js` · `getRawConversationHistory` | Les 8 derniers échanges, chargés avant le RAG. |
| 33 | `lib/chat/responseGenerator.js` · `buildHistoryMessages` | Historique au format messages ; son dernier message utilisateur sert de requête secondaire. Via `toSafeText`. |
| 34 | `lib/promptBuilder.js` · `buildRAGContextForPrompt` | Bloc `<contexte>` de blocs `<source document section>` sans score, vide si la porte reste fermée. |
| 35 | `lib/rag/ragSystem.js` · `rechercher` | Question (poids 1) et message précédent (poids 0,5), top 6 passages. |
| 36 | `lib/rag/ragSystem.js` · `vecteursRequetes` | Les deux embeddings en un seul appel, cache de 200 questions. Via `embedder`. |
| 37 | `lib/rag/recherche.js` · `listesClassees` | Classements par cosinus (tous les passages) et par BM25. Via `bm25`, `termes`, `normaliser`, `ordre`. |
| 38 | `lib/rag/recherche.js` · `fusionner` | Reciprocal Rank Fusion, `Σ poids/(60+rang)`. |
| 39 | `lib/rag/recherche.js` · `porteOuverte` | **Seule la question juge** : cosinus ≥ 0,45, ou couverture ≥ 0,6 avec cosinus ≥ 0,3 (`SEUILS`). |
| 40 | `lib/promptBuilder.js` · `buildVisitorContext` | Second message système : candidature (en tête, voir 120), profil, palette. Le premier, `SYSTEM_FIXE` (consignes, `prompts/instructions.txt`, règle du contexte), ne change jamais : c'est le préfixe en cache. |
| 41 | `lib/chat/responseGenerator.js` · `filterToolsForPrompt` | N'expose que les tools dont l'intention est détectée. Via `isUserIntent`, `isImageIntent`, `isColorIntent`. |

### Back, boucle d'agent
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 42 | `lib/openai/callHandler.js` · `callOpenAI` | Boucle appel → tools → rappel. Budget de 5. |
| 43 | `lib/openai/messageConverter.js` · `convertMessagesToInput` | Format API Responses. Via `shouldFilterMessage`, `convertToolMessage`, `convertStandardMessage`. |
| 44 | `lib/openai/apiParams.js` · `buildAPIParams` | Modèle, effort, verbosité. Via `resolveModelConfig`, `buildBaseParams`, `addToolsToParams`. |
| 45 | `lib/openai/responseParser.js` · `parseOpenAIResponse` | Extrait texte et tool calls. Via `extractTextContent`, `extractToolCalls`. |
| 46 | `lib/openai/callHandler.js` · `processToolCalls` | Anti-boucle par clé stable. Via `toolCallKey`, `stableStringify`, `safeParseArgs`. |
| 46b | `lib/openai/callHandler.js` · `shouldShortCircuitAfterTools` | Économise un aller-retour si la réponse ne contient que des affichages d'image. Via `executeMergedUiShowPictureCalls`. |
| 47 | `lib/openai/toolExecutor.js` · `executeToolCall` | Exécute l'outil. Via `callFunction`, `formatFunctionResponse`. |

### Back, les 8 outils
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 48a | `helpers/assetsHelpers.js` · `getRulePicture` | Règles d'affichage d'image. |
| 48b | `helpers/assetsHelpers.js` · `getAvailableAssets` | Liste des visuels. Via `parseAssetsFile`, `extractAssetsSimple`. |
| 48c | `helpers/colorsHelpers.js` · `getAvailableColors` | Référentiel des 25 palettes. Via `parseColorsFile`, `isPaletteId`, `flush`. |
| 48d | `helpers/uiCommandsHelpers.js` · `uiShowPicture` | Empile l'affichage. Via `getKnownAssetFilenames`, `pushUiCommand`, `ensureUiCommandsArray`. |
| 48e | `helpers/uiCommandsHelpers.js` · `uiSetBackground` | Empile le changement de fond. |
| 48f | `helpers/uiCommandsHelpers.js` · `uiOpenWindow` | Empile l'ouverture de fenêtre. |
| 48g | `helpers/userCheckHelpers.js` · `checkUser` | Vérifie un pseudo. Via `validateContext`, `namesMatch`, `looksLikeAssetOrFileName`, `buildUserNotFoundMessage`, `clearPendingCreation`. |
| 48h | `helpers/userSwitchHelpers.js` · `SwitchUserProfile` | Bascule de profil. Via `isCurrentProfile`, `updateTargetProfileStats`. |

### Back, sortie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 49 | `lib/chat/responseProcessor.js` · `processResponse` | Extrait les commandes, décide du fond, sauvegarde. Via `getLastBackgroundCommand`, `isBackgroundChangeIntent`, `isBackgroundTopic`, `extractPaletteIdFromText`, `getKnownPaletteIds`, `isPaletteIdLine`, `normalizeTokens`, `stripDiacritics`. |
| 50 | `lib/user/userConversations.js` · `addConversation` | Écrit l'échange dans le document utilisateur. |
| 51 | `lib/user/userConversations.js` · `updateUserProfile` | Incrémente `messageCount`. |
| 52 | `lib/tts/ttsGenerator.js` · `generateTTS` | Prépare l'audio si demandé à ce stade. |

---

## C. Restituer la réponse — 53 à 70

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 53 | `lib/stream/chatHelpers.ts` · `parseResponse` | Vérifie le JSON, erreur lisible sinon. Via `snippet`. |
| 54 | `lib/stream/chatHelpers.ts` · `updateStoredUserId` | Range l'identifiant confirmé. Via `shouldUpdate`, `setStoredUserId`, `isValidUserId`. |
| 55 | `lib/stream/chatHelpers.ts` · `createMessage` | Fabrique l'objet message affiché. |
| 56 | `HomeClient.tsx` · effet de restitution | Détecte le nouveau transcript, choisit la voie. |
| 57 | `HomeClient.tsx` · `openTextWindowOnce` | Ouvre la fenêtre texte, une seule fois. |
| 58 | `HomeClient.tsx` · `onStartSpeaking` | Astuce, fenêtre, animation, passage en `awake`. **Commun aux deux voies sonores.** |
| 59 | `hooks/useTTS.ts` · `speakWithQueue` | Découpe, génère via `p-limit`, lit dans l'ordre. Via `splitTextIntoTTSBlocks`, `normalizeForChunking`, `isStale`. |
| 59b | `hooks/useTTS.ts` · `speakWithUrl` | Variante fichier statique, ex. fin de session. |
| 60 | `hooks/useTTS.ts` · `fetchChunk` | Demande un bloc audio à `/api/tts`. |
| 61 | `app/api/tts/route.ts` · `POST` | Seule route qui relaie du binaire. |
| 62 | `routes/tts.js` · `handleTTS` | Entrée backend du TTS. |
| 63 | `lib/tts/ttsGenerator.js` · `runProviders` | Cascade des fournisseurs. Via `cleanTextForTTS`, `normalizeText`, `usesClientFallback`. |
| 63a | `tts/providers/elevenLabs.js` · `getElevenLabsAudio` | Premier choix. Via `getEnv`, `createPayload`, `createHeaders`, `logNoCredits`. |
| 63b | `tts/providers/openai.js` · `getOpenAIAudio` | Repli. Via `getApiKey`. |
| 63c | `hooks/useTTS.ts` · `speakBrowserQueued` | Dernier repli : voix du navigateur. |
| 64 | `hooks/useTTS.ts` · `playAudioQueued` | Lit un bloc, attend sa fin. |
| 65 | `hooks/setupAudioVisualization.ts` · `setupAudio` | Branche l'audio sur l'analyseur. Via `buildAudioGraph`, `createFilterChain`, `configureFilterNode`, `createAnalyser`, `createGain`, `getAudioCtor`. |
| 66 | `hooks/setupAudioVisualization.ts` · `startLevelLoop` | Boucle de mesure. Via `tick`, `computeLevel`. |
| 67 | `ui/HexagonalAnimation.tsx` · `animate` | Rendu piloté par le niveau sonore. |
| 68 | `ui/HexagonalAnimation.tsx` · `emitWave` | Vague visuelle. Via `bounceHexagons`. |
| 69 | `HomeClient.tsx` · `onEnd` | Retour en veille. Via `startStandbyAnimation`. |
| 70 | `hooks/useTTS.ts` · `stop` | Annule tout : runId, fetch, audio, voix. |

---

## D. Commandes d'interface — 71 à 78

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 71 | `HomeClient.tsx` · effet `SetBackground` | Applique le fond même en messagerie. |
| 72 | `lib/state/backgroundStore.ts` · `setBackground` | Résout et applique la palette. Via `resolvePalette`, `cleanPaletteInput`, `normalizeKey`, `stripDiacritics`, `PALETTE_LOOKUP`. |
| 73 | `lib/state/backgroundStore.ts` · `savePreferenceToBackend` | Persiste le choix. |
| 74 | `CommandProcessor.tsx` · effet de traitement | Consomme le lot une seule fois, par référence. |
| 75 | `CommandProcessor.tsx` · `processCommand` | Aiguille selon la commande. |
| 76 | `CommandProcessor.tsx` · `createImageWindow` | Fenêtre image. Via `buildId`, `extractImageFilename`, `safeEncodeAssetName`. |
| 76b | `CommandProcessor.tsx` · `createGenericWindow` | Fenêtre générique. |
| 77 | `lib/state/uiStore.ts` · `addTextWindow`, `incrementMaxZIndex` | Empile la fenêtre et son plan. |
| 78 | `ui/GlassmorphismeWindow.tsx` · `Window` | Rend la fenêtre. Glissé par `handlePointerDown`, `handlePointerMove`, `clamp`, `handlePointerUp`. |

---

## E. Authentification — 79 à 86

Le formulaire ne s'affiche plus que sur `/connexion`. Ailleurs, l'arrivée crée ou reprend un profil visiteur sans saisie : section I, 109 à 117.

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 79 | `intro/AuthForm.tsx` · `handleChange` | Saisie contrôlée, sur `/connexion`. |
| 80 | `intro/AuthForm.tsx` · `handleSubmit` | Compose le payload selon le mode. |
| 81 | `intro/IntroSequence.tsx` · `handleAuthSubmit` | Vague, passage en `processing`. |
| 82 | `lib/stream/useChatController.ts` · `sendAuth` | Appelle `/api/auth/{login,register}`. |
| 83 | `app/api/auth/*/route.ts` · `POST` | Relai de 6 lignes vers Express. |
| 84 | `routes/authRoute.js` · `setupAuthRoutes` | Inscription et connexion. Via `normalizeUserName`, `generateUserIdFromName`, `isValidEmail`, bcrypt. |
| 85 | `intro/IntroSequence.tsx` · `getWelcomeMessage` | Message d'accueil selon l'état. |
| 86 | `intro/IntroSequence.tsx` · `OverlayMessage` | Bandeau d'accueil et astuces. |

---

## F. Messagerie et galerie — 87 à 94

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 87 | `chat/MessagingView.tsx` · `MessagingView` | Liste des messages, scroll collant. |
| 88 | `chat/MessagingView.tsx` · `handleScroll` | Détecte le bas, charge l'historique vers le haut. |
| 89 | `lib/stream/useChatController.ts` · `loadMoreMessages` | Page suivante d'historique. |
| 90 | `app/api/chat/history/route.ts` · `GET` | Historique paginé vers `chatRoute.js`. |
| 91 | `chat/MessagingView.tsx` · `stickToBottomIfNeeded` | Recolle en bas quand une image charge. |
| 92 | `chat/MessageBubble.tsx` · `MessageBubble` | Bulle, Markdown assaini, images. Via `extractImagesFromContent`, `extractImagesFromCommands`, `normalizeForCompare`, `isPrismTheme`, `ImageGrid`, `renderChatImage`. |
| 93 | `chat/MessagingView.tsx` · `handleImageClick` | Ouvre la galerie sur la bonne image. |
| 94 | `chat/ImageGallery.tsx` · `ImageGallery` | Visionneuse. Via `goToNext`, `goToPrev`, `onTouchStart/Move/End`, `handleKeyDown`, `getSlideStyle`, `getImageName`, `renderSlide`. |

---

## G. Chemins secondaires — 95 à 101

| № | Fichier · Fonction | Rôle |
|---|---|---|
| 95 | `middleware.ts` · `middleware` | Redirections traçables `/redirectcvdesign`, `/redirectcv`, `/redirectlinkedin`, `/redirectgithub`, `/redirectportfolio`. Via `parseRedirectPath`, `trackAndRedirect`. Détail en 106. |
| 96 | `components/Tracking/UrlTracker.tsx` · `UrlTracker` | Signale la visite d'un lien, et l'URL d'arrivée dès le profil confirmé. Via `handler`, `sendTrackingLink`. |
| 97 | `routes/trackingRoute.js` · `setupTrackingRoute` | Enregistre visites et redirections, avec cible, jeton et `robot`. Détail en 108. |
| 98 | `routes/preferencesRoute.js` · `setupPreferencesRoute` | Lecture et écriture des préférences. Via `saveUserPreference`. |
| 99 | `routes/adminRoutes.js` · `requireAdminAuth` | **Refuse par défaut** sans `ADMIN_API_KEY`. Via `extractAdminKey`, `timingSafeEquals`. |
| 100 | `routes/adminRoutes.js` · `setupAdminRoutes` | Liste utilisateurs, stats RAG, réindexation. |
| 101 | `lib/server/serverRoutes.js` · `setupHealthRoute` | `/health` : état Mongo **et** RAG. |

---

## I. Recruteur venu d'Illusion — 102 à 121

Illusion range la candidature dans la base partagée (`MONGODB_URI`, `MONGODB_DB`), le recruteur clique un lien du CV ou de la lettre, arrive sur l'accueil sans rien saisir et parle à un agent orienté vers son poste. Illusion relit ensuite les visites dans la même base. Aucune clé entre les deux.

### Illusion range la candidature
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 102 | `models/IllusionCandidature.js` · schéma | Collection `illusion_candidatures`, écrite par Illusion : jeton unique, utilisateur, statut, offre, entreprise, CV et lettre (texte et PDF). Sans TTL : la purge d'Illusion l'efface selon sa durée de conservation. |
| 103 | `models/IllusionFichier.js` · schéma | Collection `illusion_fichiers` : le PDF du CV et de la lettre, rangés par Illusion avec leur jeton et leur utilisateur. |
| 104 | `routes/illusionRoute.js` · `setupIllusionRoutes` | Limiteur propre (120 requêtes par 15 min), puis les deux routes publiques. Branché par `setupRoutes`. |
| 105 | `routes/illusionRoute.js` · `GET /api/illusion/cv/:jeton` | Public : le PDF du CV envoyé avec la candidature, affiché et jamais gardé en cache, ou 404. Via `contenu`. Relayé par `app/api/illusion/cv/[jeton]/route.ts`, qui retombe sur le CV générique. |

### Le recruteur clique
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 106 | `middleware.ts` · `middleware` | Lit cible et jeton, redirige, pose le cookie httpOnly `ovrane_jeton` pour `redirectportfolio` ; `redirectcv` avec jeton mène au CV envoyé (105). Via `parseRedirectPath` et `REDIRECT_TARGETS` de `lib/redirections.ts`. |
| 107 | `middleware.ts` · `trackAndRedirect` | Transmet chemin, cible, jeton et user-agent au suivi, sans bloquer la redirection. |
| 108 | `routes/trackingRoute.js` · handler `POST /api/tracking/redirect` | Journalise cible, jeton et `robot`, toujours calculé ici. Via `isValidJeton`, `isRobotUserAgent` de `lib/validators.js`. |

### Arrivée sur l'accueil, sans saisie
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 109 | `intro/IntroSequence.tsx` · effet d'arrivée | Hors `/connexion` : vague, passage en `processing`, puis `startVisit`. Une seule fois, même en StrictMode. |
| 110 | `app/api/illusion/accueil/route.ts` · `GET` | Relit le jeton du cookie, 404 sans. Via `sessionJeton` de `lib/api/proxy.ts`. |
| 111 | `routes/illusionRoute.js` · `GET /api/illusion/accueil/:jeton` | Public : entreprise, poste et langue, ou 404. Jamais la lettre, le CV ni l'offre. |
| 112 | `lib/messages.ts` · `CHAT_UI.recruiterWelcome` | Accueil du recruteur en français ou en anglais, vide sans poste ni entreprise. |
| 113 | `lib/userId.ts` · `getStoredUserId` | Profil retenu par le navigateur, proposé à la reprise. |
| 114 | `lib/stream/useChatController.ts` · `sendAuth('visitor')` | Même traitement qu'une connexion ; l'accueil du recruteur remplace celui du backend. |
| 115 | `app/api/auth/visitor/route.ts` · `POST` | Relai vers Express. |
| 116 | `routes/authRoute.js` · handler `POST /api/auth/visitor` | Reprend un profil visiteur, sans nom ni mot de passe, ou en crée un : `v` + 24 hexadécimaux. Jamais un compte. |
| 117 | `components/Tracking/UrlTracker.tsx` · `handler` | Le profil confirmé, signale l'URL d'arrivée. |

### Chat orienté, sur le chemin B
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 118 | `lib/api/proxy.ts` · `sessionJeton` | Ajoute le jeton du cookie au relai du chat (étape 22), jamais celui du corps. |
| 119 | `routes/chatRoute.js` · `loadCandidature` | Candidature du jeton, `null` si absente, mal formée ou en erreur (étape 26). |
| 120 | `lib/messages.js` · `formatCandidatureContext` | Bloc en tête du contexte visiteur (étape 40) : recruteur, consignes, offre, entreprise, CV, lettre. Via `SYSTEM_PROMPTS.recruiterContext`. |

### Illusion relève les visites
| № | Fichier · Fonction | Rôle |
|---|---|---|
| 121 | `models/RedirectLog.js` · collection `redirectlogs` | Illusion y lit elle-même les visites à jeton arrivées depuis sa dernière relevée, par date croissante ; aucune route. |

---

## H. Hors chemin — à examiner

Aucun numéro : rien dans les parcours ci-dessus n'y mène.

| Fichier · Fonction | Constat |
|---|---|
| `app/admin/users/**` — 8 composants, ~400 l. | **Le plus gros bloc sans chemin.** `useUsersData` appelle le backend sans en-tête : depuis la fermeture de la faille, la page reçoit 503. Soit on la rebranche derrière un proxy au chantier 00, soit elle sort. |
| `lib/user/userMerge.js` · `linkProfiles`, `mergeUserProfiles` | Fusion de profils. Aucun appelant trouvé. |
| `lib/user/profileManagement.js` · `searchUserByName` | Aucun appelant hors admin. |
| `lib/messages.js` · `formatLog` | Un seul usage, dans l'export par défaut. Probablement morte. |
| `lib/serverHelpers.js` · `loadAssetsFromFrontend` | Uniquement `/api/admin/reload-assets`, donc injoignable aujourd'hui. |
| `lib/rag/ragSystem.js` · `getSystemStats` | `/health` et admin uniquement. Légitime mais rare. |
| `CommandProcessor.tsx` · `renderWindowContent` `(rendu)` | Ne gère plus que `image` et `generic` depuis le retrait du cas `code`. |

---

## Ce que la numérotation révèle

**Le chemin principal fait 52 étapes**, du clic sur Envoyer à la sauvegarde en base. C'est beaucoup pour un envoi de message, et la moitié se joue entre les étapes 31 et 47 — construction du prompt et boucle d'agent. C'est le cœur du produit, la densité y est justifiée.

**Les étapes 22 à 25 sont du pur transport.** Quatre fonctions pour transmettre une requête au backend. C'est le prix du proxy same-origin, qui évite le CORS et garde l'URL du backend hors du navigateur.

**Le bloc H pèse environ 500 lignes** dont 400 pour la seule page d'administration. C'est là qu'il reste le plus à gagner, mais c'est une décision produit — la garder et la rebrancher, ou l'abandonner — pas une décision technique.
