import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, X, Loader2, Briefcase } from 'lucide-react';
import type { CRMUser } from './types';

interface Props { user: CRMUser; onClose: () => void; onSuccess: () => void; }

export default function PromoteModal({ user, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(user.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === user.role) return onClose(); // No change
    setLoading(true);
    
    const { error } = await supabase.functions.invoke('update-user', {
      body: { target_id: user.id, updates: { role: role } }
    });

    setLoading(false);
    if (error) alert('Error: ' + error.message);
    else {
        window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Role updated successfully!', type: 'success' } }));
        onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#1e293b] border border-gray-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-crm-bg">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><TrendingUp className="text-green-400" /> Promote User</h3>
          <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
           <p className="text-sm text-gray-400">Change role for <span className="text-white font-bold">{user.real_name}</span>.</p>
           
           <div className="relative group">
            <Briefcase className="absolute left-3 top-3.5 text-gray-500 transition" size={18} />
            <select className="w-full bg-black/20 border border-gray-600 pl-10 py-3 rounded-xl text-sm text-white focus:border-green-500 outline-none appearance-none cursor-pointer transition"
              value={role} onChange={e => setRole(e.target.value as any)}>
              {/* EXCLUDING ADMIN AND MANAGER AS REQUESTED */}
              <option value="conversion" className="bg-slate-900">Conversion (Agent)</option>
              <option value="retention" className="bg-slate-900">Retention</option>
              <option value="team_leader" className="bg-slate-900">Team Leader</option>
              <option value="compliance" className="bg-slate-900">Compliance</option>
            </select>
          </div>

          <button disabled={loading} type="submit" className="mt-4 w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <TrendingUp size={18} />}
            Update Role
          </button>
        </form>
      </div>
    </div>
  );
}