export const dynamic = 'force-dynamic';

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { WithdrawalsClient } from "./withdrawals-client";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import { PayPalService } from "@/lib/server/payments/paypal";

export default async function WithdrawalsPage() {
  const { user, merchant, userRole, supabase } = await getCurrentUserAndMerchant();

  if (userRole !== 'owner') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center max-w-md">
          <span className="material-symbols-outlined text-4xl text-red-500 mb-4">lock</span>
          <h2 className="text-xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-slate-400">Seul le propriétaire du compte peut accéder à la gestion des retraits.</p>
        </div>
      </div>
    );
  }

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('environment', 'live')
    .order('created_at', { ascending: false });

  const { data: settings } = await supabase
    .from('settings')
    .select('security_json, settings_json')
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  const security = settings?.security_json || {};
  const generalSettings = settings?.settings_json || {};
  const twoFactorMethod = security.two_factor_method || 'none';
  const savedMoncashNumber = generalSettings.saved_moncash_number || '';
  const providerConfig = await getPaymentProviderConfig();
  const exchangeRate = Number(providerConfig.paypal_htg_per_usd || 130);
  const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
  const safeMerchant = {
    available_balance: merchant.available_balance,
    available_balance_usd: usdAccount.isActive ? merchant.available_balance_usd : 0,
    pending_balance: merchant.pending_balance,
  };

  return <WithdrawalsClient 
    withdrawals={withdrawals || []} 
    merchant={safeMerchant}
    usdAccountActive={usdAccount.isActive}
    twoFactorMethod={twoFactorMethod} 
    userEmail={user.email!}
    savedMoncashNumber={savedMoncashNumber}
    exchangeRate={exchangeRate}
  />;
}
