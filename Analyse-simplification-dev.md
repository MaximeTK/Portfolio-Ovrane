# Ovrane — audit de dette technique

Branche `dev`, le 17/08/2026. **11 835 lignes** (6 343 front, 5 492 back), 110 fichiers, 379 fonctions.
Pour cinq éléments d'interface : un œil, une barre de saisie, des fenêtres flottantes, un chat, une galerie.

Deuxième passe, avec mesures. La première s'était arrêtée à ce qui se voyait à la lecture.

---

## 1. Les workflows

Sept chemins d'exécution. Tout le reste est du support.

### W1 — Envoyer un message

```
InputArea.onSubmit
└─ HomeClient (callback inline, 30 l.)
   └─ useChatController.send                          [116 l.]
      └─ POST /api/chat (Next, proxy)
         └─ POST /api/chat (Express)                  [chatRoute 137 l.]
            ├─ processUserInfo → profil Mongo
            ├─ generateResponse
            │  ├─ buildRAGContextForPrompt → vectra → 5 chunks
            │  ├─ buildSystemPrompt (+ historique 8 msg)
            │  ├─ filterToolsForPrompt ← 3 regex d'intention
            │  └─ callOpenAI ← boucle agent, budget 5 [200 l.]
            │     └─ executeToolCall → helpers/*
            └─ processResponse                        [142 l.]
```

### W2 — Restituer la réponse
```
currentTranscript / lastCommands / currentTTS
└─ HomeClient useEffect                    [120 l., 16 dépendances]
   └─ useTTS.speakWithQueue                [527 l.]
      └─ /api/tts → ElevenLabs → OpenAI → Web Speech
         └─ setupAudioVisualization [279 l.] → HexagonalAnimation [415 l.]
```

### W3 — Commandes d'interface
```
lastCommands ├─ HomeClient (SetBackground, marche aussi en mobile)
             └─ CommandProcessor [348 l.] → GlassmorphismeWindow [306 l.]
```

### W4 — Galerie
`MessageBubble.renderChatImage [160 l.] → ImageGrid [66 l.] → ImageGallery [268 l.]`

### W5 — Messagerie
`MessagingView [289 l.] → MessageBubble [373 l.]`

### W6 — Authentification (accès admin)
`IntroSequence → AuthForm [177 l.] → /api/auth/* → authRoute [140 l.]`

### W7 — Thème
`uiSetBackground → backgroundStore [194 l.] → colorPalettes [194 l.]`

---

## 2. Ce que la mesure a révélé

Cinq constats que la lecture seule n'avait pas donnés.

### 2.1 Les routes proxy — 434 lignes pour « relaie ça »

Huit fichiers dans `Venta/src/app/api/`. `auth/login/route.ts` et `auth/register/route.ts` sont **identiques au caractère près**, sauf le chemin cible. Et les valeurs ont déjà divergé :

| | repli d'URL | timeout | erreur |
|---|---|---|---|
| `auth/login`, `auth/register` | `127.0.0.1:3001` | 15 s | 503 « Service indisponible » |
| `preferences`, `preferences/[userId]` | `localhost:3001` | 10 s | passe-plat + repli texte |
| `tts` | `localhost:3001` | **aucun** | repli client |
| `chat` | via `helpers.ts` | 60 s | 503 + détails hors prod |

Trois répartitions différentes pour le même geste. Un helper `forwardToBackend(request, path, opts)` d'environ 25 lignes ramène chaque route à 3-5 lignes. **−310 lignes**, et surtout une seule définition du timeout et du repli.

### 2.2 `messages.js` — 165 clés, 123 injustifiées

| | nombre |
|---|---|
| clés totales | 165 |
| **jamais utilisées** | **28** |
| utilisées **exactement une fois** | **95** |
| utilisées 2 fois ou plus | 42 |

Centraliser une chaîne a du sens quand elle est réutilisée ou traduite. Ici, `CONSOLE_LOGS.openaiCallInProgress` sert une fois et oblige à ouvrir un second fichier pour lire une ligne de log. Les 28 mortes incluent toute la famille `fileMoved*` — sept clés d'un mécanisme de redirection supprimé.

**−200 lignes**, et un aller-retour de lecture en moins à chaque log.

### 2.3 Dépendances installées et jamais importées

| Paquet | Poids | Application |
|---|---|---|
| `lottie-web` | **12 Mo** | front |
| `openai` | **5,7 Mo** | front |
| `dotenv` | 76 Ko | front (Next lit `.env` nativement) |
| `cookie-parser` | — | back |

Zéro import pour les quatre. Non importés, ils ne partent pas dans le bundle navigateur — l'impact est sur l'installation, la CI et la surface d'`npm audit`, pas sur le poids servi.

