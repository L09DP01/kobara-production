import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { getMaintenanceState } from '@/lib/server/maintenance';
import { isMaintenanceActive } from '@/lib/maintenance-state';
import { requireAdmin } from '@/lib/auth/require-admin';
import { setPlatformMaintenance } from './maintenance-actions';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const supabase = createAdminClient();
  const [merchantResult, paymentResult, settingsResult, providerConfig, maintenance, adminSession] = await Promise.all([
    supabase.from('merchants').select('*', { count: 'exact', head: true }),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('environment', 'live'),
    supabase.from('system_settings').select('key', { count: 'exact', head: true }),
    getPaymentProviderConfig().catch(() => null),
    getMaintenanceState(),
    requireAdmin(),
  ]);
  const maintenanceActive = isMaintenanceActive(maintenance);
  const canManageMaintenance = adminSession.user.role === 'super_admin';
  const maintenanceAction = setPlatformMaintenance.bind(null, !maintenanceActive);
  const turnstileSecretConfigured = Boolean(
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    process.env.TURNSTILE_SECRET
  );

  const checks = [
    { name: 'Base de données', ok: !merchantResult.error && !paymentResult.error, detail: `${merchantResult.count || 0} marchands · ${paymentResult.count || 0} paiements` },
    { name: 'Configuration système', ok: !settingsResult.error, detail: settingsResult.error?.message || 'Accessible' },
    { name: 'Fournisseur de paiement', ok: Boolean(providerConfig), detail: providerConfig ? `Routage chargé · SMS ${providerConfig.sms_gateway_enabled ? 'actif' : 'inactif'}` : 'Configuration inaccessible' },
    { name: 'Identifiants fournisseur principal', ok: Boolean(process.env.PAYM_API_URL && process.env.PAYM_CLIENT_ID && process.env.PAYM_CLIENT_SECRET), detail: 'Présence vérifiée, valeurs jamais affichées' },
    { name: 'Identifiants fournisseur secondaire', ok: Boolean(process.env.BAZIK_API_URL && process.env.BAZIK_USER_ID && process.env.BAZIK_SECRET_KEY), detail: 'Présence vérifiée, valeurs jamais affichées' },
    { name: 'E-mail transactionnel', ok: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), detail: process.env.RESEND_API_KEY ? 'Configuré' : 'Configuration manquante' },
    { name: 'Redis et limitation', ok: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), detail: process.env.UPSTASH_REDIS_REST_URL ? 'Configuré' : 'Limitation distribuée inactive' },
    { name: 'Secret des tâches planifiées', ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? 'Configuré' : 'Manquant' },
    { name: 'Vérification humaine Turnstile', ok: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && turnstileSecretConfigured), detail: turnstileSecretConfigured ? 'Clés client et serveur détectées' : 'Secret Turnstile manquant dans Cloudflare' },
  ];

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">SYSTEM HEALTH</h1><p className="text-sm text-slate-500 mt-1">Contrôles réels de configuration et de disponibilité.</p></div>
    <section className={`border rounded p-5 ${maintenanceActive ? 'border-red-500/50 bg-red-950/20' : 'border-amber-500/40 bg-amber-950/10'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${maintenanceActive ? 'text-red-400' : 'text-amber-400'}`} />
            <h2 className="font-bold">CONTRÔLE GLOBAL DES SERVICES</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300">{maintenanceActive ? 'Les interfaces clientes et les API marchandes sont suspendues.' : maintenance.message}</p>
          <p className="mt-2 text-xs text-slate-500">Les webhooks fournisseurs, tâches planifiées et accès System Core restent actifs pour préserver la cohérence financière.</p>
        </div>
        <form action={maintenanceAction}>
          <button type="submit" disabled={!canManageMaintenance} className={`min-w-56 px-5 py-3 text-sm font-bold border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${maintenanceActive ? 'border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500' : 'border-red-500/50 bg-red-600 text-white hover:bg-red-500'}`}>
            {maintenanceActive ? 'RÉACTIVER TOUS LES SERVICES' : 'SUSPENDRE TOUS LES SERVICES'}
          </button>
        </form>
      </div>
      {!canManageMaintenance && <p className="mt-3 text-xs text-slate-500">Action réservée au super administrateur.</p>}
    </section>
    <div className="grid md:grid-cols-2 gap-3">{checks.map(check => <div key={check.name} className={`border rounded p-4 ${check.ok ? 'bg-green-950/10 border-green-900/40' : 'bg-red-950/10 border-red-900/40'}`}><div className="flex items-center gap-2 font-bold text-sm">{check.ok ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <XCircle className="w-4 h-4 text-red-400"/>}{check.name}</div><p className="text-xs text-slate-500 mt-2">{check.detail}</p></div>)}</div>
    <div className="border border-amber-900/40 bg-amber-950/10 rounded p-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-400 shrink-0"/><div><h2 className="text-sm font-bold text-amber-300">Moteur Risque suspendu</h2><p className="text-xs text-slate-400 mt-1">Le module reste retiré de la navigation jusqu’à ce que ses règles, sa planification et ses dossiers de conformité soient réellement opérationnels.</p></div></div>
    <div className="bg-slate-900 border border-slate-800 rounded p-4"><h2 className="text-sm font-bold mb-3">TÂCHES PLANIFIÉES</h2><div className="text-xs text-slate-400 space-y-2"><p>Expiration des paiements : quotidienne à 00:00 UTC</p><p>Cycle des abonnements : quotidien à 08:00 UTC</p><p>Risque automatique : désactivé</p></div></div>
  </div>;
}
