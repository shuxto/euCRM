import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, FolderOpen, Zap, Loader2, Search, CheckCircle2, Database } from 'lucide-react';

// IMPORT YOUR MODALS
import ConfirmationModal from '../Team/ConfirmationModal';
import SuccessModal from '../Team/SuccessModal';

function NumberTicker({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
        let start = displayValue;
        const end = value;
        if (start === end) return;
        const duration = 500;
        const startTime = performance.now();
        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4); 
            setDisplayValue(Math.floor(start + (end - start) * ease));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [value]);
    return <span>{displayValue}</span>;
}

export default function DistributeTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  
  const [processing, setProcessing] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  // --- NEW MODAL STATES ---
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        const { data: agentData } = await supabase.from('crm_users').select('id, real_name, role').in('role', ['conversion', 'retention']).order('real_name');
        if (agentData) setAgents(agentData);
        const { data: folderData } = await supabase.rpc('get_unassigned_folder_counts');
        if (folderData) setFolders(folderData);
    };
    loadData();
  }, []);

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()));
  const filteredAgents = agents.filter(a => a.real_name.toLowerCase().includes(agentSearch.toLowerCase()));

  const totalLeads = selectedFolders.reduce((sum, fName) => {
      const f = folders.find(fo => fo.name === fName);
      return sum + (f ? f.count : 0);
  }, 0);
  
  const perAgent = selectedAgents.length > 0 ? Math.floor(totalLeads / selectedAgents.length) : 0;
  const remainder = selectedAgents.length > 0 ? totalLeads % selectedAgents.length : 0;

  const toggleAgent = (id: string) => {
      if (selectedAgents.includes(id)) setSelectedAgents(prev => prev.filter(x => x !== id));
      else setSelectedAgents(prev => [...prev, id]);
  };

  const toggleFolder = (name: string) => {
      if (selectedFolders.includes(name)) setSelectedFolders(prev => prev.filter(x => x !== name));
      else setSelectedFolders(prev => [...prev, name]);
  };

  // 1. BUTTON CLICK: Just opens the modal
  const handleInitiate = () => {
      if (totalLeads === 0 || selectedAgents.length === 0) return;
      setShowConfirm(true);
  };

  // 2. CONFIRM CLICK: Runs the actual logic
  const executeDistribution = async () => {
      setProcessing(true);
      try {
        for (const folderName of selectedFolders) {
            const f = folders.find(fo => fo.name === folderName);
            if (!f) continue;
            
            const count = f.count;
            const perAgentThisFolder = Math.floor(count / selectedAgents.length);
            let rem = count % selectedAgents.length;
            
            const folderPayload = selectedAgents.map(agentId => {
                const amount = perAgentThisFolder + (rem > 0 ? 1 : 0);
                if (rem > 0) rem--;
                return { agent_id: agentId, count: amount, folder: folderName };
            });
            
            // 1. Move the leads
            await supabase.rpc('distribute_leads_bulk', { payload: folderPayload });

            // 2. SEND NOTIFICATIONS TO AGENTS
            const notifications = folderPayload.map((item: any) => ({
                user_id: item.agent_id,
                title: '🎁 New Leads Assigned',
                message: `You have received ${item.count} new leads from folder "${folderName}". Good luck!`,
                is_read: false
            }));

            // Don't await this strictly to keep UI fast
            await supabase.from('crm_notifications').insert(notifications);
        }
        
        // SUCCESS: Close confirm, open success
        setShowConfirm(false);
        setShowSuccess(true);
        
      } catch (err: any) { 
          alert("Error: " + err.message); 
      }
      setProcessing(false);
  };

  // 3. SUCCESS CLOSE: Reloads page
  const handleSuccessClose = () => {
      setShowSuccess(false);
      window.location.reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* 1. FOLDERS */}
        <div className="lg:col-span-3 flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
             <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-500/20 rounded-lg"><FolderOpen size={18} className="text-blue-400" /></div>
                     <h3 className="font-bold text-white text-sm tracking-wide">SOURCE DATA</h3>
                 </div>
                 <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Filter folders..." value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                 </div>
             </div>
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                {filteredFolders.map(f => {
                    const isSelected = selectedFolders.includes(f.name);
                    return (
                        <div key={f.name} onClick={() => toggleFolder(f.name)}
                            className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-300 group ${isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Database size={14} className={isSelected ? 'text-blue-400' : 'text-gray-600'} />
                                <span className={`text-xs font-mono truncate ${isSelected ? 'text-white font-bold' : 'text-gray-400 group-hover:text-gray-200'}`}>{f.name}</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded border ${isSelected ? 'bg-blue-500 text-white border-blue-400' : 'bg-black/40 text-gray-500 border-white/5'}`}>{f.count}</span>
                        </div>
                    );
                })}
             </div>
        </div>

        {/* 2. ENGINE */}
        <div className="lg:col-span-6 flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden h-150 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
            
            <div className="flex-1 flex flex-col justify-center items-center text-center w-full max-w-md mx-auto space-y-12 relative z-10">
                <div>
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.3em] mb-4">Total Input Volume</p>
                    <div className="text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl"><NumberTicker value={totalLeads} /></div>
                </div>
                
                <div className="grid grid-cols-2 gap-12 border-t border-white/10 pt-8 w-full">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-widest">Agents</p>
                        <p className="text-4xl font-bold text-white"><NumberTicker value={selectedAgents.length} /></p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-widest">Remainder</p>
                        <p className="text-4xl font-bold text-gray-600">{remainder}</p>
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-2xl p-6 backdrop-blur-md w-full">
                    <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2">Calculated Output</p>
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-6xl font-black text-white tabular-nums"><NumberTicker value={perAgent} /></span>
                        <span className="text-sm text-blue-300 font-bold uppercase">/ Agent</span>
                    </div>
                </div>
            </div>

            <div className="mt-6 relative z-10">
                <button onClick={handleInitiate} disabled={totalLeads === 0 || selectedAgents.length === 0 || processing}
                    className="w-full py-5 bg-linear-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]">
                    {processing ? <Loader2 className="animate-spin" /> : <Zap size={20} fill="currentColor" />} INITIATE DISTRIBUTION
                </button>
            </div>
        </div>

        {/* 3. TEAM */}
        <div className="lg:col-span-3 flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
             <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
                 <div className="flex items-center gap-3 justify-between">
                     <h3 className="font-bold text-white text-sm tracking-wide">TARGET SQUAD</h3>
                     <div className="p-2 bg-green-500/20 rounded-lg"><Users size={18} className="text-green-400" /></div>
                 </div>
                 <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Find agent..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-green-500 outline-none transition-colors" />
                 </div>
             </div>
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                <button onClick={() => setSelectedAgents(agents.map(a => a.id))} className="w-full text-right text-[10px] text-green-400 hover:text-green-300 font-bold uppercase mb-1 px-2 tracking-wider">Select All Units</button>
                {filteredAgents.map(a => {
                    const isSelected = selectedAgents.includes(a.id);
                    return (
                        <div key={a.id} onClick={() => toggleAgent(a.id)}
                            className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all duration-300 ${isSelected ? 'bg-green-600/20 border-green-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-gray-800 text-gray-500'}`}>
                                    {a.real_name.substring(0,2).toUpperCase()}
                                </div>
                                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{a.real_name}</span>
                            </div>
                            {isSelected && <CheckCircle2 size={16} className="text-green-500" />}
                        </div>
                    );
                })}
             </div>
        </div>

        {/* --- MODALS --- */}
        <ConfirmationModal 
            isOpen={showConfirm}
            title="CONFIRM DISTRIBUTION"
            message={`You are about to distribute ${totalLeads} leads among ${selectedAgents.length} agents.\n\nEstimated: ~${perAgent} leads per agent.`}
            type="info" // Use 'info' or 'danger' depending on preference
            onClose={() => setShowConfirm(false)}
            onConfirm={executeDistribution}
            loading={processing}
        />

        <SuccessModal 
            isOpen={showSuccess}
            title="DISTRIBUTION COMPLETE"
            message={`Successfully distributed ${totalLeads} leads.`}
            type="success"
            onClose={handleSuccessClose}
        />
    </div>
  );
}