Un point mérite l'attention : **`openai` dans le `package.json` du front**. Le paquet n'y a rien à faire, et sa présence suggère un appel direct à OpenAI depuis le navigateur, ce qui exigerait d'y exposer la clé. Ce n'est pas le cas aujourd'hui — autant retirer l'invitation.

`cookie-parser` servira au chantier 00 (sessions). À garder, en le sachant.

### 2.4 Journalisation — 275 appels, aucun niveau

Un `console.*` toutes les 43 lignes. `serverLogger.js` en consacre 28 % de ses lignes. Le motif `🔵 [FUNCTION START] … ✅ [FUNCTION END]` encadre chaque helper, ce qui produit deux lignes par appel d'outil dans les logs Render — où la rétention est limitée sur l'offre gratuite.

Il n'y a pas de niveau : impossible de couper le verbeux en production sans supprimer les lignes. Un `debug(...)` piloté par une variable d'environnement règle ça. **−100 lignes** et des logs lisibles.

### 2.5 Duplication latente des palettes

25 palettes définies dans `Venta/src/lib/colorPalettes.ts` (avec les hex, pour le rendu) **et** 25 dans `venta-backend/rag/colors.txt` (en prose, pour le modèle).

Vérifié ce jour : **les deux listes sont identiques, aucune dérive.** C'est de la dette latente, pas un bug — mais toute palette ajoutée d'un seul côté cassera silencieusement, soit le modèle proposera un fond qui n'existe pas, soit l'inverse. Générer le `.txt` depuis le `.ts` supprime la classe entière.

> **Corrigé pendant l'audit.** `parseColorsFile` avait **deux** points de `push` : la dernière palette sortait au format `id - Nom - Description` quand les 24 autres sortaient en `id — Description`. La duplication avait déjà dérivé. Ramené à un seul point de sortie.

---

## 3. Remplacer par une bibliothèque

| Workflow | Code maison | Bibliothèque | Gain |
|---|---|---|---|
| W3 | `GlassmorphismeWindow` : drag `mousemove`/`mouseup` sur `document`, zoom, minimize, z-index | **`react-rnd`** | −150 |
| W4 | `ImageGallery` : index, clavier, swipe, `dragOffset` | **`yet-another-react-lightbox`** | −200 |
| W5 | `MessagingView` : scroll collant, `requestAnimationFrame`, `wheel` global, chargement vers le haut | **`react-virtuoso`** | −150 |
| W2 | `useTTS` : `waiters[]`, `inFlight`, `notify()` — sémaphore écrit à la main | **`p-limit`** | −80 |
| W1 | `InputArea` : `isSingleLine`, calcul de hauteur | **`react-textarea-autosize`** | −40 |

**−620 lignes pour 5 dépendances légères.**

Deux refus assumés. **`HexagonalAnimation`** est la signature visuelle et son couplage au niveau sonore est spécifique — à simplifier à la main. **`setupAudioVisualization`** utilise déjà l'API native ; `wavesurfer.js` pèserait dix fois le besoin.

---

## 4. Suppressions sèches

| Où | Quoi | Lignes |
|---|---|---|
| `HomeClient:223-230` | deux `if` aux conditions complémentaires, **corps identique** | −8 |
| `HomeClient:18,55,112` | `_inputValue` jamais lu, `closeTextWindow` jamais appelé, callback vide | −9 |
| `HomeClient:344-348` | 5 ancres `<div id>` de hauteur nulle, sans cible | −5 |
| `HomeClient:353` | `hidden:max-md`, classe Tailwind inexistante | −3 |
| `IntroSequence:17` | **4 props sur 7 inutilisées**, calculées par `HomeClient` pour rien | −15 |
| `CommandProcessor:126` | `createCodeWindow` + cas `showcode` : tool supprimé côté back, inatteignable | −25 |
| `messages.js` | 28 clés mortes | −40 |
| `admin/users/components` | 8 fichiers, 401 lignes, moyenne 50 — regroupables en 2 | −100 |

**−205 lignes**, aucun changement de comportement.

---

## 5. Restructurations

**`HomeClient` — l'effet de 120 lignes.** Cinq responsabilités, trois booléens de coordination dont deux toujours vrais ensemble, 16 dépendances. Découpé en trois effets à responsabilité unique : **−60**.

**`CommandProcessor` — l'anti-doublon.** Deux refs, une clé `JSON.stringify`, un `setTimeout(0)`. Toute cette machinerie compense le fait que `lastCommands` est un **état relu à chaque rendu** au lieu d'un **événement consommé une fois**. Un identifiant par lot supprime l'ensemble : **−70**.

