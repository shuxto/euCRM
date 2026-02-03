import { useState, useEffect } from 'react';
import { Phone, X, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// 1. SOUND ENGINE
const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
notifSound.volume = 0.5;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function NotificationSystem() {
  const [popups, setPopups] = useState<any[]>([]); // For Call Backs (Blue Box)
  const [toasts, setToasts] = useState<Toast[]>([]); // For Status Updates (Small Toast)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // --- PART A: LISTENER FOR CALL BACKS (MODIFIED) ---
  useEffect(() => {
    const handleCallbackAlert = (event: any) => {
       const lead = event.detail;
       if (currentUserId && lead.assigned_to === currentUserId) {
           triggerPopup(lead);
       }
    };

    window.addEventListener('crm-callback-trigger', handleCallbackAlert);
    return () => window.removeEventListener('crm-callback-trigger', handleCallbackAlert);
  }, [currentUserId]); 

  // --- PART B: LISTENER FOR TOASTS ---
  useEffect(() => {
    const handleEvent = (event: any) => {
      const { message, type } = event.detail;
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };

    window.addEventListener('crm-toast', handleEvent);
    return () => window.removeEventListener('crm-toast', handleEvent);
  }, []);

  // --- TRIGGERS ---
  const triggerPopup = (lead: any) => {
    if (localStorage.getItem('dismissed_cb_' + lead.id)) return;
    
    notifSound.play().catch(e => console.log('Sound blocked:', e));
    
    setPopups((prev) => {
        if (prev.find(p => p.id === lead.id)) return prev;
        return [...prev, lead];
    });

    setTimeout(() => { removePopup(lead.id); }, 60000);
  };

  const removePopup = (id: number) => {
    setPopups((prev) => prev.filter(p => p.id !== id));
  };

  const dismissPermanent = (id: number) => {
    localStorage.setItem('dismissed_cb_' + id, 'true');
    removePopup(id);
  };

  return (
    // FIX: Changed z-[9999] to z-9999
    <div className="fixed top-4 right-4 z-9999 flex flex-col gap-4 pointer-events-none">
      
      {/* 1. TOAST NOTIFICATIONS */}
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border 
            animate-in slide-in-from-right-full fade-in duration-300 w-72 backdrop-blur-md
            ${toast.type === 'success' ? 'bg-[#1e293b]/90 border-green-500/30 text-green-400' : 'bg-[#1e293b]/90 border-red-500/30 text-red-400'}
          `}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-sm font-bold text-gray-200">{toast.message}</span>
          <button 
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="ml-auto opacity-50 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* 2. CALL BACK ALERTS */}
      {popups.map((lead) => (
        <div 
          key={lead.id} 
          className="pointer-events-auto w-80 bg-[#1e293b]/95 backdrop-blur-xl border border-cyan-500/50 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-right duration-500 relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse ring-1 ring-cyan-500/50">
                <Phone className="text-cyan-400" size={18} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-wide">Callback Alert!</h4>
                <span className="text-[10px] text-cyan-300 font-mono bg-cyan-900/30 px-1.5 py-0.5 rounded">Now</span>
              </div>
            </div>
            <button 
              onClick={() => dismissPermanent(lead.id)}
              className="text-gray-400 hover:text-white transition w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-end border-b border-white/5 pb-2">
              <p className="text-white text-sm font-bold truncate pr-2">{lead.name} {lead.surname}</p>
              <a href={`sip:${lead.phone}`} className="text-green-400 hover:text-green-300 text-xs font-mono bg-green-900/20 px-2 py-1 rounded border border-green-500/30 transition flex items-center gap-1">
                <Phone size={10} /> Call
              </a>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-cyan-500/50 w-full animate-[shrink_60s_linear_forwards]"></div>
        </div>
      ))}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}