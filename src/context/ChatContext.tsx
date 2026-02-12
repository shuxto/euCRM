import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatMessage, ChatRoom } from '../types/chat';

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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const MESSAGES_PER_PAGE = 50;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUser(data.user);
        fetchRooms(data.user); // Now strict-safe
      }
    });
  }, []);

  // --- 1. FETCH ROOMS (OPTIMIZED VIEW) ---
  const fetchRooms = async (userOverride?: any) => {
    const user = userOverride || currentUser;
    if(!user) return;

    // The View does ALL the heavy lifting
    const { data, error } = await supabase
        .from('crm_my_rooms') 
        .select('*')
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error("Error fetching rooms:", error);
        return;
    }

    // Map View Data to internal state
    const mappedRooms = (data || []).map((r: any) => ({
        id: r.id,
        name: r.display_name || r.name, // View handles DM naming
        type: r.type,
        unread_count: r.unread_count,
        avatar_url: r.display_avatar || r.avatar_url, // View handles DM avatars
        last_message_at: r.last_message_at,
        created_at: r.created_at,
        dm_target_id: r.dm_target_id // New field for UI matching
    }));

    setRooms(prevRooms => {
        // Smart Merge: Keep local optimistic `last_message_at` if it's newer than server's
        const merged = mappedRooms.map((serverRoom: any) => {
            const localRoom = prevRooms.find(r => r.id === serverRoom.id);
            if (localRoom && localRoom.last_message_at && serverRoom.last_message_at) {
                const localTime = new Date(localRoom.last_message_at).getTime();
                const serverTime = new Date(serverRoom.last_message_at).getTime();
                // If local state is newer (e.g. from realtime event), trust local state
                if (localTime > serverTime) {
                    return { 
                        ...serverRoom, 
                        last_message_at: localRoom.last_message_at,
                        unread_count: localRoom.unread_count // PRESERVE OPTIMISTIC COUNT
                    };
                }
            }
            return serverRoom;
        });

        // SAFETY: If activeRoom is missing from server (View Lag), preserve it from local state
        // This is CRITICAL for new DMs/Groups that haven't propagated to the View yet
        if (activeRoom) {
            const isActiveRoomMissing = !merged.find((r: any) => r.id === activeRoom);
            if (isActiveRoomMissing) {
                const localActiveRoom = prevRooms.find(r => r.id === activeRoom);
                if (localActiveRoom) {
                    merged.push(localActiveRoom);
                }
            }
        }

        return merged;
    });
  };

  // AUTO-SELECT GLOBAL (Only on initial load if nothing selected)
  useEffect(() => {
      if (rooms.length > 0 && !activeRoom) {
          // Double check we haven't selected something in the meantime
          // But actually, we want to ensure we don't overwrite if user is navigating.
          // This effect runs when `rooms` updates. 
          // If activeRoom is null, select global.
          const global = rooms.find(r => r.type === 'global');
          if (global) setActiveRoom(global.id);
      }
  }, [rooms, activeRoom]);

  // --- 2. GLOBAL LISTENER (Refreshes View on New Messages) ---
  useEffect(() => {
    if (!currentUser) return;
    
    // We listen for ANY new message where we are a participant/viewer
    const channel = supabase.channel('global-chat-listener')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'crm_messages' }, 
        async (payload) => {
           const newMsg = payload.new;
           
           // Check if we already have this room in our list
           setRooms(prevRooms => {
               const roomExists = prevRooms.find(r => r.id === newMsg.room_id);
               
               if (roomExists) {
                   // UPDATE EXISTING ROOM
                   return prevRooms.map(r => {
                       if (r.id === newMsg.room_id) {
                           // Only increment unread if MSG is NOT from me AND I'm not in the room
                           const isFromMe = newMsg.sender_id === currentUser.id;
                           const isUnread = !isFromMe && r.id !== activeRoom;
                           
                           return {
                               ...r,
                               last_message_at: newMsg.created_at,
                               unread_count: isUnread 
                                  ? (r.unread_count || 0) + 1 
                                  : (isFromMe ? 0 : r.unread_count) // If from me, reset to 0 (implied read)
                           };
                       }
                       return r;
                   });
               } else {
                   // NEW ROOM FOUND (e.g. Incoming DM from someone new)
                   // We won't add it here inside the setState because we need to fetch it first.
                   // The async fetch below will handle adding it.
                   return prevRooms;
               }
           });

           // If we didn't have the room, OR to ensure consistency, we fetch.
           // Ideally, for a NEW room, we want to fetch just that room to be fast.
           const { data: newRoomData } = await supabase
               .from('crm_my_rooms') 
               .select('*')
               .eq('id', newMsg.room_id)
               .single();

           if (newRoomData) {
               const mappedNewRoom = {
                   id: newRoomData.id,
                   name: newRoomData.display_name || newRoomData.name,
                   type: newRoomData.type,
                   unread_count: newRoomData.unread_count, // Should be at least 1 now if calculated by server, but server view might lag.
                   avatar_url: newRoomData.display_avatar || newRoomData.avatar_url,
                   last_message_at: newMsg.created_at, // Trust the message time
                   created_at: newRoomData.created_at,
                   dm_target_id: newRoomData.dm_target_id
               };

               setRooms(prev => {
                   const exists = prev.find(r => r.id === mappedNewRoom.id);
                   if (exists) {
                       // We might have optimistically updated it above, but let's just ensure we have latest View data
                       // BUT preserve our optimistic unread count if strictly greater (handling race conditions)
                       return prev.map(r => r.id === mappedNewRoom.id ? { ...mappedNewRoom, unread_count: Math.max(r.unread_count || 0, mappedNewRoom.unread_count || 0) } : r);
                   } else {
                       // ADD NEW ROOM
                       return [mappedNewRoom, ...prev];
                   }
               });
           } else {
               // Fallback: Refresh all if specific fetch failed for some reason (RLS?)
               fetchRooms();
           }
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'crm_read_status', filter: `user_id=eq.${currentUser.id}` },
        () => {
            // When I read a message (or mark as read), refresh the room list to clear the red dot
            // We rely on fetchRooms here as the source of truth for "0"
            fetchRooms();
        }
      )
      .subscribe();
      
    // Initial Fetch
    fetchRooms();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, activeRoom]); // Add activeRoom dependency to ensure closure has latest state for optimistic check

  // LOAD MESSAGES (With strict Sender Fetching)
  useEffect(() => {
    if (!activeRoom) return;

    setIsLoading(true);
    setMessages([]); 
    setHasMore(true);
    
    // Optimistic: Clear unread count locally instantly
    setRooms(prev => prev.map(r => r.id === activeRoom ? { ...r, unread_count: 0 } : r));

    supabase.from('crm_messages')
      .select('*, sender:crm_users!sender_id(id, real_name, avatar_url, role)')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE)
      .then(async ({ data }) => {
         if (data) {
             setMessages(data.reverse() as any);
             if (data.length < MESSAGES_PER_PAGE) setHasMore(false);
             
             // --- MARK AS READ (DB - NEW LOGIC) ---
             // We just update our "Last Read" timestamp for this room
             if (data.length > 0) {
                 await supabase.from('crm_read_status').upsert({
                     user_id: currentUser.id,
                     room_id: activeRoom,
                     last_read_at: new Date().toISOString()
                 });
             }
         }
         setIsLoading(false);
      });

    const channel = supabase.channel(`room-${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `room_id=eq.${activeRoom}` }, 
      async (payload) => {
         const { data: sender } = await supabase.from('crm_users').select('id, real_name, avatar_url, role').eq('id', payload.new.sender_id).single();
         const newMsg = { ...payload.new, sender } as ChatMessage;
         setMessages(prev => [...prev, newMsg]);
         
         // If I am active in this room (which I am, inside this effect), 
         // update my read status immediately to now
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
  }, [activeRoom]);

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

    const { error } = await supabase.from('crm_messages').insert({
       room_id: activeRoom,
       sender_id: currentUser.id,
       content,
       attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
       mentions: mentions.length > 0 ? mentions : null,
       read: false 
    });

    if (!error) {
        // Optimistic Update: Move this room to the top instantly
        const now = new Date().toISOString();
        setRooms(prev => {
            const updated = prev.map(r => 
                r.id === activeRoom 
                ? { ...r, last_message_at: now }
                : r
            );
            // Sort immediately to reflect change
            return updated.sort((a, b) => {
                const tA = new Date(a.last_message_at || a.created_at || 0).getTime();
                const tB = new Date(b.last_message_at || b.created_at || 0).getTime();
                return tB - tA;
            });
        });

        await supabase.from('crm_chat_rooms').update({ last_message_at: now }).eq('id', activeRoom);
        if (mentions.length > 0) {
            const notifs = mentions.map(uid => ({
                user_id: uid,
                title: `New Mention from ${currentUser.user_metadata?.real_name || 'Agent'}`,
                message: content.length > 50 ? content.substring(0, 50) + '...' : content,
                related_lead_id: activeRoom,
                is_read: false
            }));
            await supabase.from('crm_notifications').insert(notifs);
        }
    }
  }, [currentUser, activeRoom]);

  // --- DM LOGIC ---
  const createOrOpenDM = async (targetUserId: string) => {
     if (!currentUser) return null;

     // 1. Check if we already have it locally (The View provides it)
     // DMs have a special name format or we can check participants from view (if we included them)
     // Since View simplifies participants to just "display_name", we assume 
     // we might need a server check if not found by name.
     // For now, let's just do the server check to be safe and canonical.

     // Check if 'dm' exists between these two
     const { data: existing } = await supabase.rpc('get_dm_room_id', { target_user_id: targetUserId });
     if (existing) {
         setActiveRoom(existing);
         return existing;
     }

     // Create New
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
        await fetchRooms();
        setActiveRoom(newRoom.id);
        return newRoom.id;
     }
     return null;
  };

  // --- NEW: CREATE GROUP ---
  const createGroup = async (name: string, participantIds: string[]) => {
      if (!currentUser) return;
      
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
    <ChatContext.Provider value={{ activeRoom, setActiveRoom, rooms, messages, sendMessage, createOrOpenDM, loadMoreMessages, hasMore, isLoading, currentUser, createGroup } as any}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used within ChatProvider");
  return context;
};