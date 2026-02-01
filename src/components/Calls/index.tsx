import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Phone, Trophy, Zap, Clock, Search,
  Crown, Loader2, Award, Flame 
} from 'lucide-react';

interface AgentStats {
  user_id: string;
  real_name: string;
  role: string;
  calls_today: number;
  calls_all_time: number;
  last_call_time: string | null;
  avatar_url?: string; // <--- Added optional avatar field
}

export default function CallsPage() {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [search, setSearch] = useState('');

  // --- 1. FETCH DATA ---
  const fetchStats = async () => {
    // A. Fetch Stats from RPC
    const { data: statsData, error } = await supabase.rpc('get_call_stats');
    
    if (!error && statsData) {
      // B. Fetch Avatars for these users
      const userIds = statsData.map((s: any) => s.user_id);
      const { data: userData } = await supabase
        .from('crm_users')
        .select('id, avatar_url')
        .in('id', userIds);

      // C. Merge Data
      const avatarMap = new Map();
      userData?.forEach((u: any) => avatarMap.set(u.id, u.avatar_url));

      const mergedStats = statsData.map((s: any) => ({
        ...s,
        avatar_url: avatarMap.get(s.user_id)
      }));

      setStats(mergedStats);
      setLastUpdate(new Date());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

    // --- 2. REAL-TIME LISTENER ---
    const subscription = supabase
      .channel('live-calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_call_logs' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // --- CALCULATIONS ---
  const totalCallsToday = stats.reduce((sum, agent) => sum + agent.calls_today, 0);
  const activeAgents = stats.filter(a => a.calls_today > 0).length;
  const topPerformer = stats.length > 0 ? stats[0] : null;
  const maxCalls = stats.length > 0 ? Math.max(...stats.map(s => s.calls_today), 1) : 1;

  // Filter for the Table
  const filteredStats = stats.filter(agent => 
    agent.real_name.toLowerCase().includes(search.toLowerCase()) ||
    agent.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="h-96 flex items-center justify-center text-cyan-500"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in zoom-in-95 duration-500">
      
      {/* --- HEADER STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* CARD 1: ACTIVE AGENTS */}
        <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 bg-blue-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Zap size={24} className="fill-current" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Agents</p>
              <p className="text-3xl font-bold text-white mt-1">{activeAgents} <span className="text-gray-500 text-lg">/ {stats.length}</span></p>
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL CALLS */}
        <div className="glass-panel p-6 rounded-2xl border border-green-500/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 bg-green-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
              <Phone size={24} className="fill-current" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Calls Today</p>
              <p className="text-3xl font-bold text-white mt-1 tabular-nums tracking-tight">
                {totalCallsToday.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* CARD 3: TOP PERFORMER */}
        <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 relative overflow-hidden group bg-linear-to-br from-amber-900/10 to-transparent">
          <div className="absolute -right-4 -top-4 bg-amber-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Trophy size={24} className="fill-current animate-pulse" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Top Performer</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-white mt-1 truncate max-w-37.5">
                  {topPerformer ? topPerformer.real_name : 'No Data'}
                </p>
                {topPerformer && <Crown size={16} className="text-amber-400 -mt-1" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- LEADERBOARD --- */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* TITLE & SEARCH */}
            <div className="flex items-center gap-6 w-full md:w-auto">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 whitespace-nowrap">
                    <Flame className="text-orange-500" size={20} /> Live Leaderboard
                </h2>

                <div className="relative w-full md:w-64 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search agent..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-black/60 transition-all"
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <span className="text-[10px] text-gray-500 font-mono flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <Clock size={10} /> {lastUpdate.toLocaleTimeString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      LIVE
                    </span>
                </span>
            </div>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
            <tr>
              <th className="p-4 w-16 text-center">Rank</th>
              <th className="p-4">Agent</th>
              <th className="p-4 w-1/3">Performance</th>
              <th className="p-4 text-center">Calls</th>
              <th className="p-4 text-right">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredStats.map((agent) => {
              // Calculate original index to keep ranking correct even when searching
              const originalIndex = stats.findIndex(a => a.user_id === agent.user_id);
              
              const isTop3 = originalIndex < 3;
              const rankColor = originalIndex === 0 ? 'text-amber-400' : originalIndex === 1 ? 'text-gray-300' : originalIndex === 2 ? 'text-orange-400' : 'text-gray-600';
              const percent = (agent.calls_today / maxCalls) * 100;
              const isRetention = agent.role === 'retention';
              const barColor = isRetention ? 'bg-fuchsia-500' : 'bg-cyan-500';
              const glowColor = isRetention ? 'shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'shadow-[0_0_10px_rgba(6,182,212,0.5)]';

              // Time Logic
              let timeDisplay = '-';
              let isJustNow = false;
              if (agent.last_call_time) {
                const diff = (new Date().getTime() - new Date(agent.last_call_time).getTime()) / 1000; 
                if (diff < 60) {
                    timeDisplay = 'Just Now';
                    isJustNow = true;
                } else if (diff < 3600) {
                    timeDisplay = `${Math.floor(diff / 60)}m ago`;
                } else {
                    timeDisplay = new Date(agent.last_call_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }

              return (
                <tr key={agent.user_id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-center">
                    <span className={`font-bold text-lg flex items-center justify-center gap-1 ${rankColor} ${isTop3 ? 'drop-shadow-lg' : ''}`}>
                      {isTop3 && <Award size={14} className={rankColor} />}
                      #{originalIndex + 1}
                    </span>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                        {/* UPDATED: AVATAR DISPLAY */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold overflow-hidden 
                            ${isRetention ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}
                        `}>
                            {agent.avatar_url ? (
                                <img src={agent.avatar_url} alt={agent.real_name} className="w-full h-full object-cover" />
                            ) : (
                                agent.real_name.substring(0, 2).toUpperCase()
                            )}
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm group-hover:text-cyan-400 transition-colors">
                                {agent.real_name}
                            </p>
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded
                                ${isRetention ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-cyan-500/10 text-cyan-400'}
                            `}>
                                {agent.role}
                            </span>
                        </div>
                    </div>
                  </td>

                  <td className="p-4 align-middle">
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-white/5">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor} ${isTop3 ? glowColor : ''}`} 
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-white leading-none tabular-nums">
                            {agent.calls_today}
                        </span>
                        <span className="text-[10px] text-gray-500">
                            Total: {agent.calls_all_time}
                        </span>
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <span className={`text-xs font-mono font-bold flex items-center justify-end gap-2
                        ${isJustNow ? 'text-green-400' : 'text-gray-500'}
                    `}>
                        {timeDisplay}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filteredStats.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                        No agents found matching "{search}"
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}