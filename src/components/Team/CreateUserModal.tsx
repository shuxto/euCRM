import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, X, User, Mail, Lock, Briefcase, Loader2, Star } from 'lucide-react';

interface Props { onClose: () => void; onSuccess: () => void; }

export default function CreateUserModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', real_name: '', role: 'conversion' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // --- NEW: CALL EDGE FUNCTION INSTEAD OF SQL ---
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { 
          email: formData.email, 
          password: formData.password, 
          real_name: formData.real_name, 
          role: formData.role 
        }
      });

      // 1. Check for Network/System Errors
      if (error) throw new Error(error.message || 'Connection to Edge Function failed');
      
      // 2. Check for Logic Errors (e.g. "User already exists") sent by the function
      if (data?.error) throw new Error(data.error);

      // --- SUCCESS ---
      window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'User created successfully!', type: 'success' } }));
      onSuccess(); // Triggers parent popup to close and refresh list

    } catch (err: any) { 
        // Show error alert
        alert('Error: ' + err.message); 
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-crm-bg/90 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 via-purple-500 to-cyan-500" />

        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><UserPlus className="text-blue-400" /> New Member</h3>
          <button onClick={onClose}><X className="text-gray-500 hover:text-white transition" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
           <div className="relative group">
            <User className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <input required type="text" placeholder="Full Name" className="w-full bg-black/20 border border-white/10 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none transition shadow-inner"
              value={formData.real_name} onChange={e => setFormData({...formData, real_name: e.target.value})} />
          </div>
          <div className="relative group">
            <Mail className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <input required type="email" placeholder="Email Address" className="w-full bg-black/20 border border-white/10 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none transition shadow-inner"
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <input required type="password" placeholder="Password" minLength={6} className="w-full bg-black/20 border border-white/10 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none transition shadow-inner"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div className="relative group">
            <Briefcase className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <select className="w-full bg-black/20 border border-white/10 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer transition shadow-inner"
              value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
              <option value="conversion" className="bg-slate-900">Conversion (Agent)</option>
              <option value="retention" className="bg-slate-900">Retention</option>
              <option value="team_leader" className="bg-slate-900">Team Leader</option>
              <option value="manager" className="bg-slate-900">Manager</option>
              <option value="compliance" className="bg-slate-900">Compliance</option>
              <option value="admin" className="bg-slate-900">Admin</option>
            </select>
          </div>

          <button disabled={loading} type="submit" className="mt-4 w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/30 transition transform active:scale-95 flex justify-center items-center gap-2 border border-white/10">
            {loading ? <Loader2 className="animate-spin" /> : <Star size={18} className="fill-white" />}
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}