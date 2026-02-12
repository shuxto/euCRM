export interface ChatUser {
  id: string;
  real_name: string;
  avatar_url?: string;
  role: string;
}

export interface ChatParticipant {
  user: ChatUser;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  attachments?: string[];
  mentions?: string[];
  created_at: string;
  read: boolean;
  sender?: ChatUser;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'global' | 'department' | 'group' | 'dm';
  allowed_roles?: string[];
  dm_target_id?: string;
  
  // View Properties (Calculated)
  display_name?: string; 
  display_avatar?: string;
  unread_count: number; 
  
  created_at?: string;
  last_message_at?: string;
  
  // Relationships
  participants?: ChatParticipant[];
}