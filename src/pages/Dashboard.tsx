import { useState } from 'react';
import type { Session } from '@supabase/supabase-js'; 
import type { Lead } from '../hooks/useLeads'; 
import StatsGrid from '../components/StatsGrid';
import AdvancedFilter from '../components/AdvancedFilter';
import LeadsTable from '../components/LeadsTable';

interface DashboardProps {
  session: Session;
  onLeadClick: (lead: Lead) => void;
}

export default function Dashboard({ session, onLeadClick }: DashboardProps) {
  const currentUserId = session?.user?.id;
  const currentRole = session?.user?.user_metadata?.role || 'conversion';

  const [activeFilters, setActiveFilters] = useState({
      search: '',
      dateRange: 'all',
      status: [] as string[],
      agent: [] as string[],
      source: [] as string[],
      country: [] as string[],
      limit: 50,
      page: 1, 
      tab: (['admin', 'manager'].includes(currentRole) ? 'all' : 'mine') as 'all' | 'mine' | 'unassigned'
  });

  const toggleStatus = (status: string) => {
    setActiveFilters(prev => {
      const current = prev.status;
      const newState = { ...prev, page: 1 }; 
      if (current.includes(status)) {
        return { ...newState, status: current.filter(s => s !== status) };
      } else {
        return { ...newState, status: [...current, status] };
      }
    });
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Lead Center</h2>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] mt-1 italic">Real-time Business Intelligence</p>
        </div>
      </header>
      
      <StatsGrid 
        selectedStatuses={activeFilters.status} 
        onToggleStatus={toggleStatus} 
        currentUserId={currentUserId}
        role={currentRole}
      />
      
      {/* UPDATED COMPONENT:
          Passed role and userId clearly.
          Removed any duplicate props.
      */}
      <AdvancedFilter 
        currentFilters={activeFilters} 
        onFilterChange={setActiveFilters} 
        currentUserEmail={session.user.email}
        role={currentRole}
        userId={currentUserId}
      />
      
      <LeadsTable 
          role={currentRole} 
          filters={activeFilters} 
          onLeadClick={onLeadClick} 
          currentUserEmail={session.user.email} 
          onPageChange={(newPage: number) => setActiveFilters(prev => ({ ...prev, page: newPage }))}
      />
    </div>
  );
}