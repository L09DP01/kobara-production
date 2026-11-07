import { AlertCircle, Landmark, WalletCards } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { PaymService } from '@/lib/server/paym/paym.service';
import { ProviderBalanceError, type ProviderBalance } from '@/lib/server/paym/paym-balance';
import { RefreshBalance } from './refresh-balance';

export const dynamic = 'force-dynamic';

const errors = {
  authentication: "L'API de solde refuse le jeton marchand après renouvellement (401). Contactez le fournisseur pour vérifier l'accès à cet endpoint.",
  not_found: "Aucun compte prépayé n'a été trouvé chez le fournisseur.",
  unavailable: "Le solde fournisseur est indisponible. Réessayez dans quelques instants.",
  invalid_response: "La réponse du fournisseur ne contient pas un solde valide. Aucun montant ne peut être affiché.",
};

export default async function TreasuryPage() {
  await requireAdmin(['super_admin', 'operations']);
  let balance: ProviderBalance | null = null;
  let error = '';
  try {
    balance = await PaymService.getBalance();
  } catch (cause) {
    error = errors[cause instanceof ProviderBalanceError ? cause.code : 'unavailable'];
  }
  const money = (value: number) => new Intl.NumberFormat('fr-HT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
      <div><h1 className="text-2xl font-bold text-slate-100">TREASURY</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Solde du compte prépayé fournisseur Pay&apos;m.</p></div>
      <RefreshBalance />
    </header>
    {error && <div role="alert" className="flex items-start gap-3 rounded border border-amber-800 bg-amber-950/20 p-4 text-sm leading-6 text-amber-200">
      <AlertCircle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /><p>{error}</p>
    </div>}
    {balance && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="break-words text-lg font-semibold text-slate-100">{balance.company}</h2>
          <p className="mt-1 text-xs text-slate-400">PAY&apos;M · {balance.currency}</p></div>
        <span className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold ${balance.active ? 'border-emerald-800 text-emerald-300' : 'border-amber-800 text-amber-300'}`}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${balance.active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {balance.active ? 'Compte actif' : 'Compte inactif'}
        </span>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {[
          { label: 'Solde total fournisseur', value: balance.total, icon: Landmark },
          { label: 'Disponible au retrait', value: balance.available, icon: WalletCards },
        ].map(({ label, value, icon: Icon }) => <section key={label} className="min-w-0 rounded border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="flex items-center gap-2 text-sm text-slate-300"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-400" />{label}</h3>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold tabular-nums text-slate-100">
            <span className="break-all text-3xl">{money(value)}</span><span className="text-sm text-slate-400">{balance.currency}</span>
          </p>
        </section>)}
      </div>
      <dl className="divide-y divide-slate-800 border-y border-slate-800 text-sm">
        <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-400">Source</dt><dd className="break-all text-slate-200">GET /api/marchand/balance</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-400">Dernière récupération</dt>
          <dd className="text-slate-200"><time dateTime={balance.checkedAt}>{new Intl.DateTimeFormat('fr-HT', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/Port-au-Prince' }).format(new Date(balance.checkedAt))} (Haïti)</time></dd></div>
      </dl>
    </>}
    <p className="max-w-3xl text-sm leading-6 text-slate-400">Ces montants sont déclarés par le fournisseur. Ils ne représentent pas le total des soldes marchands Kobara.</p>
  </div>;
}
