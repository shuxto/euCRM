import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, CalendarOff, Save } from 'lucide-react';

interface CallBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
  currentDate?: string | null;
}

export default function CallBackModal({ isOpen, onClose, onConfirm, currentDate }: CallBackModalProps) {
  const [dateValue, setDateValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentDate) {
        const d = new Date(currentDate);
        const isoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setDateValue(isoString);
      } else {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        const isoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setDateValue(isoString);
      }
    }
  }, [isOpen, currentDate]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-crm-bg border border-[#334155] rounded-xl shadow-2xl w-full max-w-sm p-6 relative transform transition-all scale-100">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
            <Clock size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Schedule Call Back</h2>
            <p className="text-xs text-slate-400">Set a reminder for this client</p>
          </div>
        </div>

        {/* Date Input */}
        <div className="space-y-2 mb-6">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Select Time
          </label>
          <input
            type="datetime-local"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full bg-crm-bg border border-[#334155] rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none scheme-dark"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirm(dateValue)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Save size={18} />
            Confirm Schedule
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onConfirm(null)}
              className="flex items-center justify-center gap-2 py-2 bg-[#334155] hover:bg-[#475569] text-slate-200 text-sm font-medium rounded-lg transition-all"
            >
              <CalendarOff size={16} />
              No Time
            </button>

            <button
              onClick={onClose}
              className="py-2 border border-[#334155] hover:bg-[#334155]/50 text-slate-400 text-sm font-medium rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}