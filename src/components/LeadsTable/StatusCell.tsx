import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase'; // <--- IMPORT SUPABASE
import { type Lead } from '../../hooks/useLeads';

interface StatusCellProps {
  lead: Lead;
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

export default function StatusCell({ lead, options, onUpdate, role }: StatusCellProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    <>
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
                onClick={() => {
                  onUpdate(lead.id, opt.label);
                  setIsOpen(false);
                  
                  // --- TRIGGER NOTIFICATION (Toast) ---
                  window.dispatchEvent(new CustomEvent('crm-toast', { 
                    detail: { message: `Status updated to ${opt.label}`, type: 'success' } 
                  }));

                  // --- SEND ADMIN ALERT (Bell) ---
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
    </>
  );
}