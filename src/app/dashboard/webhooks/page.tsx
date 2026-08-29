import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { WebhooksClient } from "./webhooks-client";

export default async function WebhooksPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test')
    .order('created_at', { ascending: false });

  const { data: events } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test')
    .order('created_at', { ascending: false })
    .limit(50); // Fetch latest 50 logs for performance

  return <WebhooksClient endpoints={endpoints || []} events={events || []} />;
}
