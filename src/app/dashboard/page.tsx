export const dynamic = "force-dynamic";

import type { LucideIcon } from "lucide-react";
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, Code2,
  CreditCard, Plus, ShieldCheck, TrendingUp, WalletCards, Webhook, XCircle,
} from "lucide-react";
import Link from "next/link";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { PayPalService } from "@/lib/server/payments/paypal";
import UsdAccountSection from "@/components/dashboard/UsdAccountSection";
import DashboardChartWrapper from "./analytics/DashboardChartWrapper";

interface DashboardPayment {
  id: string;
  amount: number | string;
  net_amount?: number | string | null;
  currency?: string | null;
  status: string;
  payment_method?: string | null;
  created_at: string;
  customers?: { name?: string | null; email?: string | null } | null;
}

interface RevenuePayment {
  amount: number | string;
  net_amount?: number | string | null;
  created_at: string;
}

interface DashboardStats {
  recentPayments: DashboardPayment[] | null;
  succeededPayments: RevenuePayment[] | null;
  totalEncaisse: number;
  successRate: number;
  monthlyRevenue: number;
  webhooksTotal: number;
  webhooksSuccess: number;
  webhooksFailed: number;
  apiTotal: number;
  apiErrors: number;
  apiSuccessRate: string;
}

const panelClass = "rounded-lg border border-[#27364B] bg-[#111C2C] shadow-[0_12px_32px_rgba(0,0,0,0.12)]";

