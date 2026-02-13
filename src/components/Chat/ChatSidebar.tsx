import { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext'; 
import { supabase } from '../../lib/supabase';
import { 
    Lock, Users, Search, 
    Globe, RefreshCcw, TrendingUp, Megaphone, Crown, Code
} from 'lucide-react';

export default function ChatSidebar() {
  const { rooms, activeRoom, setActiveRoom, currentUser, createOrOpenDM } = useChatContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = () => {
        supabase.from('crm_users')
            .select('id, real_name, avatar_url, role, last_seen')
            .neq('id', currentUser.id)
            .order('real_name')
            .then(({ data, error }) => {
                if (error) console.error("Error fetching users:", error);
                if (data) setAllUsers(data);
            });
    };

    fetchUsers(); // Initial fetch

    const interval = setInterval(fetchUsers, 60000); // Activity Refresh (1 min)
    
    return () => clearInterval(interval);
  }, [currentUser]);

  // Section 1: Headquarters (Global & Departments)
  const companyRooms = rooms.filter(r => r.type === 'global' || r.type === 'department');
  
  // NOTE: "Teams" (Group chats) are intentionally hidden as per user request (2026-02-12)
  // const teamGroups = rooms.filter(r => r.type === 'group');

  const getRoomIcon = (room: any) => {
    if (room.type === 'global') return <Globe size={16} className="text-blue-400" />;
    
    if (room.type === 'department') {
        const name = room.name.toLowerCase();
        if (name.includes('retention')) return <RefreshCcw size={16} className="text-orange-400" />;
        if (name.includes('conversion')) return <TrendingUp size={16} className="text-emerald-400" />;
        if (name.includes('marketing')) return <Megaphone size={16} className="text-pink-400" />;
        if (name.includes('management') || name.includes('high table')) return <Crown size={16} className="text-yellow-400" />;
        if (name.includes('dev')) return <Code size={16} className="text-cyan-400" />;
        return <Lock size={16} className="text-gray-400" />;
    }
    
    return <Users size={16} className="text-indigo-400" />;
  };

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Sync selectedUserId when activeRoom changes from external sources (e.g. initial load)
  useEffect(() => {
    if (activeRoom) {
        const room = rooms.find(r => r.id === activeRoom);
        if (room && room.type === 'dm') {
            // Try to find the other user ID from our known params (Smart View Logic)
            if (room.dm_target_id) {
                setSelectedUserId(room.dm_target_id);
            } else if (room.participants) {
                const other = room.participants.find(p => p.user.id !== currentUser?.id);
                if (other) setSelectedUserId(other.user.id);
            }
        } else if (room && room.type !== 'dm') {
            setSelectedUserId(null);
        }
    }
  }, [activeRoom, rooms, currentUser]);

  const handleUserClick = async (userId: string) => {
      // Optimistic Update: Immediately highlight the user
      setSelectedUserId(userId);
      setSearchTerm('');
      
      await createOrOpenDM(userId);
  };

  // MERGE & SORT USERS
  const sortedUsers = allUsers.map(user => {
      // Find the DM room for this user using Smart View ID or Participant check
      const dmRoom = rooms.find(r => 
          r.type === 'dm' && 
          (r.dm_target_id === user.id || r.participants?.some(p => p.user.id === user.id))
      );
      
      // Calculate Interaction Time
      // Priority: 1. last_message_at (Newest) 2. created_at 3. Fallback
      let interactionTime = 0;
      if (dmRoom) {
          const t1 = dmRoom.last_message_at ? new Date(dmRoom.last_message_at).getTime() : 0;
          const t2 = dmRoom.created_at ? new Date(dmRoom.created_at).getTime() : 0;
          interactionTime = Math.max(t1, t2);
      }

      return {
          ...user,
          dmRoom,
          interactionTime
      };
  }).sort((a, b) => {
      // 1. Sort by Time (Descending) - Bumps active chats to top
      if (a.interactionTime !== b.interactionTime) {
          return b.interactionTime - a.interactionTime;
      }
      // 2. Alphabetical Fallback
      return (a.real_name || '').localeCompare(b.real_name || '');
  });

  const displayedUsers = sortedUsers.filter(u => 
      (u.real_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-72 bg-black/20 border-r border-white/5 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-white font-bold tracking-wide">Workspace</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        
        {/* HEADQUARTERS */}
        <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Headquarters</h3>
            <div className="space-y-1">
                {companyRooms.map(room => (
                    <div 
                        key={room.id}
                        onClick={() => setActiveRoom(room.id)}
                        className={`px-3 py-2 rounded-lg flex items-center gap-3 cursor-pointer transition-all duration-200 ${
                            activeRoom === room.id 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                            : 'hover:bg-white/5 text-gray-400 hover:text-white'
                        }`}
                    >
                        {getRoomIcon(room)}
                        <span className="text-sm font-medium">{room.name}</span>
                        {room.unread_count && room.unread_count > 0 ? (
                            <span className="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                {room.unread_count}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>

        {/* DIRECT MESSAGES / ALL USERS */}
        <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">People</h3>
            
            <div className="relative mb-3 px-2">
                <Search className="absolute left-4 top-2 text-gray-600" size={12} />
                <input 
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-8 text-[10px] text-white focus:border-blue-500 outline-none transition-colors"
                    placeholder="Find a colleague..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="space-y-1">
                {displayedUsers.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-gray-600 italic">
                        {allUsers.length === 0 ? "No users visible (Check RLS)" : "No matches found"}
                    </div>
                ) : (
                    displayedUsers.map(user => {
                        // Use pre-calculated DM room (or find if not mapped yet)
                        const activeDmRoom = user.dmRoom || rooms.find(r => 
                            r.type === 'dm' && 
                            (r.dm_target_id === user.id || r.participants?.some(p => p.user.id === user.id))
                        );
                        
                        // Robust Active Check: Room ID match OR Optimistic User ID match
                        const isActive = (activeRoom && activeDmRoom && activeRoom === activeDmRoom.id) || (selectedUserId === user.id);
                        const unread = activeDmRoom?.unread_count || 0;

                        // ONLINE CHECK (5 minute buffer)
                        const isOnline = user.last_seen && (new Date().getTime() - new Date(user.last_seen).getTime() < 5 * 60 * 1000);

                        return (
                            <div 
                                key={user.id} 
                                onClick={() => handleUserClick(user.id)} 
                                className={`px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all group ${
                                    isActive 
                                    ? 'bg-blue-600/30 text-white border border-blue-500/30 shadow-[0_0_10px_rgba(37,99,235,0.2)]' 
                                    : 'hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'
                                }`}
                            >
                                <div className="relative">
                                    <div className={`w-6 h-6 rounded-full bg-gray-700 overflow-hidden border ${isOnline ? 'border-emerald-500/50' : 'border-white/10'} flex items-center justify-center`}>
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-[9px] font-bold">
                                                {(user.real_name || '?')[0]}
                                            </div>
                                        )}
                                    </div>
                                    {/* ONLINE DOT */}
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-black shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                       <p className="text-xs truncate font-medium">{user.real_name || 'Unknown'}</p>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <p className="text-[9px] text-gray-600 truncate">{user.role || 'Member'}</p>
                                        {isOnline && <span className="text-[8px] text-emerald-500/70">Online</span>}
                                    </div>
                                </div>

                                {unread > 0 && (
                                    <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full shadow-sm">
                                        {unread}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>

      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
              <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Connected</span>
          </div>
      </div>
    </div>
  );
}