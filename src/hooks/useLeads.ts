import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/NotificationContext'; // 👈 Import Context for Global Cache

export interface Lead {
  id: string; 
  name: string;
  surname: string;
  country: string;
  status: string;
  kyc_status: string | null;
  phone: string;
  email: string;
  created_at: string;
  source_file: string;
  assigned_to: string | null; 
  note_count: number;
  callback_time?: string | null; 
  trading_account_id?: string | null; // 👈 RESTORED for LeadProfile
}

export interface Agent {
  id: string;
  real_name: string;
  role: string;
}

export function useLeads(filters: any, currentUserId?: string) {
  const { agents: globalAgents, statuses: globalStatuses } = useApp(); 
  // 1. GET USER CONTEXT
  const { currentUser, isDataLoaded } = useApp();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [loading, setLoading] = useState(true);

  // --- FETCH DATA (OPTIMIZED: ONLY LEADS) ---
  const fetchData = async () => {
    
    setLoading(true);

    try {

        // 🔒 SECURITY GATE: If we don't know the user yet, DON'T FETCH.
        // This prevents the "Flash of Unrestricted Data" bug.
        if (!currentUser) {
             // Only stop if we are truly waiting for data. 
             // If data is loaded and user is still null, it means they aren't logged in (handled elsewhere).
             if (!isDataLoaded) return; 
        }

        // 1. BUILD QUERY (Optimized Select)
        let leadQuery = supabase.from('crm_leads')
            .select('id, name, surname, country, status, kyc_status, phone, email, created_at, source_file, assigned_to, note_count, callback_time, trading_account_id', { count: 'exact' }) 
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

            // 🔒 MANAGER RESTRICTION 🔒
        if (currentUser?.role === 'manager') {
            const allowed = currentUser.allowed_sources;
            
            // Handle CSV String "Google, Facebook"
            if (typeof allowed === 'string' && allowed.length > 0) {
                const list = allowed.split(',').map(s => s.trim());
                leadQuery = leadQuery.in('source_file', list);
            } 
            // Handle Array ["Google", "Facebook"]
            else if (Array.isArray(allowed) && allowed.length > 0) {
                leadQuery = leadQuery.in('source_file', allowed);
            }
            // Block everything if no sources allowed
            else {
                leadQuery = leadQuery.eq('id', '00000000-0000-0000-0000-000000000000');
            }
        }

        // Apply Filters to Lead Query
        if (filters) {
            if (filters.status?.length > 0) leadQuery = leadQuery.in('status', filters.status);
            if (filters.search?.trim()) {
                const s = filters.search.trim();
                leadQuery = leadQuery.or(`name.ilike.%${s}%,surname.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
            }
            if (filters.dateRange && filters.dateRange !== 'all') {
                const now = new Date();
                let dateStr = '';
                if (filters.dateRange === 'today') {
                    dateStr = now.toISOString().split('T')[0];
                    leadQuery = leadQuery.gte('created_at', dateStr);
                } else if (filters.dateRange === 'yesterday') {
                    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                    dateStr = yest.toISOString().split('T')[0];
                    const todayStr = now.toISOString().split('T')[0];
                    leadQuery = leadQuery.gte('created_at', dateStr).lt('created_at', todayStr);
                }
            }
            if (filters.agent?.length > 0) leadQuery = leadQuery.in('assigned_to', filters.agent);
            if (filters.source?.length > 0) leadQuery = leadQuery.in('source_file', filters.source);
            if (filters.country?.length > 0) leadQuery = leadQuery.in('country', filters.country);
            
            // Strict Logic
            if (filters.tab === 'unassigned') {
                leadQuery = leadQuery.is('assigned_to', null);
            } 
            else if (filters.tab === 'mine') {
                if (currentUserId) {
                    leadQuery = leadQuery.eq('assigned_to', currentUserId); 
                } else {
                    // Security Fallback
                    leadQuery = leadQuery.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            } 
        }

        const page = filters?.page || 1;
        const limit = filters?.limit || 50;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        leadQuery = leadQuery.range(from, to);

        // 2. EXECUTE REQUEST (Single Request!)
        const { data: leadsData, count, error: leadError } = await leadQuery;

        // 3. SET STATE
        if (leadError) {
            console.error("Error fetching leads:", leadError);
            setLeads([]); 
        } else {
            setLeads(leadsData || []);
            setTotalCount(count || 0);
        }

    } catch (err) {
        console.error("Critical fetch error:", err);
        setLeads([]);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Realtime subscription (unchanged logic)
    const leadSub = supabase.channel('table-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_leads' }, (payload) => {
          setLeads(currentLeads => [payload.new as Lead, ...currentLeads]);
          setTotalCount(prev => prev + 1);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(leadSub); };
    
  }, [JSON.stringify(filters), currentUserId, currentUser, isDataLoaded]); // 👈 FIXED: currentUser is INSIDE the brackets

  // --- ACTIONS (Untouched) ---
  const updateLocalLead = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const removeLeadFromView = (id: string) => {
      setLeads(prev => prev.filter(l => l.id !== id));
      setTotalCount(prev => prev - 1);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    const oldStatus = lead ? lead.status : null;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    if (oldStatus && oldStatus !== newStatus) {
        window.dispatchEvent(new CustomEvent('crm-lead-update', { detail: { oldStatus, newStatus } }));
    }
    await supabase.from('crm_leads').update({ status: newStatus }).eq('id', leadId);
  };

  const updateLeadAgent = async (leadId: string, agentId: string | null) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: agentId } : l));
    await supabase.from('crm_leads').update({ assigned_to: agentId }).eq('id', leadId);
  };

  const deleteLead = async (leadId: string) => {
    try {
        // 1. Delete Notifications first
        await supabase.from('crm_notifications').delete().eq('related_lead_id', leadId);
        
        // 2. Delete the Lead
        const { error } = await supabase.from('crm_leads').delete().eq('id', leadId);
        
        if (error) {
            console.error("Delete failed:", error);
            return false;
        }

        setLeads(prev => prev.filter(l => l.id !== leadId));
        setTotalCount(prev => prev - 1);
        return true;
    } catch (err) {
        console.error("Error deleting lead:", err);
        return false;
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: string) => {
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, status } : l));
    await supabase.from('crm_leads').update({ status }).in('id', ids);
    return true;
  };

  const bulkUpdateAgent = async (ids: string[], agentId: string | null) => {
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, assigned_to: agentId } : l));
    await supabase.from('crm_leads').update({ assigned_to: agentId }).in('id', ids);
    return true;
  };

  const bulkDeleteLeads = async (ids: string[]) => {
    try {
        // Process in chunks of 50 to avoid "URI Too Long" errors
        const chunkSize = 50;
        
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            
            // 1. Delete Notifications for this chunk
            const { error: notifError } = await supabase
                .from('crm_notifications')
                .delete()
                .in('related_lead_id', chunk);
                
            if (notifError) {
                console.error("Error deleting notifications for chunk:", notifError);
                // Continue to try deleting leads anyway, or throw
            }

            // 2. Delete Leads for this chunk
            const { error: leadError } = await supabase
                .from('crm_leads')
                .delete()
                .in('id', chunk);

            if (leadError) throw leadError;
        }

        // Update local state after loop finishes
        setLeads(prev => prev.filter(l => !ids.includes(l.id)));
        setTotalCount(prev => prev - ids.length);
        return true;

    } catch (err) {
        console.error("Error bulk deleting:", err);
        return false;
    }
  };

  return { 
    leads, 
    totalCount, 
    statusOptions: globalStatuses, 
    agents: globalAgents, 
    loading, // 👈 RESTORED: Don't wait for global data. Show leads ASAP.
    updateLeadStatus, updateLeadAgent, deleteLead,
    bulkUpdateStatus, bulkUpdateAgent, bulkDeleteLeads,
    updateLocalLead, removeLeadFromView 
  };
}