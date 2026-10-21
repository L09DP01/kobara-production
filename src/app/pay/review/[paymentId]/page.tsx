import { notFound } from 'next/navigation';
import { createAdminClient } from '@/utils/supabase/admin';

export default async function ReviewPaymentSuccess({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const { data: payment } = await createAdminClient().from('payments').select('amount, currency, status, environment, metadata')
    .eq('id', paymentId).eq('environment', 'test').maybeSingle();
  if (!payment || payment.status !== 'succeeded' || payment.metadata?.shopify_review !== true) notFound();
  return <main className="min-h-dvh bg-[#080e19] px-6 py-16 text-white">
    <div className="mx-auto max-w-lg space-y-5">
      <p className="text-sm font-semibold text-amber-300">TEST SHOPIFY</p>
      <h1 className="text-2xl font-bold">Paiement simulé réussi</h1>
      <p className="text-xl">{Number(payment.amount).toLocaleString('fr-FR')} {payment.currency}</p>
      <p className="text-slate-300">Aucun montant débité. Aucun fonds réel crédité. Aucun e-mail envoyé par Kobara.</p>
      <a href="https://dashboard.kobara.app/integrations/shopify" className="inline-block rounded border border-slate-600 px-4 py-3">Retour à Kobara</a>
    </div>
  </main>;
}
