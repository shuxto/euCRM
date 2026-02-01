import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowRightLeft, User, FolderOpen, Loader2, Search, CheckCircle2 } from 'lucide-react';

// IMPORT MODALS
import ConfirmationModal from '../Team/ConfirmationModal';
import SuccessModal from '../Team/SuccessModal';

export default function TransferTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Multi-select for source
  const [fromAgents, setFromAgents] = useState<string[]>([]);
  const [targetAgent, setTargetAgent] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(0);
  
  // Default status
  const [targetStatus, setTargetStatus] = useState<'New' | 'Shuffled'>('New');
  
  const [fromSearch, setFromSearch] = useState('');

  // MODAL STATES
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadAgents = async () => {
      const { data } = await supabase.from('crm_users').select('id, real_name, role').in('role', ['conversion', 'retention']).order('real_name');
      if (data) setAgents(data);
      setLoading(false);
    };
    loadAgents();
  }, []);

  // Update folders when ANY source agent changes
  useEffect(() => {
    if (fromAgents.length === 0) { setFolders([]); return; }
    
    const loadData = async () => {
      let allCounts: any = {};
      
      for (const agentId of fromAgents) {
         const { data } = await supabase.rpc('get_agent_folder_counts', { agent_uuid: agentId });
         if(data) {
             data.forEach((f:any) => {
                 allCounts[f.name] = (allCounts[f.name] || 0) + f.count;
             });
         }
      }
      setFolders(Object.keys(allCounts).map(k => ({ name: k, count: allCounts[k] })));
    };
    loadData();
  }, [fromAgents]);

  const toggleFromAgent = (id: string) => {
      if(fromAgents.includes(id)) setFromAgents(prev => prev.filter(x => x !== id));
      else setFromAgents(prev => [...prev, id]);
  };

  // 1. INITIATE: Check and open modal
  const handleInitiate = () => {
    if (fromAgents.length === 0 || !selectedFolder) return;
    setShowConfirm(true);
  };

  // 2. EXECUTE: The actual logic
  const executeTransfer = async () => {
    setProcessing(true);
    let totalMoved = 0; 
    
    try {
        for (const agentId of fromAgents) {
            if(agentId === targetAgent) continue;
            
            const { data, error } = await supabase.rpc('transfer_leads_v2', {
                from_agent_id: agentId,
                to_agent_id: targetAgent, 
                folder_name: selectedFolder,
                limit_count: limit > 0 ? Math.floor(limit / fromAgents.length) : 1000000,
                target_status: targetStatus 
            });

            if (error) throw error;
            totalMoved += (data as number) || 0; 
        }
        
        setShowConfirm(false);
        
        if (totalMoved === 0) {
            alert("Warning: 0 Leads were transferred. Check if the folder is empty or agents have no leads.");
        } else {
            setShowSuccess(true);
        }
        
    } catch (err: any) {
        alert("CRITICAL ERROR: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  // --- THE FIX IS HERE ---
  const handleSuccessClose = () => {
    setShowSuccess(false);
    // REMOVED: window.location.reload(); 
    
    // ADDED: Reset the form instead. This keeps you on the same tab!
    setFromAgents([]);       // Deselect agents
    setSelectedFolder(null); // Deselect folder
    setTargetAgent(null);    // Reset target
    setLimit(0);             // Reset limit
    // Note: This forces the user to select again, ensuring data counts are refreshed.
  };

  const filteredAgents = agents.filter(a => a.real_name.toLowerCase().includes(fromSearch.toLowerCase()));
  
  const totalAvailable = folders.find(f => f.name === selectedFolder)?.count || 0;
  const estimatedMove = limit > 0 && limit < totalAvailable ? limit : totalAvailable;

  if (loading) return <Loader2 className="animate-spin mx-auto mt-10" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* 1. FROM */}
      <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
         <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg"><User size={18} className="text-blue-400" /></div>
                <h3 className="font-bold text-white text-sm tracking-wide">SOURCE AGENTS</h3>
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Search..." value={fromSearch} onChange={e => setFromSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
             </div>
         </div>
         <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
            <button onClick={() => setFromAgents(agents.map(a => a.id))} className="w-full text-right text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase mb-1 px-2 tracking-wider">Select All</button>
            {filteredAgents.map(a => {
                const isSelected = fromAgents.includes(a.id);
                return (
                    <div key={a.id} onClick={() => toggleFromAgent(a.id)}
                        className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{a.real_name}</span>
                        {isSelected && <CheckCircle2 size={16} className="text-blue-400" />}
                    </div>
                );
            })}
         </div>
      </div>

      {/* 2. SELECT FOLDER */}
      <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
         <div className="p-5 border-b border-white/5 flex items-center gap-3 bg-white/5">
            <div className="p-2 bg-yellow-500/20 rounded-lg"><FolderOpen size={18} className="text-yellow-400" /></div>
            <h3 className="font-bold text-white text-sm tracking-wide">SELECT DATA</h3>
         </div>
         {fromAgents.length > 0 ? (
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                {folders.map(f => (
                    <div key={f.name} onClick={() => setSelectedFolder(f.name)}
                        className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${selectedFolder === f.name ? 'bg-yellow-600/20 border-yellow-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                        <span className={`text-xs truncate max-w-37.5 font-mono ${selectedFolder === f.name ? 'text-white' : 'text-gray-400'}`}>{f.name}</span>
                        <span className="bg-black/40 px-2 py-0.5 rounded text-xs text-white border border-white/5">{f.count}</span>
                    </div>
                ))}
             </div>
         ) : <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">Select Source Agent First</div>}
      </div>

      {/* 3. DESTINATION */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col h-150 relative overflow-hidden shadow-2xl">
         <div className="absolute inset-0 bg-linear-to-bl from-fuchsia-500/10 to-transparent pointer-events-none"></div>
         
         <div className="flex-1 space-y-8 mt-4 relative z-10">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Target Destination</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-fuchsia-500 outline-none hover:bg-white/10 cursor-pointer appearance-none"
                    onChange={(e) => setTargetAgent(e.target.value === 'POOL' ? null : e.target.value)}
                    value={targetAgent || 'POOL'}
                >
                    <option className="text-black" value="POOL">📥 Return to Pool (Unassign)</option>
                    {agents.map(a => (<option className="text-black" key={a.id} value={a.id} disabled={fromAgents.includes(a.id)}>👤 {a.real_name}</option>))}
                </select>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">Status Protocol</label>
                <div className="flex bg-black/50 p-1 rounded-lg">
                    <button onClick={() => setTargetStatus('New')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${targetStatus === 'New' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>New</button>
                    <button onClick={() => setTargetStatus('Shuffled')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${targetStatus === 'Shuffled' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Shuffle</button>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Quantity Limit</label>
                <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} placeholder="0 (All)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-mono focus:border-fuchsia-500 outline-none" />
            </div>
         </div>

         <button onClick={handleInitiate} disabled={fromAgents.length === 0 || !selectedFolder || processing}
            className="w-full py-5 mt-4 bg-linear-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold uppercase tracking-[0.2em] rounded-xl shadow-[0_0_25px_rgba(192,38,211,0.4)] disabled:opacity-50 transition flex items-center justify-center gap-3 relative z-10 hover:scale-[1.02]">
            {processing ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />} TRANSFER ASSETS
         </button>
      </div>

      {/* --- MODALS --- */}
      <ConfirmationModal 
          isOpen={showConfirm}
          title="CONFIRM ASSET TRANSFER"
          message={`You are about to transfer up to ${estimatedMove} leads from ${fromAgents.length} agents.\n\nTarget: ${targetAgent ? 'Selected Agent' : 'The Pool'}\nStatus: ${targetStatus}`}
          type="info"
          onClose={() => setShowConfirm(false)}
          onConfirm={executeTransfer}
          loading={processing}
      />

      <SuccessModal 
          isOpen={showSuccess}
          title="TRANSFER COMPLETE"
          message="Leads have been successfully re-assigned."
          type="success"
          onClose={handleSuccessClose}
      />
    </div>
  );
}