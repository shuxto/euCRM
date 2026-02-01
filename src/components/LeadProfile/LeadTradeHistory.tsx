import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { History, Loader2 } from 'lucide-react';

interface Props {
  lead: any;
}

export default function LeadTradeHistory({ lead }: Props) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead?.trading_account_id) {
        fetchHistory();
    }
  }, [lead]);

  const fetchHistory = async () => {
    setLoading(true);
    // Fetch CLOSED trades
    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', lead.trading_account_id)
        .eq('status', 'closed') // Only closed history
        .order('closed_at', { ascending: false });

    if (error) console.error("Error fetching history:", error);
    else setTrades(data || []);
    
    setLoading(false);
  };

  if (!lead.trading_account_id) return <div className="p-8 text-center text-gray-500">Not registered.</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
       <div className="glass-panel p-6 rounded-2xl border border-white/5">
         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <History size={18} className="text-blue-400" />
            Closed Positions
         </h3>
         
         {loading ? (
             <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
         ) : trades.length === 0 ? (
             <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                 <p className="text-sm text-gray-500">No closed trade history available.</p>
             </div>
         ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                        <tr>
                            <th className="pb-3 pl-2">Symbol</th>
                            <th className="pb-3 text-center">Type</th>
                            <th className="pb-3 text-center">Entry</th>
                            <th className="pb-3 text-center">Close</th>
                            <th className="pb-3 text-right">Profit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {trades.map((trade) => (
                            <tr key={trade.id} className="hover:bg-white/5 transition">
                                <td className="py-3 pl-2 font-bold text-white">{trade.symbol}</td>
                                <td className="py-3 text-center">
                                    <span className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded ${trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="py-3 text-center text-gray-400">{trade.entry_price}</td>
                                <td className="py-3 text-center text-gray-400">{trade.exit_price || '-'}</td>
                                <td className={`py-3 text-right font-mono font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.pnl > 0 ? '+' : ''}{Number(trade.pnl).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         )}
       </div>
    </div>
  );
}