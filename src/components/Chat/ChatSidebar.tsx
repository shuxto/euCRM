import { useState, useEffect } from 'react';
import { useChatContext } from '../../context/ChatContext'; 
import { supabase } from '../../lib/supabase';
// FIX: Removed 'Hash' from imports
import { 
    Lock, Users, Plus, Search, 
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

  const isVisibleRoom = (r: any) => {
      const name = (r.name || '').toLowerCase();
      if (name.includes('tech support')) return false;
      if (name.includes('it support')) return false;
      return true;
  };

  const companyRooms = rooms.filter(r => (r.type === 'global' || r.type === 'department') && isVisibleRoom(r));
  const teamGroups = rooms.filter(r => r.type === 'group' && isVisibleRoom(r));

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

  const handleUserClick = async (userId: string) => {
      await createOrOpenDM(userId);
      setSearchTerm('');
  };

  const displayedUsers = allUsers.filter(u => 
      (u.real_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-72 bg-black/20 border-r border-white/5 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-white font-bold tracking-wide">Workspace</h2>
        <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition">
           <Plus size={18} />
        </button>
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

        {/* TEAMS */}
        {teamGroups.length > 0 && (
            <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Teams</h3>
                <div className="space-y-1">
                    {teamGroups.map(room => (
                        <div 
                            key={room.id} 
                            onClick={() => setActiveRoom(room.id)} 
                            className={`px-3 py-2 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${
                                activeRoom === room.id 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'hover:bg-white/5 text-gray-400 hover:text-white'
                            }`}
                        >
                            <Users size={16} className="opacity-70" />
                            <span className="text-sm font-medium">{room.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

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
                        const activeDmRoom = rooms.find(r => 
                            r.type === 'dm' && 
                            r.participants?.some(p => p.user.id === user.id)
                        );
                        
                        const isActive = activeRoom === activeDmRoom?.id;
                        const unread = activeDmRoom?.unread_count || 0;

                        // ONLINE CHECK (5 minute buffer)
                        const isOnline = user.last_seen && (new Date().getTime() - new Date(user.last_seen).getTime() < 5 * 60 * 1000);

                        return (
                            <div 
                                key={user.id} 
                                onClick={() => handleUserClick(user.id)} 
                                className={`px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all group ${
                                    isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
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
                                    <div className="bg-blue-500 text-white text-[9px] font-bold px-1.5 rounded-full">
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