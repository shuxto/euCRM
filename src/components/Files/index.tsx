import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Papa from 'papaparse';
// REMOVED: import * as XLSX from 'xlsx'; <--- We removed this heavy import
import { FileSpreadsheet, UploadCloud, Search, Trash2, Download, CheckCircle, Loader2, FolderOpen } from 'lucide-react';

// --- TYPES ---
interface FolderStat {
  source_file: string;
  total_leads: number;
  distributed: number;
  agents: number;
}

// --- HELPER: STRICT HEADER VALIDATION ---
const validateHeaders = (headers: string[]) => {
  if (!headers || headers.length === 0) return false;
  
  const normalized = headers.map(h => String(h).toLowerCase().trim().replace(/[\uFEFF\x00-\x1F]/g, '')); // Remove invisible chars
  
  const required4 = ['name', 'email', 'phone', 'country'];
  const required5 = ['name', 'surname', 'email', 'phone', 'country'];

  // Check strict intersection
  const has4 = required4.every(r => normalized.includes(r));
  const has5 = required5.every(r => normalized.includes(r));

  if (has5) return 'type_5'; // Separate Surname
  if (has4) return 'type_4'; // Combined Name
  return false;
};

// --- HELPER: UNIVERSAL FILE PARSER (CSV + EXCEL) ---
const parseFile = async (file: File): Promise<{ data: any[], fields: string[] }> => {
  // A. CSV HANDLING (PapaParse is light, so we keep it as is)
  if (file.name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve({
            data: results.data as any[],
            fields: results.meta.fields || []
          });
        },
        error: (err) => reject(err)
      });
    });
  }

  // B. EXCEL HANDLING (Dynamic Import)
  // This line only runs if the file is NOT a CSV.
  // It downloads the heavy XLSX library on demand.
  const XLSX = await import('xlsx'); 

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 1. Get Headers (First Row)
        const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        
        // 2. Get Data (Rows as Objects)
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        resolve({
          data: jsonData,
          fields: headerRow || []
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
};

export default function FileManager() {
  const [activeTab, setActiveTab] = useState<'check' | 'upload' | 'manage'>('check');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Results State
  const [checkResults, setCheckResults] = useState<{total: number, new: number, dupes: number, dupeList: any[]} | null>(null);
  const [uploadResults, setUploadResults] = useState<{added: number, skipped: number} | null>(null);
  const [folders, setFolders] = useState<FolderStat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- 1. CHECK TAB LOGIC ---
  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);
    setCheckResults(null);

    try {
        const { data: rows } = await parseFile(file); // <--- Updated to await
        
        let dupes = 0;
        let newLeads = 0;
        let dupeList: any[] = [];
        
        // Fetch ALL phones from DB to compare
        const { data: dbLeads } = await supabase.from('crm_leads').select('phone, email');
        const existingPhones = new Set(dbLeads?.map(l => l.phone.replace(/[^0-9]/g, '')) || []);
        const existingEmails = new Set(dbLeads?.map(l => l.email) || []);

        rows.forEach((row: any, index) => {
          const phone = row.phone ? String(row.phone).replace(/[^0-9]/g, '') : ''; // Ensure String
          const email = row.email ? String(row.email).trim() : '';
          
          let isDupe = false;
          let reason = '';

          if (phone && existingPhones.has(phone)) { isDupe = true; reason = `Phone: ${phone}`; }
          else if (email && existingEmails.has(email)) { isDupe = true; reason = `Email: ${email}`; }

          if (isDupe) {
            dupes++;
            if (dupeList.length < 100) dupeList.push({ row: index + 2, name: row.name || 'Unknown', reason });
          } else {
            newLeads++;
          }
        });

        setCheckResults({ total: rows.length, new: newLeads, dupes, dupeList });
    } catch (error) {
        alert("Error parsing file. Make sure it is a valid CSV or Excel file.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  // --- 2. UPLOAD TAB LOGIC (STRICT) ---
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatusMsg('Analyzing Headers...');
    
    try {
        const { data: rows, fields: headers } = await parseFile(file); // <--- Updated to await
        const csvType = validateHeaders(headers);

        if (!csvType) {
          alert('STRICT RULE: Missing required columns (Name, Phone, Email, Country)');
          setLoading(false);
          return;
        }

        setStatusMsg('Headers OK. Importing data...');
        // Remove both extensions for cleaner folder name
        const sourceFile = file.name.replace('.csv', '').replace('.xlsx', '').replace('.xls', '');
        
        // Fetch existing phones for duplicates check
        const { data: dbLeads } = await supabase.from('crm_leads').select('phone');
        const existingPhones = new Set(dbLeads?.map(l => l.phone) || []);

        const batchInsert: any[] = [];
        let addedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
          const phone = row.phone ? String(row.phone).replace(/[^0-9]/g, '') : '';
          
          // Duplicate Check
          if (phone && existingPhones.has(phone)) {
            skippedCount++;
            continue; 
          }

          // Name Logic
          let name = '';
          let surname = '';

          if (csvType === 'type_5') {
            name = row.name || '';
            surname = row.surname || '';
          } else {
            // Type 4: Split Name
            const parts = (String(row.name || '')).split(' ');
            name = parts[0];
            surname = parts.slice(1).join(' ');
          }

          batchInsert.push({
            name: name,
            surname: surname,
            email: row.email,
            phone: phone,
            country: row.country,
            source_file: sourceFile,
            status: 'New',
            created_at: new Date().toISOString()
          });

          addedCount++;
        }

        // BATCH INSERT
        if (batchInsert.length > 0) {
          // Note: Supabase limits strict batch sizes, but for <5000 rows usually OK. 
          // For HUGE files, we might need to chunk this loop.
          const { error } = await supabase.from('crm_leads').insert(batchInsert);
          if (error) {
            alert('Database Error: ' + error.message);
          } else {
            setUploadResults({ added: addedCount, skipped: skippedCount });
          }
        } else {
            setUploadResults({ added: 0, skipped: skippedCount });
        }
    } catch (error) {
        alert("Error importing file.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  // --- 3. MANAGE TAB LOGIC (STATS) ---
  const fetchFolders = async () => {
    const { data } = await supabase.from('crm_leads').select('source_file, assigned_to');
    
    if (!data) return;

    const statsMap: Record<string, FolderStat> = {};

    data.forEach(lead => {
      const src = lead.source_file || 'Unknown';
      if (!statsMap[src]) {
        statsMap[src] = { source_file: src, total_leads: 0, distributed: 0, agents: 0 };
      }
      statsMap[src].total_leads++;
      if (lead.assigned_to) statsMap[src].distributed++;
    });

    setFolders(Object.values(statsMap));
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchFolders();
  }, [activeTab]);

  // Manage Actions
  const deleteFolder = async (folderName: string) => {
    if(!confirm(`Are you sure you want to delete folder: ${folderName}? This cannot be undone.`)) return;
    
    const { error } = await supabase.from('crm_leads').delete().eq('source_file', folderName);
    if(error) alert('Error: ' + error.message);
    else fetchFolders();
  };

  const downloadFolder = async (folderName: string) => {
     const { data } = await supabase.from('crm_leads').select('*').eq('source_file', folderName);
     if (!data) return;
     
     // Convert JSON to CSV on the fly
     const csv = Papa.unparse(data);
     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement('a');
     link.href = URL.createObjectURL(blob);
     link.setAttribute('download', `${folderName}_export.csv`);
     document.body.appendChild(link);
     link.click();
  };

  return (
    <div className="max-w-6xl mx-auto mt-8 pb-20">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-linear-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/10">
          <FolderOpen className="text-white" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">File Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Check, import, and manage your lead lists.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-700 mb-8 overflow-x-auto">
        {[
            { id: 'check', label: 'Check File', icon: Search },
            { id: 'upload', label: 'Upload File', icon: UploadCloud },
            { id: 'manage', label: 'Manage Files', icon: FileSpreadsheet }
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-none px-8 py-4 font-bold text-sm transition rounded-t-xl flex items-center justify-center gap-2 min-w-35 ${
                    activeTab === tab.id 
                    ? 'border-b-2 border-blue-500 text-blue-500 bg-blue-500/10' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
                <tab.icon size={16} /> {tab.label}
            </button>
        ))}
      </div>

      {/* --- TAB CONTENT: CHECK --- */}
      {activeTab === 'check' && (
        <div className="glass-panel p-8 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-white mb-2">Flexible Check</h2>
            <p className="text-gray-400 text-sm mb-6">Scan any CSV or Excel file for duplicates. It only looks for <b>Phone</b> or <b>Email</b> columns.</p>
            
            {!checkResults ? (
                 <div className="border-2 border-dashed border-gray-600 hover:border-blue-500 hover:bg-blue-500/5 rounded-2xl p-12 text-center transition cursor-pointer group bg-crm-bg/30">
                    {/* ACCEPT CSV AND EXCEL */}
                    <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="checkInput" />
                    <label htmlFor="checkInput" className="cursor-pointer block w-full h-full">
                        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/20 transition">
                            <FileSpreadsheet className="text-gray-400 group-hover:text-blue-400" size={32} />
                        </div>
                        <p className="text-lg text-gray-300 font-bold group-hover:text-white">
                            {file ? file.name : 'Select CSV or Excel to Analyze'}
                        </p>
                    </label>
                    {file && (
                        <button onClick={handleCheck} disabled={loading} className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition flex items-center gap-2 mx-auto">
                           {loading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                           {loading ? 'Analyzing...' : 'Run Analysis'}
                        </button>
                    )}
                 </div>
            ) : (
                <div className="animate-in zoom-in-95 duration-300">
                      <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="bg-[#1e293b] p-5 rounded-xl border border-white/10 text-center"><span className="block text-3xl font-bold text-white">{checkResults.total}</span><span className="text-[10px] text-gray-400 uppercase font-bold">Total</span></div>
                        <div className="bg-[#1e293b] p-5 rounded-xl border border-green-500/20 text-center"><span className="block text-3xl font-bold text-green-400">{checkResults.new}</span><span className="text-[10px] text-green-400/70 uppercase font-bold">New</span></div>
                        <div className="bg-[#1e293b] p-5 rounded-xl border border-red-500/20 text-center"><span className="block text-3xl font-bold text-red-400">{checkResults.dupes}</span><span className="text-[10px] text-red-400/70 uppercase font-bold">Dupes</span></div>
                    </div>
                    
                    {checkResults.dupeList.length > 0 ? (
                        <div className="bg-crm-bg rounded-xl border border-red-500/20 overflow-hidden max-h-60 overflow-y-auto">
                           <table className="w-full text-left text-xs text-gray-400">
                               <thead className="bg-red-500/10 text-red-300 font-bold sticky top-0"><tr><th className="p-3">Row</th><th className="p-3">Name</th><th className="p-3">Reason</th></tr></thead>
                               <tbody className="divide-y divide-white/5">
                                   {checkResults.dupeList.map((d, i) => (
                                       <tr key={i} className="hover:bg-white/5"><td className="p-3 font-mono">{d.row}</td><td className="p-3 font-bold text-gray-300">{d.name}</td><td className="p-3 text-red-400 italic">{d.reason}</td></tr>
                                   ))}
                               </tbody>
                           </table>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-center text-green-400 font-bold">File is Clean!</div>
                    )}
                    <button onClick={() => { setCheckResults(null); setFile(null); }} className="w-full mt-6 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition">Check Another</button>
                </div>
            )}
        </div>
      )}

      {/* --- TAB CONTENT: UPLOAD --- */}
      {activeTab === 'upload' && (
        <div className="glass-panel p-8 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4">
             <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-xl font-bold text-white mb-2">Strict Import</h2>
                    <p className="text-gray-400 text-sm">Upload to Database. Must have: <code className="bg-black/30 px-1 py-0.5 rounded text-blue-300">Name, Phone, Email, Country</code></p>
                 </div>
                 <div className="hidden md:block bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-lg text-xs text-blue-200">
                     <p>Option 1: Name, Email, Phone, Country</p>
                     <p>Option 2: Name, Surname, Email, Phone, Country</p>
                 </div>
             </div>

             {!uploadResults ? (
                 <div className="border-2 border-dashed border-gray-600 hover:border-green-500 hover:bg-green-500/5 rounded-2xl p-12 text-center transition cursor-pointer group bg-crm-bg/30">
                    {/* ACCEPT CSV AND EXCEL */}
                    <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="uploadInput" />
                    <label htmlFor="uploadInput" className="cursor-pointer block w-full h-full">
                        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/20 transition">
                            <UploadCloud className="text-gray-400 group-hover:text-green-400" size={32} />
                        </div>
                        <p className="text-lg text-gray-300 font-bold group-hover:text-white">
                            {file ? file.name : 'Select CSV or Excel to Upload'}
                        </p>
                    </label>
                    {file && (
                        <div className="mt-6">
                            <button onClick={handleUpload} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition flex items-center gap-2 mx-auto">
                                {loading ? <Loader2 className="animate-spin" size={18}/> : <UploadCloud size={18}/>}
                                {loading ? 'Processing...' : 'Start Import'}
                            </button>
                            {loading && <p className="text-xs text-gray-400 mt-2 animate-pulse">{statusMsg}</p>}
                        </div>
                    )}
                 </div>
             ) : (
                <div className="bg-crm-bg p-6 rounded-xl border border-green-500/30 text-center animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400"><CheckCircle size={32} /></div>
                    <h3 className="text-2xl font-bold text-white mb-4">Import Success!</h3>
                    <div className="flex justify-center gap-8 mb-6">
                        <div><span className="block text-2xl font-bold text-green-400">{uploadResults.added}</span><span className="text-xs text-gray-500 uppercase">Added</span></div>
                        <div><span className="block text-2xl font-bold text-gray-400">{uploadResults.skipped}</span><span className="text-xs text-gray-500 uppercase">Skipped (Dupes)</span></div>
                    </div>
                    <button onClick={() => { setUploadResults(null); setFile(null); }} className="text-gray-500 hover:text-white text-sm underline">Upload Another</button>
                </div>
             )}
        </div>
      )}

      {/* --- TAB CONTENT: MANAGE --- */}
      {activeTab === 'manage' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-3.5 text-gray-500" size={14} />
                    <input type="text" placeholder="Search folders..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1e293b] border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-blue-500 outline-none shadow-lg" />
                </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-[#1e293b] text-gray-200 uppercase text-[10px] font-bold tracking-wider border-b border-gray-700">
                        <tr>
                            <th className="p-4">Folder Name</th>
                            <th className="p-4 text-center">Total Leads</th>
                            <th className="p-4 text-center">Distributed</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {folders.filter(f => f.source_file.toLowerCase().includes(searchTerm.toLowerCase())).map((folder) => (
                            <tr key={folder.source_file} className="hover:bg-white/5 transition">
                                <td className="p-4 font-mono text-white font-medium flex items-center gap-2">
                                    <FolderOpen size={16} className="text-yellow-500" /> {folder.source_file}
                                </td>
                                <td className="p-4 text-center">
                                    <span className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-bold">{folder.total_leads}</span>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="text-blue-400 font-bold">{folder.distributed}</span>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => downloadFolder(folder.source_file)} className="bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white p-2 rounded-lg transition" title="Download">
                                        <Download size={14} />
                                    </button>
                                    <button onClick={() => deleteFolder(folder.source_file)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded-lg transition" title="Delete">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

    </div>
  );
}