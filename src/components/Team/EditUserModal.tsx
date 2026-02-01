import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCog, X, User, Lock, Loader2, Save } from 'lucide-react';
import type { CRMUser } from './types';

interface Props { user: CRMUser; onClose: () => void; onSuccess: () => void; }

export default function EditUserModal({ user, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ real_name: user.real_name || '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.functions.invoke('update-user', {
      body: { 
        target_id: user.id, 
        updates: { 
            full_name: formData.real_name,
            password: formData.password || undefined // Only send if typed
        } 
      }
    });

    setLoading(false);
    if (error) alert('Error: ' + error.message);
    else {
        window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'User updated!', type: 'success' } }));
        onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#1e293b] border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-crm-bg">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><UserCog className="text-blue-400" /> Edit User</h3>
          <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
           <div className="relative group">
            <User className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <input required type="text" placeholder="Full Name" className="w-full bg-black/20 border border-gray-600 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none transition"
              value={formData.real_name} onChange={e => setFormData({...formData, real_name: e.target.value})} />
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition" size={18} />
            <input type="password" placeholder="New Password (Optional)" minLength={6} className="w-full bg-black/20 border border-gray-600 pl-10 py-3 rounded-xl text-sm text-white focus:border-blue-500 outline-none transition"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>

          <button disabled={loading} type="submit" className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}