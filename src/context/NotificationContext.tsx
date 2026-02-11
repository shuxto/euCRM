import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { GLOBAL_CHAT_ID } from '../constants';

interface AppContextType {
  // Notifications
  unreadGlobal: number;
  unreadDM: number;
  unreadSupport: number;
  clearGlobal: () => void;
  clearDM: () => void;
  
  // Global Data Cache (For useLeads optimization)
  agents: any[];
  statuses: any[];
  isDataLoaded: boolean;
}

const AppContext = createContext<AppContextType>({
  unreadGlobal: 0,
  unreadDM: 0,
  unreadSupport: 0,
  clearGlobal: () => {},
  clearDM: () => {},
  agents: [],
  statuses: [],
  isDataLoaded: false,
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // NOTIFICATION STATE
  const [unreadGlobal, setUnreadGlobal] = useState(0);
  const [unreadDM, setUnreadDM] = useState(0);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const [myRooms, setMyRooms] = useState<Set<string>>(new Set());

  // GLOBAL CACHE
  const [agents, setAgents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 1. INITIALIZE USER & GLOBAL DATA
  useEffect(() => {
    let mounted = true;

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && mounted) {
            setUserId(user.id);
            setRole(user.user_metadata?.role || 'conversion');
            
            // --- PARALLEL FETCH GLOBAL DATA ---
            const [
                { data: rooms },
                { data: agentData },
                { data: statusData }
            ] = await Promise.all([
                 supabase.from('crm_chat_participants').select('room_id').eq('user_id', user.id),
                 supabase.from('crm_users').select('id, real_name, role').in('role', ['conversion', 'retention', 'team_leader']).order('real_name', { ascending: true }),
                 supabase.from('crm_statuses').select('label, hex_color').eq('is_active', true).order('order_index', { ascending: true })
            ]);

            if (rooms) setMyRooms(new Set(rooms.map(r => r.room_id)));
            if (agentData) setAgents(agentData);
            if (statusData) setStatuses(statusData);
            
            setIsDataLoaded(true);
            
            // Fetch Initial Counts
            fetchUnreadCounts(user.id);
            if (user.user_metadata?.role) fetchSupportUnreads(user.id, user.user_metadata.role);
        }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // 2. HELPER FETCHERS
  const fetchUnreadCounts = async (uid: string) => {
      const { data } = await supabase.from('crm_messages').select('sender_id, room_id').eq('read', false);
      if (data) {
          const validUnreads = data.filter(msg => msg.sender_id !== uid && msg.room_id !== GLOBAL_CHAT_ID);
          setUnreadDM(validUnreads.length);
      }
  };

  const fetchSupportUnreads = async (uid: string, userRole: string) => {
      const { data, error } = await supabase.rpc('get_my_unread_count', { my_id: uid, my_role: userRole });
      if (!error && data !== null) setUnreadSupport(data);
  };

  // 3. REALTIME SUBSCRIPTIONS (Centralized)
  useEffect(() => {
      if (!userId) return;

      const channel = supabase.channel('app-global-notifications')
          // CHAT MESSAGES
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages' }, (payload) => {
              const newMsg = payload.new;
              if (newMsg.sender_id === userId) return;

              if (newMsg.room_id === GLOBAL_CHAT_ID) {
                  setUnreadGlobal(prev => prev + 1);
              } else {
                  // Logic for DMs
                  setUnreadDM(prev => prev + 1);
                  setMyRooms(prev => new Set(prev).add(newMsg.room_id)); 
              }
          })
          // SUPPORT MESSAGES
          .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
              if (role) fetchSupportUnreads(userId, role);
          })
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [userId, myRooms, role]);

  const clearGlobal = () => setUnreadGlobal(0);
  const clearDM = () => setUnreadDM(0);

  return (
    <AppContext.Provider value={{ 
        unreadGlobal, unreadDM, unreadSupport, 
        clearGlobal, clearDM, 
        agents, statuses, isDataLoaded 
    }}>
      {children}
    </AppContext.Provider>
  );
};
