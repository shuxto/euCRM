import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronDown, RotateCcw, Check, FileSpreadsheet, Globe, Users, Layers } from 'lucide-react';

// --- TYPES ---
interface FilterState {
  search: string;
  source: string[];
  country: string[];
  agent: string[];
  status: string[];
  limit: number;
}

interface AdvancedFilterProps {
  currentFilters: any;
  onFilterChange: (filters: any) => void;
  currentUserEmail?: string; 
  role?: string;   
  userId?: string; 
}

// --- SUB-COMPONENT: CUSTOM MULTI-SELECT DROPDOWN ---
const MultiSelectDropdown = ({ label, icon: Icon, options, selected, onChange, width = "w-48" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item: string) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const filteredOptions = options.filter((opt: string) => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative group ${width}`} ref={dropdownRef}>
      <label className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 uppercase font-bold tracking-wide">
        <Icon size={10} className="text-blue-500" /> {label} 
        {selected.length > 0 && <span className="text-blue-400">({selected.length})</span>}
      </label>
      
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-crm-bg border border-gray-700 px-3 py-2 rounded-lg text-xs text-gray-300 text-left w-full shadow-inner flex justify-between items-center hover:bg-gray-800 transition truncate h-9.5"
      >
        <span className="truncate">
          {selected.length === 0 ? `Select ${label}...` : `${selected.length} Selected`}
        </span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-64 mt-1 bg-[#1e293b] border border-gray-600 rounded-lg shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="mb-2 pb-2 border-b border-gray-700">
            <input 
              type="text" 
              autoFocus
              placeholder={`Search ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-crm-bg border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-xs text-gray-500 text-center italic">No results found.</div>
            ) : (
              filteredOptions.map((opt: string) => (
                <div 
                  key={opt} 
                  onClick={() => toggleOption(opt)}
                  className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer group/item"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-gray-600 bg-crm-bg'}`}>
                    {selected.includes(opt) && <Check size={10} className="text-white" />}
                  </div>
                  <span className={`text-xs break-all ${selected.includes(opt) ? 'text-white font-bold' : 'text-gray-400 group-hover/item:text-gray-300'}`}>
                    {opt}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function AdvancedFilter({ currentFilters, onFilterChange, role = 'conversion', userId }: AdvancedFilterProps) {
  const [agentMap, setAgentMap] = useState<Record<string, string>>({}); 
  const [nameToIdMap, setNameToIdMap] = useState<Record<string, string>>({}); 

  const [options, setOptions] = useState({
    sources: [] as string[],
    countries: [] as string[],
    agents: [] as string[],
    statuses: [] as string[]
  });

  useEffect(() => {
    async function loadOptions() {
      // 1. FETCH ALLOWED SOURCES (DB Permission)
      let allowedFolders: string[] = [];
      if (userId) {
        const { data: userData } = await supabase
            .from('crm_users')
            .select('allowed_sources')
            .eq('id', userId)
            .single();
        
        if (userData?.allowed_sources) {
            allowedFolders = userData.allowed_sources.split(',').map((s: string) => s.trim());
        }
      }

      // 2. DETERMINE FOLDER OPTIONS BASED ON ROLE
      let folderOptions: string[] = [];

      if (role === 'admin') {
          // Admin sees EVERYTHING
          const { data } = await supabase.from('crm_leads').select('source_file');
          folderOptions = Array.from(new Set(data?.map(x => x.source_file).filter(Boolean))) as string[];
      } 
      else if (role === 'manager') {
          // Manager: Restricted STRICTLY to allowed_sources (as requested)
          // We fetch all available to ensure we don't show "phantom" allowed folders
          const { data } = await supabase.from('crm_leads').select('source_file');
          const allFolders = Array.from(new Set(data?.map(x => x.source_file).filter(Boolean))) as string[];
          folderOptions = allFolders.filter(f => allowedFolders.includes(f));
      } 
      else {
          // Agents (Conversion, Retention, Compliance, etc.)
          // Logic: Show folders from leads ASSIGNED to them + any explicit allowed_sources
          const mySourceSet = new Set<string>(allowedFolders);

          if (userId) {
              // Fetch only the sources of leads assigned to this user
              const { data: myLeads } = await supabase
                  .from('crm_leads')
                  .select('source_file')
                  .eq('assigned_to', userId);
              
              myLeads?.forEach(l => {
                  if (l.source_file) mySourceSet.add(l.source_file);
              });
          }
          folderOptions = Array.from(mySourceSet);
      }
      
      // 3. Fetch Countries
      const { data: cData } = await supabase.from('crm_leads').select('country');
      
      // 4. Fetch Agents (USERS) - FILTERED BY ROLE
      let agentQuery = supabase
        .from('crm_users')
        .select('id, real_name')
        .in('role', ['conversion', 'retention', 'team_leader']) 
        .order('real_name');

      // --- PERMISSION CHECK: AGENTS ---
      if (role === 'team_leader' && userId) {
        agentQuery = agentQuery.eq('team_leader_id', userId);
      }
      
      const { data: uData } = await agentQuery;
      
      // Build Agent Maps
      const agNames: string[] = [];
      const idMap: Record<string, string> = {};
      const revMap: Record<string, string> = {};
      
      if (uData) {
        uData.forEach(u => {
            if(u.real_name) {
                agNames.push(u.real_name);
                idMap[u.id] = u.real_name;
                revMap[u.real_name] = u.id;
            }
        });
      }
      setAgentMap(idMap);
      setNameToIdMap(revMap);

      // 5. Fetch Statuses
      const { data: stData } = await supabase
        .from('crm_statuses')
        .select('label')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      setOptions({
        sources: folderOptions,
        countries: Array.from(new Set(cData?.map(x => x.country).filter(Boolean))) as string[],
        agents: agNames,
        statuses: stData?.map(x => x.label) || []
      });
    }
    loadOptions();
  }, [userId, role]); 

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...currentFilters, [key]: value };
    onFilterChange(newFilters);
  };

  const handleAgentChange = (selectedNames: string[]) => {
      const selectedIds = selectedNames.map(name => nameToIdMap[name]).filter(Boolean);
      updateFilter('agent', selectedIds);
  };

  const resetFilters = () => {
    onFilterChange({
      search: '',
      source: [],
      country: [],
      agent: [],
      status: [],
      limit: 50
    });
  };

  const selectedAgentNames = (currentFilters.agent || []).map((id: string) => agentMap[id]).filter(Boolean);

  const showAgentsFilter = ['admin', 'manager', 'team_leader'].includes(role);

  return (
    <div className="glass-panel p-5 rounded-xl mb-6 shadow-xl relative z-40 animate-in slide-in-from-top-4">
      <div className="flex flex-wrap items-end gap-4 relative">
        
        {/* 1. TEXT SEARCH */}
        <div className="flex-1 min-w-50">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 uppercase font-bold tracking-wide">
            <Search size={10} className="text-blue-500" /> Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
            <input 
              type="text" 
              value={currentFilters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Name, Phone, Email..." 
              className="bg-crm-bg border border-gray-700 pl-9 pr-4 py-2 rounded-lg text-sm text-white focus:border-blue-500 outline-none w-full shadow-inner transition placeholder-gray-600 h-9.5"
            />
          </div>
        </div>

        {/* 2. FOLDERS */}
        <MultiSelectDropdown 
          label="Folders" 
          icon={FileSpreadsheet} 
          options={options.sources} 
          selected={currentFilters.source || []} 
          onChange={(val: string[]) => updateFilter('source', val)} 
        />

        {/* 3. COUNTRIES */}
        <MultiSelectDropdown 
          label="Countries" 
          icon={Globe} 
          options={options.countries} 
          selected={currentFilters.country || []} 
          onChange={(val: string[]) => updateFilter('country', val)} 
          width="w-40"
        />

        {/* 4. AGENTS (CONDITIONAL VISIBILITY) */}
        {showAgentsFilter && (
            <MultiSelectDropdown 
            label="Agents" 
            icon={Users} 
            options={options.agents} 
            selected={selectedAgentNames} 
            onChange={handleAgentChange} 
            />
        )}

        {/* 5. STATUS */}
        <MultiSelectDropdown 
          label="Statuses" 
          icon={Layers} 
          options={options.statuses} 
          selected={currentFilters.status || []} 
          onChange={(val: string[]) => updateFilter('status', val)} 
          width="w-40"
        />

        {/* 6. ROWS LIMIT */}
        <div className="w-24">
          <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold tracking-wide">Rows</label>
          <div className="relative">
            <select 
              value={currentFilters.limit || 50}
              onChange={(e) => updateFilter('limit', parseInt(e.target.value))}
              className="bg-crm-bg border border-gray-700 px-3 py-2 rounded-lg text-sm text-white focus:border-blue-500 outline-none w-full shadow-inner cursor-pointer h-9.5 appearance-none"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
            <ChevronDown className="absolute right-2 top-3 text-gray-500 pointer-events-none" size={12} />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <button 
          onClick={resetFilters}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold transition text-xs flex items-center gap-2 h-9.5 shadow-lg"
        >
          <RotateCcw size={12} /> Reset
        </button>

      </div>
    </div>
  );
}