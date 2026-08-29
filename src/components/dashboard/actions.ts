'use server';

import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';

export async function markNotificationAsReadAction(id: string) {
  const { merchant } = await getCurrentUserAndMerchant();
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('merchant_id', merchant.id);
  if (error) {
    console.error("Failed to mark notification as read:", error);
    return { error: error.message };
  }
  return { success: true };
}

export async function markAllNotificationsAsReadAction(merchantId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('merchant_id', merchantId).is('read_at', null);
  if (error) {
    console.error("Failed to mark all notifications as read:", error);
    return { error: error.message };
  }
  return { success: true };
}
