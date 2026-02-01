import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLeads, type Lead } from '../../hooks/useLeads'; 
import KYCModal from './KYCModal'; 
import ConfirmationModal from '../Team/ConfirmationModal'; 
import NotesSidebar from './NotesSidebar'; 
import TransferOverlay, { type OverlayMode } from '../TransferOverlay';
import LeadsTableRow from './LeadsTableRow';
import BulkActionsBar from './BulkActionsBar';

interface LeadsTableProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'conversion' | 'retention' | 'compliance';
  filters?: any;
  onLeadClick: (lead: Lead) => void;
  currentUserEmail?: string;
  onPageChange?: (page: number) => void;
}

type ActionType = 'transfer' | 'ftd' | 'upsale';

export default function LeadsTable({ role = 'admin', filters, onLeadClick, onPageChange }: LeadsTableProps) {
  
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if(data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const { 
    leads, totalCount, statusOptions, agents, loading, 
    updateLeadStatus, updateLeadAgent, deleteLead,
    bulkUpdateStatus, bulkUpdateAgent, bulkDeleteLeads,
    updateLocalLead, removeLeadFromView // <--- IMPORTED HERE
  } = useLeads(filters, currentUserId);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [kycLead, setKycLead] = useState<Lead | null>(null);
  const [activeNoteLead, setActiveNoteLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [pendingAction, setPendingAction] = useState<{ type: ActionType, id: string, name: string } | null>(null);
  const [vanishingIds] = useState<string[]>([]);
  const [overlayMode, setOverlayMode] = useState<OverlayMode | null>(null);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const showCheckbox = isAdmin || isManager;
  const showAssign = isAdmin || isManager;
  const showDelete = isAdmin || isManager;

  const currentPage = filters?.page || 1;
  const limit = filters?.limit || 50;
  const totalPages = Math.ceil((totalCount || 0) / limit);

  // --- LOGIC HANDLERS ---

  const handleStatusUpdateInterceptor = (id: string, newStatus: string) => {
    const lead = leads.find(l => l.id === id);
    const name = lead ? `${lead.name} ${lead.surname}` : 'this lead';

    if (newStatus === 'Transferred' || newStatus === 'Transfered') {
      setPendingAction({ type: 'transfer', id, name });
      return; 
    }
    if (newStatus === 'FTD') {
      setPendingAction({ type: 'ftd', id, name });
      return;
    }
    if (newStatus === 'Up Sale') {
      setPendingAction({ type: 'upsale', id, name });
      return;
    }
    updateLeadStatus(id, newStatus);
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { type, id } = pendingAction;
    setPendingAction(null);
    setOverlayMode(type); 

    if (type === 'transfer') {
        // --- NEW: AUTO-UNASSIGN LOGIC FOR CONVERSION ---
        if (role === 'conversion') {
            // Wait for overlay to start (UX)
            setTimeout(async () => {
                try {
                    // 1. Get Agent Name
                    const { data: userData } = await supabase.from('crm_users').select('real_name').eq('id', currentUserId).single();
                    const agentName = userData?.real_name || 'Agent';

                    // 2. Add System Note with Icons
                    const noteText = `🔄 **TRANSFERRED**\n\n👤 Handled by: ${agentName}\n📉 Action: Manual Transfer & Unassign`;
                    
                    await supabase.from('crm_notes').insert({
                        lead_id: id,
                        content: noteText,
                        author_name: 'System', 
                    });

                    // 3. Unassign and set Status
                    await updateLeadAgent(id, null);
                    await updateLeadStatus(id, 'Transferred');
                    
                    // 4. Instantly remove from view (Poof!)
                    removeLeadFromView(id);
                    
                    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Transferred & Unassigned', type: 'success' } }));
                } catch (err) {
                    console.error("Transfer error:", err);
                }
            }, 800);
        } else {
            // Normal behavior for Admin/Manager
            setTimeout(async () => {
                await updateLeadStatus(id, 'Transferred');
            }, 800);
        }
    } else if (type === 'ftd') {
        await updateLeadStatus(id, 'FTD');
    } else if (type === 'upsale') {
        await updateLeadStatus(id, 'Up Sale');
    }
  };

  const toggleSelectAll = () => selectedIds.length === leads.length ? setSelectedIds([]) : setSelectedIds(leads.map(l => l.id));
  const toggleSelectOne = (id: string) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(i => i !== id)) : setSelectedIds([...selectedIds, id]);

  const handleBulkAssign = async (agentId: string | null) => {
    setIsProcessing(true);
    await bulkUpdateAgent(selectedIds, agentId);
    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: agentId ? 'Assigned' : 'Unassigned', type: 'success' } }));
    setIsProcessing(false);
    setSelectedIds([]); 
  };

  const handleBulkStatus = async (status: string) => {
    setIsProcessing(true);
    await bulkUpdateStatus(selectedIds, status);
    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Updated', type: 'success' } }));
    setIsProcessing(false);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true); 
    await bulkDeleteLeads(selectedIds);
    setIsDeleting(false);
    setShowBulkDeleteConfirm(false);
    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: 'Deleted', type: 'success' } }));
    setSelectedIds([]);
  };

  const handleBulkDownload = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Name,Surname,Phone,Email,Status,Country,Source\n"
        + leads.filter(l => selectedIds.includes(l.id)).map(e => `${e.id},${e.name},${e.surname},${e.phone},${e.email},${e.status},${e.country},${e.source_file}`).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `crm_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getModalProps = () => {
    if (!pendingAction) return { title: '', message: '', type: 'danger' as const };
    if (pendingAction.type === 'transfer') return {
        title: '⚠️ ASSET RELOCATION PROTOCOL',
        message: `WARNING: You are about to TRANSFER ${pendingAction.name}. \n\nConfirming this will mark the lead as Transferred.`,
        type: 'danger' as const
    };
    if (pendingAction.type === 'ftd') return {
        title: '🔥 FTD DETECTED',
        message: `WTF?! Did you actually close ${pendingAction.name}? \n\nThis is a major win. Confirming this will lock the lead as an FTD and trigger the celebration sequence.`,
        type: 'success' as const
    };
    if (pendingAction.type === 'upsale') return {
        title: '🚀 UP SALE MODE',
        message: `UNREAL PERFORMANCE. You are doubling down on ${pendingAction.name}? \n\nConfirming this marks you as a top-tier closer.`,
        type: 'success' as const
    };
    return { title: '', message: '', type: 'danger' as const };
  };

  if (loading && leads.length === 0) return <div className="glass-panel rounded-xl p-12 flex justify-center items-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="glass-panel rounded-xl shadow-2xl overflow-hidden border border-white/5 relative z-10 flex flex-col h-full">
      
      {overlayMode && <TransferOverlay mode={overlayMode} onComplete={() => setOverlayMode(null)} />}

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1e293b]/80 border-b border-gray-700 text-[10px] font-bold uppercase tracking-wider text-gray-200">
              {showCheckbox && <th className="p-4 w-10 text-center"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === leads.length && leads.length > 0} className="cursor-pointer accent-cyan-500" /></th>}
              <th className="p-4 hidden md:table-cell">Source</th>
              <th className="p-4">Lead Info</th>
              <th className="p-4 hidden md:table-cell">Country</th>
              <th className="p-4">Contact</th>
              <th className="p-4 text-center">S-KYC</th>
              <th className="p-4 text-center w-40">Status</th>
              {showAssign && <th className="p-4 hidden md:table-cell">Assigned To</th>}
              <th className="p-4 text-center">Notes</th>
              <th className="p-4 text-center">Actions</th>
              {showDelete && <th className="p-4 text-center">Del</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {leads.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-500 italic">No leads found matching your filters.</td></tr>
            ) : leads.map((lead: Lead, index: number) => (
              <LeadsTableRow 
                key={lead.id}
                lead={lead}
                isSelected={selectedIds.includes(lead.id)}
                isVanishing={vanishingIds.includes(lead.id)}
                role={role} // <--- PASSING ROLE HERE
                showCheckbox={showCheckbox}
                showAssign={showAssign}
                showDelete={showDelete}
                statusOptions={statusOptions}
                agents={agents}
                toggleSelectOne={toggleSelectOne}
                onLeadClick={onLeadClick}
                setKycLead={setKycLead}
                setActiveNoteLead={setActiveNoteLead}
                handleDeleteClick={() => setLeadToDelete(lead)}
                onStatusUpdateInterceptor={handleStatusUpdateInterceptor}
                updateLeadAgent={updateLeadAgent}
                rowIndex={index}
                totalRows={leads.length}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-white/10 bg-[#1e293b]/50 backdrop-blur-sm flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">Showing <span className="text-white font-bold">{leads.length}</span> of <span className="text-white font-bold">{totalCount}</span> leads</div>
          <div className="flex items-center gap-2">
              <button onClick={() => onPageChange?.(currentPage - 1)} disabled={currentPage === 1 || loading} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition text-white border border-white/5"><ChevronLeft size={16} /></button>
              <div className="px-4 py-2 bg-black/20 rounded-lg text-xs font-bold text-cyan-400 border border-white/5 font-mono shadow-inner">Page {currentPage} / {totalPages || 1}</div>
              <button onClick={() => onPageChange?.(currentPage + 1)} disabled={currentPage >= totalPages || loading} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition text-white border border-white/5"><ChevronRight size={16} /></button>
          </div>
      </div>

      <BulkActionsBar 
        selectedCount={selectedIds.length}
        showAssign={showAssign}
        showDelete={showDelete}
        agents={agents}
        statusOptions={statusOptions}
        isProcessing={isProcessing}
        onClearSelection={() => setSelectedIds([])}
        onBulkAssign={handleBulkAssign}
        onBulkStatus={handleBulkStatus}
        onBulkDownload={handleBulkDownload}
        onBulkDeleteStart={() => setShowBulkDeleteConfirm(true)}
      />

      {kycLead && <KYCModal leadId={kycLead.id} leadName={`${kycLead.name} ${kycLead.surname}`} phone={kycLead.phone} email={kycLead.email} currentStatus={kycLead.kyc_status} onClose={() => setKycLead(null)} onUpdateStatus={() => {}} />}
      
      {activeNoteLead && <NotesSidebar lead={activeNoteLead} onClose={() => setActiveNoteLead(null)} currentUserId={currentUserId} role={role} onNoteCountChange={(count) => {
          if (activeNoteLead) updateLocalLead(activeNoteLead.id, { note_count: count });
      }} />}
      
      <ConfirmationModal isOpen={!!leadToDelete} type="danger" title="Delete Lead?" message={`Are you sure?`} onConfirm={async () => {
          if (!leadToDelete) return;
          setIsDeleting(true);
          await deleteLead(leadToDelete.id);
          setIsDeleting(false);
          setLeadToDelete(null);
      }} onClose={() => setLeadToDelete(null)} loading={isDeleting} />

      <ConfirmationModal isOpen={showBulkDeleteConfirm} type="danger" title="Delete Leads?" message={`Delete ${selectedIds.length} leads?`} onConfirm={handleBulkDelete} onClose={() => setShowBulkDeleteConfirm(false)} loading={isDeleting} />

      <ConfirmationModal 
        isOpen={!!pendingAction}
        type={getModalProps().type}
        title={getModalProps().title} 
        message={getModalProps().message} 
        onConfirm={executePendingAction} 
        onClose={() => setPendingAction(null)} 
      />
    </div>
  );
}