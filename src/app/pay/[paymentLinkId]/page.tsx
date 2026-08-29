import { createAdminClient } from "@/utils/supabase/admin";
import { notFound } from "next/navigation";
import { processPayment } from "./actions";
import { getMerchantCurrentPlan } from "@/lib/server/plans";
import PaymentFormClient from "@/components/payments/PaymentFormClient";
import { ShieldCheck, Zap, HeadphonesIcon, Lock } from "lucide-react";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import { PayPalService } from "@/lib/server/payments/paypal";

export default async function PublicPaymentPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ paymentLinkId: string }>, 
  searchParams: Promise<{ status?: string, error?: string }> 
}) {
  const supabaseAdmin = createAdminClient();
  
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Search by slug first, then by id
  let link = null;
  
  const { data: linkBySlug } = await supabaseAdmin
    .from('payment_links')
    .select('*, merchants(id, business_name, logo_url, paypal_enabled, has_usd_account)')
    .eq('slug', resolvedParams.paymentLinkId)
    .single();

  if (linkBySlug) {
    link = linkBySlug;
  } else {
    const { data: linkById } = await supabaseAdmin
      .from('payment_links')
      .select('*, merchants(id, business_name, logo_url, paypal_enabled, has_usd_account)')
      .eq('id', resolvedParams.paymentLinkId)
      .single();
    
    if (linkById) {
      link = linkById;
    }
  }

  if (!link) {
    notFound();
  }

  const providerConfig = await getPaymentProviderConfig();
  const { plan } = await getMerchantCurrentPlan(link.merchant_id);
  const transactionFeePercent = plan ? plan.transaction_fee_percent / 100 : 0.04;
  const usdAccount = await PayPalService.getMerchantUsdAccountState(link.merchants || { id: link.merchant_id });
  const allowCardPayment = usdAccount.isActive;

  // Check if link is active
  const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
  if (link.status !== 'active' || isExpired) {
    return (
      <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-lg p-8 text-center shadow-lg ambient-shadow">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h1 className="text-headline-md font-headline-md text-white mb-2">Lien invalide</h1>
          <p className="text-slate-400 font-body-base">
            Ce lien de paiement est expiré ou a été désactivé par le marchand.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedSearchParams.status === 'success') {
    return (
      <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-lg p-8 text-center shadow-lg ambient-shadow">
          <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h1 className="text-headline-md font-headline-md text-white mb-2">Paiement réussi</h1>
          <p className="text-slate-400 font-body-base">
            Merci pour votre paiement. La transaction a été complétée avec succès.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#080E19] font-sans text-white lg:grid lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* Colonne de Gauche : Récapitulatif (Sidebar) */}
      <aside className="w-full border-b border-white/10 bg-[#0F1626] p-4 sm:p-6 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:border-b-0 lg:border-r lg:p-7 2xl:p-8">
        
        {/* En-tête / Logo */}
        <div className="mb-5 flex w-full items-center justify-between lg:mb-8">
          <div className="flex items-center gap-2">
            <img src="/Icone.png" alt="Kobara" className="h-8 w-8 rounded object-contain" />
            <span className="text-lg font-bold text-white">KOBARA</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Lock size={14} className="text-orange-500" /> Sécurisé</div>
        </div>

        {/* Bouton retour (masqué pour le moment selon la consigne, ou on peut l'afficher conditionnellement si un success_url existe) */}
        {link.success_url && (
          <a href={link.success_url} className="mb-5 flex w-fit items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white lg:mb-8">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Retour à la boutique
          </a>
        )}

        <div className="flex-1">
          <h2 className="mb-3 text-xs font-bold uppercase text-slate-400">Récapitulatif</h2>
          
          {/* Carte Produit (Affichée uniquement s'il y a un nom ou une image) */}
          {(link.metadata?.product_name || link.metadata?.product_image || link.title) && (
            <div className="mb-5 flex gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              {link.metadata?.product_image && (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/10">
                  <img src={link.metadata.product_image} alt="Produit" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="font-bold text-white text-base leading-tight mb-1">
                  {link.metadata?.product_name || link.title}
                </h3>
                {link.description && (
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3">
                    {link.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">x1</span>
                  <span className="text-orange-400 font-bold text-sm">
                    {link.amount ? `${Number(link.amount).toLocaleString('fr-FR')} HTG` : 'Variable'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sous-total et Frais */}
          <div className="mb-6 hidden space-y-4 lg:block">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Sous-total</span>
              <span className="font-medium">{link.amount ? `${Number(link.amount).toLocaleString('fr-FR')} HTG` : '---'}</span>
            </div>
            
            {/* Afficher les frais si le marchand les applique au client */}
            {link.metadata?.pass_fees_to_customer && (
              <div className="flex justify-between items-center text-sm group relative">
                <span className="text-slate-400 flex items-center gap-1 cursor-help border-b border-dashed border-slate-600">
                  Frais de transaction
                  <span className="material-symbols-outlined text-[14px]">info</span>
                </span>
                <span className="font-medium text-slate-300">+2.9%</span>
                
                <div className="absolute left-0 bottom-6 w-48 bg-black/90 text-xs text-slate-300 p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Les frais de réseau sont à votre charge sur cette transaction.
                </div>
              </div>
            )}
            
            {/* Si option livraison est activée, on peut afficher une ligne Frais de livraison */}
            {link.metadata?.collect_address && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  Frais de livraison
                  <span className="material-symbols-outlined text-[14px] text-slate-500">info</span>
                </span>
                <span className="font-medium">{link.metadata?.shipping_fee ? `${Number(link.metadata.shipping_fee).toLocaleString('fr-FR')} HTG` : '0 HTG'}</span>
              </div>
            )}
          </div>

          <div className="mb-6 hidden h-px w-full bg-white/5 lg:block" />

          {/* Total */}
          <div className="mb-8 hidden items-end justify-between lg:flex">
            <span className="text-white font-bold text-base">Total à payer</span>
            <div className="text-right">
              <span className="text-orange-500 font-black text-2xl tracking-tight">
                {link.amount ? `${(Number(link.amount) + (link.metadata?.shipping_fee ? Number(link.metadata.shipping_fee) : 0)).toLocaleString('fr-FR')} HTG` : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* Badges de Réassurance */}
        <div className="mt-auto hidden space-y-5 lg:block">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
              <ShieldCheck size={20} className="text-orange-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">Paiement 100% sécurisé</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Vos informations sont protégées et chiffrées de bout en bout.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
              <Zap size={20} className="text-orange-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">Traitement instantané</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Confirmation immédiate selon le moyen de paiement choisi.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
              <HeadphonesIcon size={20} className="text-orange-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">Support 24/7</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Notre équipe est disponible à tout moment pour vous aider.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 hidden text-xs text-slate-500 lg:block">
          © {new Date().getFullYear()} Kobara. Tous droits réservés.
        </div>
      </aside>

      {/* Colonne de Droite : Formulaire (Main Content) */}
      <section className="min-w-0 bg-[#080E19]">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="mb-7 hidden items-end justify-between gap-4 lg:flex">
            <div>
              <h1 className="mb-1 text-3xl font-bold text-white">Paiement sécurisé</h1>
              <p className="text-base text-slate-400">Choisissez votre moyen de paiement.</p>
            </div>
            <div className="flex items-center gap-2 bg-[#0F1626] border border-white/10 px-4 py-2.5 rounded-lg shrink-0">
              <Lock size={14} className="text-orange-500" />
              <div className="text-xs">
                <span className="block font-bold text-white">Paiement sécurisé</span>
                <span className="block text-slate-400 text-[10px]">SSL chiffré 256-bit</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#101827] p-4 sm:p-6 lg:p-8">
            {/* Header Form : Montant (Optionnel, si on veut le rappeler, mais c'est déjà à gauche) */}
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">Montant à payer</h3>
                <div className="text-3xl font-black text-orange-500 lg:text-4xl">
                  {link.amount ? `${(Number(link.amount) + (link.metadata?.shipping_fee ? Number(link.metadata.shipping_fee) : 0)).toLocaleString('fr-FR')} HTG` : 'Variable'}
                </div>
              </div>
              <div className="min-w-0 flex-1 text-right sm:max-w-[220px]">
                <div className="font-bold text-white truncate">{link.merchants?.business_name}</div>
                <div className="text-xs text-slate-400 truncate">Paiement marchand</div>
              </div>
            </div>

            {/* Client Component for Interactive Form */}
            <PaymentFormClient 
              link={link} 
              processPaymentAction={processPayment} 
              initialError={resolvedSearchParams.error}
              providerConfig={providerConfig}
              transactionFeePercent={transactionFeePercent}
              allowCardPayment={allowCardPayment}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
