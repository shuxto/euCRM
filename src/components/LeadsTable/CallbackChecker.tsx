import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface CallbackCheckerProps {
  userId: string | undefined;
}

export default function CallbackChecker({ userId }: CallbackCheckerProps) {
  const isRunning = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const checkCallbacks = async () => {
      if (isRunning.current) return;
      isRunning.current = true;

      const now = new Date();
      
      const { data: leads, error } = await supabase
        .from('crm_leads')
        .select('id, name, surname, phone, callback_time, status, assigned_to')
        .eq('assigned_to', userId)
        .not('callback_time', 'is', null);

      if (error || !leads) {
        isRunning.current = false;
        return;
      }

      const dueLeads = leads.filter(lead => {
        // 1. Check Status
        const isCallBack = lead.status.toLowerCase().replace(/_/g, ' ') === 'call back' || lead.status.toLowerCase() === 'callback';
        if (!isCallBack) return false;

        // 2. Check Time
        const leadTime = new Date(lead.callback_time).getTime();
        const currentTime = now.getTime();
        const diff = currentTime - leadTime;

        // "Overdue" window: 0s to 24 hours ago
        return diff >= 0 && diff < (24 * 60 * 60 * 1000); 
      });

      dueLeads.forEach(lead => {
        // Unique Key for this specific scheduled time
        const alertKey = `dismissed_cb_${lead.id}`;
        
        // If user already clicked X, don't show again
        if (localStorage.getItem(alertKey)) return;

        // --- TRIGGER THE BLUE POPUP (in NotificationSystem) ---
        // We dispatch a custom event that NotificationSystem is listening for
        window.dispatchEvent(new CustomEvent('crm-callback-trigger', { 
            detail: lead 
        }));
      });

      isRunning.current = false;
    };

    checkCallbacks();
    const interval = setInterval(checkCallbacks, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [userId]);

  return null;
}