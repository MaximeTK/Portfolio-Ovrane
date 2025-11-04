# Guide d'utilisation du système Dual-Model (GPT-5 / GPT-4o-mini)

## 📋 Vue d'ensemble

Le système Venta supporte maintenant **deux modèles d'IA** en parallèle :
- **GPT-5-mini** : Utilise l'API Responses (nouvelle API avec reasoning et verbosity)
- **GPT-4o-mini** : Utilise l'API Chat Completions (API classique)

Les deux branches sont **complètement indépendantes** et coexistent sans interférence.

## 🏗️ Architecture

```
venta-backend/src/lib/
├── openai/              # Branche GPT-5 (API Responses)
│   ├── apiParams.js
│   ├── callHandler.js
│   ├── messageConverter.js
│   ├── responseParser.js
│   └── toolExecutor.js   # Partagé entre les deux branches
│
├── openai4o/            # Branche GPT-4o-mini (API Chat Completions)
│   ├── apiParams.js
│   ├── callHandler.js
│   ├── messageConverter.js
│   └── responseParser.js
│
└── aiModelFactory.js    # Sélecteur de branche
```

## ⚙️ Configuration

### Étape 1 : Définir le modèle dans `.env`

Copiez `env.local.example` vers `.env.local` (ou `.env`) et définissez :

```bash
# Options: "gpt5" ou "gpt4o-mini"
AI_MODEL=gpt5           # Pour utiliser GPT-5-mini
# ou
AI_MODEL=gpt4o-mini     # Pour utiliser GPT-4o-mini
```

### Étape 2 : Redémarrer le serveur

```bash
npm start
# ou
npm run dev
```

Le serveur affichera au démarrage quel modèle est utilisé :
```
🤖 [BACKEND] Utilisation du modèle: GPT-5-mini (Responses API)
# ou
🤖 [BACKEND] Utilisation du modèle: GPT-4o-mini (Chat Completions API)
```

## 🔄 Différences entre les deux branches

### GPT-5 (Responses API)

**Fichiers** : `src/lib/openai/*`

**Format d'appel** :
```javascript
const response = await openai.responses.create({
  model: 'gpt-5-mini',
  input: formattedMessages,  // Format spécial
  reasoning: { effort: "medium" },
  text: { verbosity: "medium" },
  tools: tools
});
```

**Format des tools** :
```javascript
{
  type: "function",
  name: "myFunction",
  description: "Description",
  parameters: { type: "object", properties: {...}, required: [...] }
}
```

**Configuration** : `OPENAI_CONFIG` dans `messages.js`
- `reasoningEffort`: low, medium, high
- `textVerbosity`: low, medium, high

### GPT-4o-mini (Chat Completions API)

**Fichiers** : `src/lib/openai4o/*`

**Format d'appel** :
```javascript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,  // Format standard
  temperature: 0.7,
  max_tokens: 2000,
  tools: tools  // Convertis automatiquement
});
```

**Format des tools** (converti automatiquement) :
```javascript
{
  type: "function",
  function: {
    name: "myFunction",
    description: "Description",
    parameters: { type: "object", properties: {...}, required: [...] }
  }
}
```

**Configuration** : `OPENAI_4O_CONFIG` dans `messages.js`
- `temperature`: 0.0 à 2.0
- `maxTokens`: limite de tokens

### 🔧 Conversion automatique des tools

Le système **convertit automatiquement** les tools du format GPT-5 vers le format Chat Completions dans `openai4o/apiParams.js`. Vous n'avez pas besoin de modifier la définition des tools dans `toolsConfig.js` - ils fonctionnent pour les deux modèles !

## 🛠️ Paramètres de configuration

### GPT-5 (dans `messages.js`)

```javascript
export const OPENAI_CONFIG = {
  model: 'gpt-5-mini',
  toolChoice: 'auto',
  reasoningEffort: 'medium',    // low, medium, high
  textVerbosity: 'medium',      // low, medium, high
  maxFunctionCalls: 5,
};
```

### GPT-4o-mini (dans `messages.js`)

```javascript
export const OPENAI_4O_CONFIG = {
  model: 'gpt-4o-mini',
  toolChoice: 'auto',
  temperature: 0.7,
  maxTokens: 2000,
  maxFunctionCalls: 5,
};
```

## 📝 Exemples d'utilisation

### Basculer vers GPT-4o-mini

1. Modifier `.env.local` :
   ```bash
   AI_MODEL=gpt4o-mini
   ```

2. Redémarrer le serveur :
   ```bash
   npm run dev
   ```

3. Le système utilisera automatiquement GPT-4o-mini

### Basculer vers GPT-5

1. Modifier `.env.local` :
   ```bash
   AI_MODEL=gpt5
   ```

2. Redémarrer le serveur

## 🔍 Comment ça fonctionne ?

Le fichier `aiModelFactory.js` agit comme un **router intelligent** :

```javascript
import { callAI } from './aiModelFactory.js';

// Dans responseGenerator.js
const rawResponse = await callAI(openai, messages, tools);
```

Le factory regarde la variable `AI_MODEL` et appelle automatiquement :
- `openai/callHandler.js` si `AI_MODEL=gpt5`
- `openai4o/callHandler.js` si `AI_MODEL=gpt4o-mini`

## 🧪 Tests

Pour tester les deux modèles :

```bash
# Test avec GPT-5
AI_MODEL=gpt5 npm run dev

# Test avec GPT-4o-mini
AI_MODEL=gpt4o-mini npm run dev
```

## ⚠️ Notes importantes

1. **Aucune modification du code GPT-5 existant** : Tous les fichiers dans `openai/` restent intacts
2. **API différentes** : Les deux modèles utilisent des endpoints OpenAI différents
3. **Tool calling** : Le système de tools (`toolExecutor.js`) est partagé entre les deux branches
4. **Par défaut** : Si `AI_MODEL` n'est pas défini, le système utilise GPT-5

## 🐛 Dépannage

### Le modèle ne change pas
- Vérifiez que vous avez bien redémarré le serveur après modification du `.env`
- Vérifiez les logs au démarrage pour confirmer quel modèle est chargé

### Erreur "Modèle invalide"
- Vérifiez que `AI_MODEL` est soit `gpt5` soit `gpt4o-mini`
- Pas de faute de frappe dans le `.env`

### Erreur API OpenAI
- GPT-5 : Vérifiez que votre clé API a accès à l'API Responses
- GPT-4o-mini : Vérifiez que votre clé API a accès à gpt-4o-mini

## 📚 Fichiers modifiés

- ✅ **Créés** :
  - `src/lib/openai4o/` (dossier complet)
  - `src/lib/aiModelFactory.js`
  - `DUAL-MODEL-GUIDE.md` (ce fichier)

- ✅ **Modifiés** :
  - `src/lib/messages.js` (ajout OPENAI_4O_CONFIG)
  - `src/lib/chat/responseGenerator.js` (utilise aiModelFactory)
  - `Venta/env.local.example` (ajout AI_MODEL)

- ✅ **Intacts** :
  - `src/lib/openai/*` (code GPT-5 non touché)
  - Tous les autres fichiers du projet

