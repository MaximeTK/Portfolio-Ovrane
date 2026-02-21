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
Plutôt que d'injecter tout mon CV dans chaque requête (coûteux, lent, bruité), le système identifie les blocs de connaissances pertinents pour la question et ne les transmet au modèle que si nécessaire. Une seconde couche de filtrage gère les faux positifs.

Pourquoi le RAG plutôt que le fine-tuning : le fine-tuning sur des données personnelles demande du volume et du temps que je n'avais pas. Le RAG est plus rapide à itérer, plus simple à mettre à jour, et plus prévisible pour un cas d'usage portfolio.

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

### 🧠 Choix du modèle
Après plusieurs itérations, **GPT-4o-mini** a été retenu pour le texte et la voix. Il offre le bon équilibre entre taille de fenêtre de contexte, qualité de réponse, latence et coût API. Coût total après 3 mois de développement et de tests : **0,20 €**.

---

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| 🖥️ Frontend | Next.js, TypeScript, Tailwind CSS, Framer Motion |
| ⚡ Backend | Node.js, Express |
| 🗄️ Base de données | MongoDB (persistance des conversations et sessions) |
| 🤖 IA | OpenAI GPT-4o-mini (texte), OpenAI TTS (audio) |
| 🔍 RAG | Implémentation sur mesure avec indexation vectorielle |
| 🚀 Déploiement | Vercel |

---

## 🔮 Roadmap

### 🤖 IA & Infrastructure
- [ ] 🧠 **Déploiement LLM local** — faire tourner un modèle open source (OpenClaw) sur une instance RunPod démarrée automatiquement à la demande, pour la souveraineté des données et zéro coût API
- [ ] 🗃️ **Migration base vectorielle** — remplacer le RAG actuel en .txt par une vraie base de données vectorielle pour une meilleure récupération sémantique
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
