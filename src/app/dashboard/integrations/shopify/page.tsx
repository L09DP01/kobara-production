import { redirect } from 'next/navigation';
import { AlertCircle, ExternalLink, Unplug } from 'lucide-react';
import { ShopifyKobaraLockup } from '@/components/shopify-kobara-lockup';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const errors: Record<string, string> = {
  kyc_required: 'Votre compte doit être vérifié avant de connecter Shopify.',
  invalid_shop: 'Utilisez le domaine permanent de votre boutique en .myshopify.com.',
  callback_failed: "La connexion Shopify n'a pas pu être finalisée. Vérifiez les autorisations et réessayez.",
  disconnect_failed: 'La déconnexion a échoué. Réessayez.',
  owner_required: 'Seul le propriétaire peut gérer Shopify.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  connection_failed: 'Connexion Shopify indisponible. Contactez le support.',
};

export default async function ShopifyIntegrationPage({ searchParams }: {
  searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>;
}) {
  const { merchant, userRole } = await getCurrentUserAndMerchant();
  if (userRole !== 'owner') redirect('/dashboard');
  const params = await searchParams;
  const db = createAdminClient();
  const [installationResult, ordersResult] = await Promise.all([
    db.from('shopify_installations').select('id, shop_domain, shop_name, status, granted_scopes, installed_at')
      .eq('merchant_id', merchant.id).maybeSingle(),
    db.from('shopify_orders').select('id, order_name, currency, total_amount, financial_status, kobara_status, updated_at')
      .eq('merchant_id', merchant.id).order('updated_at', { ascending: false }).limit(20),
  ]);
  const installation = installationResult.data;
  const connected = installation?.status === 'active';
  const storageReady = !installationResult.error && !ordersResult.error;
  const configured = ['SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET', 'SHOPIFY_TOKEN_ENCRYPTION_KEY'].every(key => Boolean(process.env[key]?.trim()));
  const approved = merchant.kyc_status === 'approved';
  const notice = !storageReady ? 'La connexion Shopify nécessite la migration de base de données. Contactez le support.'
    : !configured ? "La connexion Shopify n'est pas encore configurée sur ce serveur."
    : !approved ? errors.kyc_required
    : params.error ? errors[params.error] || errors.connection_failed : null;
  const success = !notice && (params.connected ? 'Votre boutique est connectée à Kobara.' : params.disconnected ? 'La boutique est déconnectée.' : '');
  const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Port-au-Prince' }).format(new Date(value));

  return <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27364B] pb-5">
      <div><ShopifyKobaraLockup /><h1 className="mt-5 text-2xl font-bold text-white">Shopify</h1>
        <p className="mt-2 text-sm text-slate-400">Votre boutique, ses commandes et leurs paiements Kobara.</p></div>
      <span className={`rounded border px-3 py-2 text-xs font-semibold ${connected ? 'border-emerald-700 text-emerald-300' : 'border-slate-600 text-slate-300'}`}>{connected ? 'Connecté' : 'Non connecté'}</span>
    </header>
    {notice && <p role="alert" className="flex items-start gap-2 rounded border border-amber-800 bg-amber-950/20 p-4 text-sm leading-6 text-amber-200"><AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />{notice}</p>}
    {success && <p role="status" className="rounded border border-emerald-800 p-4 text-sm text-emerald-300">{success}</p>}
    <section className="border-b border-[#27364B] pb-6">
      <h2 className="text-lg font-semibold text-white">Boutique</h2>
      {connected ? <div className="mt-4 space-y-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">Nom</dt><dd className="mt-1 break-words text-white">{installation.shop_name || installation.shop_domain}</dd></div>
          <div><dt className="text-slate-400">Domaine</dt><dd className="mt-1 break-all text-white">{installation.shop_domain}</dd></div>
          <div><dt className="text-slate-400">Autorisations accordées</dt><dd className="mt-1 break-words text-white">{installation.granted_scopes?.join(', ') || 'Non renseignées'}</dd></div>
          <div><dt className="text-slate-400">Connexion</dt><dd className="mt-1 text-white">{installation.installed_at ? `${formatDate(installation.installed_at)} (Haïti)` : 'Non renseignée'}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-3">
          <a href={`https://${installation.shop_domain}/admin`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-600 px-4 text-sm font-semibold text-white hover:bg-white/5">Ouvrir Shopify <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
          <form action="/api/integrations/shopify/disconnect" method="post"><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-800 px-4 text-sm font-semibold text-red-300 hover:bg-red-950/30"><Unplug className="h-4 w-4" aria-hidden="true" />Déconnecter</button></form>
        </div>
      </div> : <form action="/api/integrations/shopify/connect" method="get" className="mt-4 max-w-2xl">
        <label htmlFor="shop" className="text-sm font-semibold text-slate-200">Domaine permanent</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="shop" name="shop" required maxLength={255} autoCapitalize="none" spellCheck={false} placeholder="ma-boutique.myshopify.com" className="min-h-12 min-w-0 flex-1 rounded-md border border-slate-600 bg-[#091321] px-4 text-sm text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-orange-500" />
          <button type="submit" disabled={!configured || !storageReady || !approved} className="min-h-12 rounded-md bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">Connecter Shopify</button></div>
        <p className="mt-3 text-xs leading-5 text-slate-400">L&apos;autorisation se fait sur Shopify. Ne partagez jamais votre mot de passe ou vos clés dans une conversation.</p>
      </form>}
    </section>
    <section className="border-b border-[#27364B] pb-6"><h2 className="text-lg font-semibold text-white">Paiement manuel Kobara</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Dans les paramètres de paiement Shopify, ajoutez une méthode manuelle nommée « Kobara ». Les commandes Live impayées en HTG ayant choisi cette méthode recevront un lien sécurisé, valable 24 heures, si l&apos;e-mail du client est renseigné. La commande est marquée payée après confirmation réelle.</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Les commandes Test et les commandes en devises autres que HTG ne déclenchent pas de collecte. Ce connecteur n&apos;est pas une passerelle native dans le checkout Shopify.</p>
    </section>
    <section><h2 className="text-lg font-semibold text-white">Dernières commandes</h2>
      <div className="mt-4 overflow-x-auto rounded-md border border-[#27364B]"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[#111C2C] text-slate-300"><tr><th className="px-4 py-3 font-semibold">Commande</th><th className="px-4 py-3 font-semibold">Montant</th><th className="px-4 py-3 font-semibold">Statut</th><th className="px-4 py-3 font-semibold">Mise à jour</th></tr></thead>
        <tbody className="divide-y divide-[#27364B] text-slate-200">{(ordersResult.data || []).map(order => <tr key={order.id}><td className="px-4 py-4 font-semibold">{order.order_name || 'Commande Shopify'}</td><td className="whitespace-nowrap px-4 py-4 tabular-nums">{Number(order.total_amount).toLocaleString('fr-FR')} {order.currency}</td><td className="px-4 py-4">{order.kobara_status === 'paid' ? 'Payée' : order.kobara_status === 'payment_link_ready' ? 'Lien prêt' : order.financial_status || order.kobara_status}</td><td className="px-4 py-4">{formatDate(order.updated_at)}</td></tr>)}
          {!ordersResult.data?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{storageReady ? 'Aucune commande synchronisée.' : 'Commandes indisponibles.'}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
