/**
 * Configuration des outils (function calling) pour OpenAI
 */
import { TOOL_DESCRIPTIONS } from '../messages.js';

/**
 * Crée la configuration d'un outil sans paramètres
 */
function createNoParamTool(toolDesc) {
  return {
    type: "function",
    name: toolDesc.name,
    description: toolDesc.description,
    parameters: { type: "object", properties: {}, required: [] }
  };
}

/**
 * Configuration des tools pour l'API OpenAI
 */
export const tools = [
  createNoParamTool(TOOL_DESCRIPTIONS.getRulePicture),
  createNoParamTool(TOOL_DESCRIPTIONS.getAvailableAssets),
  createNoParamTool(TOOL_DESCRIPTIONS.getAvailableColors),
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.searchKnowledgeBase.name,
    description: TOOL_DESCRIPTIONS.searchKnowledgeBase.description,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: TOOL_DESCRIPTIONS.searchKnowledgeBase.parameterDescription }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.checkUser.name,
    description: TOOL_DESCRIPTIONS.checkUser.description,
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Le nom à vérifier en base de données" } },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.CreateUserProfile.name,
    description: TOOL_DESCRIPTIONS.CreateUserProfile.description,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Le nom à attribuer au profil temporaire" },
        reason: { type: "string", description: "Explication courte de pourquoi tu crées ce profil" }
      },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.UpdateUserProfile.name,
    description: TOOL_DESCRIPTIONS.UpdateUserProfile.description,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Le nouveau nom correct à attribuer au profil" },
        reason: { type: "string", description: "Explication courte de pourquoi c'est une correction de nom" }
      },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.SwitchUserProfile.name,
    description: TOOL_DESCRIPTIONS.SwitchUserProfile.description,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Le nom du profil vers lequel basculer" },
        reason: { type: "string", description: "Explication courte de pourquoi l'utilisateur change de profil" }
      },
      required: ["name"]
    }
  }
];

