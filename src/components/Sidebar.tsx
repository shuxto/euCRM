import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Phone, 
  LogOut, Shield, Briefcase, 
  Shuffle, Split, FolderOpen,
  Menu, ChevronLeft, ChevronRight,
  MessageCircle,
  Bot,
  Headphones 
} from 'lucide-react';
import { Radio } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Gamepad2 } from 'lucide-react';
import Game2048 from './Game/Game2048';
import { NavLink, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell'; 
import ProfileSettingsModal from './ProfileSettingsModal';
import { useApp } from '../context/NotificationContext'; 
import { usePerformance } from '../context/PerformanceContext'; // 👈 NEW
import { Zap, ZapOff } from 'lucide-react'; // Icons

interface SidebarProps {
  role: string;
  username: string;
  isCollapsed: boolean; 
  onToggle: () => void; 
  onOpenAi: () => void;
  onLogout: () => void;
}

export default function Sidebar({ 
  role, 
  username, 
  isCollapsed, 
  onToggle, 
  onOpenAi,
  onLogout
}: SidebarProps) {
  const [userId, setUserId] = useState<string | null>(null); // RESTORED
  const [isMobileOpen, setIsMobileOpen] = useState(false); 
  
  const { unreadGlobal, unreadDM, unreadSupport, clearGlobal, clearDM } = useApp();
  const { isPerformanceMode, togglePerformanceMode } = usePerformance(); // 👈 NEW

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGame, setShowGame] = useState(false);

  const location = useLocation();

  // RESTORED: Profile & User ID Logic (Lightweight)
  useEffect(() => {
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
            // Fetch Avatar
            const { data } = await supabase.from('crm_users').select('avatar_url').eq('id', user.id).single();
            if (data) setAvatarUrl(data.avatar_url);
        }
    };
    init();

    // Listen for Profile Updates (Avatar changes)
    const handleProfileUpdate = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('crm_users').select('avatar_url').eq('id', user.id).single();
            if (data) setAvatarUrl(data.avatar_url);
        }
    };
    window.addEventListener('crm-profile-update', handleProfileUpdate);
    return () => { window.removeEventListener('crm-profile-update', handleProfileUpdate); };
  }, []);
  
  const menuItems = [
    { path: '/', label: 'Leads', icon: LayoutDashboard, roles: ['admin', 'manager', 'retention', 'conversion', 'team_leader'] },
    { 
        path: '/chat', 
        label: 'Messenger', 
        icon: MessageCircle, 
        roles: ['admin', 'manager', 'retention', 'conversion'],
        hasBadge: unreadGlobal > 0
    },
    { 
        path: '/support', 
        label: 'Support', 
        icon: Headphones, 
        roles: ['admin', 'manager', 'retention', 'conversion', 'team_leader'],
        hasBadge: unreadSupport > 0 && location.pathname !== '/support'
    },
    { path: '/team', label: 'Team', icon: Users, roles: ['admin', 'manager'] },
    { path: '/shuffle', label: 'Shuffle', icon: Shuffle, roles: ['admin', 'manager', 'team_leader'] },
    { path: '/broadcast', label: 'Broadcast', icon: Radio, roles: ['admin', 'manager'] },
    { path: '/splitter', label: 'Splitter', icon: Split, roles: ['admin', 'manager'] },
    { path: '/files', label: 'Files', icon: FolderOpen, roles: ['admin', 'manager'] },
    { path: '/calls', label: 'Call Logs', icon: Phone, roles: ['admin', 'manager'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <button 
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-crm-bg border border-white/10 rounded-lg text-white shadow-lg active:scale-95 transition"
      >
        <Menu size={24} />
      </button>

      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 h-screen bg-crm-bg border-r border-white/5 flex flex-col transition-all duration-300
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 
          ${isCollapsed ? 'md:w-20' : 'md:w-56'} 
          w-56
        `}
      >
        <button
            onClick={onToggle}
            className="hidden md:flex absolute -right-3 top-9 w-6 h-6 bg-blue-600 rounded-full items-center justify-center text-white shadow-lg cursor-pointer hover:bg-blue-500 hover:scale-110 transition z-50 border border-crm-bg"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* PRO FIX: Reduced padding (p-4) to fit smaller laptop screens */}
        <div className="p-4 flex flex-col h-full overflow-hidden">
          
          {/* PRO FIX: Reduced margin (mb-4) and added shrink-0 so header never squishes */}
          <div className={`flex items-center mb-4 shrink-0 transition-all ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                      <Briefcase size={18} className="text-white" />
                  </div>
                  {!isCollapsed && (
                    <h1 className="text-xl font-bold bg-linear-to-r from-white to-gray-400 bg-clip-text text-transparent whitespace-nowrap animate-in fade-in duration-300">
                        CRM Pro
                    </h1>
                  )}
              </div>
              
              {userId && (
                <div className={isCollapsed ? "" : ""}>
                   <NotificationBell userId={userId} />
                </div>
              )}
          </div>

          {/* PRO FIX: Scrollable but with HIDDEN scrollbar (Looks clean, works on all screens) */}
          <nav className="space-y-1 flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {filteredMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}         
                onClick={() => {
                    setIsMobileOpen(false);
                    if (item.path === '/chat') clearGlobal();
                }}
                className={({ isActive }) => {
                  // Special Style for Broadcast
                  if (item.path === '/broadcast') {
                      return `
                        w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer relative
                        ${isCollapsed ? 'justify-center' : ''}
                        ${isActive 
                          ? 'bg-linear-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-900/20 translate-x-1' 
                          : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                        }
                      `;
                  }
                  // Default Style for others
                  return `
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer relative
                    ${isCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-1' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                    }
                  `;
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="relative">
                    <item.icon size={20} className="shrink-0" />
                    {/* @ts-ignore */}
                    {item.hasBadge && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-crm-bg"></span>
                    )}
                </div>
                
                {!isCollapsed && (
                   <span className="font-medium text-sm whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                     {item.label}
                   </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className={`mt-auto pt-6 border-t border-white/5 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>

             {/* AI ASSISTANT BUTTON */}
             <button 
                onClick={() => {
                    console.log("AI Button Clicked"); // <--- Debug check
                    onOpenAi();
                }}
                className={`mb-3 w-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-lg transition flex items-center justify-center relative ${isCollapsed ? 'p-2' : 'py-2 gap-2'}`}
                title="AI Assistant"
             >
                <div className="relative">
                    <Bot size={18} />
                </div>
                {!isCollapsed && <span className="text-sm font-bold">AI Assistant</span>}
             </button>

          {/* GAME BUTTON */}
             <button 
                onClick={() => setShowGame(true)}
                className={`mb-3 w-full bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 hover:text-white rounded-lg transition flex items-center justify-center relative ${isCollapsed ? 'p-2' : 'py-2 gap-2'}`}
                title="Play 2048"
             >
                <div className="relative">
                    <Gamepad2 size={18} className="animate-pulse" />
                </div>
                {!isCollapsed && <span className="text-sm font-bold">Championship</span>}
             </button>
              
             <button 
                onClick={clearDM} 
                className={`mb-3 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center justify-center relative ${isCollapsed ? 'p-2' : 'py-2 gap-2'}`}
                title="Open Quick Chat"
             >
                <div className="relative">
                    <MessageCircle size={18} />
                    {unreadDM > 0 && (
                        <span className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-red-500 border-2 border-blue-600 rounded-full flex items-center justify-center text-[8px] font-bold">
                            {unreadDM > 9 ? '!' : unreadDM}
                        </span>
                    )}
                </div>
                {!isCollapsed && <span className="text-sm font-bold">Quick Chat</span>}
             </button>

             {!isCollapsed ? (
                <div className="bg-black/20 p-4 rounded-xl animate-in fade-in duration-300">
                  {/* --- CLICKABLE PROFILE HEADER --- */}
                  <div 
                    onClick={() => setShowProfileModal(true)} 
                    className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition group"
                  >
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {avatarUrl ? (
                          <img src={avatarUrl} alt="Me" className="w-full h-full object-cover" />
                      ) : (
                          <Shield size={14} className="text-gray-400 group-hover:text-white transition" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition">{username}</p>
                      <p className="text-xs text-gray-500 capitalize truncate">{role}</p>
                    </div>
                  </div>
                  
                  {/* POTATO MODE TOGGLE */}
                  <button 
                    onClick={togglePerformanceMode}
                    className={`w-full flex items-center justify-center gap-2 p-2 mb-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                        isPerformanceMode 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                        : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {isPerformanceMode ? <ZapOff size={16} /> : <Zap size={16} />}
                    <span>{isPerformanceMode ? 'Potato Mode: ON' : 'High Performance'}</span>
                  </button>
                  
                  <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium border border-transparent hover:border-red-500/20 cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
             ) : (
                <div className="flex flex-col gap-4 items-center animate-in fade-in duration-300">
                    {/* --- COLLAPSED AVATAR --- */}
                    <div 
                        onClick={() => setShowProfileModal(true)}
                        className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center shrink-0 cursor-pointer hover:border-blue-500 overflow-hidden" 
                        title={username}
                    >
                      {avatarUrl ? (
                          <img src={avatarUrl} alt="Me" className="w-full h-full object-cover" />
                      ) : (
                          <Shield size={14} className="text-gray-400" />
                      )}
                    </div>
                    <button 
    onClick={onLogout}
    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
    title="Sign Out"
>
                        <LogOut size={18} />
                    </button>
                </div>
             )}
          </div>
        </div>
      </aside>

      {/* --- PROFILE MODAL --- */}
      {showProfileModal && <ProfileSettingsModal onClose={() => setShowProfileModal(false)} />}

        {/* --- GAME MODAL --- */}
      {showGame && userId && (
        <Game2048 
            onClose={() => setShowGame(false)} 
            currentUserRole={role} 
            currentUserId={userId} 
        />
      )}
    </>
  );
}