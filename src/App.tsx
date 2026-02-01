import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ShieldAlert } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { Lead } from './hooks/useLeads'; 

// COMPONENTS
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import NotificationSystem from './components/NotificationSystem';
import LeadProfilePage from './components/LeadProfile';
import ChatBubble from './components/Chat/ChatBubble';

// PAGES
import Dashboard from './pages/Dashboard';
import FileManager from './components/Files';
import TeamManagement from './components/Team'; 
import ShufflePage from './components/Shuffle'; 
import CallsPage from './components/Calls';
import SplitterPage from './components/Splitter';
import ChatPage from './pages/ChatPage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // --- MODIFIED: Load 'selectedLead' from storage, or default to null ---
  const [selectedLead, setSelectedLead] = useState<Lead | null>(() => {
    const saved = localStorage.getItem('crm_selected_lead');
    return saved ? JSON.parse(saved) : null;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [showBubble, setShowBubble] = useState(false);
  // --- NEW: This fixes the Red Dot issue ---
  // It tracks which room you are currently looking at.
  const [activeBubbleRoom, setActiveBubbleRoom] = useState<string | null>(null); 

  // --- NEW: Auto-save Selected Lead when it changes ---
  useEffect(() => {
    if (selectedLead) {
      localStorage.setItem('crm_selected_lead', JSON.stringify(selectedLead));
    } else {
      localStorage.removeItem('crm_selected_lead');
    }
  }, [selectedLead]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((currentSession) => {
        if (currentSession?.access_token === newSession?.access_token) {
          return currentSession;
        }
        return newSession;
      });
    });

    const handleOpenLead = async (event: Event) => {
        const e = event as CustomEvent; 
        const leadId = e.detail;
        if (!leadId) return;

        const { data } = await supabase.from('crm_leads').select('*').eq('id', leadId).single();
        if (data) {
            setSelectedLead(data);
        }
    };
    
    window.addEventListener('crm-open-lead-id', handleOpenLead);

    return () => { 
        subscription.unsubscribe(); 
        window.removeEventListener('crm-open-lead-id', handleOpenLead);
    };
  }, []);

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
    const role = session?.user?.user_metadata?.role || 'conversion';
    if (!allowedRoles.includes(role)) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in zoom-in-95">
            <div className="p-6 bg-red-500/10 rounded-full mb-6 border border-red-500/20">
                <ShieldAlert size={64} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Access Denied</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
                Security Protocol: You do not have the required clearance.
            </p>
        </div>
      );
    }
    return <>{children}</>;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading System...</div>;
  if (!session) return <LoginPage />;
  
  if (selectedLead) {
    return (
      <div className="min-h-screen text-[#e2e8f0]">
        <LeadProfilePage lead={selectedLead} onBack={() => setSelectedLead(null)} />
      </div>
    );
  }

  const currentRole = session.user.user_metadata?.role || 'conversion';

  return (
    <BrowserRouter>
      <div className="flex min-h-screen font-sans text-[#e2e8f0]">
        <NotificationSystem />

        {/* --- CHAT BUBBLE WIDGET --- */}
        {session?.user?.id && showBubble && (
            <ChatBubble 
                currentUserId={session.user.id} 
                onClose={() => { setShowBubble(false); setActiveBubbleRoom(null); }} 
                onRoomChange={setActiveBubbleRoom} // <--- Important: This tells App where you are
            />
        )}

        <Sidebar 
            role={currentRole} 
            username={session.user.email || 'User'} 
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenBubble={() => setShowBubble(true)}
            activeBubbleRoom={activeBubbleRoom} // <--- Important: This tells Sidebar to hide the red dot
        />
        
        <main className={`flex-1 p-6 relative z-10 overflow-y-auto h-screen transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
          <Routes>
            <Route path="/" element={<Dashboard session={session} onLeadClick={setSelectedLead} />} />
            <Route path="/team" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><TeamManagement /></ProtectedRoute>} />
            <Route path="/files" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><FileManager /></ProtectedRoute>} />
            <Route path="/shuffle" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'team_leader']}><ShufflePage /></ProtectedRoute>} />
            <Route path="/splitter" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><SplitterPage /></ProtectedRoute>} />
            <Route path="/calls" element={<CallsPage />} />
            
            {/* --- NEW CHAT PAGE --- */}
            <Route path="/chat" element={<ChatPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}