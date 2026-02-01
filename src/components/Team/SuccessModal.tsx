import { CheckCircle2, AlertOctagon } from 'lucide-react';

interface Props {
  isOpen: boolean;
  type?: 'success' | 'error'; // Changed: Added '?' to make it optional
  title: string;
  message: string;
  onClose: () => void;
}

// Changed: Added default value "type = 'success'"
export default function SuccessModal({ isOpen, type = 'success', title, message, onClose }: Props) {
  if (!isOpen) return null;

  const isSuccess = type === 'success';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-200 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isSuccess ? 'border-cyan-500/30 shadow-cyan-500/20' : 'border-red-500/30 shadow-red-500/20'}`}>
        
        <div className={`p-6 flex flex-col items-center text-center border-b border-white/5 ${isSuccess ? 'bg-cyan-900/10' : 'bg-red-900/10'}`}>
          <div className={`mb-4 p-4 rounded-full border shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isSuccess ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
            {isSuccess ? <CheckCircle2 size={40} /> : <AlertOctagon size={40} />}
          </div>
          <h3 className="text-xl font-bold text-white mb-2 tracking-wide">{title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>

        <div className="p-4 bg-crm-bg">
          <button 
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition transform active:scale-95 border border-white/10 ${isSuccess ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20' : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'}`}
          >
            ACKNOWLEDGE
          </button>
        </div>

      </div>
    </div>
  );
}