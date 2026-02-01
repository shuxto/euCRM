import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    ArrowUpRight, ArrowDownLeft, Loader2, ArrowRightLeft, 
    Gift, Globe, Server, ShieldCheck, Repeat, CheckCircle, 
    XCircle, ChevronLeft, ChevronRight, Hash, UserCog, Shield 
} from 'lucide-react';

interface Props {
  lead: any;
}

export default function LeadTransactions({ lead }: Props) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (lead?.trading_account_id) {
        fetchTransactions();
    }
  }, [lead]);

  const fetchTransactions = async () => {
    setLoading(true);
    
    // 👇 UPDATED QUERY: We now fetch the 'email' from the 'profiles' table
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            performer:performed_by (
                email
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

  // --- HELPER: GET PRO LABELS & ICONS ---
  const getTxConfig = (tx: any) => {
      // 1. INTERNAL TRANSFER
      const isTransfer = tx.type === 'transfer' || (tx.method && tx.method.includes('->'));
      if (isTransfer) {
          return {
              label: 'INTERNAL TRANSFER',
              icon: <ArrowRightLeft size={12} />,
              color: 'text-blue-400',
              bg: 'bg-blue-400/10',
              border: 'border-blue-400/20',
              channelIcon: <Server size={12} />
          };
      }

      // 2. BONUS
      if (tx.type === 'bonus') {
          return {
              label: 'BONUS',
              icon: <Gift size={12} />,
              color: 'text-[#F0B90B]', 
              bg: 'bg-[#F0B90B]/10',
              border: 'border-[#F0B90B]/20',
              channelIcon: <ShieldCheck size={12} />
          };
      }

      // 3. EXTERNAL
      if (['deposit', 'withdrawal', 'external_deposit', 'external_withdraw'].includes(tx.type)) {
          const isIn = tx.type.includes('deposit');
          return {
              label: isIn ? 'DEPOSIT' : 'WITHDRAWAL',
              icon: isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />,
              color: isIn ? 'text-[#21ce99]' : 'text-[#f23645]',
              bg: isIn ? 'bg-[#21ce99]/10' : 'bg-[#f23645]/10',
              border: isIn ? 'border-[#21ce99]/20' : 'border-[#f23645]/20',
              channelIcon: <Globe size={12} />
          };
      }

      // 4. DEFAULT
      return {
          label: 'SYSTEM',
          icon: <Repeat size={12} />,
          color: 'text-gray-400',
          bg: 'bg-gray-400/10',
          border: 'border-gray-400/20',
          channelIcon: <Server size={12} />
      };
  };

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  if (!lead.trading_account_id) {
      return <div className="p-8 text-center text-gray-500 italic">This lead is not registered on the Platform yet.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="glass-panel p-0 rounded-2xl border border-white/5 overflow-hidden bg-[#151a21]">
        
        {/* HEADER */}
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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                        {currentTransactions.map((tx) => {
                            const config = getTxConfig(tx);
                            const displayMethod = tx.method || 'System';
                            const isPositive = ['deposit', 'bonus', 'relay_in', 'external_deposit', 'profit'].includes(tx.type);
                            
                            // 👇 Logic to find the email
                            // 1. Try fetched profile email
                            // 2. Try direct column
                            // 3. Fallback to ID
                            const performerEmail = tx.performer?.email || tx.performed_by_email;
                            const performerDisplay = performerEmail || (tx.performed_by ? `${tx.performed_by.slice(0, 8)}...` : null);

                            return (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                    
                                    {/* 1. TX ID */}
                                    <td className="p-4 pl-6 text-gray-500 font-mono text-[10px]">
                                        <div className="flex items-center gap-1"><Hash size={10} />{tx.id}</div>
                                    </td>

                                    {/* 2. TIME */}
                                    <td className="p-4 text-gray-400 font-mono text-[10px]">
                                        {new Date(tx.created_at).toLocaleString()}
                                    </td>

                                    {/* 3. TYPE */}
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded text-[10px] font-bold uppercase border ${config.bg} ${config.color} ${config.border}`}>
                                            {config.icon} {config.label}
                                        </span>
                                    </td>

                                    {/* 4. METHOD */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-bold uppercase">
                                            {config.channelIcon}
                                            {displayMethod}
                                        </div>
                                    </td>

                                    {/* 5. PERFORMED BY (UPDATED) */}
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

                                    {/* 6. AMOUNT */}
                                    <td className={`p-4 text-right font-mono font-bold text-sm ${isPositive ? 'text-[#21ce99]' : 'text-[#f23645]'}`}>
                                        {isPositive ? '+' : ''}${tx.amount?.toLocaleString()}
                                    </td>

                                    {/* 7. STATUS */}
                                    <td className="p-4 text-center">
                                        {tx.status === 'approved' ? (
                                            <div className="flex justify-center"><CheckCircle size={14} className="text-[#21ce99]" /></div>
                                        ) : tx.status === 'pending' ? (
                                            <div className="flex justify-center"><Loader2 size={14} className="text-[#F0B90B] animate-spin" /></div>
                                        ) : (
                                            <div className="flex justify-center"><XCircle size={14} className="text-[#f23645]" /></div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* PAGINATION */}
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