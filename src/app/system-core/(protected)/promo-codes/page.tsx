import { getPromoCodes } from './actions';
import { createAdminClient } from "@/utils/supabase/admin";
import PromoCodesClient from './PromoCodesClient';

export default async function PromoCodesPage() {
  const supabase = createAdminClient();
  
  const [promoCodes, { data: plans }, { data: merchants }] = await Promise.all([
    getPromoCodes(),
    supabase.from('plans').select('id, name').order('price_htg', { ascending: true }),
    supabase.from('merchants').select('id, business_name, email').order('business_name', { ascending: true })
  ]);

  return <PromoCodesClient promoCodes={promoCodes} plans={plans || []} merchants={merchants || []} />;
}
