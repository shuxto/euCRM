// import { io } from 'socket.io-client'; // REMOVED
import { useSocket } from '../../context/SocketContext'; // 👈 NEW
import { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, PenTool, History, Trash2, Server, ArrowRightLeft, Edit2, AlertTriangle, X, Briefcase } from 'lucide-react'; 
import { supabase } from '../../lib/supabase'; 
import ProfileHeader from './ProfileHeader';
import KYCSummary from './KYCSummary';
import KYCForm from './KYCForm';
import PlatformRegistration from './PlatformRegistration';
import LeadTransactions from './LeadTransactions';
import LeadTradeHistory from './LeadTradeHistory';
import LeadFinancials from './LeadFinancials';
import LeadActivePositions from './LeadActivePositions'; // 👈 NEW IMPORT
import TradingAccountsTab from './TradingAccountsTab'; 

// ⚠️ API KEY from twelwedata.ts
// const MARKET_SOCKET_URL = "wss://trading-copy-production.up.railway.app"; // MOVED TO CONTEXT

interface LeadProfilePageProps {
  lead: any;
  onBack: () => void;
}

export default function LeadProfilePage({ lead: initialLead, onBack }: LeadProfilePageProps) {
  // --- 1. LOCAL STATE FIX ---
  const [activeLead, setActiveLead] = useState(initialLead);

  // Sync state if the parent prop changes
  useEffect(() => { setActiveLead(initialLead); }, [initialLead]);

  // The "Self-Heal" Function
  const refreshLeadData = async () => {
      const { data } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', activeLead.id)
          .single();
      
      if (data) {
          setActiveLead(data);
          setDbTrades([]); 
      }
  };

  // --- TABS ---
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'update' | 'platform' | 'transactions' | 'history' | 'accounts'>(() => {
    const saved = localStorage.getItem('crm_profile_active_tab');
    return (saved as any) || 'overview';
  });

  useEffect(() => { localStorage.setItem('crm_profile_active_tab', activeTab); }, [activeTab]);

  // --- STATE ---
  const [dbTrades, setDbTrades] = useState<any[]>([]); // Static DB Data
  // const [livePrices, setLivePrices] = useState<Record<string, number>>({}); // REMOVED: Managed by Context
  const [financials, setFinancials] = useState({
    mainBalance: 0,
    roomBalance: 0,
    totalEquity: 0,
    openPnL: 0,
    rooms: [] as any[]
  });
  const [loadingData, setLoadingData] = useState(false);

  // --- MANIPULATION STATE ---
  const [editingTrade, setEditingTrade] = useState<any>(null);
  const [manipulatePrice, setManipulatePrice] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- 1. FETCH STATIC DB DATA ---
  useEffect(() => {
    if (activeLead?.trading_account_id && activeTab === 'overview') {
        fetchOverviewData();

        // Listen for DB changes
        const channel = supabase
            .channel('crm-live-db')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${activeLead.trading_account_id}` }, () => fetchOverviewData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts', filter: `user_id=eq.${activeLead.trading_account_id}` }, () => fetchOverviewData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }
  }, [activeLead, activeTab]);

  const fetchOverviewData = async () => {
    if (dbTrades.length === 0) setLoadingData(true);
    try {
        const userId = activeLead.trading_account_id;
        
        // 1. Get Main Wallet
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const mainBal = profile?.balance || 0;

        // 2. Get Trading Rooms
        const { data: rooms } = await supabase
            .from('trading_accounts')
            .select('id, name, balance')
            .eq('user_id', userId);
            
        const roomsList = rooms || [];
        const roomsBal = roomsList.reduce((sum, room) => sum + (room.balance || 0), 0);

        // 3. Get Active Trades
        const { data: trades } = await supabase.from('trades').select('*').eq('user_id', userId).eq('status', 'open');
        
        setDbTrades(trades || []);
        
        setFinancials(prev => ({ 
            ...prev, 
            mainBalance: mainBal, 
            roomBalance: roomsBal,
            rooms: roomsList
        }));

    } catch (error) { console.error("Error:", error); }
    setLoadingData(false);
  };

  // --- 2. SOCKET.IO CONNECTION (Stable) ---
  const { socket } = useSocket();

  useEffect(() => {
    // Safety Checks
    if (dbTrades.length === 0 || activeTab !== 'overview' || !socket) return;

    // 1. Prepare symbols string
    const symbols = Array.from(new Set(dbTrades.map(t => t.symbol))).join(',');

    // 2. Subscribe to these symbols using the SHARED socket
    if (socket.connected) {
        socket.emit('subscribe', { action: "subscribe", params: { symbols } });
    }
  }, [dbTrades.length, activeTab, socket]); 
  
  // --- 3. (REMOVED) CALCULATE LIVE PnL ---
  // We no longer calculate live PnL here to prevent re-renders. 
  // This logic is moved to <LeadFinancials /> and <LeadActivePositions />

  // --- 4. MANIPULATION HANDLERS ---
  const handleEditClick = (trade: any) => {
      setEditingTrade(trade);
      setManipulatePrice(trade.entry_price.toString());
      setShowConfirm(false);
  };

  const handleUpdateEntry = async () => {
      if (!editingTrade || !manipulatePrice) return;
      setIsUpdating(true);

      const newPrice = parseFloat(manipulatePrice);

      const { error } = await supabase
          .from('trades')
          .update({ entry_price: newPrice })
          .eq('id', editingTrade.id);

      if (error) {
          alert("Error: " + error.message);
      } else {
          setDbTrades(prev => prev.map(t => 
             t.id === editingTrade.id ? { ...t, entry_price: newPrice } : t
          ));
          
          setEditingTrade(null);
          setShowConfirm(false);
      }
      setIsUpdating(false);
  };

  // --- NOTES LOGIC ---
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [userRole, setUserRole] = useState(''); 
  useEffect(() => { if(activeLead?.id) { fetchNotes(); fetchUserRole(); } }, [activeLead.id]);
  const fetchUserRole = async () => { const { data: { user } } = await supabase.auth.getUser(); setUserRole(user?.user_metadata?.role || 'conversion'); };
  const fetchNotes = async () => { const { data } = await supabase.from('crm_lead_notes').select('*').eq('lead_id', activeLead.id).order('created_at', { ascending: false }); if (data) setNotes(data); };
  const handleSaveNote = async () => { if (!newNote.trim()) return; setSavingNote(true); const { data: { user } } = await supabase.auth.getUser(); await supabase.from('crm_lead_notes').insert({ lead_id: activeLead.id, content: newNote, agent_email: user?.email }); setNewNote(''); fetchNotes(); setSavingNote(false); };
  const handleDeleteNote = async (id: string) => { if(confirm('Delete?')) { await supabase.from('crm_lead_notes').delete().eq('id', id); fetchNotes(); } };
  const canDelete = ['admin', 'manager', 'retention'].includes(userRole);

  if (!activeLead) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 p-6 max-w-400 mx-auto w-full relative">
      <ProfileHeader lead={activeLead} onBack={onBack} />

      {/* TABS */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-1 overflow-x-auto">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={16}/>} label="Overview" />
        
        <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Briefcase size={16}/>} label="Trading Accounts" />
        
        <TabButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<ArrowRightLeft size={16}/>} label="Transactions" />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={16}/>} label="Trade History" />
        <TabButton active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} icon={<FileText size={16}/>} label="KYC Summary" />
        <TabButton active={activeTab === 'update'} onClick={() => setActiveTab('update')} icon={<PenTool size={16}/>} label="Update KYC" />
        <TabButton active={activeTab === 'platform'} onClick={() => setActiveTab('platform')} icon={<Server size={16}/>} label="Platform Account" />
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* LEFT: FINANCIALS & TRADES */}
          <div className="col-span-12 lg:col-span-9 space-y-6"> 
            
            <LeadFinancials 
                mainBalance={financials.mainBalance} 
                rooms={financials.rooms}
                trades={dbTrades}
                loading={loadingData} 
            />

            {/* LIVE MARKET TABLE */}
            <LeadActivePositions 
                trades={dbTrades} 
                onEditTrade={handleEditClick}
            />

          </div>

          {/* RIGHT: NOTES */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="glass-panel p-6 rounded-xl border border-white/5 h-full flex flex-col min-h-125">
              <h3 className="text-lg font-bold text-white mb-4">Agent Notes</h3>
              <div className="relative">
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white resize-none" placeholder="Type note..."></textarea>
                <button onClick={handleSaveNote} disabled={savingNote || !newNote.trim()} className="cursor-pointer w-full mt-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition text-xs uppercase">{savingNote ? 'Saving...' : 'Save Note'}</button>
              </div>
              <div className="mt-8 space-y-4 flex-1 overflow-y-auto max-h-100 pr-2 custom-scrollbar">
                {notes.map((note) => (
                    <div key={note.id} className="p-4 bg-white/5 rounded-xl border-l-2 border-blue-500 relative group">
                        <p className="text-sm text-gray-300">{note.content}</p>
                        <div className="flex justify-between mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-500">
                             <span>{note.agent_email?.split('@')[0]}</span>
                             <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        {canDelete && <button onClick={() => handleDeleteNote(note.id)} className="cursor-pointer absolute top-2 right-2 p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded"><Trash2 size={12} /></button>}
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANIPULATION MODAL (Overlay) */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e232d] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative">
                
                {/* 1. INPUT SCREEN */}
                {!showConfirm ? (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit2 size={18} className="text-blue-400" />
                                Edit Entry Price
                            </h3>
                            <button onClick={() => setEditingTrade(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Symbol</span>
                                    <span>Current Entry</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-white">
                                    <span>{editingTrade.symbol}</span>
                                    <span>{Number(editingTrade.entry_price).toLocaleString()}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-blue-400 font-bold uppercase mb-1.5 block">New Entry Price</label>
                                <input 
                                    type="number" 
                                    value={manipulatePrice}
                                    onChange={(e) => setManipulatePrice(e.target.value)}
                                    className="w-full bg-black/30 border border-blue-500/50 rounded-lg p-3 text-white text-lg font-mono focus:outline-none focus:border-blue-400 transition-colors"
                                    placeholder="Enter new price..."
                                />
                            </div>

                            <button 
                                onClick={() => setShowConfirm(true)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors mt-2"
                            >
                                Update Price
                            </button>
                        </div>
                    </div>
                ) : (
                    /* 2. CONFIRMATION POPUP */
                    <div className="p-6 text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            This will change the entry price from <b className="text-white">{Number(editingTrade.entry_price).toLocaleString()}</b> to <b className="text-blue-400">{Number(manipulatePrice).toLocaleString()}</b> immediately.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateEntry}
                                disabled={isUpdating}
                                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isUpdating ? 'Updating...' : 'Yes, Confirm'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* NEW ACCOUNTS TAB */}
      {activeTab === 'accounts' && <TradingAccountsTab lead={activeLead} />}

      {/* OTHER TABS */}
      {activeTab === 'transactions' && <LeadTransactions lead={activeLead} />}
      {activeTab === 'history' && <LeadTradeHistory lead={activeLead} />}
      {activeTab === 'resume' && <KYCSummary lead={activeLead} />}
      {activeTab === 'update' && <KYCForm lead={activeLead} />}
      
      {/*  THIS IS THE FIX: Using activeLead and the refresh function */}
      {activeTab === 'platform' && (
        <PlatformRegistration 
            lead={activeLead} 
            onSuccess={refreshLeadData} 
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button onClick={onClick} className={`cursor-pointer whitespace-nowrap flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg transition-all border-b-2 ${active ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5' : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'}`}>
          {icon} {label}
        </button>
    );
}