import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
}

export interface Agent {
  id: string;
  real_name: string;
  role: string;
}

export function useLeads(filters: any, currentUserId?: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // --- FETCH DATA (OPTIMIZED: PARALLEL REQUESTS) ---
  const fetchData = async () => {
    setLoading(true);

    try {
        // 1. BUILD QUERIES (Synchronous - No await yet)
        
        // Status Query
        const statusQuery = supabase.from('crm_statuses').select('label, hex_color').eq('is_active', true).order('order_index', { ascending: true });
        
        // Agents Query
        const agentsQuery = supabase.from('crm_users').select('id, real_name, role').in('role', ['conversion', 'retention', 'team_leader']).order('real_name', { ascending: true });

        // Leads Query
        let leadQuery = supabase.from('crm_leads')
            .select('*', { count: 'exact' }) 
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

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

        // 2. EXECUTE ALL REQUESTS IN PARALLEL
        const [
            { data: stData }, 
            { data: agentData }, 
            { data: leadsData, count, error: leadError }
        ] = await Promise.all([
            statusQuery,
            agentsQuery,
            leadQuery
        ]);

        // 3. SET STATE
        if (stData) setStatusOptions(stData);
        if (agentData) setAgents(agentData);
        
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
    
    const leadSub = supabase.channel('table-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_leads' }, (payload) => {
          setLeads(currentLeads => [payload.new as Lead, ...currentLeads]);
          setTotalCount(prev => prev + 1);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(leadSub); };
    
    // Using stringify to prevent infinite loops (Preserved from original)
  }, [JSON.stringify(filters), currentUserId]); 

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
    const { error } = await supabase.from('crm_leads').delete().eq('id', leadId);
    if (error) return false;
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setTotalCount(prev => prev - 1);
    return true;
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
    const { error } = await supabase.from('crm_leads').delete().in('id', ids);
    if (error) return false;
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setTotalCount(prev => prev - ids.length);
    return true;
  };

  return { 
    leads, totalCount, statusOptions, agents, loading, 
    updateLeadStatus, updateLeadAgent, deleteLead,
    bulkUpdateStatus, bulkUpdateAgent, bulkDeleteLeads,
    updateLocalLead, removeLeadFromView 
  };
}