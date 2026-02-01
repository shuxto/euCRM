import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    Wallet, Plus, ArrowRightLeft, TrendingUp, ArrowDownLeft, 
    Loader2, Briefcase, X, AlertCircle, Building2, Landmark, 
    CreditCard, Bitcoin, HelpCircle, ArrowLeft, Trash2, AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SuccessModal from '../Team/SuccessModal';

interface Props {
  lead: any;
}

export default function TradingAccountsTab({ lead }: Props) {
  const [loading, setLoading] = useState(true);
  const [mainBalance, setMainBalance] = useState(0);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // ACTIONS
  const [isCreatingOpen, setIsCreatingOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // TRANSFER MODAL STATE
  const [transferMode, setTransferMode] = useState<{ 
      type: 'deposit' | 'withdraw' | 'main_transfer', 
      accountId?: string, 
      accountName?: string 
  } | null>(null);
  
  const [amount, setAmount] = useState('');
  const [selectedTargetRoom, setSelectedTargetRoom] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // DEPOSIT (ADD FUNDS) STATE
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'card' | 'crypto' | 'wire' | 'other' | null>(null);
  const [addAmount, setAddAmount] = useState('');

  // DELETE MODAL STATE
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; account: any | null }>({ isOpen: false, account: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // SUCCESS MODAL
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  useEffect(() => {
    if (!lead?.trading_account_id) {
        setLoading(false);
        return;
    }

    fetchData();
    
    const channel = supabase.channel('crm-accounts-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts', filter: `user_id=eq.${lead.trading_account_id}` }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${lead.trading_account_id}` }, () => fetchData())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lead]);

  const fetchData = async () => {
    try {
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', lead.trading_account_id).single();
        if (profile) setMainBalance(profile.balance);

        const { data: rooms } = await supabase.from('trading_accounts').select('*').eq('user_id', lead.trading_account_id).order('created_at', { ascending: true });
        
        if (rooms) {
             const activeAccounts = rooms.filter(acc => !acc.name?.includes('DELETED_'));
             setAccounts(activeAccounts);
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const totalRoomBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const totalNetWorth = mainBalance + totalRoomBalance;

  // --- 1. CREATE ACCOUNT ---
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    setIsCreating(true);
    try {
        const { data, error } = await supabase.from('trading_accounts').insert({
            user_id: lead.trading_account_id,
            name: newAccountName,
            balance: 0, 
        }).select().single();

        if (error) throw error;

        if (data) setAccounts(prev => [...prev, data]);
        
        setNewAccountName('');
        setIsCreatingOpen(false); 
        
        setSuccessMessage({ title: 'ROOM DEPLOYED', message: `Trading room "${newAccountName}" created.` });
        setSuccessOpen(true);

    } catch (e: any) { alert("Error: " + e.message); } finally { setIsCreating(false); }
  };

  // --- 2. ADD BALANCE TO MAIN WALLET (DEPOSIT) ---
  const handleAddMainFunds = async () => {
      if (!addAmount || isNaN(Number(addAmount))) return;
      setIsCreating(true); 
      const val = Number(addAmount);

      try {
          const { data: { user: agent } } = await supabase.auth.getUser();
          if (!agent) throw new Error("Agent session missing");

          const { error } = await supabase.rpc('crm_deposit_funds', {
              p_user_id: lead.trading_account_id,
              p_amount: val,
              p_method: `${depositMethod?.toUpperCase()} Deposit`,
              p_agent_id: agent.id
          });
          
          if (error) throw error;

          await fetchData();
          
          setIsAddingFunds(false);
          setDepositMethod(null);
          setAddAmount('');
          
          setSuccessMessage({ title: 'FUNDS ADDED', message: `$${val.toLocaleString()} added to Main Wallet.` });
          setSuccessOpen(true);

      } catch(e: any) { 
          alert("Error: " + e.message); 
      } finally { 
          setIsCreating(false); 
      }
  };

  // --- 3. TRANSFER LOGIC ---
  const handleTransfer = async () => {
    if (!transferMode || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    setIsTransferring(true);
    const val = Number(amount);
    
    try {
        if (transferMode.type === 'main_transfer') {
             if (!selectedTargetRoom) throw new Error("Select a room");
             if (mainBalance < val) throw new Error("Insufficient Main Wallet Funds");
             
             const { error: e1 } = await supabase.rpc('admin_adjust_balance', {
                 p_user_id: lead.trading_account_id,
                 p_amount: val,
                 p_type: 'withdrawal',
                 p_method: `Main -> Room`
             });
             if (e1) throw e1;

             const { error: e2 } = await supabase.from('trading_accounts')
                .update({ balance: accounts.find(a => a.id === selectedTargetRoom).balance + val })
                .eq('id', selectedTargetRoom);
             if (e2) throw e2;

             setSuccessMessage({ title: 'TRANSFER COMPLETE', message: `$${val.toLocaleString()} moved to Room.` });
        }
        else if (transferMode.type === 'withdraw') {
             const room = accounts.find(a => a.id === transferMode.accountId);
             if (room.balance < val) throw new Error("Insufficient Room Funds");

             const { error: e1 } = await supabase.rpc('admin_adjust_balance', {
                 p_user_id: lead.trading_account_id,
                 p_amount: val,
                 p_type: 'deposit',
                 p_method: `${room.name} -> Main`
             });
             if (e1) throw e1;

             const { error: e2 } = await supabase.from('trading_accounts')
                .update({ balance: room.balance - val })
                .eq('id', transferMode.accountId);
             if (e2) throw e2;

             setSuccessMessage({ title: 'TRANSFER COMPLETE', message: `$${val.toLocaleString()} moved to Main Wallet.` });
        }

        await fetchData();
        setTransferMode(null);
        setAmount('');
        setSelectedTargetRoom('');
        setSuccessOpen(true);

    } catch (e: any) {
        alert("Transfer Failed: " + e.message);
    } finally {
        setIsTransferring(false);
    }
  };

  // --- 4. DELETE ACCOUNT LOGIC ---
  const executeDelete = async () => {
    if (!deleteModal.account) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.rpc('admin_delete_account', { 
        p_account_id: deleteModal.account.id 
      });

      if (error) throw error;

      setDeleteModal({ isOpen: false, account: null });
      setSuccessMessage({ title: 'UNIT DELETED', message: 'Account removed & funds returned to Main Wallet.' });
      setSuccessOpen(true);
      await fetchData();

    } catch (err: any) {
      alert("Delete Failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>;

  if (!lead.trading_account_id) {
      return (
          <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/5 text-center animate-in fade-in">
              <div className="inline-flex p-4 rounded-full bg-white/5 mb-4 text-gray-500"><AlertCircle size={32} /></div>
              <h3 className="text-lg font-bold text-white mb-2">Client Not Registered</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">This lead does not have a linked Trading Account ID.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      <SuccessModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title={successMessage.title} message={successMessage.message} />

      {/* TOP STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MAIN WALLET */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-linear-to-r from-blue-600/10 to-purple-600/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Wallet size={120} className="text-white"/></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Wallet size={14}/> Main Wallet
                    </h2>
                    <div className="text-4xl font-mono font-bold text-white tracking-tight">
                        ${mainBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                    <button onClick={() => setIsAddingFunds(true)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold transition border border-green-500/20 cursor-pointer">
                        <Plus size={14} /> Deposit
                    </button>
                    <button onClick={() => setTransferMode({ type: 'main_transfer' })} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition border border-blue-500/20 cursor-pointer">
                        <ArrowRightLeft size={14} /> Transfer
                    </button>
                </div>
             </div>
          </div>

          {/* Total Net Worth */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-linear-to-r from-emerald-600/10 to-teal-600/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={80} className="text-white"/></div>
              <div className="relative z-10 flex flex-col justify-center h-full">
                <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <TrendingUp size={14}/> Total Net Worth
                </h2>
                <div className="text-4xl font-mono font-bold text-white tracking-tight">
                    ${totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Combined balance across all wallets & rooms.</p>
             </div>
          </div>
      </div>

      {/* ACCOUNTS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Briefcase size={18} className="text-yellow-400"/> Trading Rooms
                <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">{accounts.length}</span>
            </h3>
            <button onClick={() => setIsCreatingOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-cyan-500/20 cursor-pointer">
                <Plus size={14} /> New Room
            </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
            {accounts.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center text-gray-500 text-sm">No trading accounts active.</div>
            ) : accounts.map(acc => (
                <div key={acc.id} className="glass-panel p-5 rounded-xl border border-white/5 hover:border-white/10 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500"><Building2 size={20} /></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white text-sm">{acc.name}</h4>
                                {/* DELETE BUTTON */}
                                <button 
                                    onClick={() => setDeleteModal({ isOpen: true, account: acc })}
                                    className="text-gray-600 hover:text-red-500 transition-colors p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                    title="Delete Account"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">ID: {acc.id.split('-')[0]}...</span>
                        </div>
                    </div>
                    <div className="text-right w-full sm:w-auto">
                        <div className="font-mono font-bold text-white text-xl">${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Available Margin</span>
                    </div>
                    <div className="w-full sm:w-auto">
                        <button onClick={() => setTransferMode({ type: 'withdraw', accountId: acc.id, accountName: acc.name })} className="w-full sm:w-auto px-6 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2">
                            <ArrowRightLeft size={14} /> Transfer
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* MODAL: CREATE ROOM */}
      <AnimatePresence>
      {isCreatingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e232d] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative"
              >
                  <button onClick={() => setIsCreatingOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"><X size={18}/></button>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Plus size={18} className="text-cyan-400"/> Create Trading Room</h3>
                  <div className="space-y-4">
                      <input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Room Name" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none" autoFocus />
                      <button onClick={handleCreateAccount} disabled={!newAccountName || isCreating} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50">{isCreating ? <Loader2 className="animate-spin mx-auto" size={16}/> : 'Create Room'}</button>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* MODAL: ADD FUNDS (DEPOSIT) */}
      <AnimatePresence>
      {isAddingFunds && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e232d] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative"
              >
                  <button onClick={() => { setIsAddingFunds(false); setDepositMethod(null); }} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"><X size={18}/></button>
                  
                  <div className="text-center mb-6">
                      <h3 className="text-lg font-bold text-white uppercase flex items-center justify-center gap-2">
                          <ArrowDownLeft className="text-[#21ce99]" size={20} /> Deposit Funds
                      </h3>
                  </div>

                  {!depositMethod ? (
                      <div className="grid grid-cols-2 gap-3">
                          {[
                              { id: 'card', label: 'Card', icon: <CreditCard size={20}/>, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                              { id: 'crypto', label: 'Crypto', icon: <Bitcoin size={20}/>, color: 'text-[#F0B90B]', bg: 'bg-[#F0B90B]/10' },
                              { id: 'wire', label: 'Wire', icon: <Landmark size={20}/>, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                              { id: 'other', label: 'Other', icon: <HelpCircle size={20}/>, color: 'text-gray-400', bg: 'bg-gray-400/10' }
                          ].map((item) => (
                              <button key={item.id} onClick={() => setDepositMethod(item.id as any)} className="flex flex-col items-center gap-2 p-4 bg-[#0b0e11] border border-white/5 rounded-xl hover:bg-[#21ce99]/5 hover:border-[#21ce99]/50 transition group cursor-pointer">
                                  <div className={`p-3 rounded-full ${item.bg} ${item.color} group-hover:scale-110 transition`}>{item.icon}</div>
                                  <span className="text-xs font-bold text-gray-400 group-hover:text-white uppercase">{item.label}</span>
                              </button>
                          ))}
                      </div>
                  ) : (depositMethod === 'wire' || depositMethod === 'other') ? (
                      <div className="text-center space-y-6">
                          <div className="p-4 bg-purple-500/10 rounded-full inline-block text-purple-400"><Landmark size={32}/></div>
                          <div>
                              <h4 className="text-white font-bold mb-1">Manual Processing</h4>
                              <p className="text-xs text-gray-400">Please provide banking details to the client manually.</p>
                          </div>
                          <button onClick={() => setDepositMethod(null)} className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition w-full py-2 cursor-pointer"><ArrowLeft size={12}/> Back</button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <button onClick={() => setDepositMethod(null)} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white mb-2 cursor-pointer"><ArrowLeft size={10}/> Back</button>
                          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">$</span><input type="number" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus className="w-full bg-black/30 border border-white/10 rounded-xl p-4 pl-8 text-white text-xl font-mono font-bold focus:border-white/30 outline-none" placeholder="0.00"/></div>
                          <button onClick={handleAddMainFunds} disabled={!addAmount || isCreating} className="w-full py-3 bg-[#21ce99] hover:bg-[#1aa37a] text-[#0b0e11] font-bold rounded-xl transition cursor-pointer">{isCreating ? <Loader2 className="animate-spin mx-auto" size={16}/> : `Confirm ${depositMethod.toUpperCase()}`}</button>
                      </div>
                  )}
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* MODAL: TRANSFER (Main <-> Room) */}
      <AnimatePresence>
      {transferMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e232d] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative"
              >
                  <button onClick={() => setTransferMode(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"><X size={18}/></button>
                  
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 bg-blue-500/20 text-blue-400">
                          <ArrowRightLeft size={24}/>
                      </div>
                      <h3 className="text-lg font-bold text-white uppercase">
                          {transferMode.type === 'main_transfer' ? 'Main ➝ Room' : 'Room ➝ Main'}
                      </h3>
                  </div>

                  <div className="space-y-4">
                      {transferMode.type === 'main_transfer' && (
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Select Target Room</label>
                              <select value={selectedTargetRoom} onChange={(e) => setSelectedTargetRoom(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none mb-3 appearance-none cursor-pointer">
                                  <option value="">-- Choose Room --</option>
                                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance.toLocaleString()})</option>)}
                              </select>
                          </div>
                      )}

                      <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">$</span>
                          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="w-full bg-black/30 border border-white/10 rounded-xl p-4 pl-8 text-white text-xl font-mono font-bold focus:border-white/30 outline-none" placeholder="0.00"/>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <button onClick={() => setTransferMode(null)} className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition cursor-pointer">Cancel</button>
                          <button onClick={handleTransfer} disabled={isTransferring} className="py-3 rounded-xl font-bold text-white text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500">
                              {isTransferring ? <Loader2 className="animate-spin" size={14}/> : 'Confirm'}
                          </button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}
      </AnimatePresence>

      {/* MODAL: DELETE ACCOUNT CONFIRMATION */}
      <AnimatePresence>
        {deleteModal.isOpen && deleteModal.account && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#151a21] border border-[#f23645]/30 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-[#f23645]/20 flex justify-between items-center bg-[#191f2e]">
                <h3 className="font-bold text-[#f23645] text-xs uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={14} /> 
                  Confirm Deletion
                </h3>
                <button onClick={() => setDeleteModal({ isOpen: false, account: null })} className="text-gray-500 hover:text-white cursor-pointer"><X size={16}/></button>
              </div>

              <div className="p-6 text-center space-y-4">
                <p className="text-sm text-gray-300">
                  Are you sure you want to delete <span className="font-bold text-white">{deleteModal.account.name}</span>?
                </p>
                
                {deleteModal.account.balance > 0 && (
                  <div className="bg-[#21ce99]/10 border border-[#21ce99]/30 p-3 rounded-xl flex items-center gap-3 text-left">
                    <div className="p-2 bg-[#21ce99]/20 rounded-full text-[#21ce99]"><Wallet size={16} /></div>
                    <div>
                      <div className="text-[10px] text-[#21ce99] font-bold uppercase tracking-widest">Refund Detected</div>
                      <div className="text-xs text-gray-300">
                        <span className="text-white font-mono font-bold">${deleteModal.account.balance.toLocaleString()}</span> will be returned to Main Wallet.
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setDeleteModal({ isOpen: false, account: null })}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-[#2a2e39] text-gray-400 hover:text-white hover:bg-[#363c4a] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={executeDelete}
                    disabled={isDeleting}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-[#f23645] text-white hover:bg-[#d12c39] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isDeleting ? <Loader2 className="animate-spin" size={14} /> : 'Delete Unit'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}