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

export async function POST(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await authenticateApiRequest(request);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optionnel si query params fournis
    }

    const searchParams = request.nextUrl.searchParams;
    const paymentId = body.payment_id || body.paymentId || body.id || searchParams.get('payment_id') || searchParams.get('id');
    const reference = body.reference || body.kobara_reference || body.reference_code || searchParams.get('reference') || searchParams.get('kobara_reference');
    const targetStatus = body.status === 'failed' ? 'failed' : 'succeeded';

    if (!paymentId && !reference) {
      return NextResponse.json({
        status: "error",
        error: "Paramètres manquants : 'payment_id' ou 'reference' requis dans le corps JSON ou l'URL.",
        example: { payment_id: "pay_123456", status: "succeeded" }
      }, { status: 400 });
    }

    const result = await handleSimulateTestPayment({
      paymentId,
      reference,
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
    console.error("API Simulate Payment Error:", error);
    return NextResponse.json({ status: "error", error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { merchantId } = await authenticateApiRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('payment_id') || searchParams.get('id');
    const reference = searchParams.get('reference') || searchParams.get('kobara_reference');
    const targetStatus = searchParams.get('status') === 'failed' ? 'failed' : 'succeeded';

    if (!paymentId && !reference) {
      return NextResponse.json({
        status: "error",
        error: "Paramètres manquants : 'payment_id' ou 'reference' requis en paramètre de requête GET.",
      }, { status: 400 });
    }

    const result = await handleSimulateTestPayment({
      paymentId,
      reference,
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
    console.error("API GET Simulate Payment Error:", error);
    return NextResponse.json({ status: "error", error: "Internal Server Error" }, { status: 500 });
  }
}
