import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
// FIX: Added 'type' keyword for verbatimModuleSyntax compliance
import type { ChatMessage, ChatRoom } from '../types/chat';

interface ChatContextType {
  activeRoom: string | null;
  setActiveRoom: (id: string) => void;
  rooms: ChatRoom[];
  messages: ChatMessage[];
  sendMessage: (content: string, files: File[], mentions: string[]) => Promise<void>;
  isLoading: boolean;
  currentUser: any;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Init User & Rooms
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
      if (data.user) fetchRooms(data.user);
    });
  }, []);

  // 2. Fetch Rooms
  const fetchRooms = async (user: any) => {
    const { data } = await supabase.from('crm_chat_rooms').select('*');
    if (!data) return;

    const visibleRooms = data.filter((r: any) => {
       if (!r.allowed_roles) return true;
       if (r.allowed_roles.includes(user.role)) return true;
       if (['admin', 'manager'].includes(user.role)) return true;
       return false;
    });
    
    visibleRooms.sort((a: any, b: any) => {
        if (a.type === 'department' && b.type !== 'department') return -1;
        if (a.type !== 'department' && b.type === 'department') return 1;
        return 0;
    });

    setRooms(visibleRooms);
    
    if (!activeRoom) {
        const global = visibleRooms.find((r: any) => r.type === 'global');
        if (global) setActiveRoom(global.id);
    }
  };

  // 3. Load Messages
  useEffect(() => {
    if (!activeRoom) return;

    setIsLoading(true);
    setMessages([]); 

    supabase.from('crm_messages')
      .select('*, sender:crm_users(id, real_name, avatar_url, role)')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
         if (data) setMessages(data as any);
         setIsLoading(false);
      });

    const channel = supabase.channel(`room-${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `room_id=eq.${activeRoom}` }, 
      async (payload) => {
         const { data: sender } = await supabase.from('crm_users').select('id, real_name, avatar_url, role').eq('id', payload.new.sender_id).single();
         const newMsg = { ...payload.new, sender } as ChatMessage;
         setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  // 4. Send Function
  const sendMessage = useCallback(async (content: string, files: File[], mentions: string[]) => {
    if (!currentUser || !activeRoom) return;

    let attachmentUrls: string[] = [];

    if (files.length > 0) {
       for (const file of files) {
          try {
              const fileExt = file.name.split('.').pop();
              const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
              const { error } = await supabase.storage.from('chat-attachments').upload(fileName, file);
              if (!error) {
                 const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
                 attachmentUrls.push(data.publicUrl);
              }
          } catch(e) {
              console.error("Upload failed", e);
          }
       }
    }

    await supabase.from('crm_messages').insert({
       room_id: activeRoom,
       sender_id: currentUser.id,
       content,
       attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
       mentions: mentions.length > 0 ? mentions : null,
       read: false
    });
  }, [currentUser, activeRoom]);

  return (
    <ChatContext.Provider value={{ activeRoom, setActiveRoom, rooms, messages, sendMessage, isLoading, currentUser }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used within ChatProvider");
  return context;
};