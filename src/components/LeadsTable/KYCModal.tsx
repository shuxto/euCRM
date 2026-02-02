import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ShieldCheck, ShieldAlert, Shield, Mail, Phone, 
  User, Fingerprint, Check, Save, Loader2, FileText 
} from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

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
  
  // --- STATE FOR NOTES ---
  const [kycNote, setKycNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. LISTEN FOR ESCAPE KEY & FETCH NOTES
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    fetchKycNote();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, leadId]);

  const fetchKycNote = async () => {
    try {
      setLoadingNote(true);
      const { data, error } = await supabase
        .from('crm_leads')
        .select('skyc_note') 
        .eq('id', leadId)
        .single();

      if (data && !error) {
        setKycNote(data.skyc_note || '');
      }
    } catch (err) {
      console.error('Error fetching KYC note:', err);
    } finally {
      setLoadingNote(false);
    }
  };

  const handleSaveNote = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('crm_leads')
        .update({ skyc_note: kycNote })
        .eq('id', leadId);
      
      if (!error) {
        window.dispatchEvent(new CustomEvent('crm-toast', { 
            detail: { message: 'KYC Note Saved', type: 'success' } 
        }));
      }
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  };

  // 2. COPY FUNCTION
  const handleCopyId = () => {
    navigator.clipboard.writeText(leadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* 2. GLAMORPHIC CARD 
          Fixed: w-[95%] for mobile margins
          Fixed: h-162.5 (650px) but with max-h-[90vh] so it fits on small screens
      */}
      <div className="relative w-[95%] sm:w-full max-w-2xl h-162.5 max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)] bg-slate-900/90 backdrop-blur-2xl animate-in zoom-in-95 duration-300 flex flex-col">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute bottom-[-50%] right-[-50%] w-full h-full bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

        {/* CLOSE BUTTON */}
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
        >
            <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* --- HEADER SECTION --- */}
        <div className="relative z-10 p-6 border-b border-white/5 shrink-0 bg-[#1e293b]/40">
            <div className="flex gap-5">
                {/* AVATAR */}
                <div className="relative group shrink-0 mt-1">
                    {/* Fixed Gradient Class */}
                    <div className="absolute inset-0 bg-linear-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-500" />
                    <div className="relative w-16 h-16 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-gray-300 shadow-2xl">
                        <User size={28} />
                    </div>
                    {/* Status Dot */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center border border-white/10 ${badge.color}`}>
                       {badge.icon}
                    </div>
                </div>

                {/* INFO COLUMN */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {/* Name */}
                    <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-lg truncate pr-8">
                        {leadName}
                    </h2>

                    {/* Badge Row */}
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest border ${badge.bg} ${badge.color} ${badge.border} ${badge.glow}`}>
                            {currentStatus || 'Not Verified'}
                        </span>
                        
                        <button 
                            onClick={handleCopyId}
                            className="px-2 py-0.5 rounded-full border border-white/5 bg-white/5 text-[10px] text-gray-400 flex items-center gap-1 hover:bg-white/10 hover:text-white hover:border-cyan-500/50 transition cursor-copy active:scale-95"
                        >
                            {copied ? <Check size={10} className="text-green-400"/> : <Fingerprint size={10} />}
                            {copied ? <span className="text-green-400 font-bold">Copied!</span> : leadId.substring(0, 8)}
                        </button>
                    </div>

                    {/* Contact Info Inline */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-gray-400 mt-1">
                        <div className="flex items-center gap-1.5 hover:text-cyan-400 transition group cursor-default">
                            <Phone size={12} className="text-cyan-500/70 group-hover:text-cyan-400" />
                            <span className="">{phone}</span>
                        </div>
                        <div className="hidden sm:block w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-1.5 hover:text-purple-400 transition group cursor-default">
                            <Mail size={12} className="text-purple-500/70 group-hover:text-purple-400" />
                            {/* Fixed Max Width Class */}
                            <span className="truncate max-w-50" title={email}>{email}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="relative z-10 p-6 flex-1 flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Verification Notes</span>
                </div>
            </div>
            
            {/* Expanded Container */}
            <div className="relative group flex-1">
                {/* Fixed Inset and Gradient Class */}
                <div className="absolute -inset-px bg-linear-to-r from-cyan-500/20 to-blue-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 blur-sm pointer-events-none" />
                
                <textarea 
                    value={kycNote}
                    onChange={(e) => setKycNote(e.target.value)}
                    disabled={loadingNote}
                    placeholder={loadingNote ? "Loading notes..." : "Enter manual verification details, document IDs, or internal remarks here..."}
                    className="w-full h-full bg-[#0B1120] border border-white/10 rounded-xl p-5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:bg-[#0F172A] transition-all resize-none placeholder:text-gray-600 font-sans leading-relaxed tracking-normal"
                />
            </div>

            {/* --- FOOTER ACTION BAR --- */}
            <div className="pt-4 flex justify-end shrink-0">
                 <button 
                    onClick={handleSaveNote}
                    disabled={loadingNote || saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{saving ? 'Saving...' : 'Save Note'}</span>
                </button>
            </div>

        </div>

        {/* --- BOTTOM DECORATION --- */}
        {/* Fixed Gradient Class */}
        <div className="relative z-10 h-1 bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-50 shrink-0" />
        
      </div>
    </div>,
    document.body
  );
}