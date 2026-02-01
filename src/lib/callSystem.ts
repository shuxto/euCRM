import { supabase } from './supabase';

export interface CallResult {
  success: boolean;
  message?: string;
  callId?: string;
}

export const initiateCall = async (leadId: string, phoneNumber: string): Promise<CallResult> => {
  // 1. Open the Phone Dialer
  window.location.href = `tel:${phoneNumber}`;

  // 2. Log the click in Supabase
  const { data, error } = await supabase.rpc('log_call', { lead_id_input: leadId });

  if (error) {
    console.error("Call Log Error:", error);
    return { success: false, message: error.message };
  }

  return { success: data.success, message: data.message };
};