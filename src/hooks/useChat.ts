import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// --- HELPER: SORT & DEDUPE ---
const mergeAndSortMessages = (currentMessages: any[], newBatch: any[]) => {
  const combined = [...currentMessages, ...newBatch];
  const uniqueMap = new Map();
  combined.forEach(msg => {
      uniqueMap.set(msg.id, msg);
  });
  const uniqueList = Array.from(uniqueMap.values());

  return uniqueList.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id > b.id ? 1 : -1;
  });
};

export function useChat(roomId: string, currentUserId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true); 
  
  const isMounted = useRef(false);
  const PAGE_SIZE = 50;

  // 1. Initial Load & Room Switch
  useEffect(() => {
    if (!roomId || !currentUserId) return;
    isMounted.current = true;

    setMessages([]); 
    setHasMore(true);

    const fetchInitialMessages = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('crm_messages')
        // UPDATED: Added avatar_url to the select
        .select('*, sender:crm_users(real_name, avatar_url)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false }) 
        .order('id', { ascending: false })
        .range(0, PAGE_SIZE - 1); 
      
      if (!error && data) {
        const safeData = data as any[];
        setMessages(mergeAndSortMessages([], safeData)); 
        if (safeData.length < PAGE_SIZE) setHasMore(false);
      }
      setLoading(false);
    };

    fetchInitialMessages();

    // 2. Real-time Subscription
    const sub = supabase.channel(`chat-${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'crm_messages', 
        filter: `room_id=eq.${roomId}` 
      }, async (payload) => {
        // UPDATED: Fetch sender name AND avatar_url
        const { data: senderData } = await supabase
            .from('crm_users')
            .select('real_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();
            
        const newMsg: any = { ...payload.new, sender: senderData };
        
        setMessages(prev => mergeAndSortMessages(prev, [newMsg]));
      })
      .subscribe();

    return () => { 
        supabase.removeChannel(sub); 
        isMounted.current = false;
    };
  }, [roomId, currentUserId]);

  // --- 3. LOAD MORE (OPTIMIZED) ---
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || messages.length === 0) return;
    
    setLoading(true);
    
    const from = messages.length;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('crm_messages')
      // UPDATED: Added avatar_url to the select
      .select('*, sender:crm_users(real_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) 
      .range(from, to);

    if (!error && data) {
      const safeData = data as any[];
      if (safeData.length > 0) {
          setMessages(prev => mergeAndSortMessages(prev, safeData));
      }
      if (safeData.length < PAGE_SIZE) setHasMore(false);
    }
    setLoading(false);
  }, [loading, hasMore, messages, roomId]);

  // --- 4. SEND MESSAGE (OPTIMIZED) ---
  const sendMessage = useCallback(async (content: string, mentions: string[] = []) => {
    if (!content.trim() || !currentUserId || !roomId) return;
    setIsSending(true);
    const { error } = await supabase.from('crm_messages').insert({
      room_id: roomId,
      sender_id: currentUserId,
      content,
      mentions,
      reply_to_id: null
    });
    setIsSending(false);
    return error;
  }, [currentUserId, roomId]);

  return { messages, loading, sendMessage, isSending, loadMore, hasMore };
}