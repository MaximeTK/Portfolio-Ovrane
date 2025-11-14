export type UserProfile = {
  id: string;
  name: string | null;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  conversationCount: number;
};

export type Conversation = {
  timestamp: string;
  prompt: string;
  response: string;
  detectedName?: string;
};

export type UserDetails = UserProfile & {
  ipHash: string;
  preferences: Record<string, unknown>;
  conversations: Conversation[];
};

export type UsersResponse = {
  users: UserProfile[];
};

export type UserResponse = {
  user: UserDetails;
};

