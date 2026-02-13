import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatMessage, ChatRoom, ChatUser } from '../types/chat';

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
  createGroup: (name: string, participantIds: string[]) => Promise<string | null>;
  allUsers: ChatUser[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // --- NEW: Store All Users for Mentions ---
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);

  const MESSAGES_PER_PAGE = 50;

  // 1. INIT: Load User & Rooms
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUser(data.user);
        fetchRooms(data.user); 
        fetchAllUsers(); // <--- ADD THIS
      }
    });
  }, []);

  // --- NEW: Fetch All Users Function ---
  const fetchAllUsers = async () => {
      const { data } = await supabase
        .from('crm_users')
        .select('id, real_name, avatar_url, role')
        .order('real_name');
      
      if (data) {
          const mappedUsers = data.map((u: any) => ({
              id: u.id,
              real_name: u.real_name,
              avatar_url: u.avatar_url,
              role: u.role
          }));
          setAllUsers(mappedUsers);
      }
  };

  // 2. FETCH ROOMS (From the new Smart View)
  const fetchRooms = async (userOverride?: any) => {
    const user = userOverride || currentUser;
    if(!user) return;

    // QUERY THE VIEW
    const { data, error } = await supabase
        .from('crm_my_rooms') 
        .select('*')
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error("Error fetching rooms:", error);
        return;
    }

    // Map raw data to our Types
    const mappedRooms: ChatRoom[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.original_name || r.name, // Fallback
        type: r.type,
        unread_count: r.unread_count || 0,
        last_message_at: r.last_message_at,
        created_at: r.created_at,
        
        // Smart View Fields
        display_name: r.display_name,
        display_avatar: r.display_avatar,
        dm_target_id: r.dm_target_id,
        allowed_roles: r.allowed_roles
    }));

    setRooms(mappedRooms);
  };

  // 3. THE LIVE LISTENER (Fixes the "Refresh" bug)
  useEffect(() => {
    if (!currentUser) return;

    // Listen to ALL new messages in the system
    const channel = supabase.channel('global-chat-listener')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'crm_messages' }, 
        async (payload) => {
           const newMsg = payload.new;
           
           setRooms(prevRooms => {
               // A. Check if we have this room locally
               const roomIndex = prevRooms.findIndex(r => r.id === newMsg.room_id);
               
               if (roomIndex === -1) {
                   // New Room (e.g. someone DM'd you for the first time) -> Fetch everything to be safe
                   fetchRooms();
                   return prevRooms;
               }

               // B. Update Existing Room
               const updatedRooms = [...prevRooms];
               const room = updatedRooms[roomIndex];
               
               const isFromMe = newMsg.sender_id === currentUser.id;
               const isCurrentRoom = room.id === activeRoom;
               
               // LOGIC: Increment Red Dot if it's NOT from me AND NOT the active room
               const shouldIncrement = !isFromMe && !isCurrentRoom;

               updatedRooms[roomIndex] = {
                   ...room,
                   last_message_at: newMsg.created_at,
                   unread_count: shouldIncrement 
                       ? (room.unread_count || 0) + 1 
                       : (isFromMe ? 0 : room.unread_count) // Reset if I replied
               };

               // C. Move to Top
               updatedRooms.sort((a, b) => {
                   const tA = new Date(a.last_message_at || 0).getTime();
                   const tB = new Date(b.last_message_at || 0).getTime();
                   return tB - tA;
               });

               return updatedRooms;
           });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, activeRoom]); 

  // 4. LOAD MESSAGES (Active Room)
  useEffect(() => {
    if (!activeRoom || !currentUser) return;

    setIsLoading(true);
    setMessages([]); 
    setHasMore(true);
    
    // IMMEDIATE LOCAL UPDATE: Clear Red Dot
    setRooms(prev => prev.map(r => r.id === activeRoom ? { ...r, unread_count: 0 } : r));

    // A. Fetch Messages
    supabase.from('crm_messages')
      .select('*, sender:crm_users!sender_id(id, real_name, avatar_url, role)')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE)
      .then(async ({ data }) => {
         if (data) {
             setMessages(data.reverse() as any);
             if (data.length < MESSAGES_PER_PAGE) setHasMore(false);
             
             // B. MARK AS READ (Database)
             await supabase.from('crm_read_status').upsert({
                 user_id: currentUser.id,
                 room_id: activeRoom,
                 last_read_at: new Date().toISOString()
             });
         }
         setIsLoading(false);
      });

    // C. Listen for NEW messages in THIS room
    const channel = supabase.channel(`room-${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `room_id=eq.${activeRoom}` }, 
      async (payload) => {
         const { data: sender } = await supabase.from('crm_users').select('id, real_name, avatar_url, role').eq('id', payload.new.sender_id).single();
         const newMsg = { ...payload.new, sender } as ChatMessage;
         setMessages(prev => [...prev, newMsg]);
         
         // Mark read immediately since we are looking at it
         if (payload.new.sender_id !== currentUser.id) {
             await supabase.from('crm_read_status').upsert({
                 user_id: currentUser.id,
                 room_id: activeRoom,
                 last_read_at: new Date().toISOString()
             });
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom, currentUser]); // Added currentUser dependency

  const loadMoreMessages = async () => {
      if (!activeRoom || messages.length === 0) return;
      const oldestMessage = messages[0];
      const { data } = await supabase
          .from('crm_messages')
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

    // 1. Upload Attachments
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
          } catch(e) { console.error("Upload failed", e); }
       }
    }

    // 2. Insert Message
    const { error } = await supabase.from('crm_messages').insert({
       room_id: activeRoom,
       sender_id: currentUser.id,
       content,
       attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
       mentions: mentions.length > 0 ? mentions : null,
       read: false 
    });

    if (!error) {
        // 3. Optimistic Update (Sort List)
        const now = new Date().toISOString();
        setRooms(prev => {
            const updated = prev.map(r => 
                r.id === activeRoom 
                ? { ...r, last_message_at: now, unread_count: 0 }
                : r
            );
            return updated.sort((a, b) => {
                const tA = new Date(a.last_message_at || 0).getTime();
                const tB = new Date(b.last_message_at || 0).getTime();
                return tB - tA;
            });
        });
        
        // Update DB timestamp for others
        await supabase.from('crm_chat_rooms').update({ last_message_at: now }).eq('id', activeRoom);
    }
  }, [currentUser, activeRoom]);

  const createOrOpenDM = async (targetUserId: string) => {
     if (!currentUser) return null;

     // 1. Check local cache first (Fastest)
     const existingRoom = rooms.find(r => r.type === 'dm' && r.dm_target_id === targetUserId);
     if (existingRoom) {
         setActiveRoom(existingRoom.id);
         return existingRoom.id;
     }

     // 2. Check Server (Double Check)
     const { data: existingId } = await supabase.rpc('get_dm_room_id', { target_user_id: targetUserId });
     if (existingId) {
         // It exists but wasn't in our list (maybe we just joined?), fetch and set
         await fetchRooms();
         setActiveRoom(existingId);
         return existingId;
     }

     // 3. Create New
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
        // Force refresh to see the new room
        await fetchRooms();
        setActiveRoom(newRoom.id);
        return newRoom.id;
     }
     return null;
  };

  const createGroup = async (name: string, participantIds: string[]) => {
      if (!currentUser) return null;
      
      const { data: room, error } = await supabase
        .from('crm_chat_rooms')
        .insert({ type: 'group', name, created_by: currentUser.id })
        .select()
        .single();

      if (room && !error) {
          const participants = [
              { room_id: room.id, user_id: currentUser.id },
              ...participantIds.map(uid => ({ room_id: room.id, user_id: uid }))
          ];
          await supabase.from('crm_chat_participants').insert(participants);
          await fetchRooms();
          setActiveRoom(room.id);
          return room.id;
      }
      return null;
  };

  return (
    <ChatContext.Provider value={{ activeRoom, setActiveRoom, rooms, messages, sendMessage, createOrOpenDM, loadMoreMessages, hasMore, isLoading, currentUser, createGroup, allUsers } as any}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used within ChatProvider");
  return context;
};