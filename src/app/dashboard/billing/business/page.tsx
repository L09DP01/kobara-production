import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';
import { BusinessRequestForm } from './business-request-form';

export default async function BusinessRequestPage() {
  const { user, merchant, userRole } = await getCurrentUserAndMerchant();
  if (userRole !== 'owner') return <p className="text-slate-300">Seul le propriétaire peut envoyer une demande Business.</p>;
  const admin = createAdminClient();
  const [{ data: dbUser }, { data: request }] = await Promise.all([
    admin.from('users').select('first_name, last_name, email').eq('id', user.id).maybeSingle(),
    admin.from('business_plan_requests').select('*').eq('merchant_id', merchant.id).maybeSingle(),
  ]);
  let businessAddress = '';
  if (typeof merchant.address === 'string') {
    try {
      const parsed = JSON.parse(merchant.address);
      businessAddress = [parsed.address, parsed.city, parsed.state, parsed.country].filter(Boolean).join(', ');
    } catch {
      businessAddress = merchant.address;
    }
  }
  return <BusinessRequestForm defaults={{ requester_first_name: dbUser?.first_name, requester_last_name: dbUser?.last_name, professional_email: dbUser?.email || merchant.email, phone: merchant.phone, legal_business_name: merchant.business_name, trading_name: merchant.business_name, business_address: businessAddress }} request={request}/>;
}
