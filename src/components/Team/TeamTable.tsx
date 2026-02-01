import { Briefcase, Key, Trash2, Users, TrendingUp, CheckCircle2, Pencil, Link } from 'lucide-react';
import type { CRMUser } from './types';

interface Props {
  users: CRMUser[];
  activeTab: string;
  allUsers: CRMUser[];
  onDelete: (id: string) => void;
  onManageLeader?: (leader: CRMUser) => void;
  onManagePerms?: (manager: CRMUser) => void;
  onPromoteTrading?: (user: CRMUser) => void;
  onEditUser: (user: CRMUser) => void;
  onChangeRole: (user: CRMUser) => void;
}

export default function TeamTable({ 
  users, activeTab, allUsers, onDelete, onManageLeader, onManagePerms, onPromoteTrading, onEditUser, onChangeRole 
}: Props) {

  const filteredUsers = users.filter(u => {
    if (activeTab === 'staff') return true;
    if (activeTab === 'admins') return u.role === 'admin';
    if (activeTab === 'managers') return u.role === 'manager';
    if (activeTab === 'leaders') return u.role === 'team_leader';
    return u.role === activeTab;
  });

  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-gray-800/50 backdrop-blur-xl">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-gray-900/50 text-gray-200 uppercase text-[10px] font-bold tracking-wider border-b border-gray-700">
          <tr>
            <th className="p-5">User</th>
            <th className="p-5">Role</th>
            <th className="p-5">Platform</th>
            <th className="p-5">Management</th>
            <th className="p-5">Details</th>
            <th className="p-5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {filteredUsers.length === 0 ? (
            <tr><td colSpan={6} className="p-10 text-center text-gray-500 italic">No users found.</td></tr>
          ) : (
            filteredUsers.map(user => {
              const leader = allUsers.find(u => u.id === user.team_leader_id);
              const teamSize = allUsers.filter(u => u.team_leader_id === user.id).length;
              
              // --- FIX FOR CRASH: Handle Array vs String ---
              const sourceData = user.allowed_sources;
              let folderCount = 0;
              if (Array.isArray(sourceData)) {
                  folderCount = sourceData.length;
              } else if (typeof sourceData === 'string' && sourceData) {
                  folderCount = sourceData.split(',').filter(s => s.trim() !== '').length;
              }
              // ---------------------------------------------
              
              const roleStyles: Record<string, string> = {
                admin: 'bg-red-500/10 text-red-400 border-red-500/20',
                manager: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                team_leader: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                retention: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
                compliance: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                conversion: 'bg-green-500/10 text-green-400 border-green-500/20',
              };

              return (
                <tr key={user.id} className="group hover:bg-white/5 transition duration-200">
                  
                  {/* 1. USER - UPDATED WITH AVATAR */}
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-linear-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white font-bold shadow-inner group-hover:scale-105 transition border border-gray-600/30">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.real_name} className="w-full h-full object-cover" />
                        ) : (
                            user.real_name?.substring(0, 2).toUpperCase() || 'UN'
                        )}
                      </div>
                      <div>
                        <div className="text-white font-bold group-hover:text-cyan-400 transition">{user.real_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* 2. ROLE */}
                  <td className="p-5">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${roleStyles[user.role] || roleStyles.conversion}`}>
                      {user.role === 'conversion' ? 'Conversion' : user.role.replace('_', ' ')}
                    </span>
                  </td>

                  {/* 3. PLATFORM */}
                  <td className="p-5">
                    {['admin', 'manager', 'compliance'].includes(user.role) ? (
                        user.is_synced ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                            <CheckCircle2 size={12} /> Linked
                          </div>
                        ) : (
                          <button onClick={() => onPromoteTrading?.(user)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-700 hover:bg-green-600 text-gray-300 hover:text-white border border-gray-600 hover:border-green-500 text-[10px] font-bold transition">
                            <Link size={12} /> Sync Role
                          </button>
                        )
                    ) : (
                        <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>

                  {/* 4. MANAGEMENT */}
                  <td className="p-5">
                    {user.role === 'team_leader' && (
                        <button onClick={() => onManageLeader?.(user)} className="flex items-center gap-2 bg-cyan-900/30 hover:bg-cyan-600 text-cyan-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition border border-cyan-500/30 hover:border-cyan-500 shadow-lg shadow-cyan-900/10">
                            <Users size={12} /> Manage Team
                        </button>
                    )}
                    {user.role === 'manager' && (
                        <button onClick={() => onManagePerms?.(user)} className="flex items-center gap-2 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition border border-purple-500/30 hover:border-purple-500">
                            <Key size={12} /> Permissions
                        </button>
                    )}
                    {!['team_leader', 'manager'].includes(user.role) && <span className="text-gray-600 text-xs">-</span>}
                  </td>

                  {/* 5. DETAILS */}
                  <td className="p-5">
                    {user.role === 'team_leader' ? (
                      <div className="text-white font-bold flex items-center gap-1"><Users size={14} className="text-cyan-500"/> {teamSize} <span className="text-gray-500 font-normal text-xs">Agents</span></div>
                    ) : user.role === 'manager' ? (
                      <div className="text-white font-bold flex items-center gap-1"><Briefcase size={14} className="text-purple-500"/> {folderCount} <span className="text-gray-500 font-normal text-xs">Sources</span></div>
                    ) : leader ? (
                      <div className="flex items-center gap-2 text-cyan-300 bg-cyan-900/10 px-2 py-1 rounded-md w-fit border border-cyan-500/20"><Briefcase size={12} /> <span className="text-xs">{leader.real_name}</span></div>
                    ) : (<span className="text-gray-600 text-xs">-</span>)}
                  </td>

                  {/* 6. ACTIONS */}
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <button onClick={() => onEditUser(user)} className="text-gray-500 hover:text-blue-400 transition p-2 hover:bg-blue-500/10 rounded-lg cursor-pointer" title="Edit User">
                        <Pencil size={16} />
                      </button>
                      
                      <button onClick={() => onChangeRole(user)} className="text-gray-500 hover:text-green-400 transition p-2 hover:bg-green-500/10 rounded-lg cursor-pointer" title="Promote / Change Role">
                        <TrendingUp size={16} />
                      </button>

                      <button onClick={() => onDelete(user.id)} className="text-gray-500 hover:text-red-400 transition p-2 hover:bg-red-500/10 rounded-lg cursor-pointer" title="Delete User">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}