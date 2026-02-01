import { Wallet, Layers, Briefcase, TrendingUp } from 'lucide-react';

interface Props {
  financials: {
    mainBalance: number;
    roomBalance: number;
    totalEquity: number;
    openPnL: number;
    rooms: { name: string; balance: number }[];
  };
  loading: boolean;
}

export default function LeadFinancials({ financials, loading }: Props) {
  // Calculate Total Cash (Without PnL) for the middle box
  const totalCash = financials.mainBalance + financials.roomBalance;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      
      {/* BOX 1: LIVE EQUITY */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-30">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} className="text-white" />
        </div>
        <div>
           <div className="flex items-center gap-2 text-gray-400 mb-1">
              <div className="p-1.5 rounded-lg bg-white/5 text-green-400">
                 <Wallet size={16} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Live Net Worth</span>
           </div>
           <p className="text-2xl font-bold text-white font-mono mt-1">
             {loading ? "..." : `$${financials.totalEquity.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
           </p>
        </div>
        <div className="mt-2">
             <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold ${financials.openPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {financials.openPnL > 0 ? '+' : ''}{financials.openPnL.toLocaleString(undefined, {minimumFractionDigits: 2})
                }</span>
                <span className="text-[10px] text-gray-500 uppercase">Live PnL</span>
             </div>
        </div>
      </div>

      {/* BOX 2: WALLET BREAKDOWN */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-30">
        <div>
           <div className="flex items-center gap-2 text-gray-400 mb-1">
              <div className="p-1.5 rounded-lg bg-white/5 text-blue-400">
                 <Layers size={16} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Cash Assets</span>
           </div>
           <p className="text-2xl font-bold text-blue-400 font-mono mt-1">
             {loading ? "..." : `$${totalCash.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
           </p>
        </div>
        
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
             <span className="text-[10px] text-gray-500 uppercase font-bold">Main Wallet:</span>
             <span className="text-xs font-mono text-white">
                ${financials.mainBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
             </span>
        </div>
      </div>

      {/* BOX 3: TRADING ROOMS (Fixed Height + Scroll) */}
      <div className="glass-panel p-0 rounded-xl border border-white/5 relative overflow-hidden flex flex-col h-full max-h-45"> 
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/5 bg-white/2 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="p-1.5 rounded-lg bg-white/5 text-yellow-400">
                 <Briefcase size={14} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Trading Accounts</span>
            </div>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                {financials.rooms.length}
            </span>
        </div>

        {/* Scrollable List */}
        <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
            {financials.rooms.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-[10px] italic py-4">
                    No accounts found
                </div>
            ) : (
                financials.rooms.map((room, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 group-hover:bg-yellow-400 transition-colors"></div>
                            <span className="text-xs text-gray-300 truncate max-w-30" title={room.name}>
                                {room.name}
                            </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-yellow-400/80 group-hover:text-yellow-400">
                            ${room.balance.toLocaleString()}
                        </span>
                    </div>
                ))
            )}
        </div>
      </div>

    </div>
  );
}