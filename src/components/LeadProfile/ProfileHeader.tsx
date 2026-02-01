import { ArrowLeft, User, Phone, Mail, Globe, ShieldCheck, ShieldAlert, Crown, Loader2, Info, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface ProfileHeaderProps {
  lead: any;
  onBack: () => void;
}

export default function ProfileHeader({ lead, onBack }: ProfileHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentTier, setCurrentTier] = useState('Basic');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const fetchProfileTier = async () => {
      const targetId = lead.trading_account_id;
      if (!targetId) return;
      const { data, error } = await supabase.from('profiles').select('tier').eq('id', targetId).single();
      if (!error && data?.tier) setCurrentTier(data.tier);
    };
    fetchProfileTier();
  }, [lead.trading_account_id]);

  const getTierStyles = (tier: string) => {
    switch (tier) {
      case 'Diamond': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'Platinum': return 'text-slate-300 bg-slate-400/10 border-slate-400/20';
      case 'Gold': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'Silver': return 'text-gray-300 bg-gray-400/10 border-gray-400/20';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const handleTierChange = async (newTier: string) => {
    const targetId = lead.trading_account_id;
    if (!targetId) { alert("Registration Required"); return; }
    if (!window.confirm(`Update Platform Tier to ${newTier}?`)) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.from('profiles').update({ tier: newTier }).eq('id', targetId);
      if (error) throw error;
      setCurrentTier(newTier);
    } catch (err: any) {
      alert("Sync Error: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const displayName = lead.real_name || lead.full_name || `${lead.name || ''} ${lead.surname || ''}`.trim();
  const isVerified = ['verified', 'approved'].includes((lead.kyc_status || '').toLowerCase());

  return (
    <>
      <div className="glass-panel p-6 rounded-xl border border-white/5 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative bg-[#0b0e11]/40 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all group cursor-pointer">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
              <User size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest ${
                  lead.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>
                  {lead.status || 'New'}
                </span>
              </div>
              <p className="text-gray-500 text-[10px] font-mono mt-1 opacity-60 uppercase tracking-tighter">Account_ID: {lead.id}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-8 text-sm w-full lg:w-auto">
          <div className="flex flex-col gap-1.5 min-w-37.5">
            <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Protocol Contact</span>
            <div className="flex items-center gap-2 text-gray-300 text-[11px] font-mono"><Phone size={12} className="text-blue-500" /> {lead.phone || '---'}</div>
            <div className="flex items-center gap-2 text-gray-300 text-[11px] font-mono"><Mail size={12} className="text-blue-500" /> {lead.email}</div>
          </div>

          <div className="flex flex-col gap-1.5 border-l border-white/10 pl-8 min-w-35">
            <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Compliance</span>
            <div className="flex items-center gap-2 text-gray-300 text-[11px]"><Globe size={12} className="text-blue-500" /> {lead.country || 'Global'}</div>
            <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${isVerified ? 'text-green-400' : 'text-yellow-500'}`}>
              {isVerified ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              {isVerified ? 'Verified' : 'Pending'}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-l border-white/10 pl-8 min-w-35">
            <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Platform Tier</span>
            {!lead.trading_account_id ? (
              <div className="text-[10px] text-gray-600 italic py-1">Registration Required</div>
            ) : isUpdating ? (
              <div className="flex items-center gap-2 text-gray-500 text-[11px] py-1 font-bold italic"><Loader2 size={12} className="animate-spin text-blue-500" /> SYNC...</div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Crown size={14} className={currentTier === 'Basic' ? 'text-gray-600' : 'text-yellow-500'} />
                  <select 
                    value={currentTier}
                    onChange={(e) => handleTierChange(e.target.value)}
                    className={`bg-transparent border-none outline-none font-black text-xs uppercase cursor-pointer transition-all ${getTierStyles(currentTier).split(' ')[0]}`}
                  >
                    <option value="Basic" className="bg-[#151a21]">Basic</option>
                    <option value="Silver" className="bg-[#151a21]">Silver</option>
                    <option value="Gold" className="bg-[#151a21]">Gold</option>
                    <option value="Platinum" className="bg-[#151a21]">Platinum</option>
                    <option value="Diamond" className="bg-[#151a21]">Diamond</option>
                  </select>
                </div>
                <button 
                  onClick={() => setShowInfo(true)}
                  className="text-[9px] font-black uppercase text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer w-fit"
                >
                  <Info size={10} /> Staff Guide
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 STAFF GUIDE MODAL - FIXED TAILWIND ALERTS */}
      {showInfo && (
        <div className="fixed inset-0 top-0 left-0 w-full h-full flex items-center justify-center z-999999 px-4">
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md" onClick={() => setShowInfo(false)} />
          <div className="relative w-full max-w-md rounded-4xl border border-white/10 bg-[#0b0e11] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Tier Regulations</h3>
                <p className="text-[10px] text-[#F0B90B] font-bold uppercase mt-1 tracking-widest">Internal Compliance Manual</p>
              </div>
              <button onClick={() => setShowInfo(false)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"><X size={18}/></button>
            </div>

            <div className="space-y-3">
              {/* BASIC */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Basic</span>
                  <span className="text-sm text-white font-black tracking-tighter">LOCKED</span>
                </div>
                <div className="text-[11px] text-gray-300 text-right font-medium max-w-45 leading-snug">
                  Leverage modification <span className="text-rose-500 font-bold">DISABLED</span>. Fixed at 1:1.
                </div>
              </div>

              {/* SILVER */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Silver</span>
                  <span className="text-sm text-white font-black tracking-tighter">1 : 5</span>
                </div>
                <div className="text-[11px] text-gray-300 text-right font-medium max-w-45 leading-snug">
                  Staff may adjust leverage <span className="text-white font-bold">from 1 to 5</span>.
                </div>
              </div>

              {/* GOLD */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">Gold</span>
                  <span className="text-sm text-white font-black tracking-tighter">1 : 20</span>
                </div>
                <div className="text-[11px] text-gray-300 text-right font-medium max-w-45 leading-snug">
                  Staff may adjust leverage <span className="text-white font-bold">from 1 to 20</span>.
                </div>
              </div>

              {/* PLATINUM */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Platinum</span>
                  <span className="text-sm text-white font-black tracking-tighter">1 : 50</span>
                </div>
                <div className="text-[11px] text-gray-300 text-right font-medium max-w-45 leading-snug">
                  Staff may adjust leverage <span className="text-white font-bold">from 1 to 50</span>.
                </div>
              </div>

              {/* DIAMOND */}
              <div className="bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Diamond</span>
                  <span className="text-sm text-white font-black tracking-tighter">1 : 125</span>
                </div>
                <div className="text-[11px] text-white text-right font-bold max-w-45 leading-snug">
                  Staff may adjust leverage <span className="text-cyan-400 font-black">from 1 to 125</span>.
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowInfo(false)}
              className="w-full mt-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all cursor-pointer active:scale-95"
            >
              Understand & Exit
            </button>
          </div>
        </div>
      )}
    </>
  );
}