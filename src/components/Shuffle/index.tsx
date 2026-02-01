import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Shuffle, Lock, Users, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Search
} from 'lucide-react';
import ConfirmationModal from '../Team/ConfirmationModal';
import SuccessModal from '../Team/SuccessModal';

interface AgentStats {
  user_id: string;
  real_name: string;
  role: string;
  moveable_count: number;
  safe_count: number;
  avatar_url?: string; // <--- Added
}

export default function ShufflePage() {
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shuffling, setShuffling] = useState(false);
  
  // Search State
  const [search, setSearch] = useState('');

  // Modals
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
  const [successState, setSuccessState] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch Stats
  const fetchStats = async () => {
    setLoading(true);
    // 1. Get Shuffle Stats
    const { data: statsData, error } = await supabase.rpc('get_shuffle_stats');
    
    if (error) {
        setErrorMsg(error.message);
    } else if (statsData) {
        // 2. Fetch Avatars for these users
        const userIds = statsData.map((s: any) => s.user_id);
        const { data: userData } = await supabase
            .from('crm_users')
            .select('id, avatar_url')
            .in('id', userIds);

        // 3. Merge Data
        const avatarMap = new Map();
        userData?.forEach((u: any) => avatarMap.set(u.id, u.avatar_url));

        const mergedAgents = statsData.map((s: any) => ({
            ...s,
            avatar_url: avatarMap.get(s.user_id)
        }));

        setAgents(mergedAgents);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  // Selection Logic
  const toggleAgent = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  // Toggle all now respects the search filter
  const toggleAll = (checked: boolean) => {
    if (checked) {
      const visibleIds = filteredAgents.map(a => a.user_id);
      const newSelection = [...new Set([...selectedIds, ...visibleIds])];
      setSelectedIds(newSelection);
    } else {
      const visibleIds = filteredAgents.map(a => a.user_id);
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    }
  };

  // Execution
  const handleShuffleClick = () => {
    if (selectedIds.length < 2) {
      alert("Please select at least 2 agents to rotate leads.");
      return;
    }
    setConfirmState({
      isOpen: true,
      title: 'Initiate Lead Shuffle',
      message: `You are about to rotate leads between ${selectedIds.length} agents. "Safe" leads will stay put. This cannot be undone.`
    });
  };

  const executeShuffle = async () => {
    setShuffling(true);
    setConfirmState({ ...confirmState, isOpen: false });
    
    try {
      const { data, error } = await supabase.rpc('perform_shuffle', { agent_ids: selectedIds });
      if (error) throw error;
      
      setSuccessState({ isOpen: true, message: data });
      await fetchStats(); // Refresh numbers
      setSelectedIds([]); // Clear selection
    } catch (err: any) {
      setErrorMsg(err.message || "Shuffle Failed");
    } finally {
      setShuffling(false);
    }
  };

  // Filter Agents based on Search
  const filteredAgents = agents.filter(agent => 
    agent.real_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="h-96 flex items-center justify-center text-cyan-500"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in zoom-in-95 duration-500">
      
      {/* HEADER */}
      <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group mb-6 border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-500 pointer-events-none">
            <Shuffle size={180} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight flex items-center gap-3">
                    <span className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/30 text-cyan-400">
                        <Shuffle size={32} />
                    </span>
                    Shuffle Machine
                </h1>
                <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
                    Rotate leads between agents in a circle (A <ArrowRight size={10} className="inline"/> B <ArrowRight size={10} className="inline"/> C <ArrowRight size={10} className="inline"/> A). <br/>
                    Leads with <span className="text-cyan-400 font-bold">Safe Statuses</span> (Sale, Deposit, etc.) are locked and will <u className="decoration-red-500">NOT</u> move.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search agents..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-black/40 border border-gray-700 rounded-xl focus:border-cyan-500 focus:outline-none text-white text-sm placeholder:text-gray-600 transition"
                    />
                </div>

                <label className="flex items-center gap-3 px-5 py-3 rounded-xl bg-crm-bg border border-gray-700 hover:border-cyan-500/50 cursor-pointer transition select-none group whitespace-nowrap">
                    <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded bg-gray-800 border-gray-600 accent-cyan-500"
                        onChange={(e) => toggleAll(e.target.checked)}
                        checked={filteredAgents.length > 0 && filteredAgents.every(a => selectedIds.includes(a.user_id))}
                    />
                    <span className="font-bold text-gray-300 group-hover:text-white">Select All</span>
                </label>
            </div>
        </div>
      </div>

      {/* ERROR MSG */}
      {errorMsg && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle /> {errorMsg}
            <button onClick={() => setErrorMsg('')} className="ml-auto hover:text-white"><Users size={16} /></button>
        </div>
      )}

      {/* AGENT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 mb-8">
        {filteredAgents.map(agent => {
            const isRet = agent.role === 'retention';
            const isSelected = selectedIds.includes(agent.user_id);
            
            return (
                <div 
                    key={agent.user_id}
                    onClick={() => toggleAgent(agent.user_id)}
                    className={`
                        relative p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none group
                        ${isSelected 
                            ? (isRet ? 'bg-fuchsia-900/20 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.2)]' : 'bg-cyan-900/20 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]')
                            : 'bg-crm-bg/50 border-white/5 hover:bg-crm-bg hover:border-gray-500'
                        }
                    `}
                >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {/* UPDATED: Avatar Display */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden
                                ${isRet ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-cyan-500/10 text-cyan-400'}
                            `}>
                                {agent.avatar_url ? (
                                    <img src={agent.avatar_url} alt={agent.real_name} className="w-full h-full object-cover" />
                                ) : (
                                    agent.real_name.substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <div className="overflow-hidden">
                                <div className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {agent.real_name}
                                </div>
                                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded
                                    ${isRet ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-cyan-500/10 text-cyan-400'}
                                `}>
                                    {agent.role === 'conversion' ? 'Agent' : 'Retention'}
                                </span>
                            </div>
                        </div>
                        
                        {/* Checkbox UI */}
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0
                            ${isSelected 
                                ? (isRet ? 'bg-fuchsia-500 border-fuchsia-500' : 'bg-cyan-500 border-cyan-500') 
                                : 'bg-gray-800 border-gray-600'
                            }
                        `}>
                            {isSelected && <CheckCircle2 size={12} className="text-black" />}
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5 group-hover:border-white/10 transition">
                        <div>
                            <span className="block font-mono text-white text-lg leading-none mb-0.5 text-shadow-glow">
                                {agent.moveable_count.toLocaleString()}
                            </span>
                            <span className="text-gray-500 text-[10px]">Moveable</span>
                        </div>
                        <div className="text-right">
                            <span className="block font-mono text-gray-500 text-lg leading-none mb-0.5">
                                {agent.safe_count.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 justify-end text-gray-600 text-[10px]">
                                <Lock size={8} /> Safe
                            </span>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-center z-40">
         <div className="max-w-7xl w-full flex items-center justify-between">
            <div className="text-sm text-gray-500 flex items-center gap-2">
                <Users size={16} className="text-cyan-500" />
                <span>{selectedIds.length} Agents Selected</span>
            </div>
            
            <button 
                onClick={handleShuffleClick}
                disabled={selectedIds.length < 2 || shuffling}
                className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-10 py-3 rounded-xl font-bold text-sm shadow-lg shadow-cyan-900/40 flex items-center gap-3 transition transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
                {shuffling ? <Loader2 className="animate-spin" /> : <Shuffle className="animate-pulse" />}
                {shuffling ? 'ROTATING LEADS...' : 'START ROTATION'}
            </button>
         </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <ConfirmationModal 
        isOpen={confirmState.isOpen}
        type="danger" 
        title={confirmState.title}
        message={confirmState.message}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={executeShuffle}
        loading={shuffling}
      />

      {/* SUCCESS MODAL */}
      <SuccessModal 
        isOpen={successState.isOpen}
        type="success"
        title="Shuffle Complete"
        message={successState.message}
        onClose={() => setSuccessState({ ...successState, isOpen: false })}
      />

    </div>
  );
}