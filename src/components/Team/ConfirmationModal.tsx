import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  type?: 'danger' | 'success' | 'info';
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ConfirmationModal({ isOpen, type = 'danger', title, message, onConfirm, onClose, loading }: Props) {
  if (!isOpen) return null;

  // --- CYBERPUNK STYLES CONFIG ---
  const styles = {
    danger: {
      icon: <AlertTriangle className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" size={40} />,
      btn: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] border border-red-500/50",
      glow: "bg-red-600/20",
      border: "border-red-500/20",
      title: "text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-200"
    },
    success: {
      icon: <CheckCircle2 className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" size={40} />,
      btn: "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] border border-emerald-500/50",
      glow: "bg-emerald-600/20",
      border: "border-emerald-500/20",
      title: "text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200"
    },
    info: {
      icon: <Info className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]" size={40} />,
      btn: "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] border border-cyan-500/50",
      glow: "bg-cyan-600/20",
      border: "border-cyan-500/20",
      title: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200"
    }
  };

  const currentStyle = styles[type];

  // USE PORTAL to teleport this outside the table
  return createPortal(
    // 1. UPDATED Z-INDEX CLASS (Removed brackets)
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      
      {/* 1. DARK BACKDROP WITH BLUR */}
      <div 
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm animate-in fade-in duration-300 cursor-default"
        onClick={onClose}
      />

      {/* 2. THE MODAL */}
      <div className="relative w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 group">
        
        {/* NEON GLOW BEHIND MODAL */}
        <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-50 transition duration-500 group-hover:opacity-75 ${currentStyle.glow}`} />

        {/* GLASS CARD */}
        {/* 2. UPDATED BG COLOR (Used variable instead of hex) */}
        <div className="relative bg-crm-bg/90 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
            
            {/* Close Button X */}
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition cursor-pointer z-50"
            >
                <X size={20} />
            </button>

            <div className="p-8 flex flex-col items-center text-center">
                
                {/* ICON WITH PULSE */}
                <div className={`mb-6 p-5 rounded-full bg-black/40 border border-white/5 shadow-inner relative`}>
                    <div className={`absolute inset-0 rounded-full animate-pulse opacity-20 ${currentStyle.glow}`} />
                    {currentStyle.icon}
                </div>

                {/* TITLE WITH GRADIENT TEXT */}
                <h3 className={`text-2xl font-black uppercase tracking-wide mb-3 ${currentStyle.title}`}>
                    {title}
                </h3>

                {/* MESSAGE */}
                <p className="text-gray-400 text-sm leading-relaxed font-medium">
                    {message}
                </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="p-6 bg-black/20 border-t border-white/5 flex gap-4">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition border border-transparent hover:border-white/10 uppercase tracking-wider text-xs cursor-pointer" 
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    disabled={loading}
                    className={`flex-1 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${currentStyle.btn}`}
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            <span>Processing...</span>
                        </div>
                    ) : "Confirm Action"}
                </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
}