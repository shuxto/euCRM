import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Users, Radio, Loader2, Search, CheckSquare, Square } from 'lucide-react';

interface User {
  id: string;
  real_name: string;
  role: string;
}

export default function BroadcastCenter() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- NEW: Multi-Select State ---
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'ticker' | 'popup'>('popup');
  const [sending, setSending] = useState(false);

  // 1. Fetch Users
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('crm_users')
        .select('id, real_name, role')
        .order('real_name');
      setUsers(data || []);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // 2. Selection Logic
  const toggleUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(prev => prev.filter(u => u !== id));
    } else {
      setSelectedUserIds(prev => [...prev, id]);
    }
  };

  const toggleAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  // 3. Send Function
  const handleSend = async () => {
    if (!message || selectedUserIds.length === 0) return;
    setSending(true);

    // Send Array of IDs (or ['all'] if everyone is selected)
    const targetPayload = selectedUserIds.length === users.length ? ['all'] : selectedUserIds;

    await supabase.channel('global-alerts').send({
      type: 'broadcast',
      event: 'flash-alert',
      payload: { 
        targetUserIds: targetPayload, // <--- CHANGED TO ARRAY
        message: message, 
        type: type 
      }
    });

    setSending(false);
    setMessage('');
    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Alert Sent Successfully', type: 'success' } }));
  };

  // Filter Users
  const filteredUsers = users.filter(u => 
    u.real_name.toLowerCase().includes(search.toLowerCase()) || 
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <Radio size={32} />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-white">Broadcast Center</h1>
            <p className="text-gray-400 text-sm">Send real-time flash alerts to agent screens.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* LEFT: User Selection (Multi-Select + Search) */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col overflow-hidden">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users size={16} /> Select Targets ({selectedUserIds.length})
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                <input 
                    type="text" 
                    placeholder="Search agents..." 
                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {/* Select All Button */}
                <button 
                    onClick={toggleAll}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${selectedUserIds.length === users.length && users.length > 0 ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                >
                    {selectedUserIds.length === users.length && users.length > 0 ? <CheckSquare size={16} className="text-cyan-400" /> : <Square size={16} />}
                    <span className="font-bold text-sm">SELECT ALL USERS</span>
                </button>

                {loading ? <Loader2 className="animate-spin mx-auto mt-10 text-gray-500" /> : filteredUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                        <button 
                            key={user.id}
                            onClick={() => toggleUser(user.id)}
                            className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 group ${isSelected ? 'bg-cyan-500/10 border-cyan-500/50 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                        >
                            {isSelected ? <CheckSquare size={16} className="text-cyan-400 shrink-0" /> : <Square size={16} className="shrink-0" />}
                            <div className="min-w-0">
                                <div className="font-bold text-sm truncate">{user.real_name}</div>
                                <div className="text-[10px] uppercase opacity-50 truncate">{user.role}</div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>

        {/* RIGHT: Message Composer */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-2xl p-6 flex flex-col">
             
             {/* 1. Style Selection */}
             <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                    onClick={() => setType('ticker')}
                    className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${type === 'ticker' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-black/20 border-white/5 text-gray-500 hover:border-white/10'}`}
                >
                    <div className="w-full h-2 bg-current opacity-50 rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full w-1/3 bg-current animate-pulse"/>
                    </div>
                    <span className="font-bold uppercase tracking-widest text-sm">Ticker Tape</span>
                </button>

                <button 
                    onClick={() => setType('popup')}
                    className={`p-6 rounded-xl border-2 transition flex flex-col items-center gap-3 ${type === 'popup' ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-black/20 border-white/5 text-gray-500 hover:border-white/10'}`}
                >
                    <div className="w-8 h-6 border-2 border-current rounded flex items-center justify-center">
                        <div className="w-1 h-1 bg-current rounded-full"/>
                    </div>
                    <span className="font-bold uppercase tracking-widest text-sm">Flash Popup</span>
                </button>
             </div>

             {/* 2. Message Input */}
             <div className="flex-1 relative mb-6">
                <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="ENTER BROADCAST MESSAGE..."
                    className="w-full h-full bg-black/30 border border-white/10 rounded-xl p-6 text-2xl font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-cyan-500/50 resize-none uppercase font-mono"
                />
             </div>

             {/* 3. Fire Button */}
             <button 
                onClick={handleSend}
                disabled={selectedUserIds.length === 0 || !message || sending}
                className="w-full py-4 bg-linear-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-red-900/50 flex items-center justify-center gap-3 transition active:scale-95"
             >
                {sending ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                {sending ? 'TRANSMITTING...' : `BROADCAST TO ${selectedUserIds.length} AGENTS`}
             </button>

        </div>

      </div>
    </div>
  );
}