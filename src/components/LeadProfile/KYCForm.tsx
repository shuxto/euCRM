import { User, MapPin, Save, UploadCloud, Landmark, Plus, Trash2, FileText, CreditCard, Loader2, FolderOpen, CheckCircle, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

// Standard Country List
const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Italy", "Spain", "Netherlands", "Switzerland",
  "Sweden", "Norway", "Denmark", "Finland", "Belgium", "Austria", "Ireland", "Poland", "Portugal", "Greece",
  "Japan", "South Korea", "Singapore", "Hong Kong", "New Zealand", "United Arab Emirates", "Saudi Arabia", "Qatar", "Israel", "Turkey",
  "Brazil", "Mexico", "Argentina", "Chile", "Colombia", "Peru", "South Africa", "India", "China", "Malaysia", "Thailand", "Indonesia", "Vietnam"
].sort();

interface Props {
  lead: any;
}

export default function KYCForm({ lead }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // --- NEW: SUCCESS POPUP STATE ---
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Data Form State
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', dob: '', nationality: '',
    idType: 'passport', idNumber: '', expiryDate: '',
    street: '', city: '', country: '',
    employment: 'employed', income: '0-25k', 
    source: '', 
    additionalInfo: '',
    banks: [{ id: Date.now(), name: '' }] 
  });

  // 2. Upload State
  const [uploadType, setUploadType] = useState('passport');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- AUTO-HIDE POPUP ---
  useEffect(() => {
    if (successMsg) {
        const timer = setTimeout(() => setSuccessMsg(null), 3000); // Hide after 3s
        return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // --- FETCH EXISTING DATA & LISTEN FOR UPDATES ---
  useEffect(() => {
    let channel: any;

    const fetchKYC = async () => {
        if (!lead?.id) return;
        setLoading(true);
        
        const { data } = await supabase
            .from('crm_kyc')
            .select('*')
            .eq('lead_id', lead.id)
            .maybeSingle();

        if (data) {
            setFormData({
                firstName: data.first_name || '',
                lastName: data.last_name || '',
                dob: data.date_of_birth || '',
                nationality: data.nationality || '',
                idType: data.document_type || 'passport',
                idNumber: data.document_number || '',
                expiryDate: data.document_expiry || '',
                street: data.street_address || '',
                city: data.city || '',
                country: data.residence_country || '',
                employment: data.employment_status || 'employed',
                income: data.annual_income || '0-25k',
                source: data.source_of_funds || '',
                additionalInfo: data.additional_info || '',
                banks: data.bank_details && Array.isArray(data.bank_details) && data.bank_details.length > 0 
                        ? data.bank_details 
                        : [{ id: Date.now(), name: '' }]
            });
        }
        setLoading(false);
    };

    fetchKYC();

    // --- REALTIME LISTENER FOR CRM AGENT ---
    // If the User updates their KYC from the Trading App, the Agent sees it instantly.
    if (lead?.id) {
        channel = supabase
            .channel(`crm-kyc-${lead.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for INSERT or UPDATE
                    schema: 'public',
                    table: 'crm_kyc',
                    filter: `lead_id=eq.${lead.id}`,
                },
                () => {
                    // Refresh data when change happens
                    fetchKYC();
                }
            )
            .subscribe();
    }

    return () => {
        if (channel) supabase.removeChannel(channel);
    }
  }, [lead.id]);


  // --- HANDLERS ---
  const addBank = () => setFormData(p => ({ ...p, banks: [...p.banks, { id: Date.now(), name: '' }] }));
  const removeBank = (id: number) => setFormData(p => ({ ...p, banks: p.banks.filter(b => b.id !== id) }));
  const updateBank = (id: number, val: string) => setFormData(p => ({ ...p, banks: p.banks.map(b => b.id === id ? { ...b, name: val } : b) }));


  // --- SAVE TO SQL ---
  const handleSaveData = async () => {
    if (!lead?.id) return;
    setSaving(true);

    const { error } = await supabase.from('crm_kyc').upsert({
        lead_id: lead.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dob || null,
        nationality: formData.nationality,
        document_type: formData.idType,
        document_number: formData.idNumber,
        document_expiry: formData.expiryDate || null,
        street_address: formData.street,
        city: formData.city,
        residence_country: formData.country,
        employment_status: formData.employment,
        annual_income: formData.income,
        source_of_funds: formData.source,
        additional_info: formData.additionalInfo,
        bank_details: formData.banks,
        updated_at: new Date().toISOString()
    }, { onConflict: 'lead_id' });

    setSaving(false);

    if (error) {
        alert('Error saving data: ' + error.message);
    } else {
        // 1. Update CRM Lead Status
        await supabase.from('crm_leads').update({ kyc_status: 'Pending' }).eq('id', lead.id);

        // 2. --- THE REALTIME FIX --- 
        // We MUST update the 'profiles' table too. This triggers the listener on the Client Side!
        if (lead.trading_account_id) {
             await supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', lead.trading_account_id);
        }

        // REPLACED ALERT WITH SUCCESS STATE
        setSuccessMsg('Personal Information Saved Successfully!'); 
    }
  };


  // --- UPLOAD FILE ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${lead.id}/${uploadType}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('kyc-documents')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from('crm_kyc_documents').insert({
            lead_id: lead.id,
            file_type: uploadType,
            file_name: file.name,
            file_path: fileName,
            is_verified: false
        });

        if (dbError) throw dbError;

        // REPLACED ALERT WITH SUCCESS STATE
        setSuccessMsg('Document Uploaded Successfully!');
        
    } catch (error: any) {
        alert('Upload failed: ' + error.message);
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };


  if (loading) return <div className="p-10 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" /> Loading KYC Data...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      
      {/* --- AMAZING SUCCESS POPUP --- */}
      {successMsg && (
        <div className="fixed top-10 right-10 z-50 animate-in slide-in-from-top-10 fade-in duration-300">
            {/* FIXED CLASSES HERE */}
            <div className="bg-[#1e232d] border border-green-500/30 rounded-2xl shadow-2xl shadow-green-500/20 p-5 flex items-center gap-4 min-w-75 relative overflow-hidden">
                {/* Glow Effect: FIXED bg-linear-to-b */}
                <div className="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-green-400 to-emerald-600"></div>
                
                <div className="p-3 bg-green-500/10 rounded-full text-green-400">
                    <CheckCircle size={24} />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm">Success!</h4>
                    <p className="text-gray-400 text-xs mt-0.5">{successMsg}</p>
                </div>
                <button onClick={() => setSuccessMsg(null)} className="ml-auto text-gray-500 hover:text-white transition">
                    <X size={16} />
                </button>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 mb-6">
        <h2 className="text-lg font-bold text-white">Update KYC Information</h2>
        <button 
            onClick={handleSaveData}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/50 text-white font-bold rounded-lg transition text-xs shadow-lg shadow-cyan-500/20"
        >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'SAVING...' : 'SAVE PERSONAL DATA'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
          
          {/* --- LEFT SIDE: DATA ENTRY --- */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
              
              {/* Identity Form */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
                 <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={16}/> Personal Identity</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name" val={formData.firstName} set={(v: string) => setFormData({...formData, firstName: v})} />
                    <Input label="Last Name" val={formData.lastName} set={(v: string) => setFormData({...formData, lastName: v})} />
                    
                    {/* NEW: Date Picker */}
                    <Input label="Date of Birth" type="date" val={formData.dob} set={(v: string) => setFormData({...formData, dob: v})} />
                    <Input label="Nationality" val={formData.nationality} set={(v: string) => setFormData({...formData, nationality: v})} />
                    
                    <div className="col-span-2 h-px bg-white/5 my-2"></div>
                    <Input label="Document Number" placeholder="Passport / ID No." val={formData.idNumber} set={(v: string) => setFormData({...formData, idNumber: v})} />
                    <Input label="Expiry Date" type="date" val={formData.expiryDate} set={(v: string) => setFormData({...formData, expiryDate: v})} />
                 </div>
              </div>

              {/* Address Form */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
                 <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin size={16}/> Residential Address</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Input label="Street Address" val={formData.street} set={(v: string) => setFormData({...formData, street: v})} /></div>
                    <Input label="City" val={formData.city} set={(v: string) => setFormData({...formData, city: v})} />
                    
                    {/* NEW: Country Selector */}
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Country of Residence</label>
                        <select 
                            value={formData.country}
                            onChange={(e) => setFormData({...formData, country: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                        >
                            <option value="">-- Select Country --</option>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                 </div>
              </div>

              {/* Financial & Banking Form */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
                 <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Landmark size={16}/> Financial & Banking</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Employment</label>
                        <select 
                            value={formData.employment}
                            onChange={(e) => setFormData({...formData, employment: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                        >
                            <option value="employed">Employed</option>
                            <option value="self_employed">Self-Employed</option>
                            <option value="unemployed">Unemployed</option>
                            <option value="crypto_trader">Crypto Trader</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Annual Income</label>
                        <select 
                            value={formData.income}
                            onChange={(e) => setFormData({...formData, income: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                        >
                            <option value="0-25k">$0 - $25k</option>
                            <option value="25k-50k">$25k - $50k</option>
                            <option value="50k-100k">$50k - $100k</option>
                            <option value="100k+">$100k+</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <Input label="Source of Funds" placeholder="e.g. Salary, Crypto Trading" val={formData.source} set={(v: string) => setFormData({...formData, source: v})} />
                    </div>

                    {/* Banking Section */}
                    <div className="col-span-2 pt-4 mt-2 border-t border-white/5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Landmark size={14} />
                                <span className="text-xs font-bold uppercase tracking-widest">Bank details</span>
                            </div>
                            <button onClick={addBank} className="flex items-center gap-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded transition border border-emerald-500/20">
                                <Plus size={12} /> ADD BANK
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.banks.map((bank: any, index: number) => (
                                <div key={bank.id} className="flex items-end gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <div className="w-full">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">
                                            {index === 0 ? 'Primary Bank Name' : `Bank #${index + 1}`}
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. Chase, Revolut"
                                            value={bank.name} 
                                            onChange={(e) => updateBank(bank.id, e.target.value)} 
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition placeholder:text-gray-600" 
                                        />
                                    </div>
                                    {formData.banks.length > 1 && (
                                        <button onClick={() => removeBank(bank.id)} className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition mb-px">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
              </div>

              {/* Additional Information Form */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={16}/> Additional Information</h3>
                 <textarea 
                    value={formData.additionalInfo}
                    onChange={(e) => setFormData({...formData, additionalInfo: e.target.value})}
                    placeholder="Enter any other details here (e.g. client has dual citizenship, specific bank restrictions, etc.)"
                    className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-cyan-500 transition resize-none placeholder:text-gray-600"
                 />
              </div>

          </div>

          {/* --- RIGHT SIDE: FILE UPLOAD --- */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
              
              {/* UPLOAD PANEL */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/5 h-full flex flex-col">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <UploadCloud size={16} className="text-blue-400"/> Document Upload
                  </h3>

                  {/* 1. Select Document Type */}
                  <div className="mb-6">
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">Select Document Type</label>
                      <div className="grid grid-cols-2 gap-2">
                          <TypeBtn type="passport" label="Passport" icon={<User size={14}/>} active={uploadType} set={setUploadType} />
                          <TypeBtn type="id_card" label="ID Card" icon={<FileText size={14}/>} active={uploadType} set={setUploadType} />
                          <TypeBtn type="driver_license" label="License" icon={<FileText size={14}/>} active={uploadType} set={setUploadType} />
                          <TypeBtn type="credit_card" label="Credit Card" icon={<CreditCard size={14}/>} active={uploadType} set={setUploadType} />
                          <TypeBtn type="other" label="Other Doc" icon={<FolderOpen size={14}/>} active={uploadType} set={setUploadType} />
                      </div>
                  </div>

                  {/* 2. Drop Zone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-xl bg-black/20 flex flex-col items-center justify-center p-6 text-center transition duration-300 group cursor-pointer ${uploading ? 'border-cyan-500/50 opacity-50' : 'border-white/10 hover:border-cyan-500/50'}`}
                  >
                      <div className="p-4 rounded-full bg-white/5 text-gray-400 group-hover:text-cyan-400 group-hover:scale-110 transition mb-4">
                          {uploading ? <Loader2 size={32} className="animate-spin"/> : <UploadCloud size={32}/>}
                      </div>
                      <p className="text-gray-300 font-bold text-sm mb-1">{uploading ? 'Uploading...' : 'Click to Upload'}</p>
                      <p className="text-gray-500 text-xs">or drag and drop {uploadType.replace('_', ' ')}</p>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,.pdf"
                  />

                  <div className="mt-6 text-center">
                    <p className="text-[10px] text-gray-500">Supported formats: JPG, PNG, PDF (Max 5MB)</p>
                  </div>

              </div>
          </div>

      </div>
    </div>
  );
}

// --- Helper Components ---

interface InputProps {
  label: string;
  type?: string;
  placeholder?: string;
  val: string;
  set: (value: string) => void;
}

function Input({ label, type="text", placeholder, val, set }: InputProps) {
    return (
        <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">{label}</label>
            <input 
              type={type} placeholder={placeholder} value={val} onChange={(e) => set(e.target.value)} 
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 transition placeholder:text-gray-600" 
              style={{ colorScheme: 'dark' }} // Forces date picker to be dark mode
            />
        </div>
    );
}

interface TypeBtnProps {
    type: string;
    label: string;
    icon: any;
    active: string;
    set: (type: string) => void;
}

function TypeBtn({ type, label, icon, active, set }: TypeBtnProps) {
    const isActive = active === type;
    return (
        <button 
            onClick={() => set(type)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all w-full justify-center ${isActive ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'}`}
        >
            {icon} {label}
        </button>
    );
}