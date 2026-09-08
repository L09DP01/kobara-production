import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, ShieldAlert, Store, Activity, CreditCard, Clock, Zap, RefreshCw, Pencil } from "lucide-react";
import { getMerchantSubscriptionEntitlement, syncSubscriptionLifecycle } from '@/lib/server/plans';
import { requireAdmin } from '@/lib/auth/require-admin';
import { MerchantPayPalToggle } from './MerchantPayPalToggle';
import { setMerchantAccountSuspended } from './actions';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';

export default async function AdminMerchantDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = createAdminClient();

  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', id)
    .single();

  if (!merchant) {
    return (
      <div className="text-center p-12">
        <h1 className="text-2xl font-bold text-slate-300">MERCHANT NOT FOUND</h1>
      </div>
    );
  }

  const { data: merchantSettings } = await supabase
    .from('settings')
    .select('*')
    .eq('merchant_id', id)
    .maybeSingle();

  const merchantPaymentFlags = merchant as typeof merchant & {
    paypal_enabled?: boolean | null;
    has_usd_account?: boolean | null;
  };
  const merchantPayPalFlag = merchantPaymentFlags.paypal_enabled;
  const isPayPalEnabledForMerchant = merchantPayPalFlag == null
    ? merchantSettings?.settings_json?.paypal_enabled === true
    : merchantPayPalFlag === true;
  const merchantUsdAccountFlag = merchantPaymentFlags.has_usd_account;
  const hasUsdAccount = merchantUsdAccountFlag == null
    ? merchantSettings?.settings_json?.has_usd_account === true
    : merchantUsdAccountFlag === true;
  const paymentProviderConfig = await getPaymentProviderConfig();
  const internationalServiceEnabled = paymentProviderConfig.paypal_global_enabled === true;

  // Fetch LIVE payments for this merchant (les tests ne sont jamais affichés dans system-core)
  const { data: allPayments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('merchant_id', id)
    .eq('environment', 'live')
    .order('created_at', { ascending: false });

  if (paymentsError) {
    console.error('Payments query error:', paymentsError);
  }

  const payments = allPayments || [];
  const subscriptionAccess = await getMerchantSubscriptionEntitlement(id);
  const entitlement = subscriptionAccess.entitlement;

  // Calculate totals (Strictement LIVE)
  const succeededLive = payments.filter(p => p.status === 'succeeded');
  const pendingAll = payments.filter(p => p.status === 'pending');
  const failedAll = payments.filter(p => p.status === 'failed');

  const totalNetLive = succeededLive.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
  const totalGrossLive = succeededLive.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPending = pendingAll.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalFees = succeededLive.reduce((sum, p) => sum + Number(p.fee_amount || 0), 0);

  const statusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'expired': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const envBadge = (env: string) => {
    return env === 'test' 
      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
      : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="mb-8 flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link href="/system-core/merchants" className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 break-words text-xl font-bold uppercase tracking-tight sm:gap-3 sm:text-2xl">
            {merchant.business_name || 'UNNAMED_ENTITY'}
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              merchant.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
              'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {merchant.status.toUpperCase()}
            </span>
          </h1>
          <div className="mt-1 break-all font-mono text-xs text-slate-500 sm:text-sm">ID: {merchant.id}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <h2 className="text-sm font-bold text-slate-400 mb-6 flex items-center gap-2">
              <Store className="w-4 h-4" />
              BUSINESS INTELLIGENCE
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500 mb-1">EMAIL CONTACT</div>
                <div className="break-all font-mono text-slate-200">{merchant.email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">PHONE</div>
                <div className="font-mono text-slate-200">{merchant.phone || 'NOT_PROVIDED'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">CATEGORY</div>
                <div className="text-slate-200 uppercase">{merchant.category || 'UNDEFINED'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">ACCOUNT CREATED</div>
                <div className="text-slate-200">{new Date(merchant.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">PLAN</div>
                <div className="text-slate-200 uppercase font-bold">{entitlement.effectivePlan}</div>
                {entitlement.subscriptionPlan && entitlement.subscriptionPlan !== entitlement.effectivePlan && (
                  <div className="mt-1 text-xs text-amber-400">Souscription enregistrée : {entitlement.subscriptionPlan}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">CURRENT MODE</div>
                <div className="font-bold uppercase text-green-400">PRODUCTION</div>
              </div>
            </div>
          </div>

          {/* Financial Metrics */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <h2 className="text-sm font-bold text-slate-400 mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              FINANCIAL METRICS
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Zap className="w-3 h-3" /> NET VOLUME (LIVE)</div>
                <div className="text-xl font-bold text-green-400">{totalNetLive.toLocaleString()} HTG</div>
                <div className="text-xs text-slate-500 mt-1">{succeededLive.length} txns (frais déduits)</div>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><CreditCard className="w-3 h-3" /> GROSS VOLUME</div>
                <div className="text-xl font-bold text-slate-200">{totalGrossLive.toLocaleString()} HTG</div>
                <div className="text-xs text-slate-500 mt-1">{succeededLive.length} paiements réussis</div>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> EN ATTENTE</div>
                <div className="text-xl font-bold text-amber-400">{totalPending.toLocaleString()} HTG</div>
                <div className="text-xs text-slate-500 mt-1">{pendingAll.length} txns</div>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="text-xs text-slate-500 mb-2">FRAIS KOBARA</div>
                <div className="text-xl font-bold text-[#FF4A1C]">{totalFees.toLocaleString()} HTG</div>
                <div className="text-xs text-slate-500 mt-1">{failedAll.length} failed</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/50">
                <div className="text-xs text-slate-500 mb-2">SOLDE DISPONIBLE (LIVE)</div>
                <div className="text-xl font-bold text-green-400">{Number(merchant.available_balance || 0).toLocaleString()} HTG</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <h2 className="text-sm font-bold text-slate-400 mb-6 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              SECURITY PROTOCOLS
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-2">SUBSCRIPTION ENTITLEMENT</div>
                <div className={`px-3 py-2 rounded text-sm font-bold text-center border ${
                  entitlement.isGracePeriod
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : entitlement.canUsePaidFeatures
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {entitlement.isGracePeriod ? 'GRACE PERIOD' : entitlement.canUsePaidFeatures ? 'PAID ACTIVE' : 'FREE / EXPIRED'}
                </div>
                {entitlement.currentPeriodEnd && (
                  <p className="mt-2 text-xs text-slate-500">Fin payée : {new Date(entitlement.currentPeriodEnd).toLocaleString('fr-FR')}</p>
                )}
                {entitlement.gracePeriodEnd && (
                  <p className="mt-1 text-xs text-amber-400">Fin de grâce : {new Date(entitlement.gracePeriodEnd).toLocaleString('fr-FR')}</p>
                )}
              </div>

              <form action={async () => {
                'use server';
                const session = await requireAdmin(['super_admin', 'operations']);
                const result = await syncSubscriptionLifecycle(id);
                const adminClient = createAdminClient();
                await adminClient.from('audit_logs').insert({
                  admin_id: session.user.id,
                  merchant_id: id,
                  action: 'admin.subscription_resynced',
                  metadata: { processed: result.processed },
                });
              }}>
                <button type="submit" className="w-full flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 py-2.5 rounded font-bold transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  RESYNC SUBSCRIPTION
                </button>
              </form>

              <div>
                <div className="text-xs text-slate-500 mb-2">KYC CLEARANCE LEVEL</div>
                <div className={`px-3 py-2 rounded text-sm font-bold text-center border ${
                  merchant.kyc_status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                  merchant.kyc_status === 'in_review' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                  merchant.kyc_status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {merchant.kyc_status?.toUpperCase() || 'NOT_STARTED'}
                </div>
              </div>

              {/* PAYPAL & COMPTE USD OVERRIDE */}
              <div className="pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                  <span>ACCÈS PAYPAL & COMPTE USD</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isPayPalEnabledForMerchant ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {isPayPalEnabledForMerchant ? 'AUTORISÉ' : 'NON AUTORISÉ'}
                  </span>
                </div>
                
                <div className="mb-2 flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-[10px]">
                  <span className="text-slate-500">Compte USD du marchand</span>
                  <span className={hasUsdAccount ? 'font-bold text-emerald-400' : 'font-semibold text-slate-500'}>
                    {hasUsdAccount ? 'CRÉÉ' : 'NON CRÉÉ'}
                  </span>
                </div>
                {!internationalServiceEnabled && (
                  <p className="mb-2 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-300">
                    {isPayPalEnabledForMerchant
                      ? 'Le service international global est arrêté. Ce marchand reste actif grâce à son autorisation individuelle, jusqu’à sa désactivation.'
                      : 'Le service international global est arrêté et ce marchand ne possède pas d’autorisation individuelle.'}
                  </p>
                )}
                <MerchantPayPalToggle
                  merchantId={id}
                  initialEnabled={isPayPalEnabledForMerchant}
                />
                <p className="mt-1.5 text-center text-[10px] text-slate-500">
                  L&apos;autorisation permet au marchand de créer son compte USD puis d&apos;encaisser par carte, portefeuille mobile ou PayPal.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-500 mb-3">SYSTEM KILL SWITCH</div>
                {merchant.status === 'active' ? (
                  <form action={setMerchantAccountSuspended.bind(null, id, true)}>
                    <button type="submit" className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 py-2.5 rounded font-bold transition-colors">
                      <Ban className="w-4 h-4" />
                      SUSPEND ACCOUNT
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2 text-center">Instantly blocks API keys and payment links.</p>
                  </form>
                ) : (
                  <form action={setMerchantAccountSuspended.bind(null, id, false)}>
                    <button type="submit" className="w-full flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600/20 text-green-500 border border-green-600/30 py-2.5 rounded font-bold transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                      RESTORE ACCOUNT
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All Payments Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            LIVE PAYMENTS ({payments.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-green-400">● {succeededLive.length} succeeded</span>
            <span className="text-amber-400">● {pendingAll.length} pending</span>
            <span className="text-red-400">● {failedAll.length} failed</span>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">NO TRANSACTIONS RECORDED</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="text-left py-3 px-3 font-medium">ID</th>
                  <th className="text-left py-3 px-3 font-medium">REFERENCE</th>
                  <th className="text-left py-3 px-3 font-medium">CUSTOMER</th>
                  <th className="text-left py-3 px-3 font-medium">PROVIDER</th>
                  <th className="text-right py-3 px-3 font-medium">AMOUNT</th>
                  <th className="text-right py-3 px-3 font-medium">FEES</th>
                  <th className="text-right py-3 px-3 font-medium">NET</th>
                  <th className="text-center py-3 px-3 font-medium">ENV</th>
                  <th className="text-center py-3 px-3 font-medium">STATUS</th>
                  <th className="text-left py-3 px-3 font-medium">DATE</th>
                  <th className="text-center py-3 px-3 font-medium">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs text-slate-500" title={p.id}>
                      {p.id.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-300">
                      {p.kobara_reference || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-400">
                      {p.customer_id ? p.customer_id.substring(0, 8) + '...' : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs font-bold uppercase text-slate-300">
                        {p.provider || p.payment_method || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      {Number(p.amount || 0).toLocaleString()} HTG
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#FF4A1C] text-xs">
                      {Number(p.fee_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      {Number(p.net_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${envBadge(p.environment)}`}>
                        {p.environment?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor(p.status)}`}>
                        {p.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {p.status === 'pending' ? (
                        <Link
                          href={`/system-core/transactions/${p.id}?edit=1`}
                          aria-label={`Corriger le paiement ${p.kobara_reference || p.id}`}
                          title="Corriger ce paiement en attente"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-amber-500/30 text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
