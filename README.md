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
- **Relances sans appel au modèle** : le message précédent du visiteur est une seconde requête de poids 0,5 ; les deux embeddings partent dans un seul appel.
- **Porte de pertinence calibrée** : le contexte n'est injecté que si le meilleur cosinus de la question atteint 0,45, ou si 60 % de ses termes sont réunis dans un même passage avec un cosinus d'au moins 0,3. La règle naïve « au moins un terme trouvé » laissait passer 5 hors-sujet sur 7.
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

Sur les 6 relances, le contexte injecté passe de 0 à 0,833 de recall@5 ; faux positifs de la porte : 0/7 avant comme après. Un passage à Atlas Vector Search et `$rankFusion` n'aurait de sens qu'au-delà de quelques milliers de passages : en dessous, une base distante n'ajoute que de la latence.

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
