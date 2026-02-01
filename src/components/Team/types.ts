// src/components/Team/types.ts

export interface CRMUser {
  id: string;
  email: string;
  real_name: string;
  role: 'admin' | 'manager' | 'compliance' | 'team_leader' | 'conversion' | 'retention';
  team_leader_id?: string | null;
  allowed_sources?: string; // "Google,Facebook"
  is_synced?: boolean;      // Calculated (true if exists in 'profiles')
  created_at?: string;
  avatar_url?: string;
}