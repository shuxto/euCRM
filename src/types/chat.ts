export interface ChatUser {
  id: string;
  real_name: string;
  avatar_url?: string;
  role: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  attachments?: string[]; // URLs for images/files
  mentions?: string[];    // User IDs of people mentioned
  created_at: string;
  read: boolean;
  sender?: ChatUser;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'global' | 'department' | 'group' | 'dm';
  allowed_roles?: string[];
  unread_count?: number;
}