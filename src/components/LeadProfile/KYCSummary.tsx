import { User, MapPin, Briefcase, ShieldCheck, ShieldAlert, Shield, Fingerprint, Check, FileText, Landmark, CreditCard, FileBox, Loader2, AlertCircle, FolderOpen, ExternalLink, Info, XCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import ConfirmationModal from '../Team/ConfirmationModal';
import SuccessModal from '../Team/SuccessModal'; // ✅ Using your existing 1-button modal

interface Props {
  lead: any;
}

export default function KYCSummary({ lead }: Props) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [kycData, setKycData] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  
  // --- MODAL STATES ---
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 1. CONFIRMATION MODAL (2 Buttons: Confirm/Cancel)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
      title: '',
      message: '',
      type: 'info' as 'info' | 'danger' | 'success',
      action: () => {}
  });

  // 2. SUCCESS MODAL (1 Button: OK)
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
        if (!lead?.id) return;
        setLoading(true);

        try {
            const { data: profile } = await supabase.from('crm_kyc').select('*').eq('lead_id', lead.id).maybeSingle();
            if (profile) setKycData(profile);

            const { data: documents } = await supabase.from('crm_kyc_documents').select('*').eq('lead_id', lead.id).order('uploaded_at', { ascending: false });
            if (documents) setDocs(documents);

        } catch (error) {
            console.error('Error fetching KYC:', error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [lead.id]);

  // --- VERIFICATION LOGIC ---
  const initiateVerificationToggle = () => {
      if (!lead.trading_account_id) {
          alert('Missing Trading ID'); 
          return;
      }

      const currentStatus = lead.kyc_status;
      const isVerified = currentStatus === 'Approved' || currentStatus === 'Verified' || currentStatus === 'verified'; 

      if (isVerified) {
          // REVOKE FLOW
          setConfirmConfig({
              type: 'danger',
              title: 'REVOKE ACCESS?',
              message: `Are you sure you want to UNVERIFY ${lead.name || 'this user'}? \n\nThey will lose trading capabilities immediately.`,
              action: () => executeToggle(true)
          });
      } else {
          // VERIFY FLOW
          setConfirmConfig({
              type: 'success',
              title: 'VERIFY CLIENT?',
              message: `Are you sure you want to VERIFY ${lead.name || 'this user'}? \n\nThis will instantly unlock trading capabilities.`,
              action: () => executeToggle(false)
          });
      }
      setConfirmOpen(true);
  };

  const executeToggle = async (isCurrentlyVerified: boolean) => {
    setIsProcessing(true);

    const tradingStatus = isCurrentlyVerified ? 'pending' : 'verified'; 
    const crmStatus     = isCurrentlyVerified ? 'Pending' : 'Approved';

    try {
        // A. Update Trading App
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ kyc_status: tradingStatus }) 
            .eq('id', lead.trading_account_id);

        if (profileError) throw new Error("Failed to update Trading App");

        // B. Update CRM
        const { error: crmError } = await supabase
            .from('crm_leads')
            .update({ kyc_status: crmStatus }) 
            .eq('id', lead.id);

        if (crmError) throw new Error("Failed to update CRM");

        // C. Refresh UI
        window.dispatchEvent(new CustomEvent('crm-open-lead-id', { detail: lead.id }));

        // D. Switch Modals
        setConfirmOpen(false); // Close question
        setSuccessMessage({
            title: isCurrentlyVerified ? 'ACCESS REVOKED' : 'CLIENT VERIFIED',
            message: isCurrentlyVerified ? 'The client has been unverified successfully.' : 'The client is now verified and can trade.'
        });
        setSuccessOpen(true); // Open success (1 button)
        
    } catch (err: any) {
        alert("Error: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- HELPERS ---
  const handleViewDocument = async (filePath: string) => {
    try {
        const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(filePath, 60);
        if (error) throw error;
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) { alert("Error: " + err.message); }
  };

  // ✅ LOGIC FIX: Determine Status & Color
  const rawStatus = lead?.kyc_status || 'Pending'; 
  const isVerified = rawStatus === 'Approved' || rawStatus === 'Verified' || rawStatus === 'verified';
  const displayStatus = isVerified ? 'Verified' : (rawStatus === 'Pending' ? 'Pending' : 'Not Verified');

  const getStatusBadge = () => {
    if (isVerified) return { icon: <ShieldCheck size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (displayStatus === 'Pending') return { icon: <Shield size={20} />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { icon: <ShieldAlert size={20} />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
  };
  const badge = getStatusBadge();

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-400"/></div>;

  // --- HEADER COMPONENT ---
  const HeaderContent = () => (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${badge.bg} ${badge.border} ${badge.color}`}>
                {badge.icon}
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">KYC Resume</h2>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>Status:</span>
                    <span className={`font-bold uppercase ${badge.color}`}>{displayStatus}</span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
            {/* VERIFY BUTTON */}
            <button
                onClick={initiateVerificationToggle}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-lg cursor-pointer ${
                    isVerified
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-red-500/10'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 hover:scale-105 active:scale-95'
                }`}
            >
                {isVerified ? ( <><XCircle size={16} /> Revoke Verification</> ) : ( <><CheckCircle2 size={16} /> Verify Client</> )}
            </button>

            {/* COPY BUTTON */}
            <button 
                onClick={() => { navigator.clipboard.writeText(lead?.id); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/20 border border-white/10 hover:bg-white/5 transition cursor-pointer h-9.5"
            >
                {copied ? <Check size={16} className="text-green-400"/> : <Fingerprint size={16} className="text-gray-400"/>}
                <span className="text-xs font-mono text-gray-300 hidden sm:inline">{copied ? 'Copied!' : 'Copy ID'}</span>
            </button>
        </div>
    </div>
  );

  return (
    <>
        {/* 1. CONFIRMATION (Two Buttons) */}
        <ConfirmationModal 
            isOpen={confirmOpen}
            type={confirmConfig.type}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.action}
            onClose={() => setConfirmOpen(false)}
            loading={isProcessing}
        />

        {/* 2. SUCCESS (One Button) */}
        <SuccessModal
            isOpen={successOpen}
            title={successMessage.title}
            message={successMessage.message}
            onClose={() => setSuccessOpen(false)}
        />

        {!kycData ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <HeaderContent />
                <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                    <div className="inline-flex p-4 rounded-full bg-white/5 mb-4 text-gray-500">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No KYC Data Found</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                        This client has not submitted their personal information or documents yet. 
                        Go to the <b>"Update / Upload"</b> tab to add details.
                    </p>
                </div>
            </div>
        ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <HeaderContent />
                
                {/* GRID LAYOUT */}
                <div className="grid grid-cols-12 gap-6">
                    {/* LEFT COLUMN */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 relative group hover:border-cyan-500/30 transition">
                            <div className="flex items-center gap-2 mb-6">
                                <User size={18} className="text-cyan-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Identity Profile</h3>
                            </div>
                            <div className="space-y-4">
                                <Row label="Full Name" value={`${kycData.first_name || '-'} ${kycData.last_name || ''}`} />
                                <Row label="Date of Birth" value={kycData.date_of_birth || '-'} />
                                <Row label="Nationality" value={kycData.nationality || '-'} />
                                <div className="h-px bg-white/5 my-2" />
                                <Row label="Document" value={formatDocType(kycData.document_type)} />
                                <Row label="Doc Number" value={kycData.document_number || '-'} />
                                <Row label="Expiry" value={kycData.document_expiry || '-'} />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-6 h-fit">
                        {/* RESIDENCE */}
                        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-purple-500/30 transition">
                            <div className="flex items-center gap-2 mb-6">
                                <MapPin size={18} className="text-purple-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Residence</h3>
                            </div>
                            <div className="space-y-4">
                                <Row label="Street" value={kycData.street_address || '-'} isLong />
                                <Row label="City" value={kycData.city || '-'} />
                                <Row label="Country" value={kycData.residence_country || '-'} />
                            </div>
                        </div>

                        {/* FINANCIAL */}
                        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-yellow-500/30 transition">
                            <div className="flex items-center gap-2 mb-6">
                                <Briefcase size={18} className="text-yellow-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Financial & Banking</h3>
                            </div>
                            <div className="space-y-4">
                                <Row label="Employment" value={formatText(kycData.employment_status)} />
                                <Row label="Annual Income" value={kycData.annual_income || '-'} />
                                <Row label="Source of Funds" value={kycData.source_of_funds || '-'} />
                                <div className="h-px bg-white/5 my-2" />
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-2">
                                        <Landmark size={12} className="text-emerald-400" />
                                        <span className="text-xs text-emerald-400 font-bold uppercase">Bank(s)</span>
                                    </div>
                                    <div className="text-sm text-white font-mono text-right flex flex-col gap-1">
                                        {kycData.bank_details && Array.isArray(kycData.bank_details) && kycData.bank_details.length > 0 ? (
                                            kycData.bank_details.map((b: any, i: number) => (
                                                <span key={i} className="block">{b.name || 'Unnamed Bank'}</span>
                                            ))
                                        ) : ( <span className="text-gray-500 italic">No banks added</span> )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DOCUMENTS */}
                        <div className="col-span-2 p-6 rounded-2xl border border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 mb-4">
                                <FileBox size={18} className="text-blue-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Documents on File</h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {docs.length > 0 ? (
                                    docs.map((doc, i) => (
                                        <DocBadge 
                                            key={i} 
                                            type={formatDocType(doc.file_type)} 
                                            date={new Date(doc.uploaded_at).toLocaleDateString()} 
                                            verified={doc.is_verified} 
                                            onClick={() => handleViewDocument(doc.file_path)} 
                                        />
                                    ))
                                ) : ( <div className="w-full text-center text-gray-500 text-xs italic py-4">No documents uploaded yet.</div> )}
                            </div>
                        </div>

                        {/* NOTES */}
                        {kycData.additional_info && (
                            <div className="col-span-2 p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-gray-500/30 transition">
                                <div className="flex items-center gap-2 mb-4">
                                    <Info size={18} className="text-gray-400" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Additional Notes</h3>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {kycData.additional_info}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
}

// --- HELPER FUNCTIONS ---
function formatDocType(type: string) {
    if (!type) return '-';
    if (type === 'other') return 'Other Document';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function formatText(text: string) {
    if (!text) return '-';
    return text.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function Row({ label, value, isLong, highlight }: any) {
    return (
        <div className={isLong ? '' : 'flex justify-between items-center'}>
            <span className="text-xs text-gray-500 font-bold uppercase">{label}</span>
            <div className={`text-sm ${isLong ? 'mt-1' : 'text-right'} ${highlight ? 'text-green-400 font-bold' : 'text-gray-200'}`}>
                {value}
            </div>
        </div>
    );
}
interface BadgeProps { type: string; date: string; verified: boolean; onClick: () => void; }
function DocBadge({ type, date, verified, onClick }: BadgeProps) {
    const getIcon = () => {
        if (type?.toLowerCase().includes('card')) return <CreditCard size={12} />;
        if (type?.toLowerCase().includes('passport')) return <User size={12} />;
        if (type?.toLowerCase().includes('other')) return <FolderOpen size={12} />;
        return <FileText size={12} />;
    };
    return (
        <div 
            onClick={onClick}
            className={`px-3 py-2 rounded-lg border flex items-center gap-3 transition cursor-pointer group hover:border-cyan-500/50 hover:bg-cyan-500/5 ${verified ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}
        >
            <div className={`p-1.5 rounded ${verified ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-400 group-hover:text-cyan-400'}`}>
                {getIcon()}
            </div>
            <div>
                <div className="text-xs text-white font-bold group-hover:text-cyan-400 transition flex items-center gap-1">
                    {type}
                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="text-[10px] text-gray-500">{date}</div>
            </div>
        </div>
    );
}