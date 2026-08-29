import { createAdminClient } from "@/utils/supabase/admin";
import { headers } from "next/headers";

export async function logAdminAudit(action: string, metadata: Record<string, unknown> = {}, adminId?: string) {
  try {
    const supabase = createAdminClient();
    const headersList = await headers();
    
    // Attempt to get IP address
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
    const userAgent = headersList.get('user-agent') || 'Unknown';

    await supabase.from('audit_logs').insert({
      admin_id: adminId || null,
      action,
      ip_address: ip.split(',')[0].trim(),
      user_agent: userAgent,
      metadata
    });
  } catch (error) {
    console.error("Failed to write admin audit log:", error);
  }
}
