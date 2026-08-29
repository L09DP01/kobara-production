import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const supabase = createAdminClient();
  const [merchantResult, paymentResult, settingsResult, providerConfig] = await Promise.all([
    supabase.from('merchants').select('*', { count: 'exact', head: true }),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('environment', 'live'),
    supabase.from('system_settings').select('key', { count: 'exact', head: true }),
    getPaymentProviderConfig().catch(() => null),
  ]);

  const checks = [
    { name: 'Base de données', ok: !merchantResult.error && !paymentResult.error, detail: `${merchantResult.count || 0} marchands · ${paymentResult.count || 0} paiements` },
    { name: 'Configuration système', ok: !settingsResult.error, detail: settingsResult.error?.message || 'Accessible' },
    { name: 'Fournisseur de paiement', ok: Boolean(providerConfig), detail: providerConfig ? `Routage chargé · SMS ${providerConfig.sms_gateway_enabled ? 'actif' : 'inactif'}` : 'Configuration inaccessible' },
    { name: 'Identifiants fournisseur principal', ok: Boolean(process.env.PAYM_API_URL && process.env.PAYM_CLIENT_ID && process.env.PAYM_CLIENT_SECRET), detail: 'Présence vérifiée, valeurs jamais affichées' },
    { name: 'Identifiants fournisseur secondaire', ok: Boolean(process.env.BAZIK_API_URL && process.env.BAZIK_USER_ID && process.env.BAZIK_SECRET_KEY), detail: 'Présence vérifiée, valeurs jamais affichées' },
    { name: 'E-mail transactionnel', ok: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), detail: process.env.RESEND_API_KEY ? 'Configuré' : 'Configuration manquante' },
    { name: 'Redis et limitation', ok: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), detail: process.env.UPSTASH_REDIS_REST_URL ? 'Configuré' : 'Limitation distribuée inactive' },
    { name: 'Secret des tâches planifiées', ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? 'Configuré' : 'Manquant' },
  ];

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">SYSTEM HEALTH</h1><p className="text-sm text-slate-500 mt-1">Contrôles réels de configuration et de disponibilité.</p></div>
    <div className="grid md:grid-cols-2 gap-3">{checks.map(check => <div key={check.name} className={`border rounded p-4 ${check.ok ? 'bg-green-950/10 border-green-900/40' : 'bg-red-950/10 border-red-900/40'}`}><div className="flex items-center gap-2 font-bold text-sm">{check.ok ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <XCircle className="w-4 h-4 text-red-400"/>}{check.name}</div><p className="text-xs text-slate-500 mt-2">{check.detail}</p></div>)}</div>
    <div className="border border-amber-900/40 bg-amber-950/10 rounded p-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-400 shrink-0"/><div><h2 className="text-sm font-bold text-amber-300">Moteur Risque suspendu</h2><p className="text-xs text-slate-400 mt-1">Le module reste retiré de la navigation jusqu’à ce que ses règles, sa planification et ses dossiers de conformité soient réellement opérationnels.</p></div></div>
    <div className="bg-slate-900 border border-slate-800 rounded p-4"><h2 className="text-sm font-bold mb-3">TÂCHES PLANIFIÉES</h2><div className="text-xs text-slate-400 space-y-2"><p>Expiration des paiements : quotidienne à 00:00 UTC</p><p>Cycle des abonnements : quotidien à 08:00 UTC</p><p>Risque automatique : désactivé</p></div></div>
  </div>;
}
