import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Lead } from '../../hooks/useLeads';
import CallBackModal from './CallBackModal';

interface StatusCellProps {
  // FIX: We add callback_time manually here so TypeScript stops complaining
  lead: Lead & { callback_time?: string | null }; 
  options: any[];
  onUpdate: (id: string, newStatus: string) => void;
  role?: string;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) return 'rgba(255,255,255,0.1)';
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper to calculate time left
const getTimeStatus = (dateStr: string | null) => {
  if (!dateStr) return { text: "NO TIME", color: "text-slate-400", isOverdue: false };
  
  const target = new Date(dateStr).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  // IMMEDIATE OVERDUE CHECK
  if (diff <= 0) return { text: "OVERDUE", color: "text-red-500 font-bold animate-pulse", isOverdue: true };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (hours > 24) return { text: `${Math.floor(hours / 24)}d left`, color: "text-blue-400", isOverdue: false };
  // Show seconds if less than 5 minutes left
  if (hours === 0 && minutes < 5) return { text: `${minutes}m ${seconds}s`, color: "text-orange-400", isOverdue: false };
  return { text: `${hours}h ${minutes}m`, color: "text-emerald-400", isOverdue: false };
};

export default function StatusCell({ lead, options, onUpdate, role }: StatusCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // FIX 1: Local State for "Instant" updates (Optimistic UI)
  const [optimisticDate, setOptimisticDate] = useState(lead.callback_time);

  const [timeStatus, setTimeStatus] = useState(getTimeStatus(lead.callback_time || null));

  // Sync local state if parent prop updates (e.g. from DB refetch)
  useEffect(() => {
    setOptimisticDate(lead.callback_time);
  }, [lead.callback_time]);

  // Update the timer every second
  useEffect(() => {
    const isCallBack = lead.status === 'call_back' || lead.status === 'Call Back';

    // FIX: Timer now depends on optimisticDate
    if (isCallBack && optimisticDate) {
      const interval = setInterval(() => {
        // @ts-ignore
        setTimeStatus(getTimeStatus(optimisticDate));
      }, 1000); 
      return () => clearInterval(interval);
    }
  }, [lead.status, optimisticDate]);

  const handleCallbackConfirm = async (date: string | null) => {
    // 1. Force UI Update Immediately (Visual Feedback)
    setTimeStatus(getTimeStatus(date));
    setOptimisticDate(date); // <--- Forces timer to update instantly

    // 2. RESET TOAST MEMORY (Fixes the "Toast won't come back" bug)
    // If I schedule a new time, I want to be alerted again!
    localStorage.removeItem('dismissed_cb_' + lead.id);

    // 3. Prepare Data
    const finalDate = date ? new Date(date).toISOString() : null;

    // 4. FIND THE CORRECT STATUS STRING
    const validCallBackStatus = options.find(o => 
        o.label.toLowerCase().replace(/_/g, ' ') === 'call back' || 
        o.label.toLowerCase() === 'callback'
    )?.label || 'Call Back'; 

    // 4. SINGLE DB UPDATE
    const { error } = await supabase
        .from('crm_leads')
        .update({ 
            status: validCallBackStatus, 
            callback_time: finalDate 
        })
        .eq('id', lead.id);

    if (error) {
        console.error("Save failed:", error);
        window.dispatchEvent(new CustomEvent('crm-toast', { 
            detail: { message: `Error saving: ${error.message}`, type: 'error' } 
        }));
        return;
    }
    
    // 5. Update Parent UI & Trigger Toast
    onUpdate(lead.id, validCallBackStatus); 
    
    window.dispatchEvent(new CustomEvent('crm-toast', { 
        detail: { message: `Call Back scheduled!`, type: 'success' } 
    }));

    setShowModal(false);
  };

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null); 
  
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const visibleOptions = options.filter(opt => {
      const label = opt.label.toLowerCase();
      const labelClean = label.replace(/\s/g, ''); // "upsale"

      if (role === 'admin' || role === 'manager') return true;
      
      // 1. FIXED: FUZZY MATCH BLOCKER
      // Blocks "up sale", "upsale", "Up-Sale", etc.
      if (role === 'conversion' && labelClean.includes('upsale')) return false;

      return !['trash', 'archived'].includes(label);
  });

  const currentOption = options.find(o => o.label === lead.status) || { label: lead.status, hex_color: '#94a3b8' };

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const showAbove = spaceBelow < 250; 

        setMenuStyle({
            top: showAbove ? (rect.top - 200) : (rect.bottom + 4), 
            left: rect.left,
            width: 192 
        });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) return;
      if (menuRef.current && menuRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', () => setIsOpen(false)); 

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', () => setIsOpen(false));
    };
  }, [isOpen]);

  // --- NEW: LOGIC TO SEND ADMIN ALERTS ---
  const checkAndSendAlert = async (newStatus: string) => {
      const clean = newStatus.toLowerCase().replace(/\s/g, '');
      const importantStatuses = ['upsale', 'ftd', 'transferred'];
      
      if (importantStatuses.some(s => clean.includes(s))) {
          // 1. Get Current User (Who did it?)
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { data: userData } = await supabase.from('crm_users').select('real_name').eq('id', user.id).single();
          const actorName = userData?.real_name || 'Agent';

          // 2. Get Admins & Managers
          const { data: recipients } = await supabase.from('crm_users').select('id').in('role', ['admin', 'manager']);
          if (!recipients || recipients.length === 0) return;

          // 3. Send Notification with Clickable Link
          const notifications = recipients.map(r => ({
              user_id: r.id,
              title: `🔥 Important: ${newStatus}`,
              message: `${actorName} changed status to ${newStatus}. Click to view details.`,
              related_lead_id: lead.id, // <--- Saves the ID for clicking
              is_read: false
          }));

          await supabase.from('crm_notifications').insert(notifications);
      }
  };
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-1">
      {/* TIMER DISPLAY */}
      {/* @ts-ignore */}
      {(lead.status === 'call_back' || lead.status === 'Call Back') && (
        <div 
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider cursor-pointer hover:underline px-1 ${timeStatus.color}`}
        >
            {timeStatus.isOverdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
            <span>{timeStatus.text}</span>
        </div>
      )}

      <button 
        ref={buttonRef}
        onClick={toggleDropdown}
        className="w-full px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border flex items-center justify-between transition-all active:scale-95 group"
        style={{ 
            backgroundColor: hexToRgba(currentOption.hex_color, 0.15), 
            borderColor: hexToRgba(currentOption.hex_color, 0.3),
            color: currentOption.hex_color === '#ffffff' ? '#e2e8f0' : currentOption.hex_color
        }}
      >
        <span className="truncate mr-2 uppercase tracking-wide text-[10px] drop-shadow-sm">{lead.status}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 opacity-70 group-hover:opacity-100 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div 
            ref={menuRef} 
            className="fixed bg-crm-bg border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            style={{ 
                zIndex: 9999,
                top: menuStyle.top, 
                left: menuStyle.left,
                width: menuStyle.width,
                transformOrigin: menuStyle.top < (buttonRef.current?.getBoundingClientRect().top || 0) ? 'bottom left' : 'top left'
            }}
        >
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {visibleOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={async () => {
                  setIsOpen(false);

                  // 1. INTERCEPT "CALL BACK" (Open Modal)
                  if (opt.label.toLowerCase().replace(/_/g, ' ') === 'call back') {
                      setShowModal(true);
                      return;
                  }

                  // 2. FOR ANY OTHER STATUS -> CLEAR THE TIME (Fixes "Memory" Bug)
                  // We silently wipe the callback_time so it starts fresh next time
                  await supabase
                    .from('crm_leads')
                    .update({ callback_time: null })
                    .eq('id', lead.id);

                  // 3. Standard Update
                  onUpdate(lead.id, opt.label);
                  
                  window.dispatchEvent(new CustomEvent('crm-toast', { 
                    detail: { message: `Status updated to ${opt.label}`, type: 'success' } 
                  }));

                  checkAndSendAlert(opt.label);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <div 
                  className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)]" 
                  style={{ backgroundColor: opt.hex_color }} 
                />
                <span className="flex-1">{opt.label}</span>
                {lead.status === opt.label && <Check size={12} className="text-white" />}
              </button>
            ))}
          </div>
        </div>,
        document.body 
      )}

      <CallBackModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleCallbackConfirm}
        // @ts-ignore
        currentDate={lead.callback_time}
      />
    </div>
  );
}