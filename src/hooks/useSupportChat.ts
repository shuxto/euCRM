import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Helper to keep messages unique and sorted
const mergeMessages = (current: any[], incoming: any[]) => {
  const map = new Map();
  [...current, ...incoming].forEach(msg => map.set(msg.id, msg));
  return Array.from(map.values()).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export function useSupportChat(leadId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // 1. Fetch & Subscribe
  useEffect(() => {
    if (!leadId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_messages')
        .select('*') // 👈 Fixed: Stop trying to join hidden tables 
        // Note: We select email/name depending on what table sender is in. 
        // Since sender could be Client OR Staff, we might need a joined view later.
        // For now, we just get the raw ID and Text.
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    };

    fetchMessages();

    // Realtime Subscription
    const channel = supabase.channel(`support-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setMessages(prev => mergeMessages(prev, [payload.new]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  // 2. Send Message Logic (The Smart Router)
  const sendMessage = useCallback(async (text: string, currentUserId: string) => {
    if (!text.trim() || !leadId) return;
    setSending(true);

    try {
      // STEP A: Find out who should receive this (The Manager)
      // We look up the lead to see if they are assigned to anyone.
      let targetManagerId = null;

      const { data: leadData } = await supabase
        .from('crm_leads')
        .select('assigned_to')
        .eq('id', leadId)
        .single();

      if (leadData?.assigned_to) {
        targetManagerId = leadData.assigned_to;
      }

      // STEP B: Insert the message
      const { error } = await supabase.from('support_messages').insert({
        lead_id: leadId,
        sender_id: currentUserId,
        recipient_id: targetManagerId, // <--- THIS IS THE KEY (Null = Inbox, ID = Private)
        message_text: text,
        is_read: false
      });

      if (error) throw error;

    } catch (err) {
      console.error('Failed to send support message:', err);
      alert('Error sending message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [leadId]);

  return { messages, loading, sending, sendMessage };
}