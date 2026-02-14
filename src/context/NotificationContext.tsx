import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { GLOBAL_CHAT_ID } from '../constants';
import type { CRMUser } from '../components/Team/types';

interface AppContextType {
  // Notifications
  currentUser: CRMUser | null;
  unreadGlobal: number;
  unreadDM: number;
  unreadSupport: number;
  clearGlobal: () => void;
  clearDM: () => void;
  decrementUnreadDM: (amount?: number) => void;
  
  // Global Data Cache (For useLeads optimization)
  agents: any[];
  statuses: any[];
  isDataLoaded: boolean;
}

const AppContext = createContext<AppContextType>({
  currentUser: null,
  unreadGlobal: 0,
  unreadDM: 0,
  unreadSupport: 0,
  clearGlobal: () => {},
  clearDM: () => {},
  decrementUnreadDM: () => {},
  agents: [],
  statuses: [],
  isDataLoaded: false,
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(null);

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
            // FETCH FULL USER PROFILE (For Permissions)
            const { data: userProfile } = await supabase
                .from('crm_users')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (userProfile) setCurrentUser(userProfile as CRMUser);
            const [
                { data: rooms },
                { data: agentData },
                { data: statusData }
            ] = await Promise.all([
                 supabase.from('crm_chat_participants').select('room_id').eq('user_id', user.id),
                 supabase.from('crm_users').select('id, real_name, role').neq('role', 'admin').order('real_name', { ascending: true }),
                 supabase.from('crm_statuses').select('label, hex_color').eq('is_active', true).order('order_index', { ascending: true })
            ]);

            if (rooms) setMyRooms(new Set(rooms.map(r => r.room_id)));
            if (agentData) setAgents(agentData);
            if (statusData) setStatuses(statusData);
            
            setIsDataLoaded(true);
            
            // Fetch Initial Counts
            fetchUnreadCounts();
            if (user.user_metadata?.role) fetchSupportUnreads(user.id, user.user_metadata.role);
        }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // 2. HELPER FETCHERS
  const fetchUnreadCounts = async () => {
      // FIX: Use the View which handles the new `crm_read_status` logic
      const { data } = await supabase.from('crm_my_rooms').select('type, unread_count');
      if (data) {
          const globalUnread = data
            .filter((r: any) => r.type === 'global')
            .reduce((sum, r: any) => sum + (r.unread_count || 0), 0);
            
          const dmUnread = data
            .filter((r: any) => r.type !== 'global')
            .reduce((sum, r: any) => sum + (r.unread_count || 0), 0);

          setUnreadGlobal(globalUnread);
          setUnreadDM(dmUnread);
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
          // CHAT MESSAGES (INCREMENT)
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
          // READ STATUS (DECREMENT / RECALCULATE)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_read_status', filter: `user_id=eq.${userId}` }, () => {
              fetchUnreadCounts();
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
  const decrementUnreadDM = (amount: number = 1) => setUnreadDM(prev => Math.max(0, prev - amount));

  return (
    <AppContext.Provider value={{ 
        unreadGlobal, unreadDM, unreadSupport, 
        currentUser,
        clearGlobal, clearDM, decrementUnreadDM, 
        agents, statuses, isDataLoaded 
    }}>
      {children}
    </AppContext.Provider>
  );
};
