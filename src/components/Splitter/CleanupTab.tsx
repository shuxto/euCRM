import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, FolderMinus, UserX, Loader2, AlertTriangle, Search, CheckSquare } from 'lucide-react';
import ConfirmationModal from '../Team/ConfirmationModal'; 
import SuccessModal from '../Team/SuccessModal'; 

export default function CleanupTab() {
  const [folders, setFolders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  
  // FIX 1: Changed default state to 'Shuffled'
  const [targetStatus, setTargetStatus] = useState<'New' | 'Shuffled'>('Shuffled');
  
  const [processing, setProcessing] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 1. Load Folders
  const loadFolders = async () => {
      const { data } = await supabase.rpc('get_moveable_folders');
      if(data) setFolders(data);
  };

  useEffect(() => { loadFolders(); }, []);

  // 2. Load Agents
  useEffect(() => {
    if (selectedFolders.length === 0) { 
        setAgents([]); 
        setSelectedAgents([]); 
        return; 
    }
    loadAgents();
  }, [selectedFolders]);

  const loadAgents = async () => {
      const { data } = await supabase.rpc('get_cleanup_stats', { target_folders: selectedFolders });
      if(data) setAgents(data);
  };

  const toggleFolder = (name: string) => {
    if (selectedFolders.includes(name)) setSelectedFolders(prev => prev.filter(f => f !== name));
    else setSelectedFolders(prev => [...prev, name]);
  };

  const toggleAgent = (id: string) => {
    if (selectedAgents.includes(id)) setSelectedAgents(prev => prev.filter(a => a !== id));
    else setSelectedAgents(prev => [...prev, id]);
  };

  const toggleAllFolders = () => {
      if (selectedFolders.length === folders.length) setSelectedFolders([]); 
      else setSelectedFolders(folders.map(f => f.name)); 
  };

  const toggleAllAgents = () => {
      if (selectedAgents.length === agents.length) setSelectedAgents([]); 
      else setSelectedAgents(agents.map(a => a.agent_id)); 
  };

  const handlePurgeClick = () => {
    if (selectedFolders.length === 0 || selectedAgents.length === 0) return;
    setShowConfirm(true);
  };

  const executePurge = async () => {
    setProcessing(true);
    const { error } = await supabase.rpc('cleanup_leads_v2', {
        target_agent_ids: selectedAgents,
        target_folders: selectedFolders,
        target_status: targetStatus
    });
    
    setProcessing(false);
    setShowConfirm(false);

    if (error) {
        alert("Error: " + error.message);
    } else {
        setShowSuccess(true);
        loadFolders(); 
        setAgents([]); 
        setSelectedAgents([]); 
        setSelectedFolders([]); 
    }
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()));
  const filteredAgents = agents.filter(a => a.real_name.toLowerCase().includes(agentSearch.toLowerCase()));

  const totalToRemove = agents
    .filter(a => selectedAgents.includes(a.agent_id))
    .reduce((sum, a) => sum + (a.total_count - a.safe_count), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* 1. FOLDERS */}
        <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
             <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-red-500/20 rounded-lg"><FolderMinus size={18} className="text-red-400" /></div>
                     <h3 className="font-bold text-white text-sm tracking-wide">1. SELECT FOLDERS</h3>
                 </div>
                 <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Filter folders..." value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-red-500 outline-none" />
                 </div>
             </div>
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                <button onClick={toggleAllFolders} className="w-full text-right text-[10px] text-red-400 hover:text-red-300 font-bold uppercase mb-1 px-2 tracking-wider transition-colors">
                    {selectedFolders.length === folders.length && folders.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                {filteredFolders.map(f => {
                    const isSelected = selectedFolders.includes(f.name);
                    return (
                        <div key={f.name} onClick={() => toggleFolder(f.name)}
                            className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-red-900/20 border-red-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                            <span className={`text-xs truncate max-w-37.5 font-mono ${isSelected ? 'text-white' : 'text-gray-400'}`}>{f.name}</span>
                            <span className="bg-black/30 px-2 py-0.5 rounded text-xs text-gray-400 border border-white/5">{f.count}</span>
                        </div>
                    );
                })}
             </div>
        </div>

        {/* 2. AGENTS */}
        <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
             <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg"><UserX size={18} className="text-orange-400" /></div>
                    <h3 className="font-bold text-white text-sm tracking-wide">2. AFFECTED AGENTS</h3>
                 </div>
                 <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Filter agents..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-orange-500 outline-none" />
                 </div>
             </div>
             {selectedFolders.length > 0 ? (
                 <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                    <button onClick={toggleAllAgents} className="w-full text-right text-[10px] text-orange-400 hover:text-orange-300 font-bold uppercase mb-1 px-2 tracking-wider transition-colors">
                        {selectedAgents.length === agents.length && agents.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    {filteredAgents.map(a => {
                        const isSelected = selectedAgents.includes(a.agent_id);
                        return (
                            <div key={a.agent_id} onClick={() => toggleAgent(a.agent_id)}
                                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-2 transition-all ${isSelected ? 'bg-orange-600/20 border-orange-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{a.real_name}</span>
                                    {isSelected && <CheckSquare size={16} className="text-orange-500" />}
                                </div>
                                <div className="flex gap-2 text-[10px]">
                                    <div className="bg-white/10 px-2 py-0.5 rounded text-gray-300">Total: {a.total_count}</div>
                                    <div className="bg-green-500/20 px-2 py-0.5 rounded text-green-400 border border-green-500/20">Safe: {a.safe_count}</div>
                                    <div className="bg-red-500/20 px-2 py-0.5 rounded text-red-400 border border-red-500/20">Purgeable: {a.total_count - a.safe_count}</div>
                                </div>
                            </div>
                        );
                    })}
                 </div>
             ) : <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">Select Folders First</div>}
        </div>

        {/* 3. DANGER ZONE */}
        <div className="bg-black/40 backdrop-blur-xl border border-red-900/30 rounded-3xl p-8 flex flex-col justify-center gap-8 h-150 relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]"></div>
             
             <div className="text-center relative z-10">
                 <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                     <AlertTriangle size={48} className="text-red-500" />
                 </div>
                 <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Nuclear Option</h2>
                 <p className="text-red-400/60 text-xs uppercase tracking-wider">
                     {selectedFolders.length > 0 && selectedAgents.length > 0 
                        ? `Ready to remove ${totalToRemove} leads` 
                        : 'Awaiting target selection...'}
                 </p>
             </div>

             <div className="bg-black/40 p-4 rounded-xl border border-red-500/20 relative z-10">
                <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">Return Status</label>
                <div className="flex bg-black/50 p-1 rounded-lg">
                    <button onClick={() => setTargetStatus('New')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${targetStatus === 'New' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>New</button>
                    {/* FIX 2 & 3: Value and Check Updated */}
                    <button onClick={() => setTargetStatus('Shuffled')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${targetStatus === 'Shuffled' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>Shuffle</button>
                </div>
            </div>

            <button onClick={handlePurgeClick} disabled={selectedFolders.length === 0 || selectedAgents.length === 0 || processing}
                className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.4)] disabled:opacity-50 transition flex items-center justify-center gap-3 relative z-10 hover:scale-[1.02]">
                {processing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                PURGE LEADS
            </button>
        </div>

        {/* MODALS */}
        <ConfirmationModal 
            isOpen={showConfirm} 
            title="CONFIRM PURGE PROTOCOL" 
            message={`WARNING: You are about to unassign ${totalToRemove} leads from ${selectedAgents.length} agents. \n\nSafe leads (Deposits, Interested, etc) will remain touched.`} 
            type="danger" 
            onConfirm={executePurge} 
            onClose={() => setShowConfirm(false)} 
            loading={processing} 
        />

        <SuccessModal 
            isOpen={showSuccess} 
            title="PURGE COMPLETE" 
            message="Leads have been successfully returned to the pool." 
            type="success" 
            onClose={() => setShowSuccess(false)} 
        />
    </div>
  );
}