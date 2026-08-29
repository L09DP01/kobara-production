import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/server/auth/api-auth';
import { handleSimulateTestPayment } from '@/lib/server/payments/simulate-payment';
import { getPublicApiCorsHeaders } from '@/lib/http/api-cors';

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getPublicApiCorsHeaders(request.headers.get('origin'));
  if (!corsHeaders) {
    return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const paymentId = resolvedParams.id;
    const { merchantId } = await authenticateApiRequest(request);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optionnel
    }

    const targetStatus = body.status === 'failed' ? 'failed' : 'succeeded';

    const result = await handleSimulateTestPayment({
      paymentId,
      merchantId,
      targetStatus,
    });

    if (!result.success) {
      return NextResponse.json({
        status: "error",
        error: result.error
      }, { status: result.statusCode || 400 });
    }

    const payment = result.payment;
    return NextResponse.json({
      status: "success",
      message: "Paiement de test simulé et enregistré avec succès dans la base de données.",
      data: {
        id: payment.id,
        reference: payment.kobara_reference,
        amount: payment.amount,
        net_amount: payment.net_amount,
        fee_amount: payment.fee_amount,
        currency: payment.currency,
        status: payment.status,
        environment: payment.environment,
        paid_at: payment.paid_at,
        metadata: payment.metadata
      }
    });

  } catch (error: any) {
    console.error("API Payment ID Simulate Error:", error);
    return NextResponse.json({ status: "error", error: "Internal Server Error" }, { status: 500 });
  }
}
