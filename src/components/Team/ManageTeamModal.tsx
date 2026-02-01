import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Briefcase, X, Search, Loader2, UserMinus, UserPlus, Shield, GripVertical, CheckSquare, Square } from 'lucide-react';
import type { CRMUser } from './types';

interface Props {
  leader: CRMUser;
  allUsers: CRMUser[];
  onClose: () => void;
  onSuccess: () => void;
  onConfirmRemove: (agentIds: string[]) => void;
}

export default function ManageTeamModal({ leader, allUsers, onClose, onSuccess, onConfirmRemove }: Props) {
  // STATE
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  
  const [searchAdd, setSearchAdd] = useState('');
  const [searchRemove, setSearchRemove] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false); 

  // --- ESC KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // --- DATA FILTERING ---
  
  // 1. Current Team Members
  const myAgents = useMemo(() => 
    allUsers.filter(u => u.team_leader_id === leader.id), 
  [allUsers, leader.id]);

  // 2. Available Free Agents
  const freeAgents = useMemo(() => 
    allUsers.filter(u => {
      const role = u.role?.toLowerCase() || '';
      const hasLeader = u.team_leader_id && u.team_leader_id.trim() !== '';
      return (role === 'conversion' || role === 'retention') && !hasLeader;
    }), [allUsers]);

  // --- ACTIONS ---

  // 1. BULK ADD (Selected Checkboxes)
  const handleBulkAdd = async () => {
    if (selectedAddIds.length === 0) return;
    await executeAdd(selectedAddIds);
    setSelectedAddIds([]); // Clear selection after success
  };

  // 2. SINGLE ADD (Drag & Drop)
  const handleDropAdd = async (agentId: string) => {
    await executeAdd([agentId]);
  };

  // CORE ADD LOGIC
  const executeAdd = async (ids: string[]) => {
    setSaving(true);
    const { data, error } = await supabase
        .from('crm_users')
        .update({ team_leader_id: leader.id })
        .in('id', ids)
        .select(); 
    
    setSaving(false);
    
    if (error || !data || data.length === 0) {
        alert(error ? `Error: ${error.message}` : "Permission denied. Check RLS policies.");
        return;
    }

    window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: `Assigned ${data.length} agents`, type: 'success' } }));
    onSuccess(); 
  };

  // 3. REMOVE AGENTS
  const handleRemoveClick = () => {
    if (selectedRemoveIds.length === 0) return;
    onConfirmRemove(selectedRemoveIds);
  };

  // --- TOGGLE SELECTION HELPERS ---
  const toggleAddSelection = (id: string) => {
    if (selectedAddIds.includes(id)) setSelectedAddIds(prev => prev.filter(i => i !== id));
    else setSelectedAddIds(prev => [...prev, id]);
  };

  const toggleRemoveSelection = (id: string) => {
    if (selectedRemoveIds.includes(id)) setSelectedRemoveIds(prev => prev.filter(i => i !== id));
    else setSelectedRemoveIds(prev => [...prev, id]);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData("agentId", agentId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const agentId = e.dataTransfer.getData("agentId");
    if (agentId) handleDropAdd(agentId); // Trigger immediate add
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-crm-bg border border-gray-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Briefcase className="text-cyan-400" size={18} /> 
                Manage Team
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
                Leader: <span className="text-cyan-400 font-bold">{leader.real_name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800 min-h-0">
          
          {/* LEFT: AVAILABLE AGENTS (Multi-Select + Drag Source) */}
          <div className="flex flex-col min-h-0 bg-blue-900/5">
            <div className="p-3 border-b border-blue-500/10 shrink-0">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-2 tracking-wider">
                <UserPlus size={12} /> Available Agents
              </h4>
              <div className="relative group">
                <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-blue-400 transition" size={14} />
                <input 
                    type="text" 
                    placeholder="Search available..." 
                    className="w-full bg-gray-900 border border-gray-700 pl-9 py-2 rounded-lg text-xs text-white focus:border-blue-500 outline-none transition"
                    onChange={(e) => setSearchAdd(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {freeAgents.filter(a => a.real_name?.toLowerCase().includes(searchAdd.toLowerCase())).map(agent => {
                const isSelected = selectedAddIds.includes(agent.id);
                return (
                  <div 
                      key={agent.id}
                      draggable 
                      onDragStart={(e) => handleDragStart(e, agent.id)}
                      className={`
                          flex items-center gap-3 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition select-none
                          ${isSelected 
                              ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_10px_rgba(37,99,235,0.1)]' 
                              : 'bg-gray-800/40 border-transparent hover:bg-gray-800 hover:border-gray-700'
                          }
                      `}
                      onClick={() => toggleAddSelection(agent.id)}
                  >
                    <GripVertical size={14} className="text-gray-600" />
                    {isSelected 
                        ? <CheckSquare size={16} className="text-blue-400" /> 
                        : <Square size={16} className="text-gray-600" />
                    }
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-200">{agent.real_name}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-mono">{agent.role}</div>
                    </div>
                  </div>
                );
              })}
              {freeAgents.length === 0 && <div className="p-8 text-center text-gray-500 text-xs italic">No free agents available.</div>}
            </div>

            <div className="p-3 border-t border-gray-800 bg-gray-900/50 shrink-0">
              <button 
                onClick={handleBulkAdd} 
                disabled={selectedAddIds.length === 0 || saving} 
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : `Add ${selectedAddIds.length || ''} Selected Agents`}
              </button>
            </div>
          </div>

          {/* RIGHT: CURRENT TEAM (Drop Target) */}
          <div 
            className={`flex flex-col min-h-0 transition-colors duration-300 ${isDraggingOver ? 'bg-blue-500/10' : 'bg-red-900/5'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`p-3 border-b shrink-0 ${isDraggingOver ? 'border-blue-500/30' : 'border-red-500/10'}`}>
                <h4 className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-2 tracking-wider ${isDraggingOver ? 'text-blue-400' : 'text-white'}`}>
                    <Shield size={12} /> {isDraggingOver ? 'DROP TO ADD' : 'Current Team'}
                </h4>
                <div className="relative group">
                    <Search className={`absolute left-3 top-2.5 text-gray-500 transition ${isDraggingOver ? 'group-focus-within:text-blue-400' : 'group-focus-within:text-red-400'}`} size={14} />
                    <input 
                        type="text" 
                        placeholder="Search team..." 
                        className={`w-full bg-gray-900 border pl-9 py-2 rounded-lg text-xs text-white outline-none transition ${isDraggingOver ? 'border-blue-500/50 focus:border-blue-500' : 'border-gray-700 focus:border-red-500'}`}
                        onChange={(e) => setSearchRemove(e.target.value)} 
                    />
                </div>
            </div>

            {/* Drop Zone Visual */}
            {isDraggingOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] border-2 border-dashed border-blue-500/50 rounded-br-2xl pointer-events-none">
                    <div className="bg-crm-bg px-6 py-3 rounded-xl border border-blue-500 text-blue-400 font-bold shadow-2xl animate-bounce">
                        Drop to Add Agent
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {myAgents.filter(a => a.real_name?.toLowerCase().includes(searchRemove.toLowerCase())).map(member => {
                const isSelected = selectedRemoveIds.includes(member.id);
                return (
                  <label key={member.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-gray-800/30 border-transparent hover:bg-gray-800'}`}>
                    <div className="flex items-center gap-3 w-full">
                      <input type="checkbox" className="hidden"
                          checked={isSelected}
                          onChange={() => toggleRemoveSelection(member.id)}
                      />
                      {isSelected 
                        ? <CheckSquare size={16} className="text-red-400 shrink-0" /> 
                        : <Square size={16} className="text-gray-600 shrink-0" />
                      }
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-700">
                              {member.real_name?.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                              <div className="text-sm font-bold text-gray-200">{member.real_name}</div>
                              <div className="text-[10px] text-gray-500 uppercase font-mono">{member.role}</div>
                          </div>
                      </div>
                    </div>
                  </label>
                );
              })}
              {myAgents.length === 0 && <div className="p-8 text-center text-gray-500 text-xs italic border border-dashed border-gray-700 rounded-xl m-2">Empty Team</div>}
            </div>

            <div className={`p-3 border-t bg-gray-900/50 shrink-0 ${isDraggingOver ? 'border-blue-500/30' : 'border-gray-800'}`}>
                <button 
                    onClick={handleRemoveClick} 
                    disabled={selectedRemoveIds.length === 0} 
                    className="w-full bg-red-500/10 hover:bg-red-500 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 hover:text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                >
                    <UserMinus size={16} /> Remove Selected
                </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}