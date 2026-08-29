import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { NatCashWaitingClient } from "./NatCashWaitingClient";

import { headers } from "next/headers";

export default async function NatCashWaitingPage({ params, searchParams }: { params: Promise<{ paymentLinkId: string }>, searchParams: Promise<{ payment_id?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isPaySubdomain = host.startsWith('pay.');
  const basePath = isPaySubdomain ? '' : '/pay';

  if (!resolvedSearchParams.payment_id) {
    redirect(`/pay/${resolvedParams.paymentLinkId}`);
  }

  const supabaseAdmin = createAdminClient();

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, merchants(business_name, phone)')
    .eq('id', resolvedSearchParams.payment_id)
    .single();

  if (!payment) {
    notFound();
  }

  if (payment.status === 'succeeded') {
    redirect(`/pay/${resolvedParams.paymentLinkId}?status=success`);
  }

  // Le numéro NatCash central unique de Kobara
  const natcashPhone = '+509 40 03 5664';

  return (
    <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
      <NatCashWaitingClient 
        paymentId={payment.id} 
        amount={payment.amount} 
        referenceCode={payment.reference_code || ''}
        merchantName={payment.merchants?.business_name || 'Kobara Merchant'}
        merchantPhone={natcashPhone}
        successUrl={`/pay/${resolvedParams.paymentLinkId}?status=success`}
        expiresAt={payment.expires_at}
      />
    </div>
  );
}