**49 micro-fichiers sur 110.** L'en-tête « max 5 fonctions, max 20 lignes » présent dans presque tous les fichiers a produit une fragmentation où `lib/user/` compte 6 fichiers pour 581 lignes et `lib/helpers/` 6 pour 629. La règle visait la lisibilité ; à cette granularité elle coûte un saut de fichier par idée. Regroupement par domaine plutôt que par taille : **−80** d'en-têtes et d'imports.

---

## 6. Priorisation

Score = (Impact + Risque) × (6 − Effort). Impact = frein au quotidien, Risque = ce qui arrive sans correction, Effort inversé.

| # | Élément | Cat. | I | R | E | Score | Gain |
|---|---|---|---|---|---|---|---|
| 1 | Suppressions sèches (§4) | code | 3 | 2 | 1 | **25** | −205 |
| 2 | Dépendances fantômes | dépendance | 2 | 3 | 1 | **25** | 18 Mo |
| 3 | `npm audit fix` + Dependabot | dépendance | 2 | 5 | 1 | **35** | 17 vulns |
| 4 | Helper de proxy (§2.1) | code | 4 | 3 | 2 | **28** | −310 |
| 5 | `messages.js` (§2.2) | code | 4 | 1 | 2 | **20** | −200 |
| 6 | `react-rnd` | code | 3 | 2 | 2 | **20** | −150 |
| 7 | Lightbox | code | 2 | 1 | 2 | **12** | −200 |
| 8 | `react-virtuoso` | code | 3 | 2 | 3 | **15** | −150 |
| 9 | Niveaux de log (§2.4) | infra | 3 | 2 | 2 | **20** | −100 |
| 10 | Palettes générées (§2.5) | archi | 2 | 3 | 2 | **20** | −0 |
| 11 | `HomeClient` + `CommandProcessor` | code | 4 | 2 | 4 | **12** | −130 |
| 12 | Regroupement des micro-fichiers | archi | 3 | 1 | 4 | **8** | −80 |
| 13 | **Tests automatisés** | test | 5 | 5 | 5 | **10** | +300 |
| 14 | CI/CD + conteneur | infra | 4 | 4 | 4 | **16** | +80 |
| 15 | Sessions signées (F1) | archi | 2 | 4 | 3 | **18** | +50 |

---

## 7. Bilan

| | avant | après | gain |
|---|---|---|---|
| Front | 6 343 | ~4 800 | **−24 %** |
| Back | 5 492 | ~5 000 | −9 % |
| **Total** | **11 835** | **~9 800** | **−2 035 lignes** |
| Fonctions > 30 lignes | 96 | ~60 | −37 % |
| Dépendances inutiles | 4 | 1 | 18 Mo |

Première passe : −1 585. Deuxième : **−2 035**, soit 450 de plus, dont l'essentiel vient des routes proxy et des clés mortes de `messages.js` — deux choses qui ne se voient qu'en comptant.

Le back bouge peu et c'est justifié : hors `messages.js` et les logs, la boucle d'agent, le RAG et le TTS multi-fournisseurs font ce qu'ils annoncent. **La graisse est dans le front**, concentrée sur cinq composants qui réimplémentent des bibliothèques et huit routes qui répètent le même geste.

---

## 8. Plan par phases

**Phase 1 — une soirée, risque nul.** Éléments 1, 2, 3. Suppressions sèches, dépendances fantômes, `npm audit fix`, Dependabot. Rien ne change de comportement, `tsc` et `next build` en filet.

**Phase 2 — deux soirées, gain maximal.** Éléments 4, 5, 9. Helper de proxy, `messages.js`, niveaux de log. **−610 lignes** et la configuration réseau enfin définie à un seul endroit.

**Phase 3 — au fil de l'eau.** Éléments 6, 7, 8, 10. Une bibliothèque à la fois, vérifiée sur la preview entre chaque. Le scroll de la messagerie est ce qui se voit le plus : à faire seul, pas groupé.

**Phase 4 — avec du recul.** Éléments 11, 12. Les restructurations demandent de la disponibilité mentale, pas de la vitesse.

**Transversal.** L'élément 13 conditionne la sérénité de tout le reste : **il n'y a aucun test dans ce dépôt**. Les phases 1 et 2 sont sûres parce que le typage et la compilation les couvrent. Les phases 3 et 4 touchent au comportement visible, et là `tsc` ne dira rien. Trois tests Playwright sur les parcours principaux — envoyer un message, afficher une image, changer de thème — suffiraient à rendre ces phases vérifiables. C'est le chantier 04 de la feuille de route, et cet audit est son meilleur argument.

Le livrable final — arborescence fichier par fichier, fonction par fonction, description et numéro d'ordre d'exécution — sera produit après ces modifications, pour que les numéros décrivent le code réel.
