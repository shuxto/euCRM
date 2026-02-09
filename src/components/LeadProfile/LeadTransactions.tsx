import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    ArrowUpRight, ArrowDownLeft, Loader2, ArrowRightLeft, 
    Gift, Globe, Server, ShieldCheck, Repeat, CheckCircle, 
    XCircle, ChevronLeft, ChevronRight, Hash, UserCog, Shield,
    ShieldAlert, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  lead: any;
}

export default function LeadTransactions({ lead }: Props) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🟢 ACTION MODAL STATE (Updated to handle Approve too)
  const [actionModal, setActionModal] = useState<{
      isOpen: boolean;
      txId: string | null;
      type: 'reject' | 'hold' | 'approve' | null; // Added 'approve'
      amount?: number;
  }>({ isOpen: false, txId: null, type: null });
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (lead?.trading_account_id) {
        fetchTransactions();
    }
  }, [lead]);

  const fetchTransactions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            performer:performed_by (
                email,
                real_name
            )
        `)
        .eq('user_id', lead.trading_account_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching transactions:", error);
    } else {
        setTransactions(data || []);
    }
    setLoading(false);
  };

  // --- ACTIONS: SUBMIT ACTION (Approve / Reject / Hold) ---
  const handleSubmitAction = async () => {
      if (!actionModal.txId || !actionModal.type) return;
      
      // Require comment for Reject/Hold only
      if (actionModal.type !== 'approve' && !comment.trim()) {
          alert("Please enter a reason.");
          return;
      }

      setProcessingId(actionModal.txId);
      
      try {
          // 🟢 CASE 1: APPROVE
          if (actionModal.type === 'approve') {
              // 1. Check User Balance First (Safety)
              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', lead.trading_account_id).single();
              
              if (!profile || profile.balance < (actionModal.amount || 0)) {
                  throw new Error("User has insufficient funds now. Cannot approve.");
              }

              // 2. Perform Deduction & Update Status
              const { error } = await supabase.rpc('admin_process_withdrawal', {
                  p_tx_id: actionModal.txId,
                  p_user_id: lead.trading_account_id,
                  p_amount: actionModal.amount
              });

              if (error) throw error;
          } 
          // 🟢 CASE 2: REJECT / HOLD
          else {
              const status = actionModal.type === 'reject' ? 'rejected' : 'on_hold';
              const { error } = await supabase.from('transactions')
                  .update({ 
                      status: status,
                      admin_comment: comment,
                      performed_by: (await supabase.auth.getUser()).data.user?.id 
                  })
                  .eq('id', actionModal.txId);

              if (error) throw error;
          }

          // Cleanup
          setActionModal({ isOpen: false, txId: null, type: null });
          setComment('');
          await fetchTransactions();

      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  // Helper Logic...
  const getTxConfig = (tx: any) => {
      const isTransfer = tx.type === 'transfer' || (tx.method && tx.method.includes('->'));
      if (isTransfer) return { label: 'INTERNAL TRANSFER', icon: <ArrowRightLeft size={12} />, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', channelIcon: <Server size={12} /> };
      if (tx.type === 'bonus') return { label: 'BONUS', icon: <Gift size={12} />, color: 'text-[#F0B90B]', bg: 'bg-[#F0B90B]/10', border: 'border-[#F0B90B]/20', channelIcon: <ShieldCheck size={12} /> };
      if (['deposit', 'withdrawal', 'external_deposit', 'external_withdraw'].includes(tx.type)) {
          const isIn = tx.type.includes('deposit');
          return { label: isIn ? 'DEPOSIT' : 'WITHDRAWAL', icon: isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />, color: isIn ? 'text-[#21ce99]' : 'text-[#f23645]', bg: isIn ? 'bg-[#21ce99]/10' : 'bg-[#f23645]/10', border: isIn ? 'border-[#21ce99]/20' : 'border-[#f23645]/20', channelIcon: <Globe size={12} /> };
      }
      return { label: 'SYSTEM', icon: <Repeat size={12} />, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20', channelIcon: <Server size={12} /> };
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  if (!lead.trading_account_id) return <div className="p-8 text-center text-gray-500 italic">This lead is not registered on the Platform yet.</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      
      {/* 🟢 ACTION MODAL (Handles Approve, Reject, Hold) */}
      <AnimatePresence>
        {actionModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm bg-[#151a21] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#191f2e]">
                        <h3 className={`font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${
                            actionModal.type === 'reject' ? 'text-red-500' : 
                            actionModal.type === 'approve' ? 'text-[#21ce99]' : 'text-orange-500'
                        }`}>
                            {actionModal.type === 'reject' ? <XCircle size={14} /> : 
                             actionModal.type === 'approve' ? <CheckCircle size={14} /> : <ShieldAlert size={14} />}
                            
                            {actionModal.type === 'reject' ? 'Reject Withdrawal' : 
                             actionModal.type === 'approve' ? 'Approve Withdrawal' : 'Place On Hold'}
                        </h3>
                        <button onClick={() => setActionModal({ isOpen: false, txId: null, type: null })} className="text-gray-500 hover:text-white cursor-pointer"><X size={16}/></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {actionModal.type === 'approve' ? (
                            // 🟢 APPROVE VIEW
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-[#21ce99]/10 rounded-full inline-flex text-[#21ce99]">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="text-sm text-white font-bold">
                                    Confirm approval of <span className="text-[#21ce99]">${actionModal.amount?.toLocaleString()}</span>?
                                </p>
                                <p className="text-xs text-gray-400">
                                    Funds will be deducted from the user's main wallet immediately.
                                </p>
                            </div>
                        ) : (
                            // 🟢 REJECT / HOLD VIEW
                            <>
                                <p className="text-xs text-gray-400">
                                    Please provide a reason. This will be visible to the client.
                                </p>
                                <textarea 
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={actionModal.type === 'reject' ? "Reason for rejection..." : "Reason for hold..."}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white/30 min-h-25"
                                    autoFocus
                                />
                            </>
                        )}

                        <button 
                            onClick={handleSubmitAction}
                            disabled={(actionModal.type !== 'approve' && !comment.trim()) || !!processingId}
                            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 ${
                                actionModal.type === 'reject' ? 'bg-red-600 hover:bg-red-500' : 
                                actionModal.type === 'approve' ? 'bg-[#21ce99] hover:bg-[#1aa37a] text-black' : 'bg-orange-600 hover:bg-orange-500'
                            }`}
                        >
                            {processingId ? <Loader2 className="animate-spin" size={14} /> : 
                             actionModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Action'}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <div className="glass-panel p-0 rounded-2xl border border-white/5 overflow-hidden bg-[#151a21]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#191f2e]">
            <h3 className="text-lg font-bold text-white">Financial Ledger</h3>
            <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-500 font-mono">
                Records: {transactions.length}
            </div>
        </div>
        
        {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#21ce99]" /></div>
        ) : transactions.length === 0 ? (
            <div className="text-center py-12">
                <div className="inline-flex p-4 rounded-full bg-white/5 mb-4 text-gray-500">
                    <ArrowUpRight size={24} />
                </div>
                <p className="text-sm text-gray-500">No transactions found.</p>
            </div>
        ) : (
            <>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b0e11] text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                        <tr>
                            <th className="p-4 pl-6">TX ID</th>
                            <th className="p-4">Time</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Method / Details</th>
                            <th className="p-4">Performed By</th>
                            <th className="p-4 text-right">Amount</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                        {currentTransactions.map((tx) => {
                            const config = getTxConfig(tx);
                            const displayMethod = tx.method || 'System';
                            const isPositive = ['deposit', 'bonus', 'relay_in', 'external_deposit', 'profit'].includes(tx.type);
                            
                            const performerName = tx.performer?.real_name || tx.performer?.email || tx.performed_by_email;
                            const performerDisplay = performerName || (tx.performed_by ? `${tx.performed_by.slice(0, 8)}...` : null);

                            const isPendingWithdrawal = (tx.status === 'pending' || tx.status === 'on_hold') && (tx.type === 'withdrawal' || tx.type === 'external_withdraw');

                            return (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 pl-6 text-gray-500 font-mono text-[10px]">
                                        <div className="flex items-center gap-1"><Hash size={10} />{tx.id}</div>
                                    </td>
                                    <td className="p-4 text-gray-400 font-mono text-[10px]">
                                        {new Date(tx.created_at).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded text-[10px] font-bold uppercase border ${config.bg} ${config.color} ${config.border}`}>
                                            {config.icon} {config.label}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-bold uppercase">
                                                {config.channelIcon}
                                                {displayMethod}
                                            </div>
                                            {tx.admin_comment && (
                                                <span className="text-[9px] text-orange-400 flex items-center gap-1">
                                                    <ShieldAlert size={8} /> {tx.admin_comment}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            {performerDisplay ? (
                                                <>
                                                    <UserCog size={12} className="text-[#F0B90B]" />
                                                    <span className="text-white font-bold">{performerDisplay}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Shield size={12} className="text-gray-600" />
                                                    <span className="text-gray-600 font-bold">System Auto</span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`p-4 text-right font-mono font-bold text-sm ${isPositive ? 'text-[#21ce99]' : 'text-[#f23645]'}`}>
                                        {isPositive ? '+' : ''}${tx.amount?.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        {tx.status === 'approved' ? (
                                            <div className="flex justify-center"><CheckCircle size={14} className="text-[#21ce99]" /></div>
                                        ) : tx.status === 'pending' ? (
                                            <div className="flex justify-center" title="Pending"><Loader2 size={14} className="text-[#F0B90B] animate-spin" /></div>
                                        ) : tx.status === 'on_hold' ? (
                                            <div className="flex justify-center" title="On Hold"><ShieldAlert size={14} className="text-orange-500" /></div>
                                        ) : (
                                            <div className="flex justify-center" title="Rejected"><XCircle size={14} className="text-[#f23645]" /></div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {isPendingWithdrawal && !processingId && (
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* APPROVE - 🟢 Calls Modal now */}
                                                <button 
                                                    onClick={() => setActionModal({ isOpen: true, txId: tx.id, type: 'approve', amount: tx.amount })}
                                                    className="p-1.5 bg-[#21ce99]/10 hover:bg-[#21ce99] text-[#21ce99] hover:text-black rounded transition cursor-pointer"
                                                    title="Approve"
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                                
                                                {/* HOLD */}
                                                {tx.status !== 'on_hold' && (
                                                    <button 
                                                        onClick={() => setActionModal({ isOpen: true, txId: tx.id, type: 'hold' })}
                                                        className="p-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded transition cursor-pointer"
                                                        title="Hold"
                                                    >
                                                        <ShieldAlert size={14} />
                                                    </button>
                                                )}
                                                
                                                {/* REJECT */}
                                                <button 
                                                    onClick={() => setActionModal({ isOpen: true, txId: tx.id, type: 'reject' })}
                                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded transition cursor-pointer"
                                                    title="Reject"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {processingId === tx.id && (
                                            <div className="flex justify-center"><Loader2 className="animate-spin text-gray-500" size={14}/></div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="px-6 py-3 border-t border-white/5 bg-[#151a21] flex justify-between items-center">
                    <button 
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white disabled:opacity-30 uppercase tracking-widest transition-colors"
                    >
                        <ChevronLeft size={12} /> Prev
                    </button>
                    <div className="text-[10px] font-mono text-gray-500">
                        Page <span className="text-white">{currentPage}</span> of {totalPages}
                    </div>
                    <button 
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white disabled:opacity-30 uppercase tracking-widest transition-colors"
                    >
                        Next <ChevronRight size={12} />
                    </button>
                </div>
            )}
            </>
        )}
      </div>
    </div>
  );
}