import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Save, Loader2, CheckCircle, Globe, Mail, Phone, User } from 'lucide-react';

export default function ManualEntry() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone: '',
    email: '',
    country: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      // 1. Check for duplicates first
      const { data: dupes } = await supabase
        .from('crm_leads')
        .select('id')
        .or(`phone.eq.${formData.phone},email.eq.${formData.email}`);

      if (dupes && dupes.length > 0) {
        alert('Error: A lead with this Phone or Email already exists!');
        setLoading(false);
        return;
      }

      // 2. Insert Lead
      const { error } = await supabase.from('crm_leads').insert({
        name: formData.name,
        surname: formData.surname,
        phone: formData.phone,
        email: formData.email,
        country: formData.country,
        source_file: 'System', // <--- AUTOMATICALLY SET TO SYSTEM
        status: 'New',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      setSuccess(true);
      setFormData({ name: '', surname: '', phone: '', email: '', country: '' });
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (error: any) {
      alert('Error creating lead: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 bg-black/20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/30">
          <UserPlus size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Manual Registration</h2>
          <p className="text-gray-400 text-sm">Add a single lead directly to the database. Source will be <b>System</b>.</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in">
          <CheckCircle size={20} />
          <span className="font-bold">Lead successfully created!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* NAME */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-wider">First Name</label>
            <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input required name="name" value={formData.name} onChange={handleChange} placeholder="John"
                  className="w-full bg-crm-bg border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition" />
            </div>
          </div>
          
          {/* SURNAME */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-wider">Last Name</label>
            <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input required name="surname" value={formData.surname} onChange={handleChange} placeholder="Doe"
                  className="w-full bg-crm-bg border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition" />
            </div>
          </div>

          {/* PHONE */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-wider">Phone Number</label>
            <div className="relative">
                <Phone size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input required name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 234 567 890"
                  className="w-full bg-crm-bg border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition" />
            </div>
          </div>

          {/* EMAIL */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-wider">Email Address</label>
            <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com"
                  className="w-full bg-crm-bg border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition" />
            </div>
          </div>

          {/* COUNTRY */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-wider">Country</label>
            <div className="relative">
                <Globe size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input required name="country" value={formData.country} onChange={handleChange} placeholder="United Kingdom"
                  className="w-full bg-crm-bg border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition flex items-center gap-3 w-full md:w-auto justify-center">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          <span>Create System Lead</span>
        </button>
      </form>
    </div>
  );
}