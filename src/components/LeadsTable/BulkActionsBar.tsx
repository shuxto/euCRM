import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, RefreshCw, Download, Trash2, CheckSquare, UserMinus } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  showAssign: boolean;
  showDelete: boolean;
  agents: any[];
  statusOptions: any[];
  isProcessing: boolean;
  // Handlers
  onClearSelection: () => void;
  onBulkAssign: (agentId: string | null) => void;
  onBulkStatus: (status: string) => void;
  onBulkDownload: () => void;
  onBulkDeleteStart: () => void;
}

export default function BulkActionsBar({
  selectedCount, showAssign, showDelete, agents, statusOptions, isProcessing,
  onClearSelection, onBulkAssign, onBulkStatus, onBulkDownload, onBulkDeleteStart
}: BulkActionsBarProps) {
  
  // Local state for the menus inside the bar
  const [actionMode, setActionMode] = useState<'none' | 'assign' | 'status'>('none');

  if (selectedCount === 0) return null;

  return createPortal(
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-9999 animate-in slide-in-from-bottom-20 fade-in duration-500 ease-out">
       <div className="glass-panel border border-cyan-500/30 bg-[#020617]/90 backdrop-blur-xl rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.2)] p-2 flex items-center gap-2 ring-1 ring-white/10 transform transition-all hover:scale-105">
          
          <div className="bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-xl font-bold font-mono text-sm border border-cyan-500/20 flex items-center gap-2 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
              <CheckSquare size={16} />
              {selectedCount} Selected
          </div>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {showAssign && (
            <div className="relative group">
                <button 
                    onClick={() => setActionMode(actionMode === 'assign' ? 'none' : 'assign')}
                    disabled={isProcessing}
                    className={`p-3 rounded-xl transition flex items-center gap-2 font-bold text-sm ${actionMode === 'assign' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}
                >
                    <Users size={18} /> Assign
                </button>

                {actionMode === 'assign' && (
                    <div className="absolute bottom-full left-0 mb-4 w-64 bg-crm-bg border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95">
                        <div className="p-2 bg-black/20 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Select Agent</div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            <button 
                                onClick={() => { onBulkAssign(null); setActionMode('none'); }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition flex items-center gap-2 mb-2 border-b border-white/5 pb-2"
                            >
                                <UserMinus size={14} />
                                Unassign (Release)
                            </button>
                            {agents.map(agent => (
                                <button 
                                    key={agent.id}
                                    onClick={() => { onBulkAssign(agent.id); setActionMode('none'); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-cyan-500/20 hover:text-white rounded-lg transition flex items-center gap-2"
                                >
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    {agent.real_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          )}

          <div className="relative group">
                <button 
                    onClick={() => setActionMode(actionMode === 'status' ? 'none' : 'status')}
                    disabled={isProcessing}
                    className={`p-3 rounded-xl transition flex items-center gap-2 font-bold text-sm ${actionMode === 'status' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}
                >
                    <RefreshCw size={18} /> Status
                </button>

                 {actionMode === 'status' && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 bg-crm-bg border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95">
                        <div className="p-2 bg-black/20 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Select Status</div>
                        <div className="p-1">
                            {statusOptions.map((status: any) => (
                                <button 
                                    key={status.label}
                                    onClick={() => { onBulkStatus(status.label); setActionMode('none'); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition flex items-center gap-2 mb-1"
                                >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.hex_color }} />
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
          </div>

          <button 
            onClick={onBulkDownload}
            disabled={isProcessing}
            className="p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition flex items-center gap-2 font-bold text-sm"
          >
              <Download size={18} /> CSV
          </button>

          {showDelete && (
              <button 
                onClick={onBulkDeleteStart}
                disabled={isProcessing}
                className="p-3 rounded-xl hover:bg-red-500/10 text-gray-300 hover:text-red-400 transition flex items-center gap-2 font-bold text-sm"
              >
                  <Trash2 size={18} />
              </button>
          )}
          
          <div className="w-px h-8 bg-white/10 mx-2" />
          
          <button 
            onClick={onClearSelection}
            disabled={isProcessing}
            className="p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
              <X size={18} />
          </button>
       </div>
    </div>,
    document.body 
  );
}