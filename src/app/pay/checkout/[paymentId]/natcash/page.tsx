import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { NatCashWaitingClient } from "@/app/pay/[paymentLinkId]/natcash/NatCashWaitingClient";

export default async function ApiNatCashWaitingPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const resolvedParams = await params;
  
  if (!resolvedParams.paymentId) {
    notFound();
  }

  const supabaseAdmin = createAdminClient();

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, merchants(business_name, phone)')
    .eq('id', resolvedParams.paymentId)
    .single();

  if (!payment) {
    notFound();
  }

  const successUrl = payment.success_url || `/`; // API payments can have a success_url to redirect to

  if (payment.status === 'succeeded') {
    if (payment.success_url) {
       redirect(payment.success_url);
    }
    // If no success url provided by dev, just show a success UI or redirect home
    redirect('/?status=success');
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
        successUrl={successUrl}
        expiresAt={payment.expires_at}
      />
    </div>
  );
}
