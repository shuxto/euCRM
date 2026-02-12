import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 👈 NEW
import { User, Search, X, Check, ChevronDown, UserPlus } from 'lucide-react';
import type { Agent } from '../../hooks/useLeads';

interface Props {
  leadId: string;
  currentAgentId: string | null;
  agents: Agent[];
  onUpdate: (leadId: string, agentId: string | null) => void;
  rowIndex: number;
  totalRows: number;
}

export default function AssignAgentCell({ leadId, currentAgentId, agents, onUpdate, rowIndex, totalRows }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 }); // 👈 NEW: For Portal Positioning
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const assignedAgent = agents.find(a => a.id === currentAgentId);
  const currentAgentName = assignedAgent ? assignedAgent.real_name : null;

  // 1. Calculate Position on Open
  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        
        // Decide whether to open UP or DOWN based on screen space
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpwards = spaceBelow < 250; // If less than 250px below, open UP
        
        setCoords({
            top: openUpwards ? (rect.top - 5) : (rect.bottom + 5), // 5px gap
            left: rect.left,
            width: rect.width
        });
    }
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  // 2. Close on Click Outside / Scroll / Resize
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: any) => {
      // Check if click is inside Menu (Portal) OR Button (Trigger)
      if (
          menuRef.current && !menuRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
          setIsOpen(false);
      }
    };

    // FIXED: Only close if scroll happens OUTSIDE the menu (e.g. table scroll)
    const handleScroll = (event: Event) => {
        if (menuRef.current && menuRef.current.contains(event.target as Node)) {
            return; // Ignore scrolls inside the dropdown itself
        }
        setIsOpen(false); 
    };
    
    const handleResize = () => setIsOpen(false);

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // true = capture phase (for nested scrolls)
    window.addEventListener("resize", handleResize);

    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  const handleSelect = (agentId: string | null) => {
    if (agentId !== currentAgentId) {
        onUpdate(leadId, agentId);
        
        const agentName = agents.find(a => a.id === agentId)?.real_name;
        const msg = agentId ? `Assigned to ${agentName}` : 'Agent unassigned';
        window.dispatchEvent(new CustomEvent('crm-toast', { 
            detail: { message: msg, type: 'success' } 
        }));
    }
    setIsOpen(false);
  };

  const filteredAgents = agents.filter(a => 
    a.real_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. The Menu Component (Rendered via Portal)
  const menu = (
      <div 
        ref={menuRef}
        style={{ 
            position: 'fixed', 
            top: coords.top, 
            left: coords.left, 
            zIndex: 9999, // High Z-Index to float above everything
            transform: rowIndex > totalRows - 4 ? 'translateY(-100%)' : 'none' // Basic fallback logic if needed
        }}
        className="w-56 bg-[#1e293b] border border-gray-600 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      >
          <div className="p-2 border-b border-gray-700 bg-crm-bg">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-gray-500" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search agent..." 
                className="w-full bg-gray-800/50 border border-gray-700 text-gray-200 text-xs rounded-lg pl-8 py-2 focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            <button onClick={() => handleSelect(null)} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 mb-1">
              <X size={12} /> Unassign Lead
            </button>

            {filteredAgents.map(agent => (
              <button 
                key={agent.id} 
                onClick={() => handleSelect(agent.id)}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors ${agent.id === currentAgentId ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${agent.id === currentAgentId ? 'bg-white/20' : 'bg-gray-700 text-gray-400'}`}>
                  {agent.real_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                    <div className="font-bold">{agent.real_name}</div>
                    <div className="text-[9px] opacity-70 uppercase">{agent.role}</div>
                </div>
                {agent.id === currentAgentId && <Check size={12} />}
              </button>
            ))}

            {filteredAgents.length === 0 && (
                <div className="p-3 text-center text-gray-500 text-[10px] italic">No agents found</div>
            )}
          </div>
      </div>
  );

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={toggleOpen}
        className={`w-40 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all duration-200 
          ${currentAgentId 
            ? 'bg-blue-900/20 border-blue-500/30 text-blue-200 hover:bg-blue-900/30' 
            : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
          }`}
      >
        <div className="flex items-center gap-2 truncate">
          {currentAgentId ? <User size={12} className="text-blue-400 shrink-0" /> : <UserPlus size={12} className="shrink-0" />}
          <span className="truncate">{currentAgentName || 'Unassigned'}</span>
        </div>
        <ChevronDown size={10} className={`opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* RENDER PORTAL if Open */}
      {isOpen && createPortal(menu, document.body)} 
    </>
  );
}
