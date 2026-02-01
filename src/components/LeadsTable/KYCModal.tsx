import { useState, useEffect } from 'react'; // Added useEffect
import { createPortal } from 'react-dom';
import { X, ShieldCheck, ShieldAlert, Shield, Mail, Phone, FileX, User, Fingerprint, Check } from 'lucide-react'; // Added Check icon

interface Props {
  leadId: string;
  leadName: string;
  phone: string;
  email: string;
  currentStatus: string | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export default function KYCModal({ leadId, leadName, phone, email, currentStatus, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // 1. LISTEN FOR ESCAPE KEY
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 2. COPY FUNCTION
  const handleCopyId = () => {
    navigator.clipboard.writeText(leadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };
  
  // Helper for Status Badge Design
  const getStatusBadge = () => {
    switch (currentStatus) {
      case 'Approved': return { icon: <ShieldCheck size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' };
      case 'Pending': return { icon: <Shield size={14} />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]' };
      default: return { icon: <ShieldAlert size={14} />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]' };
    }
  };

  const badge = getStatusBadge();

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      
      {/* 1. ULTRA-BLUR BACKDROP */}
      <div 
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-xl animate-in fade-in duration-300" 
        onClick={onClose}
      />

      {/* 2. GLAMORPHIC CARD */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)] bg-slate-900/80 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-cyan-500/20 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute bottom-[-50%] right-[-50%] w-full h-full bg-blue-600/20 blur-[100px] pointer-events-none rounded-full" />

        {/* CLOSE BUTTON */}
        <button 
            onClick={onClose} 
            className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
        >
            <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* --- HEADER SECTION --- */}
        <div className="relative z-10 p-8 pb-6 border-b border-white/5">
            <div className="flex items-start justify-between">
                <div className="flex gap-5 items-center">
                    {/* AVATAR GLOW */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-linear-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-500" />
                        <div className="relative w-20 h-20 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-gray-300 shadow-2xl">
                            <User size={32} />
                        </div>
                        {/* Status Indicator Dot */}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center border border-white/10 ${badge.color}`}>
                           {badge.icon}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">
                            {leadName}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border ${badge.bg} ${badge.color} ${badge.border} ${badge.glow}`}>
                                {currentStatus || 'Not Verified'}
                            </span>
                            
                            {/* --- COPY ID BADGE --- */}
                            <button 
                                onClick={handleCopyId}
                                className="px-2 py-1 rounded-full border border-white/5 bg-white/5 text-[10px] text-gray-400 font-mono flex items-center gap-1 hover:bg-white/10 hover:text-white hover:border-cyan-500/50 transition cursor-copy active:scale-95"
                                title="Click to Copy ID"
                            >
                                {copied ? <Check size={10} className="text-green-400"/> : <Fingerprint size={10} />}
                                {copied ? <span className="text-green-400 font-bold">Copied!</span> : leadId.substring(0, 8)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- INFO GRID --- */}
        <div className="relative z-10 p-6 grid grid-cols-2 gap-3">
            {/* Phone Card */}
            <div className="bg-black/20 p-3 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition duration-300 group">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:text-cyan-300 transition">
                        <Phone size={14} />
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Mobile</span>
                </div>
                <div className="pl-9">
                    <p className="text-xs font-mono text-gray-200 group-hover:text-white transition group-hover:scale-105 origin-left duration-300">{phone}</p>
                </div>
            </div>

            {/* Email Card */}
            <div className="bg-black/20 p-3 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition duration-300 group">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:text-purple-300 transition">
                        <Mail size={14} />
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Email</span>
                </div>
                <div className="pl-9">
                    <p 
                        className="text-[11px] font-mono text-gray-200 group-hover:text-white transition group-hover:scale-105 origin-left duration-300 truncate" 
                        title={email}
                    >
                        {email}
                    </p>
                </div>
            </div>
        </div>

        {/* --- EMPTY STATE --- */}
        <div className="relative z-10 p-8 min-h-55 flex flex-col items-center justify-center text-center bg-black/20 border-t border-white/5">
            <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition duration-700" />
                <FileX size={48} className="text-gray-600 relative z-10 group-hover:text-gray-400 transition duration-300" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">No Documents On File</h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                This client has not uploaded any identity verification documents yet. 
                <br />
                <span className="text-cyan-500/50">System awaiting input...</span>
            </p>
        </div>

        {/* --- FOOTER BAR --- */}
        <div className="relative z-10 h-1 bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
        
      </div>
    </div>,
    document.body
  );
}