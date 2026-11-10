[README.md](https://github.com/user-attachments/files/25458635/README.md)
# 🤖 Ovrane — Portfolio IA

> Un portfolio qui ne se contente pas de montrer qui je suis — il l'explique.

**🌐 Demo live → [ovrane.net](https://www.ovrane.net/github)**

> ⚠️ **Travaux en cours — V1** : Ce projet est en développement actif. Des fonctionnalités sont ajoutées régulièrement et l'architecture continue d'évoluer.

---

## 💡 C'est quoi Ovrane ?

Ovrane est un portfolio web construit autour d'un agent IA conversationnel. Plutôt que de forcer le visiteur à parcourir des pages de texte statique, l'IA devient le point d'entrée — elle répond aux questions sur mon profil, mes projets et mes compétences en langage naturel, avec support vocal.

Ce projet est une exploration de ce à quoi ressemble une interface personnelle de nouvelle génération : une où le GUI laisse place à un **LUI (Language User Interface)**.

---

## ⚙️ Décisions techniques clés

### 🔍 RAG — Retrieval-Augmented Generation
Plutôt que d'injecter tout mon CV dans chaque requête (coûteux, lent, bruité), le système retrouve les passages pertinents pour la question et ne les transmet au modèle que si une porte de pertinence le juge utile.

Pourquoi le RAG plutôt que le fine-tuning : le fine-tuning sur des données personnelles demande du volume et du temps que je n'avais pas. Le RAG est plus rapide à itérer, plus simple à mettre à jour, et plus prévisible pour un cas d'usage portfolio.

Le pipeline :
- **Connaissance séparée des consignes** : `venta-backend/rag/` ne contient que la connaissance, un Markdown par sujet (Profil, Hikup, Pico, Ovrane, Illusion) ; consignes, palettes et images vivent dans `venta-backend/prompts/` et ne polluent plus la recherche.
- **Découpage structurel** : un passage par section `##`/`###` (redécoupé par paragraphes au-delà de ~350 tokens), préfixé de son fil d'Ariane (« Hikup > Gamification ») pour l'embedding comme pour BM25 : 129 passages.
- **Recherche hybride en mémoire** : BM25 (sans accents ni mots vides, pluriels ramenés au singulier) et cosinus sur `text-embedding-3-small`, fusionnés par Reciprocal Rank Fusion (`Σ w/(60+rang)`), top 6.
- **Relances réécrites (reprompting)** : quand un message précède, `gpt-5.4-mini` (sans raisonnement) réécrit la question en requête autonome (« Et l'équipe l'a réussi ? » → « L'équipe a-t-elle réussi le Barrage Bêta ? »), pendant que la question s'embedde ; la requête réécrite compte autant que la question et peut ouvrir la porte. En panne ou au-delà de 2,5 s, le message précédent reprend son rôle de seconde requête de poids 0,5.
- **Porte de pertinence calibrée** : le contexte n'est injecté que si le meilleur cosinus de la question atteint 0,45, ou si 60 % de ses termes sont réunis dans un même passage avec un cosinus d'au moins 0,3. La règle naïve « au moins un terme trouvé » laissait passer 5 hors-sujet sur 7.
- **Reclassement (reranking)** : porte ouverte, les 12 meilleurs candidats de la fusion passent au même modèle, qui rend en JSON strict les numéros des passages utiles, du plus utile au moins utile ; les 6 premiers sont injectés, et une liste vide ferme la porte. En panne ou au-delà de 2,5 s, l'ordre de la fusion reste. Le classement d'une première question est gardé en mémoire (les suggestions reviennent souvent) et oublié à la réindexation.
- **Embeddings persistés dans MongoDB** (`rag_chunks`, identifiant = sha256 du modèle et du texte préfixé) : au démarrage, seuls les passages nouveaux ou modifiés sont embeddés et les obsolètes supprimés.
- **Prompt ordonné pour le cache d'OpenAI** : un message système 100 % fixe (~1 660 tokens), puis le contexte du visiteur, l'historique, et enfin `<contexte><source document="…" section="…">` suivi de la question. Mesuré : 1 536 tokens servis depuis le cache dès le deuxième appel.

Évaluation (`npm run eval:rag`, 41 questions dorées : 34 pertinentes dont 6 relances, 7 hors sujet). La comparaison avant/après porte sur les 29 questions hors Illusion, absent de l'ancien corpus :

| Variante (29 questions) | recall@5 | MRR@5 |
|---|---|---|
| Avant : dense seul (Vectra, blocs de 500 tokens) | 0,931 | 0,741 |
| Avant : seuil 0,5 et repli lexical | 0,828 | 0,681 |
| **Avant : contexte réellement injecté (filtre regex)** | **0,448** | **0,362** |
| Après : dense seul | 0,931 | 0,764 |
| Après : BM25 seul | 0,862 | 0,736 |
| Après : hybride | 0,966 | 0,754 |
| Après : hybride + historique | 0,966 | 0,771 |
| **Après : contexte réellement injecté (porte)** | **0,931** | **0,737** |

Sur les 6 relances, le contexte injecté passe de 0 à 0,833 de recall@5 ; faux positifs de la porte : 0/7 avant comme après.

Réécriture et reclassement (10/11/2026, mêmes 41 questions ; les 34 pertinentes, puis les 29 hors Illusion) :

| Variante | recall@5 (34) | MRR@5 (34) | recall@5 (29) | MRR@5 (29) |
|---|---|---|---|---|
| Hybride + historique | 0,941 | 0,718 | 0,966 | 0,771 |
| Réécrite | 0,941 | 0,718 | 0,966 | 0,771 |
| Réécrite + reclassée | 1,000 | 0,985 | 1,000 | 0,983 |
| Contexte injecté avant | 0,912 | 0,688 | 0,931 | 0,737 |
| **Contexte injecté après** | **1,000** | **0,985** | **1,000** | **0,983** |

La porte s'ouvre sur 34 questions pertinentes sur 34 au lieu de 33 : la relance « Et l'équipe l'a réussi ? » n'ouvrait la porte qu'une fois réécrite. Faux positifs : 0/7. Le prix est le délai, environ 1,2 s par appel quel que soit le modèle (`gpt-5.4-nano` et `gpt-4.1-mini` mesurés, à peine plus rapides) : la recherche complète passe de ~0,2 s à 1,8 s en médiane, plus pour une relance, qui enchaîne les deux appels. `OPENAI_RAG_MODEL=` (vide) coupe les deux étapes.

Un passage à Atlas Vector Search et `$rankFusion` n'aurait de sens qu'au-delà de quelques milliers de passages : en dessous, une base distante n'ajoute que de la latence.

### 🧪 Évaluation des réponses (promptfoo)
`npm run eval:reponses` fait passer les 41 questions dorées par la vraie chaîne du chat (`generateResponse` : RAG, consignes, Luna), une à la fois pour des délais réalistes. Un client OpenAI enveloppé relève, sans toucher au code de production, les jetons de chaque modèle, le coût au tarif standard et le bloc `<contexte>` réellement injecté. [promptfoo](https://www.promptfoo.dev/) (MIT, dépendance de développement) note ensuite chaque réponse :

- **justesse** (`llm-rubric`) : la réponse transmet-elle le fait attendu, au sens près ;
- **fidélité** (`context-faithfulness`, seuil 0,8) : part des affirmations appuyées par le contexte injecté ;
- **pertinence** (`answer-relevance`, seuil 0,5) : les questions qu'on déduirait de la réponse ressemblent-elles à celle posée ;
- **hors sujet** (`llm-rubric`) : ni météo ni heure inventées, palette inconnue signalée, code donné quand on en demande ;
- **coût** (1 centime au plus par réponse), délai du premier texte et de la réponse complète.

Le juge est `gpt-5.4`, et non Luna : un modèle qui note ses propres réponses les favorise. `gpt-5.4-mini` rendait des verdicts de fidélité que promptfoo ne savait pas lire. Télémétrie et partage de promptfoo sont coupés ; le détail se lit dans `npx promptfoo view`.

Passage du 10/11/2026 : 33 réussites sur 41 ; justesse 0,941, fidélité 0,893, pertinence 0,715 (34 questions) ; hors sujet 6/7. Premier texte : 2,7 s en médiane, 3,9 s au 9e décile ; réponse complète : 5,0 s. Coût d'une réponse : 0,13 centime en médiane, 4,6 centimes pour les 41 (juge non compté). Le banc a trouvé deux défauts : les mots accentués en tête (« écarlate », « doré ») ne proposaient pas les outils de palette, c'est corrigé ; `rag/Hikup.md` dit à la fois que Maxime a « activement participé à la réécriture des composants » et qu'il n'a « quasiment jamais codé ».

### 🔊 Streaming audio par chunks
La génération de voix IA est traditionnellement lente — le modèle doit terminer de générer la réponse complète avant que l'audio démarre. Pour éliminer ce goulot d'étranglement, le système découpe la réponse en morceaux et commence à diffuser les premiers blocs audio pendant que la suite est encore générée en arrière-plan. La latence sur les longs messages a été réduite considérablement.

### 🎮 Contrôle de l'UI via tool calls
L'IA ne fait pas que répondre — elle peut contrôler l'interface. Quand un utilisateur demande à voir l'image d'un projet ou changer le thème visuel, le modèle déclenche un tool call qui injecte un objet de commande JSON dans la réponse. Le frontend parse ces commandes et exécute les opérations DOM correspondantes.

```json
{
  "reply": "Voici le logo de Pico.",
  "commands": [
    {
      "command": "ShowPicture",
      "parameter": "Pico Logo.png"
    }
  ],
  "activeUserId": "user-123"
}
```

### 🔐 Sécurité et sessions
- Le navigateur ne parle qu'à Next : un relai à liste blanche est seul à connaître l'adresse du backend.
- Next signe chaque appel du secret de service `X-Ovrane-Service`, avec l'IP réelle (`X-Ovrane-Client-Ip`) et la session (`X-Ovrane-Session`) ; sans secret valide, le backend répond 401 (`requireService`).
- La session est un jeton opaque de 256 bits en cookie httpOnly `ovrane_session` ; la collection `sessions` n'en garde que le sha256, TTL de 30 jours glissants, rotation à la connexion.
- `requireSession` tire l'utilisateur de la session : plus aucun `userId` ne vient du client.
- L'ancien `venta_userId` du localStorage est confié une seule fois au backend, rattaché à une session, puis effacé.
- Limites de débit par IP réelle et par session : connexion 10 / 15 min, création de visiteur 30 / h, chat 10 / min, voix 30 / min.

### 🧠 Choix du modèle
En V1, après plusieurs itérations, **GPT-4o-mini** a été retenu pour le texte et la voix. Il offrait le bon équilibre entre taille de fenêtre de contexte, qualité de réponse, latence et coût API. Coût total après 3 mois de développement et de tests : **0,20 €**.

Aujourd'hui, le chat passe par l'API Responses avec **`gpt-5-mini`** par défaut (effort de raisonnement et verbosité `medium`), réglable par `OPENAI_MODEL` sans toucher au code. La voix passe par ElevenLabs, puis OpenAI TTS en repli, puis la voix du navigateur.

---

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| 🖥️ Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand |
| ⚡ Backend | Node.js, Express, Mongoose |
| 🗄️ Base de données | MongoDB (profils, conversations, sessions, embeddings du RAG ; base partagée avec Illusion) |
| 🤖 IA | OpenAI `gpt-5-mini` par défaut, API Responses (texte) ; ElevenLabs, puis OpenAI TTS (audio) |
| 🔍 RAG | Hybride sur mesure : BM25 + embeddings `text-embedding-3-small` fusionnés par RRF, en mémoire, embeddings persistés dans MongoDB |
| 🚀 Déploiement | Vercel (front), Render (backend) |

---

## 🧪 Lancer en local

Node.js 22 ou plus. Deux fichiers d'exemple, sans secret : `venta-backend/env.local.example` et `Venta/env.local.example`.

**Backend** (`venta-backend/.env`) :

| Variable | Rôle |
|---|---|
| `NODE_ENV` | **Obligatoire** : `production`, `development` ou `test`, sinon le serveur refuse de démarrer |
| `SERVICE_SECRET` | **Identique des deux côtés**. Obligatoire en production ; hors production, `dev-ovrane-service` par défaut |
| `MONGODB_URI`, `MONGODB_DB` | Obligatoires, sans repli : une base de dev à part (ex. `venta_local`) |
| `OPENAI_API_KEY` | Obligatoire |
| `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `OPENAI_TEXT_VERBOSITY` | Facultatives : `gpt-5-mini`, `medium`, `medium` |
| `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID` | Voix principale, Cartesia Sonic 3.6 ; voix Inès par défaut |
| `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID` | Facultatives : relais si Cartesia échoue, sinon OpenAI TTS |
| `TTS_DEFAULT` | `true` : la voix du navigateur lit tout |
| `INVITE_CODE` | Code d'inscription ; vide, l'inscription est fermée |
| `SITE_URL` | Adresse publique du front, pour les liens des e-mails ; `http://localhost:3000` hors production |
| `RESEND_API_KEY`, `MAIL_FROM` | E-mails « mot de passe oublié » par Resend, depuis un domaine vérifié ; vides, aucun e-mail ne part |
| `PORT`, `TRUST_PROXY`, `LOG_VERBOSE` | `3001` ; toujours vrai en production ; traçage par requête |

**Front** (`Venta/.env.local`), lu côté serveur seulement :

| Variable | Rôle |
|---|---|
| `BACKEND_URL` | Adresse du backend, `http://127.0.0.1:3001` par défaut |
| `SERVICE_SECRET` | Même valeur que le backend ; obligatoire en production, sinon le relai répond 503 |

```bash
cd venta-backend
npm install
cp env.local.example .env    # MONGODB_URI, MONGODB_DB, OPENAI_API_KEY
npm run dev                  # http://localhost:3001
npm test                     # hors ligne : MongoDB et OpenAI simulés
npm run test:openai          # RAG et chat avec le vrai OpenAI, sans MongoDB (quelques fractions de centime)

cd ../Venta
npm install
cp env.local.example .env.local
npm run dev                  # http://localhost:3000
```

### 🚀 Déploiement
- **Vercel** (`Venta`) : `BACKEND_URL` (l'URL du service Render) et `SERVICE_SECRET`. Retirer `NEXT_PUBLIC_BACKEND_URL` : le navigateur ne connaît plus le backend.
- **Render** (`venta-backend`, `npm start`, sonde `/health`) : `NODE_ENV=production`, `SERVICE_SECRET` (même valeur que sur Vercel), `MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, `CARTESIA_API_KEY`, `SITE_URL`, `RESEND_API_KEY`, `MAIL_FROM` ; au besoin `INVITE_CODE`, `CARTESIA_VOICE_ID`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`, `TTS_DEFAULT`, `OPENAI_MODEL`. Retirer `ADMIN_API_KEY`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `ALLOW_NGROK_ORIGINS`, `LOG_CORS` et `REQUEST_BODY_LIMIT`, qui ne sont plus lues ; `TTS-DEFAULT` devient `TTS_DEFAULT`.
- **Auto-hébergé** (`next start`) : Next jamais joignable directement, derrière un seul proxy qui écrit `X-Forwarded-For` et `X-Forwarded-Proto` et garde `Host` : la dernière valeur de `X-Forwarded-For` est l'IP des limites, et `X-Forwarded-Proto` avec `Host` dit le site à la garde des mutations.
- Générer le secret : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

---

## 🔮 Roadmap

### 🤖 IA & Infrastructure
- [ ] 🧠 **Déploiement LLM local** — faire tourner un modèle open source (OpenClaw) sur une instance RunPod démarrée automatiquement à la demande, pour la souveraineté des données et zéro coût API
- [x] 🗃️ **Refonte du RAG** — Markdown structuré, recherche hybride BM25 + embeddings, porte calibrée et embeddings persistés dans MongoDB : recall@5 du contexte injecté de 0,448 à 0,931. Une base vectorielle (Atlas Vector Search + `$rankFusion`) ne se justifiera qu'au-delà de quelques milliers de passages
- [ ] 🔊 **Modèle TTS local** — remplacer l'API OpenAI TTS par un modèle de voix IA auto-hébergé pour une identité sonore sur mesure

### 📊 Dashboard & Automatisation
- [ ] 💼 **Dashboard de suivi de candidatures** — suivre les mails, les candidatures et automatiser les relances via intégration n8n
- [ ] 📈 **Analytics & tracking** — intégrer Google Analytics, Microsoft Clarity et des trackers comportementaux

### 🌐 Feeds & Contenu
- [ ] 📸 **Feed Instagram** — récupérer et afficher le contenu Instagram personnel directement dans le dashboard
- [ ] 🤿 **Feed Reddit** — agréger des subreddits sélectionnés dans un feed filtré sur mesure
- [ ] 🎵 **YouTube music downloader** — télécharger et gérer de la musique depuis YouTube directement dans Ovrane

---

## 👤 Auteur

**Maxime Thiong-kay** — Product Engineer  
[LinkedIn](https://linkedin.com/in/maxime-thiong-kay) · [Portfolio](https://www.ovrane.net/github)
