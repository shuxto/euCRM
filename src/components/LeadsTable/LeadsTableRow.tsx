import { useState } from 'react';
import { Phone, Mail, Eye, MessageSquare, Trash2, ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react';
import { type Lead } from '../../hooks/useLeads';
import StatusCell from './StatusCell';
import AssignAgentCell from './AssignAgentCell';
import { initiateCall } from '../../lib/callSystem';

interface LeadsTableRowProps {
  lead: Lead;
  isSelected: boolean;
  isVanishing: boolean;
  role: string;
  showCheckbox: boolean;
  showAssign: boolean;
  showDelete: boolean;
  statusOptions: any[];
  agents: any[];
  toggleSelectOne: (id: string) => void;
  onLeadClick: (lead: Lead) => void;
  setKycLead: (lead: Lead) => void;
  setActiveNoteLead: (lead: Lead) => void;
  handleDeleteClick: (lead: Lead) => void;
  onStatusUpdateInterceptor: (id: string, newStatus: string) => void;
  updateLeadAgent: (id: string, agentId: string | null) => void;
  rowIndex: number;
  totalRows: number;
}

export default function LeadsTableRow({
  lead, isSelected, isVanishing, role,
  showCheckbox, showAssign, showDelete,
  statusOptions, agents,
  toggleSelectOne, onLeadClick, setKycLead, setActiveNoteLead, handleDeleteClick,
  onStatusUpdateInterceptor, updateLeadAgent, rowIndex, totalRows
}: LeadsTableRowProps) {
  
  const [isCalling, setIsCalling] = useState(false);

  const handleQuickCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone || isCalling) return;
    setIsCalling(true);
    await initiateCall(lead.id, lead.phone);
    setTimeout(() => setIsCalling(false), 2000);
  };

  return (
    <tr 
      className={`
          hover:bg-white/5 transition duration-150 group 
          ${isSelected ? 'bg-cyan-900/10' : ''}
          ${isVanishing ? 'animate-vanish' : ''} 
      `}
    >
      {showCheckbox && (
        <td className="p-4 text-center">
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => toggleSelectOne(lead.id)} 
            // 1. ADDED POINTER
            className="cursor-pointer accent-cyan-500" 
          />
        </td>
      )}
      
      <td className="p-4 hidden md:table-cell">
        <span className="bg-gray-800/50 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-700/50 block truncate max-w-25">
          {lead.source_file || 'Manual'}
        </span>
      </td>

      <td className="p-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white leading-tight">{lead.name} {lead.surname}</span>
          <span className="text-[10px] text-gray-600 font-mono">ID: {lead.id.substring(0,8)}...</span>
        </div>
      </td>

      <td className="p-4 hidden md:table-cell">
        <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">
          {lead.country}
        </span>
      </td>

      <td className="p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button 
               onClick={handleQuickCall}
               disabled={isCalling}
               // 2. ADDED POINTER
               className={`p-1.5 rounded-lg transition-all border cursor-pointer ${
                 isCalling 
                   ? 'bg-green-500/20 text-green-400 border-green-500/30 cursor-not-allowed' 
                   : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:scale-105'
               }`}
               title="Call Now"
            >
               {isCalling ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
            </button>
            <span className={`font-mono text-xs ${isCalling ? 'text-green-400' : 'text-gray-400'}`}>
                {lead.phone}
            </span>
          </div>

          <div className="flex items-center gap-2 text-gray-500 ml-1">
            <Mail size={10} />
            <span className="text-[10px] truncate max-w-37.5">{lead.email}</span>
          </div>
        </div>
      </td>

      <td className="p-4 text-center align-middle">
          <button 
            onClick={() => setKycLead(lead)} 
            // 3. ADDED POINTER
            className="transition transform hover:scale-110 active:scale-95 cursor-pointer" 
            title="Manage KYC"
          >
              {lead.kyc_status === 'Approved' ? <ShieldCheck size={18} className="text-green-400 mx-auto drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" /> 
              : lead.kyc_status === 'Pending' ? <Shield size={18} className="text-yellow-400 mx-auto drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" /> 
              : <ShieldAlert size={18} className="text-gray-600 mx-auto hover:text-gray-400" />}
          </button>
      </td>
      
      <td className="p-4 align-middle">
          <StatusCell 
              lead={lead} 
              options={statusOptions} 
              onUpdate={onStatusUpdateInterceptor} 
              role={role} 
          />
      </td>

      {showAssign && (
        <td className="p-4 hidden md:table-cell">
          <AssignAgentCell 
            leadId={lead.id} 
            currentAgentId={lead.assigned_to} 
            agents={agents} 
            onUpdate={updateLeadAgent} 
            rowIndex={rowIndex} 
            totalRows={totalRows} 
          />
        </td>
      )}
      
      <td className="p-4 text-center">
          <button 
            onClick={() => setActiveNoteLead(lead)} 
            // 4. ADDED POINTER
            className={`transition p-2 rounded-lg hover:bg-white/5 cursor-pointer ${(lead.note_count || 0) > 0 ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-gray-600'}`}
          >
              <MessageSquare size={16} />
          </button>
      </td>

      <td className="p-4 text-center">
        <button 
            onClick={() => onLeadClick(lead)} 
            // 5. ADDED POINTER
            className="p-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          <Eye size={14} />
        </button>
      </td>
      
      {showDelete && (
        <td className="p-4 text-center">
          <button 
            onClick={() => handleDeleteClick(lead)} 
            // 6. ADDED POINTER
            className="text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition p-1.5 rounded-lg cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}