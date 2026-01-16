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
    name: TOOL_DESCRIPTIONS.uiShowPicture.name,
    description: TOOL_DESCRIPTIONS.uiShowPicture.description,
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Nom exact du fichier image (asset) à afficher, ex: \"Pico Logo.png\"" }
      },
      required: ["filename"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.uiSetBackground.name,
    description: TOOL_DESCRIPTIONS.uiSetBackground.description,
    parameters: {
      type: "object",
      properties: {
        paletteId: { type: "string", description: "ID exact de la palette, ex: \"ocean\", \"purple\", \"default\"" }
      },
      required: ["paletteId"]
    }
  },
  {
    type: "function",
    name: TOOL_DESCRIPTIONS.uiOpenWindow.name,
    description: TOOL_DESCRIPTIONS.uiOpenWindow.description,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de la fenêtre à ouvrir" }
      },
      required: ["title"]
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
/*
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
*/
];

