import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Key, X, Loader2, Search, Folder, CheckCircle2 } from 'lucide-react';
import type { CRMUser } from './types';

// 

interface Props {
  manager: CRMUser; // <--- THIS MUST BE 'manager', NOT 'user'
  folders: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function PermsModal({ manager, folders, onClose, onSuccess }: Props) {
  // 1. SMART PARSING (Handles both Array and String data types from DB)
  const [selectedFolders, setSelectedFolders] = useState<string[]>(() => {
    const sourceData = manager.allowed_sources;
    
    if (Array.isArray(sourceData)) {
        return sourceData; // It's already an array
    }
    if (typeof sourceData === 'string' && sourceData.length > 0) {
        return sourceData.split(',').map(s => s.trim()); // It's a CSV string
    }
    return []; // It's null or empty
  });
  
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // --- ESC KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredFolders = folders.filter(f => f.toLowerCase().includes(search.toLowerCase()));

  // 2. SAVE AS ARRAY (CORRECTED)
  const handleSave = async () => {
    setSaving(true);
    
    // FIX: Send 'selectedFolders' directly as an array.
    // The DB is text[], so sending a string like "" causes the "malformed array literal" error.
    const { error } = await supabase.from('crm_users')
      .update({ allowed_sources: selectedFolders }) 
      .eq('id', manager.id);
    
    setSaving(false);
    
    if (error) {
        console.error("Permission Save Error:", error);
        alert(`Error saving permissions: ${error.message}`);
    } else {
        window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message: `Permissions updated`, type: 'success' } }));
        onSuccess();
    }
  };

  const toggleFolder = (folder: string) => {
    if (selectedFolders.includes(folder)) {
      setSelectedFolders(selectedFolders.filter(f => f !== folder));
    } else {
      setSelectedFolders([...selectedFolders, folder]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-crm-bg border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col h-[80vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-purple-400" size={18} /> 
                Folder Access
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
                Manager: <span className="text-purple-400 font-bold">{manager.real_name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="p-3 border-b border-gray-800 bg-black/20 shrink-0">
            <div className="relative group">
                <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-purple-400 transition" size={14} />
                <input 
                    type="text" 
                    placeholder="Search folders..." 
                    className="w-full bg-gray-900 border border-gray-700 pl-9 py-2 rounded-lg text-xs text-white focus:border-purple-500 outline-none transition"
                    onChange={(e) => setSearch(e.target.value)} 
                />
            </div>
            <div className="mt-2 text-[10px] flex justify-between text-gray-500 px-1 uppercase font-bold tracking-wider">
                <span>Available: {filteredFolders.length}</span>
                <span className={selectedFolders.length > 0 ? "text-purple-400" : ""}>{selectedFolders.length} Selected</span>
            </div>
        </div>
        
        {/* FOLDER LIST */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredFolders.length === 0 ? (
                <div className="col-span-2 text-center text-gray-500 py-10 italic border border-dashed border-gray-800 rounded-xl text-xs">
                    No folders match your search.
                </div>
            ) : (
                filteredFolders.map(folder => {
                    const isSelected = selectedFolders.includes(folder);
                    return (
                        <button 
                            key={folder}
                            onClick={() => toggleFolder(folder)}
                            className={`
                                group flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200
                                ${isSelected 
                                    ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.1)]' 
                                    : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Folder size={16} className={isSelected ? "text-purple-400" : "text-gray-500 group-hover:text-gray-300"} />
                                <span className={`text-xs truncate font-bold ${isSelected ? "text-white" : "text-gray-400 group-hover:text-gray-200"}`}>
                                    {folder}
                                </span>
                            </div>
                            {isSelected ? (
                                <CheckCircle2 size={14} className="text-purple-400 shrink-0" />
                            ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-gray-600 group-hover:border-gray-400 shrink-0" />
                            )}
                        </button>
                    );
                })
            )}
          </div>
        </div>
        
        {/* FOOTER */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50 shrink-0">
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-purple-900/20 transition flex justify-center items-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}