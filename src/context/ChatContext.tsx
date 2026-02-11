import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatMessage, ChatRoom } from '../types/chat';
import { useApp } from './NotificationContext';

interface ChatContextType {
  activeRoom: string | null;
  setActiveRoom: (id: string) => void;
  rooms: ChatRoom[];
  messages: ChatMessage[];
  sendMessage: (content: string, files: File[], mentions: string[]) => Promise<void>;
  createOrOpenDM: (targetUserId: string) => Promise<string | null>;
  loadMoreMessages: () => Promise<void>;
  isLoading: boolean;
  currentUser: any;
  hasMore: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { decrementUnreadDM } = useApp();

  const MESSAGES_PER_PAGE = 50;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUser(data.user);
        fetchRooms(data.user);
      }
    });
  }, []);

  const fetchRooms = async (user: any) => {
    const { data } = await supabase
      .from('crm_chat_rooms')
      .select(`
        *,
        last_message_at,
        participants:crm_chat_participants(
          user:crm_users(id, real_name, avatar_url)
        )
      `);

    if (!data) return;

    if (!data) return;

    let visibleRooms = data.filter((r: any) => {
       // 1. DMs: STRICT - Only if I am a participant
       if (r.type === 'dm') {
          return r.participants?.some((p: any) => p.user.id === user.id);
       }
       
       // 2. Global/Department/Group: Check Roles
       if (!r.allowed_roles || r.allowed_roles.length === 0) return true; 
       if (r.allowed_roles.includes(user.user_metadata?.role || user.role)) return true;
       
       // 3. Fallback: If I am a participant (e.g. manually added to a group)
       if (r.participants?.some((p: any) => p.user.id === user.id)) return true;

       return false;
    });

    // 4. FETCH UNREAD COUNTS (Fix for "Missing Red Dot inside")
    const { data: unreads } = await supabase
        .from('crm_messages')
        .select('room_id')
        .eq('read', false)
        .neq('sender_id', user.id); // Only messages NOT from me

    const unreadMap: Record<string, number> = {};
    if (unreads) {
        unreads.forEach((u: any) => {
            unreadMap[u.room_id] = (unreadMap[u.room_id] || 0) + 1;
        });
    }

    visibleRooms = visibleRooms.map((room: any) => {
        // Map Unread Count
        const count = unreadMap[room.id] || 0;
        
        // Handle DM Naming
        if (room.type === 'dm' && room.participants) {
            const otherUser = room.participants.find((p: any) => p.user.id !== user.id);
            if (otherUser?.user) {
                return {
                    ...room,
                    name: otherUser.user.real_name,
                    avatar_url: otherUser.user.avatar_url,
                    unread_count: count
                };
            }
        }
        return { ...room, unread_count: count };
    });
    
    visibleRooms.sort((a: any, b: any) => {
        // 1. Sort by Time (Newest First)
        const timeA = new Date(a.last_message_at || a.created_at).getTime();
        const timeB = new Date(b.last_message_at || b.created_at).getTime();
        if (timeA !== timeB) return timeB - timeA;

        // 2. Fallback to Type Priority
        const typeOrder = { global: 0, department: 1, group: 2, dm: 3 };
        return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
    });

    setRooms(visibleRooms);
    
    if (!activeRoom) {
        const global = visibleRooms.find((r: any) => r.type === 'global');
        if (global) setActiveRoom(global.id);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-chat-listener')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'crm_messages' }, 
        (payload) => {
           if (payload.new.room_id !== activeRoom) {
               setRooms(prev => prev.map(r => {
                   if (r.id === payload.new.room_id) {
                       return { ...r, unread_count: (r.unread_count || 0) + 1 };
                   }
                   return r;
               }));
           }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, activeRoom]);

  // LOAD MESSAGES (With strict Sender Fetching)
  useEffect(() => {
    if (!activeRoom) return;

    setIsLoading(true);
    setMessages([]); 
    setHasMore(true);
    setRooms(prev => prev.map(r => r.id === activeRoom ? { ...r, unread_count: 0 } : r));

    supabase.from('crm_messages')
      // FIX: Added explicit relationship '!sender_id' to prevent ambiguity
      .select('*, sender:crm_users!sender_id(id, real_name, avatar_url, role)')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE)
      .then(async ({ data, error }) => {
         if (error) {
             console.error("Error loading messages:", error);
         } else if (data) {
             setMessages(data.reverse() as any);
             if (data.length < MESSAGES_PER_PAGE) setHasMore(false);
             
             // --- MARK AS READ (DB) ---
             const unreadIds = data.filter((m: any) => !m.read && m.sender_id !== currentUser.id).map((m: any) => m.id);
             if (unreadIds.length > 0) {
                 await supabase.from('crm_messages').update({ read: true }).in('id', unreadIds);
                 decrementUnreadDM(unreadIds.length);
             }
         }
         setIsLoading(false);
      });

    const channel = supabase.channel(`room-${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `room_id=eq.${activeRoom}` }, 
      async (payload) => {
         // FETCH SENDER IMMEDIATELY FOR NEW MESSAGE
         const { data: sender } = await supabase.from('crm_users')
             .select('id, real_name, avatar_url, role')
             .eq('id', payload.new.sender_id)
             .single();
         
         const newMsg = { ...payload.new, sender } as ChatMessage;
         setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  const loadMoreMessages = async () => {
      if (!activeRoom || messages.length === 0) return;
      
      const oldestMessage = messages[0];
      const { data } = await supabase
          .from('crm_messages')
          // FIX: Added explicit relationship '!sender_id' here too
          .select('*, sender:crm_users!sender_id(id, real_name, avatar_url, role)')
          .eq('room_id', activeRoom)
          .lt('created_at', oldestMessage.created_at)
          .order('created_at', { ascending: false })
          .limit(MESSAGES_PER_PAGE);

      if (data) {
          if (data.length < MESSAGES_PER_PAGE) setHasMore(false);
          setMessages(prev => [...data.reverse(), ...prev]);
      }
  };

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

    const { error } = await supabase.from('crm_messages').insert({
       room_id: activeRoom,
       sender_id: currentUser.id,
       content,
       attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
       mentions: mentions.length > 0 ? mentions : null,
       read: false 
    });

    if (!error) {
        // A. Update Room Timestamp (For Sorting)
        await supabase.from('crm_chat_rooms')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', activeRoom);

        // B. Handle Mentions -> Notifications
        if (mentions.length > 0) {
            const notifs = mentions.map(uid => ({
                user_id: uid,
                title: `New Mention from ${currentUser.user_metadata?.real_name || 'Agent'}`,
                message: content.length > 50 ? content.substring(0, 50) + '...' : content,
                related_lead_id: activeRoom, // Link to Chat Room
                is_read: false
            }));
            await supabase.from('crm_notifications').insert(notifs);
        }
    } else {
        console.error("FAILED TO SEND MESSAGE:", error);
    }
  }, [currentUser, activeRoom]);

  const createOrOpenDM = async (targetUserId: string) => {
     if (!currentUser) return null;

     const existingLocal = rooms.find(r => 
        r.type === 'dm' && 
        r.participants?.some((p:any) => p.user.id === targetUserId) &&
        r.participants?.some((p:any) => p.user.id === currentUser.id)
     );
     if (existingLocal) {
         setActiveRoom(existingLocal.id);
         return existingLocal.id;
     }

     const uniqueName = `dm-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

     const { data: newRoom, error } = await supabase
        .from('crm_chat_rooms')
        .insert({ type: 'dm', name: uniqueName })
        .select()
        .single();
     
     if (newRoom && !error) {
        await supabase.from('crm_chat_participants').insert([
            { room_id: newRoom.id, user_id: currentUser.id },
            { room_id: newRoom.id, user_id: targetUserId }
        ]);
        await fetchRooms(currentUser);
        setActiveRoom(newRoom.id);
        return newRoom.id;
     }
     return null;
  };

  return (
    <ChatContext.Provider value={{ activeRoom, setActiveRoom, rooms, messages, sendMessage, createOrOpenDM, loadMoreMessages, hasMore, isLoading, currentUser }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used within ChatProvider");
  return context;
};