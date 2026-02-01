import { useState } from 'react';
import { Users, ArrowRightLeft, Trash2, LayoutGrid, Zap, Activity } from 'lucide-react';

import DistributeTab from './DistributeTab';
import TeamLeaderTab from './TeamLeaderTab';
import TransferTab from './TransferTab';
import CleanupTab from './CleanupTab';

export default function SplitterPage() {
  const [activeTab, setActiveTab] = useState<'distribute' | 'tl' | 'transfer' | 'cleanup'>('distribute');

  const tabs = [
    { id: 'distribute', label: 'Distribute', icon: LayoutGrid, color: 'from-blue-500 to-cyan-500' },
    { id: 'tl', label: 'Team Leader', icon: Users, color: 'from-indigo-500 to-violet-500' },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft, color: 'from-fuchsia-500 to-pink-500' },
    { id: 'cleanup', label: 'Cleanup', icon: Trash2, color: 'from-red-500 to-orange-500' },
  ];

  return (
    // FIXED: max-w-[1800px] -> max-w-450
    <div className="max-w-450 mx-auto pb-20 animate-in fade-in zoom-in-95 duration-500">
      
      {/* GLOBAL STYLES FOR SCROLLBAR */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>

      {/* 1. THE AMAZING HEADER IS BACK */}
      <div className="mb-8 flex items-end justify-between">
        <div className="flex items-center gap-6">
            <div className="relative group">
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className="relative p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                    <Zap size={32} className="text-cyan-400 fill-cyan-400/20" />
                </div>
            </div>
            <div>
                <h1 className="text-5xl font-black tracking-tighter text-white mb-1 italic">
                    SPLITTER <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-600">PRO</span>
                </h1>
                <div className="flex items-center gap-3 text-sm font-mono text-cyan-500/60 uppercase tracking-[0.2em]">
                    <Activity size={14} />
                    <span>System Online</span>
                    <span className="text-white/10">|</span>
                    <span>V3.0 Logic Engine</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. NEW "COCKPIT" TABS */}
      <div className="flex p-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl mb-8 w-fit shadow-2xl relative overflow-hidden">
        {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                        relative px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all duration-300
                        ${isActive ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                    `}
                >
                    {isActive && (
                        <div className={`absolute inset-0 rounded-xl bg-linear-to-r ${tab.color} opacity-100`}></div>
                    )}
                    <tab.icon size={18} className="relative z-10" />
                    <span className="relative z-10 tracking-wide uppercase text-xs">{tab.label}</span>
                </button>
            );
        })}
      </div>

      {/* VIEW CONTENT */}
      <div className="min-h-150 relative">
        {/* Background Noise Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
        
        {activeTab === 'distribute' && <DistributeTab />}
        {activeTab === 'tl' && <TeamLeaderTab />}
        {activeTab === 'transfer' && <TransferTab />}
        {activeTab === 'cleanup' && <CleanupTab />}
      </div>

    </div>
  );
}