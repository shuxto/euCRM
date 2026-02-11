import { useState } from 'react';
import { useChatContext } from '../../context/ChatContext'; 
import { Hash, Lock, Users, Plus, Search, MessageSquare } from 'lucide-react';

export default function ChatSidebar() {
  const { rooms, activeRoom, setActiveRoom } = useChatContext();
  const [searchTerm, setSearchTerm] = useState('');

  const companyRooms = rooms.filter(r => r.type === 'global' || r.type === 'department');
  const teamGroups = rooms.filter(r => r.type === 'group');
  const dmRooms = rooms.filter(r => r.type === 'dm');

  return (
    // FIX: Changed flex-shrink-0 to shrink-0
    <div className="w-72 bg-black/20 border-r border-white/5 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-white font-bold tracking-wide">Workspace</h2>
        <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition">
           <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        
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
                        {room.type === 'global' ? (
                            <Hash size={16} className="opacity-70" />
                        ) : (
                            <Lock size={16} className={activeRoom === room.id ? 'text-white opacity-70' : 'text-yellow-500'} />
                        )}
                        <span className="text-sm font-medium">{room.name}</span>
                    </div>
                ))}
            </div>
        </div>

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

        <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Direct Messages</h3>
            <div className="relative mb-2 px-2">
                <Search className="absolute left-4 top-2 text-gray-600" size={12} />
                <input 
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-8 text-[10px] text-white focus:border-blue-500 outline-none transition-colors"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="space-y-1">
                {dmRooms.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-gray-600 italic flex items-center gap-2">
                        <MessageSquare size={12} />
                        <span>No recent chats</span>
                    </div>
                ) : (
                    dmRooms.map(room => (
                        <div key={room.id} onClick={() => setActiveRoom(room.id)} className="px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer text-xs">
                             Chat #{room.id.substring(0,4)}
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
              <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Online</span>
          </div>
      </div>
    </div>
  );
}