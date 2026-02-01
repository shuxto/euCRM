// src/components/ProfileSettingsModal.tsx
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Lock, Loader2, Save, Camera, ShieldCheck, Key } from 'lucide-react';

interface Props { onClose: () => void; }

export default function ProfileSettingsModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ 
    real_name: '', 
    password: '',
    avatar_url: '' 
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. FETCH MY OWN DATA ON MOUNT
  useEffect(() => {
    async function fetchMe() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data } = await supabase.from('crm_users').select('real_name, avatar_url').eq('id', user.id).single();
        if (data) {
            setFormData(prev => ({ 
                ...prev, 
                real_name: data.real_name || '', 
                avatar_url: data.avatar_url || '' 
            }));
        }
    }
    fetchMe();
  }, []);

  // 2. IMAGE COMPRESSION & UPLOAD
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0 || !userId) return;
      setUploading(true);

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}-${Math.random()}.${fileExt}`;

      if (file.size > 10 * 1024 * 1024) throw new Error('File size must be less than 10MB');

      const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300; 
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    }, 'image/jpeg', 0.85);
                };
            };
            reader.onerror = error => reject(error);
        });
      };

      const compressedFile = await resizeImage(file);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));

    } catch (error: any) {
      alert('Error uploading avatar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    
    // Check session validity before calling
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert("Session expired. Please refresh.");
        setLoading(false);
        return;
    }

    // Call the function normally (Supabase adds the headers automatically)
    const { error } = await supabase.functions.invoke('update-user', {
      body: { 
        target_id: userId, 
        updates: { 
            password: formData.password || undefined, 
            avatar_url: formData.avatar_url
        } 
      }
    });

    setLoading(false);
    if (error) {
        console.error(error);
        alert('Error: ' + error.message);
    } else {
        window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Profile updated successfully!', type: 'success' } }));
        window.dispatchEvent(new CustomEvent('crm-profile-update')); 
        onClose();
    }
  };

  return (
    // FIX 1: Use z-9999
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-9999 flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      {/* CARD CONTAINER */}
      {/* FIX 2: Use bg-crm-bg/90 */}
      <div className="relative w-full max-w-sm bg-crm-bg/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-blue-600/20 to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* CLOSE BUTTON */}
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition z-10"
        >
            <X size={18} />
        </button>

        <div className="p-8 pt-10 flex flex-col items-center">
            
            {/* 1. AVATAR SECTION */}
            <div className="relative group cursor-pointer mb-6" onClick={() => fileInputRef.current?.click()}>
                
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-linear-to-br from-blue-500 to-cyan-400 rounded-full opacity-0 group-hover:opacity-75 blur-md transition duration-500" />
                
                {/* The Image Container */}
                {/* FIX 3: Use border-crm-bg */}
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-crm-bg shadow-2xl bg-gray-800 flex items-center justify-center z-10">
                    {uploading ? (
                        <Loader2 className="animate-spin text-blue-400" size={32} />
                    ) : formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-50" />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-gray-700 to-gray-800 flex items-center justify-center text-gray-400 text-3xl font-bold group-hover:text-gray-300 transition">
                            {formData.real_name?.substring(0, 2).toUpperCase() || 'ME'}
                        </div>
                    )}

                    {/* Camera Icon Overlay (Shows on Hover) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                        <Camera size={28} className="text-white drop-shadow-lg" />
                    </div>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/jpeg, image/png"
                    className="hidden" 
                />
            </div>

            {/* USER INFO (Read Only) */}
            <h2 className="text-2xl font-bold text-white tracking-tight mb-1">{formData.real_name || 'User'}</h2>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8">
                <ShieldCheck size={12} />
                <span>Verified Account</span>
            </div>

            {/* 2. FORM SECTION */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
               
               {/* PASSWORD INPUT */}
               <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-1">Change Password</label>
                 <div className="relative group">
                    <div className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition duration-300">
                        <Key size={16} />
                    </div>
                    <input 
                        type="password" 
                        placeholder="••••••••" 
                        minLength={6} 
                        className="w-full bg-black/30 border border-white/10 pl-10 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:bg-black/50 outline-none transition duration-300 shadow-inner"
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                    <div className="absolute right-3 top-3.5">
                        <Lock size={14} className="text-gray-600" />
                    </div>
                 </div>
               </div>

               {/* SUBMIT BUTTON */}
               <button 
                  disabled={loading || uploading} 
                  type="submit" 
                  className="mt-4 w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition transform active:scale-95 flex justify-center items-center gap-2 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Save Changes</span>
               </button>

            </form>
        </div>
      </div>
    </div>
  );
}