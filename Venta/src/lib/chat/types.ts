/**
 * Types pour le système de chat IA
 */
export type MessageRole = 'user' | 'assistant';

export interface Command {
  command: string;
  parameter: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  commands?: Command[];
}

export type ChatStatus = 'idle' | 'streaming' | 'error';

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error?: string;
}
