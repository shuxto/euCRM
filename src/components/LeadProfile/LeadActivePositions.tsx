import { useMarketData } from '../../context/SocketContext';
import { Edit2, TrendingUp } from 'lucide-react';


interface Props {
  trades: any[];
  onEditTrade: (trade: any) => void;
}

export default function LeadActivePositions({ trades, onEditTrade }: Props) {
  // 🟢 Volatile Data: Only this component re-renders when prices change
  const { marketPrices } = useMarketData();

  // Calculate live stats locally
  const activeTradesWithLiveStats = trades.map(trade => {
      // Use GLOBAL marketPrices
      const currentPrice = marketPrices[trade.symbol] || trade.entry_price || 0; 
      let pnl = 0;
      
      const entry = parseFloat(trade.entry_price) || 0;
      const size = parseFloat(trade.size) || 0;

      if (entry > 0) {
          if (trade.type === 'buy') {
              pnl = ((currentPrice - entry) / entry) * size;
          } else {
              pnl = ((entry - currentPrice) / entry) * size;
          }
      }

      const margin = trade.margin || (trade.leverage ? size / trade.leverage : 0);
      const roe = margin > 0 ? ((pnl / margin) * 100).toFixed(2) : "0.00";

      return { ...trade, currentPrice, pnl, roe, margin };
  });

  return (
    <div className="glass-panel p-6 rounded-xl border border-white/5 min-h-75 overflow-hidden relative">
       <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <TrendingUp size={18} className="text-green-500" /> 
             Active Open Positions
           </h3>
           <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded text-[10px] text-green-400 font-bold uppercase border border-green-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live Feed
              </span>
           </div>
       </div>
       
       {activeTradesWithLiveStats.length === 0 ? (
           <div className="w-full h-48 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-gray-500 text-sm italic">
             No active positions open.
           </div>
       ) : (
           <div className="overflow-x-auto">
               <table className="w-full text-left text-xs">
                   <thead className="text-gray-500 uppercase border-b border-white/5">
                       <tr>
                           <th className="pb-3 pl-2">Symbol</th>
                           <th className="pb-3 text-center">Side</th>
                           <th className="pb-3 text-center">Size</th>
                           <th className="pb-3 text-right">Entry</th>
                           <th className="pb-3 text-right">Mark Price</th>
                           <th className="pb-3 text-right">TP</th>
                           <th className="pb-3 text-right">SL</th>
                           <th className="pb-3 text-right">Liq.</th>
                           <th className="pb-3 text-right pr-2">PnL (ROE%)</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                       {activeTradesWithLiveStats.map(t => {
                           const isProfit = t.pnl >= 0;
                           const sideColor = t.type === 'buy' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10';
                           
                           return (
                               <tr key={t.id} className="hover:bg-white/5 transition group">
                                   <td className="py-3 pl-2 font-bold text-white">
                                       {t.symbol}
                                       <span className="block text-[9px] text-gray-500 font-normal">{t.leverage}x</span>
                                   </td>
                                   <td className="py-3 text-center">
                                       <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${sideColor}`}>
                                           {t.type}
                                       </span>
                                   </td>
                                   <td className="py-3 text-center text-gray-300">{Number(t.size).toLocaleString()}</td>
                                   
                                   <td className="py-3 text-right text-gray-300 relative group-hover:text-blue-200 transition-colors">
                                       {Number(t.entry_price).toLocaleString()}
                                       <button 
                                           onClick={(e) => { e.stopPropagation(); onEditTrade(t); }}
                                           className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-blue-400 transition-all shadow-lg z-10"
                                           title="Manipulate Price"
                                       >
                                           <Edit2 size={12} />
                                       </button>
                                   </td>

                                   <td className="py-3 text-right text-yellow-500 font-mono font-bold animate-pulse">
                                        {/* Fallback to entry price if market price is 0 to avoid showing 0.00 unnecessarily if disconnected */}
                                       {Number(t.currentPrice || t.entry_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                   </td>
                                   <td className="py-3 text-right text-green-400/70 font-mono">
                                       {t.take_profit ? Number(t.take_profit).toLocaleString() : '-'}
                                   </td>
                                   <td className="py-3 text-right text-red-400/70 font-mono">
                                       {t.stop_loss ? Number(t.stop_loss).toLocaleString() : '-'}
                                   </td>
                                   <td className="py-3 text-right text-orange-400/70 font-mono">
                                        {t.liquidation_price ? Number(t.liquidation_price).toLocaleString() : '-'}
                                   </td>
                                   <td className="py-3 text-right pr-2">
                                       <div className={`font-bold font-mono text-sm ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                           {isProfit ? '+' : ''}{Number(t.pnl).toFixed(2)}
                                       </div>
                                       <div className={`text-[9px] font-bold ${isProfit ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                           ({isProfit ? '+' : ''}{t.roe}%)
                                       </div>
                                   </td>
                               </tr>
                           );
                       })}
                   </tbody>
               </table>
           </div>
       )}
    </div>
  );
}
