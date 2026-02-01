import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FolderOpen, ArrowRight, CheckCircle2, Loader2, Crown, Search, Database, BarChart3 } from 'lucide-react';

export default function TeamLeaderTab() {
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedTL, setSelectedTL] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [maxAvailable, setMaxAvailable] = useState(0);
  const [tlStats, setTlStats] = useState<{safe: number, moveable: number, total: number} | null>(null);
  const [tlSearch, setTlSearch] = useState('');
  const [folderSearch, setFolderSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: tlData } = await supabase.from('crm_users').select('id, real_name').eq('role', 'team_leader');
      if (tlData) setTeamLeaders(tlData);
      const { data: folderData } = await supabase.rpc('get_unassigned_folder_counts');
      if (folderData) setFolders(folderData);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if(!selectedTL) { setTlStats(null); return; }
    const fetchStats = async () => {
        const { data } = await supabase.from('crm_leads').select('status').eq('assigned_to', selectedTL);
        if(data) {
            let safe = 0, moveable = 0;
            data.forEach((l: any) => {
                if(['Up sale','FTD','Call Back','Interested','Transferred'].includes(l.status)) safe++;
                else moveable++;
            });
            setTlStats({ safe, moveable, total: safe + moveable });
        }
    }
    fetchStats();
  }, [selectedTL]);

  useEffect(() => {
    if (selectedFolder) {
      const f = folders.find(fo => fo.name === selectedFolder);
      setMaxAvailable(f ? f.count : 0);
    }
  }, [selectedFolder, folders]);

  const handleExecute = async () => {
    if (!selectedTL || !selectedFolder || amount <= 0) return;
    setProcessing(true);
    const payload = [{ agent_id: selectedTL, count: amount, folder: selectedFolder }];
    const { error } = await supabase.rpc('distribute_leads_bulk', { payload });
    if (error) alert("Error: " + error.message);
    else window.location.reload();
    setProcessing(false);
  };

  const filteredTLs = teamLeaders.filter(tl => tl.real_name.toLowerCase().includes(tlSearch.toLowerCase()));
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()));

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* 1. SELECT TL */}
      <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
         <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg"><Crown size={18} className="text-indigo-400" /></div>
                <h3 className="font-bold text-white text-sm tracking-wide">TEAM LEADER</h3>
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Find TL..." value={tlSearch} onChange={e => setTlSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-indigo-500 outline-none transition-colors" />
             </div>
         </div>
         <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
            {filteredTLs.map(tl => (
                <div key={tl.id} onClick={() => setSelectedTL(tl.id)}
                    className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-300 ${selectedTL === tl.id ? 'bg-indigo-600/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${selectedTL === tl.id ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-500'}`}>{tl.real_name.substring(0,2).toUpperCase()}</div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-bold ${selectedTL === tl.id ? 'text-white' : 'text-gray-400'}`}>{tl.real_name}</span>
                            {selectedTL === tl.id && <span className="text-[10px] text-indigo-300">Selected Target</span>}
                        </div>
                    </div>
                    {selectedTL === tl.id && <CheckCircle2 size={18} className="text-indigo-500" />}
                </div>
            ))}
         </div>
         {selectedTL && tlStats && (
             <div className="p-4 bg-indigo-950/30 border-t border-indigo-500/20 backdrop-blur-md">
                 <div className="flex items-center gap-2 mb-2 text-indigo-400 text-xs font-bold uppercase tracking-wider"><BarChart3 size={12} /> Current Stash</div>
                 <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-white/5 rounded-lg p-2"><p className="text-[9px] text-gray-500 uppercase font-bold">Total</p><p className="text-white font-black text-lg">{tlStats.total}</p></div>
                     <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/10"><p className="text-[9px] text-green-500 uppercase font-bold">Safe</p><p className="text-green-400 font-black text-lg">{tlStats.safe}</p></div>
                     <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/10"><p className="text-[9px] text-blue-500 uppercase font-bold">Moveable</p><p className="text-blue-400 font-black text-lg">{tlStats.moveable}</p></div>
                 </div>
             </div>
         )}
      </div>

      {/* 2. FOLDER */}
      <div className="flex flex-col bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-150">
         <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-white/5">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg"><FolderOpen size={18} className="text-yellow-400" /></div>
                <h3 className="font-bold text-white text-sm tracking-wide">SOURCE FOLDER</h3>
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Filter folders..." value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white focus:border-yellow-500 outline-none transition-colors" />
             </div>
         </div>
         <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
            {filteredFolders.map(f => (
                <div key={f.name} onClick={() => setSelectedFolder(f.name)}
                    className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${selectedFolder === f.name ? 'bg-yellow-600/20 border-yellow-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Database size={14} className={selectedFolder === f.name ? 'text-yellow-400' : 'text-gray-600'} />
                        <span className={`text-xs font-mono truncate max-w-30 ${selectedFolder === f.name ? 'text-white' : 'text-gray-400'}`}>{f.name}</span>
                    </div>
                    <span className="text-xs bg-black/30 px-2 py-0.5 rounded text-gray-300 border border-white/5">{f.count}</span>
                </div>
            ))}
         </div>
      </div>

      {/* 3. CONTROL */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-between h-150 relative overflow-hidden shadow-2xl">
         <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/10 to-transparent pointer-events-none"></div>
         <div className="text-center mt-10 relative z-10">
            <p className="text-gray-500 text-xs uppercase font-bold tracking-[0.3em] mb-4">Total Available</p>
            <p className="text-7xl font-black text-white drop-shadow-lg">{maxAvailable}</p>
         </div>
         <div className="relative z-10">
            <label className="text-center block text-indigo-400 font-bold uppercase tracking-widest text-sm mb-6">Allocation Amount</label>
            <div className="relative flex items-center justify-center mb-8">
                <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} max={maxAvailable}
                    className="w-full bg-black/50 border border-indigo-500/50 rounded-2xl py-6 text-6xl font-black text-white text-center focus:outline-none focus:border-indigo-400 focus:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all tabular-nums" />
            </div>
            <input type="range" min="0" max={maxAvailable} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
         </div>
         <button onClick={handleExecute} disabled={!selectedTL || !selectedFolder || amount <= 0 || processing}
            className="w-full py-5 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-3 relative z-10 hover:scale-[1.02]">
            {processing ? <Loader2 className="animate-spin" /> : <ArrowRight />} <span>EXECUTE TRANSFER</span>
         </button>
      </div>
    </div>
  );
}