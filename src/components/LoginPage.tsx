import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, LayoutGrid } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-crm-bg">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-50 bg-[radial-gradient(at_0%_0%,hsla(253,16%,7%,1)_0,transparent_50%),radial-gradient(at_50%_0%,hsla(225,39%,30%,1)_0,transparent_50%),radial-gradient(at_100%_0%,hsla(339,49%,30%,1)_0,transparent_50%)]" />
      </div>

      <div className="w-full max-w-md z-10 p-4">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-white/5">
          <div className="text-center mb-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30 mb-4">
              <LayoutGrid size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">new crm</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="admin@crm.com" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="••••••••" required />
              </div>
            </div>
            {error && <div className="text-red-400 text-[10px] font-bold text-center uppercase">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}