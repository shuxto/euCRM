import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, AlertTriangle, Megaphone } from 'lucide-react';

interface AlertPayload {
  targetUserIds: string[]; 
  message: string;
  type: 'ticker' | 'popup';
}

export default function GlobalAlertDisplay() {
  const [alert, setAlert] = useState<AlertPayload | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // 1. Get Current User ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // 2. Listen for Broadcasts
  useEffect(() => {
    if (!currentUserId) return; 

    const channel = supabase.channel('global-alerts')
      .on('broadcast', { event: 'flash-alert' }, (payload) => {
        const data = payload.payload as AlertPayload;
        
        // Check if I am in the list OR if list contains 'all'
        if (data.targetUserIds.includes('all') || data.targetUserIds.includes(currentUserId)) {
          setAlert(data);
          setVisible(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // 3. TIMER LOGIC (UPDATED DURATION)
  useEffect(() => {
    if (visible && alert) {
      
      // LOGIC: 5 Minutes for Popup, 1 Minute for Ticker
      const duration = alert.type === 'popup' ? 300000 : 60000; 

      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setAlert(null), 500); 
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, alert]); 

  if (!visible || !alert) return null;

  // --- STYLE A: TICKER ---
  if (alert.type === 'ticker') {
    return (
      <div className="fixed top-0 left-0 right-0 z-99999 bg-yellow-500 text-black font-bold h-12 flex items-center shadow-xl border-b-4 border-yellow-600 overflow-hidden">
        {/* Static Label */}
        <div className="absolute left-0 z-10 h-full bg-yellow-600 px-4 flex items-center text-black shadow-lg">
           <Megaphone className="animate-pulse mr-2" size={20} />
           ALERT
        </div>
        
        {/* Scrolling Text Container */}
        <div className="w-full h-full flex items-center relative">
            <div className="animate-marquee text-lg uppercase tracking-widest absolute">
                {alert.message}
            </div>
        </div>

        <button 
            onClick={() => setVisible(false)}
            className="absolute right-2 z-20 top-1/2 -translate-y-1/2 p-1 bg-black/10 hover:bg-black/20 rounded-full transition"
        >
            <X size={18} />
        </button>
      </div>
    );
  }

  // --- STYLE B: POPUP ---
  if (alert.type === 'popup') {
    return (
      <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-300 p-4">
        <div className="w-full max-w-2xl bg-red-600 text-white rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.6)] border-4 border-red-400 p-8 relative overflow-hidden text-center">
            
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20"></div>
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-red-500 rounded-full blur-[80px]"></div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="mb-4 p-4 rounded-full bg-white/20 animate-bounce">
                    <AlertTriangle size={64} className="text-white" />
                </div>
                
                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 drop-shadow-lg wrap-break-word w-full">
                    {alert.message}
                </h2>

                <p className="text-red-200 text-sm font-mono mb-8 uppercase tracking-widest">
                    Identify Confirmed • Priority Alpha
                </p>

                <button 
                    onClick={() => setVisible(false)}
                    className="px-12 py-4 bg-white text-red-600 text-xl font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition shadow-2xl"
                >
                    Acknowledge
                </button>
            </div>
        </div>
      </div>
    );
  }

  return null;
}