function MetricCard({ icon: Icon, label, value, currency, caption, tone = "blue" }: { icon: LucideIcon; label: string; value: string; currency?: string; caption: string; tone?: "blue" | "orange" | "green" }) {
  const toneClass = {
    blue: "bg-blue-500/12 text-blue-400",
    orange: "bg-orange-500/12 text-orange-400",
    green: "bg-emerald-500/12 text-emerald-400",
  }[tone];

  return (
    <article className={`${panelClass} flex min-h-40 flex-col justify-between p-5 transition-colors duration-150 hover:border-[#34465F]`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-[28px] font-bold leading-none text-white">
        {value} {currency && <span className="text-xs font-semibold text-slate-500">{currency}</span>}
      </p>
      <p className="mt-4 text-xs font-medium text-slate-500">{caption}</p>
    </article>
  );
}

function TechnicalCard({ title, icon: Icon, metrics }: { title: string; icon: LucideIcon; metrics: Array<{ label: string; value: string | number; tone?: string }> }) {
  return (
    <article className={`${panelClass} p-5`}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">Activité d&apos;aujourd&apos;hui</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400"><Icon className="h-[18px] w-[18px]" /></span>
      </header>
      <dl className="grid grid-cols-3 divide-x divide-[#27364B]">
        {metrics.map((metric) => (
          <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
            <dt className="text-[10px] font-bold uppercase text-slate-500">{metric.label}</dt>
            <dd className={`mt-2 text-xl font-bold ${metric.tone || "text-white"}`}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default async function DashboardPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);

  const usdMerchant = merchant as typeof merchant & {
    has_usd_account?: boolean;
    available_balance_usd?: number | string | null;
    available_balance_usd_test?: number | string | null;
  };
  const environment = merchant.current_environment || "test";
  const availableBalanceUsd = Number(
    environment === "test"
      ? usdMerchant.available_balance_usd_test || 0
      : usdMerchant.available_balance_usd || 0,
  );

  const { data: recentPayments } = await supabase
    .from("payments")
    .select("*, customers(name, email)")
    .eq("merchant_id", merchant.id)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: succeededPayments } = await supabase
    .from("payments")
    .select("amount, net_amount, created_at")
    .eq("merchant_id", merchant.id)
    .eq("environment", environment)
    .in("status", ["succeeded", "completed"]);

  const totalEncaisse = succeededPayments?.reduce((sum, payment) => sum + Number(payment.net_amount || payment.amount), 0) || 0;
  const { count: totalCount } = await supabase.from("payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("environment", environment);
  const { count: successCount } = await supabase.from("payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("environment", environment).in("status", ["succeeded", "completed"]);
  const successRate = totalCount ? ((successCount || 0) / totalCount) * 100 : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = succeededPayments?.filter((payment) => new Date(payment.created_at) >= monthStart).reduce((sum, payment) => sum + Number(payment.net_amount || payment.amount), 0) || 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: webhookEvents } = await supabase.from("webhook_events").select("delivery_status").eq("merchant_id", merchant.id).eq("environment", environment).gte("created_at", todayStart.toISOString());
  const webhooksTotal = webhookEvents?.length || 0;
  const webhooksSuccess = webhookEvents?.filter((event) => event.delivery_status === "success" || event.delivery_status === "delivered").length || 0;
  const webhooksFailed = webhooksTotal - webhooksSuccess;

  const { data: apiLogs } = await supabase.from("audit_logs").select("metadata").eq("merchant_id", merchant.id).gte("created_at", todayStart.toISOString());
  const apiTotal = apiLogs?.length || 0;
  const apiSuccess = apiLogs?.filter((log) => !log.metadata?.error).length || 0;
  const apiErrors = apiTotal - apiSuccess;
  const apiSuccessRate = apiTotal > 0 ? ((apiSuccess / apiTotal) * 100).toFixed(1) : "0";

  const stats: DashboardStats = { recentPayments, succeededPayments, totalEncaisse, successRate, monthlyRevenue, webhooksTotal, webhooksSuccess, webhooksFailed, apiTotal, apiErrors, apiSuccessRate };
  const soldeDisponible = environment === "test" ? Number(merchant.available_balance_test || 0) : Number(merchant.available_balance || 0);
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long" });

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className={`h-2 w-2 rounded-full ${environment === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
            Environnement {environment === "live" ? "Live" : "Test"}
          </div>
          <h1 className="truncate text-2xl font-bold text-white sm:text-[28px]">{merchant.business_name}</h1>
          <p className="mt-1 text-sm text-slate-400">Pilotez vos encaissements et surveillez la santé de votre intégration.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="hidden h-10 items-center gap-2 rounded-lg border border-[#27364B] bg-[#111C2C] px-3 text-xs font-semibold text-slate-300 md:flex">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            {now.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <Link href="/dashboard/payment-links/create" className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-orange-600 sm:flex-none">
            <Plus className="h-4 w-4" />Créer un lien
          </Link>
        </div>
      </section>

      <section aria-labelledby="financial-overview">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="financial-overview" className="text-sm font-bold text-white">Vue financière</h2>
          <span className="text-xs text-slate-500">Montants nets</span>
        </div>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${usdAccount.status !== "hidden" ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
          <MetricCard icon={CreditCard} label="Total encaissé" value={stats.totalEncaisse.toLocaleString("fr-FR")} currency="HTG" caption="Cumul des paiements validés" />
          <MetricCard icon={WalletCards} label="Solde disponible" value={soldeDisponible.toLocaleString("fr-FR")} currency="HTG" caption="Disponible pour retrait" tone="orange" />
          <UsdAccountSection isEligible={usdAccount.isEnabled} hasUsdAccount={usdAccount.hasAccount} availableBalanceUsd={usdAccount.isActive ? availableBalanceUsd : 0} />
        </div>
      </section>

      <section aria-label="Indicateurs de performance" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className={`${panelClass} flex min-h-28 items-center justify-between gap-5 p-5`}>
          <div>
            <p className="text-sm font-semibold text-slate-400">Taux de succès</p>
            <p className="mt-2 text-2xl font-bold text-white">{stats.successRate.toFixed(1)}<span className="text-sm text-slate-500">%</span></p>
            <p className="mt-1 text-xs text-slate-500">{successCount || 0} paiements validés sur {totalCount || 0}</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400"><ShieldCheck className="h-5 w-5" /></span>
        </article>
        <article className={`${panelClass} flex min-h-28 items-center justify-between gap-5 p-5`}>
          <div>
            <p className="text-sm font-semibold text-slate-400">Revenu du mois</p>
            <p className="mt-2 text-2xl font-bold text-white">{stats.monthlyRevenue.toLocaleString("fr-FR")} <span className="text-xs text-slate-500">HTG</span></p>
            <p className="mt-1 text-xs capitalize text-slate-500">Depuis le 1er {monthLabel}</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400"><TrendingUp className="h-5 w-5" /></span>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,0.75fr)]">
        <div className="min-w-0"><DashboardChartWrapper payments={stats.succeededPayments || []} /></div>
        <article className={`${panelClass} min-w-0 p-5`}>
          <header className="mb-4 flex items-center justify-between">
            <div><h2 className="text-base font-bold text-white">Derniers paiements</h2><p className="mt-1 text-xs text-slate-500">Les 5 plus récents</p></div>
            <Link href="/dashboard/payments" className="flex min-h-10 items-center gap-1 px-2 text-xs font-bold text-orange-400 transition-colors duration-150 hover:text-orange-300">Voir tout <ArrowRight className="h-4 w-4" /></Link>
          </header>
          <div className="divide-y divide-[#27364B]">
            {stats.recentPayments && stats.recentPayments.length > 0 ? stats.recentPayments.map((payment) => {
              const succeeded = ["succeeded", "completed"].includes(payment.status);
              const pending = payment.status === "pending";
              const StatusIcon = succeeded ? CheckCircle2 : pending ? Clock3 : XCircle;
              const statusLabel = succeeded ? "Réussi" : pending ? "En attente" : "Échoué";
              const statusColor = succeeded ? "text-emerald-400" : pending ? "text-amber-400" : "text-red-400";
              return (
                <div key={payment.id} className="flex min-h-[72px] items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusIcon className={`h-5 w-5 shrink-0 ${statusColor}`} />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{payment.customers?.name || payment.payment_method?.toUpperCase() || "Paiement"}</p><p className="mt-1 text-xs text-slate-500">{new Date(payment.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · {new Date(payment.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p></div>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-sm font-bold text-white">{Number(payment.amount).toLocaleString("fr-FR")} {payment.currency || "HTG"}</p><p className={`mt-1 text-[10px] font-bold uppercase ${statusColor}`}>{statusLabel}</p></div>
                </div>
              );
            }) : <div className="flex min-h-48 flex-col items-center justify-center text-center"><Activity className="h-7 w-7 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-400">Aucun paiement récent</p><p className="mt-1 text-xs text-slate-600">Les nouvelles transactions apparaîtront ici.</p></div>}
          </div>
        </article>
      </section>

      <section aria-labelledby="technical-health">
        <div className="mb-3"><h2 id="technical-health" className="text-sm font-bold text-white">Santé technique</h2><p className="mt-1 text-xs text-slate-500">État des intégrations sur les dernières 24 heures</p></div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TechnicalCard title="Activité API" icon={Code2} metrics={[{ label: "Requêtes", value: stats.apiTotal }, { label: "Succès", value: `${stats.apiSuccessRate}%`, tone: "text-emerald-400" }, { label: "Erreurs", value: stats.apiErrors, tone: stats.apiErrors > 0 ? "text-red-400" : "text-white" }]} />
          <TechnicalCard title="Webhooks" icon={Webhook} metrics={[{ label: "Événements", value: stats.webhooksTotal }, { label: "Livrés", value: stats.webhooksSuccess, tone: "text-emerald-400" }, { label: "Échoués", value: stats.webhooksFailed, tone: stats.webhooksFailed > 0 ? "text-red-400" : "text-white" }]} />
        </div>
      </section>
    </>
  );
}
