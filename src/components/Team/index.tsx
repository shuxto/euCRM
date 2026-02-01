import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, Crown, Briefcase, Key, Headset, Phone, ShieldAlert, UserPlus, Loader2, Search
} from 'lucide-react';
import type { CRMUser } from './types';

// SUB-COMPONENTS
import TeamStats from './TeamStats';
import TeamTable from './TeamTable';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal'; // <--- NEW
import PromoteModal from './PromoteModal';   // <--- NEW
import ManageTeamModal from './ManageTeamModal';
import PermsModal from './PermsModal';
import ConfirmationModal from './ConfirmationModal';
import SuccessModal from './SuccessModal';

export default function TeamManagement() {
  const [activeTab, setActiveTab] = useState('staff');
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // SEARCH STATE
  const [mainSearch, setMainSearch] = useState('');

  // Modal Triggers
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<CRMUser | null>(null);
  const [selectedManager, setSelectedManager] = useState<CRMUser | null>(null);
  
  // NEW EDIT MODALS
  const [editUser, setEditUser] = useState<CRMUser | null>(null);
  const [promoteUser, setPromoteUser] = useState<CRMUser | null>(null);

  // NOTIFICATION STATE
  const [notif, setNotif] = useState<{ isOpen: boolean; type: 'success'|'error'; title: string; message: string }>({
    isOpen: false, type: 'success', title: '', message: ''
  });

  // CONFIRMATION STATE
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; type: 'danger' | 'success'; title: string; message: string; action: () => Promise<void>;
  }>({ isOpen: false, type: 'danger', title: '', message: '', action: async () => {}, });
  const [actionLoading, setActionLoading] = useState(false);

  // --- FETCH DATA ---
  const fetchTeamData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    const { data: crmData } = await supabase.from('crm_users').select('*').order('created_at', { ascending: false });
    const { data: tradingRoles } = await supabase.rpc('get_trading_roles');
    const tradingRoleMap = new Map((tradingRoles || []).map((u: any) => [u.id, u.role]));
    const { data: folderData } = await supabase.from('crm_leads').select('source_file');
    const uniqueFolders = Array.from(new Set((folderData || []).map(f => f.source_file).filter(f => f && f !== ''))) as string[];

    if (crmData) {
        const mergedUsers = crmData.map((u: any) => ({
            ...u,
            is_synced: tradingRoleMap.get(u.id) === u.role 
        }));
        setUsers(mergedUsers as CRMUser[]);
    }
    setFolders(uniqueFolders);
    if (!silent) setLoading(false);
  };

  useEffect(() => { fetchTeamData(); }, []);

  const showPopup = (type: 'success'|'error', title: string, message: string) => {
    setNotif({ isOpen: true, type, title, message });
  };

  // --- ACTIONS ---

  const handleDeleteClick = (userId: string) => {
    setConfirmState({
      isOpen: true, type: 'danger', title: 'Delete User?', message: 'This action will permanently delete the user, their trades, and logs.',
      action: async () => {
        const { data, error } = await supabase.functions.invoke('delete-user', { body: { user_id: userId } });
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
      }
    });
  };

  const handleSyncRoleClick = (user: CRMUser) => {
    setConfirmState({
      isOpen: true, type: 'success', title: `Sync ${user.role.toUpperCase()} Role?`,
      message: `Update ${user.real_name}'s role in the Trading Platform?`,
      action: async () => {
        const { error } = await supabase.rpc('sync_trading_role', { target_user_id: user.id, target_role: user.role });
        if (error) throw error;
      }
    });
  };

  const handleBulkRemoveFromTeam = (agentIds: string[]) => {
    setConfirmState({
        isOpen: true, type: 'danger', title: `Remove ${agentIds.length} Agents?`, message: 'They will be unassigned from this team leader.',
        action: async () => {
            const { error } = await supabase.from('crm_users').update({ team_leader_id: null }).in('id', agentIds);
            if (error) throw error;
        }
    });
  };

  const handleConfirmAction = async () => {
    setActionLoading(true);
    try {
      await confirmState.action();
      setConfirmState({ ...confirmState, isOpen: false });
      showPopup('success', 'Operation Successful', 'The action has been completed.');
      await fetchTeamData(true);
    } catch (err: any) { 
        console.error("Action Error:", err);
        showPopup('error', 'Action Failed', err.message || "Unknown Error");
    } 
    finally { setActionLoading(false); }
  };

  const filteredUsers = users.filter(u => 
    u.real_name.toLowerCase().includes(mainSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(mainSearch.toLowerCase())
  );

  const stats = {
    admin: users.filter(u => u.role === 'admin').length,
    manager: users.filter(u => u.role === 'manager').length,
    leader: users.filter(u => u.role === 'team_leader').length,
    conversion: users.filter(u => u.role === 'conversion').length,
    retention: users.filter(u => u.role === 'retention').length,
    compliance: users.filter(u => u.role === 'compliance').length,
  };

  if (loading) return <div className="h-96 flex items-center justify-center text-cyan-500"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in zoom-in-95 duration-500">
      
      {/* HEADER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-2 glass-panel p-8 rounded-2xl relative overflow-hidden group flex flex-col justify-between min-h-60">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-500 pointer-events-none z-0"><Crown size={180} /></div>
            <div className="relative z-10">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Team Command</h1>
                <p className="text-gray-400 text-sm mb-6 max-w-md">Manage hierarchy, roles, and access permissions for the entire organization.</p>
            </div>
            <div className="relative z-10 flex gap-3 mt-auto items-center">
                 <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-3 text-gray-500 group-focus-within:text-cyan-400 transition" size={18} />
                    <input type="text" placeholder="Search users..." className="w-full bg-crm-bg/50 border border-white/10 pl-10 py-3 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500 outline-none backdrop-blur-md transition shadow-inner" value={mainSearch} onChange={(e) => setMainSearch(e.target.value)} />
                 </div>
                 <button onClick={() => setShowCreate(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-cyan-900/20 transition hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap cursor-pointer z-20"><UserPlus size={18} /> Add Member</button>
            </div>
        </div>
        <TeamStats stats={stats} />
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-700 mb-8 overflow-x-auto custom-scrollbar">
        {[{ id: 'staff', label: 'All Staff', icon: Users }, { id: 'admins', label: 'Admins', icon: Crown }, { id: 'managers', label: 'Managers', icon: Key }, { id: 'leaders', label: 'Team Leaders', icon: Briefcase }, { id: 'conversion', label: 'Conversion', icon: Headset }, { id: 'retention', label: 'Retention', icon: Phone }, { id: 'compliance', label: 'Compliance', icon: ShieldAlert }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 font-bold text-sm transition flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${activeTab === tab.id ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}><tab.icon size={16} /> {tab.label}</button>
        ))}
      </div>

      {/* TABLE */}
      <TeamTable 
        users={filteredUsers} allUsers={users} activeTab={activeTab} 
        onDelete={handleDeleteClick} 
        onManageLeader={(leader) => setSelectedLeader(leader)}
        onManagePerms={(manager) => setSelectedManager(manager)}
        onPromoteTrading={handleSyncRoleClick} 
        onEditUser={(user) => setEditUser(user)}         // <--- WIRED
        onChangeRole={(user) => setPromoteUser(user)}    // <--- WIRED
      />

      {/* MODALS */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); showPopup('success', 'User Created', 'New member added to the database.'); fetchTeamData(true); }} />}
      
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSuccess={() => { setEditUser(null); fetchTeamData(true); }} />}
      {promoteUser && <PromoteModal user={promoteUser} onClose={() => setPromoteUser(null)} onSuccess={() => { setPromoteUser(null); fetchTeamData(true); }} />}

      {selectedLeader && (<ManageTeamModal leader={selectedLeader} allUsers={users} onClose={() => setSelectedLeader(null)} onSuccess={() => { showPopup('success', 'Team Updated', 'Agents assigned successfully.'); fetchTeamData(true); }} onConfirmRemove={handleBulkRemoveFromTeam}/>)}
      {selectedManager && <PermsModal manager={selectedManager} folders={folders} onClose={() => setSelectedManager(null)} onSuccess={() => { setSelectedManager(null); showPopup('success', 'Permissions Saved', 'Folder access updated.'); fetchTeamData(true); }} />}
      
      <ConfirmationModal isOpen={confirmState.isOpen} type={confirmState.type} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirmAction} onClose={() => setConfirmState({...confirmState, isOpen: false})} loading={actionLoading} />
      <SuccessModal isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif({...notif, isOpen: false})} />
    </div>
  );
}