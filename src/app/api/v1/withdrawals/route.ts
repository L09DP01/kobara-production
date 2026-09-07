import { NextRequest, NextResponse } from "next/server";
import { getPublicApiCorsHeaders } from "@/lib/http/api-cors";
import { canCreateWithdrawal } from "@/lib/server/access";
import { authenticateApiRequest } from "@/lib/server/auth/api-auth";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import { getClientIp, withdrawalsLimiter } from "@/lib/server/security/rate-limit";
import { WithdrawalCreatePayloadSchema } from "@/lib/server/validators";
import { WithdrawalService } from "@/lib/server/withdrawals/withdrawal.service";
import { normalizeHaitianPhoneNumber } from "@/lib/payment-routing";
import { createAdminClient } from "@/utils/supabase/admin";

type JsonPayload = Record<string, unknown>;

function apiJson(
  request: NextRequest,
  payload: JsonPayload,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...getPublicApiCorsHeaders(request.headers.get("origin")),
      ...extraHeaders,
    },
  });
}

function serializeWithdrawal(withdrawal: Record<string, unknown>, status?: string) {
  return {
    id: String(withdrawal.id || ""),
    reference: String(withdrawal.kobara_reference || ""),
    status: status || String(withdrawal.status || "pending"),
    method: String(withdrawal.provider || "").toLowerCase(),
    amount: Number(withdrawal.total || 0),
    fees: Number(withdrawal.fees || 0),
    net_amount: Number(withdrawal.amount || 0),
    currency: String(withdrawal.currency || "HTG").toUpperCase(),
    payout_amount: Number(withdrawal.payout_amount || withdrawal.amount || 0),
    payout_currency: String(withdrawal.payout_currency || "HTG").toUpperCase(),
    exchange_rate: Number(withdrawal.exchange_rate || 1),
    wallet: String(withdrawal.wallet || ""),
    description: withdrawal.description ? String(withdrawal.description) : null,
    created_at: String(withdrawal.created_at || new Date().toISOString()),
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getPublicApiCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer kbr_sk_")) {
    return apiJson(request, {
      status: "error",
      error: "secret_api_key_required",
      code: "SECRET_API_KEY_REQUIRED",
      message: "Cette opération nécessite une Secret API Key Kobara côté serveur.",
    }, 401);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return apiJson(request, {
      status: "error",
      error: "idempotency_key_required",
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "L'en-tête Idempotency-Key est obligatoire et doit contenir au maximum 255 caractères.",
    }, 400);
  }

  try {
    const { merchantId, error: authError } = await authenticateApiRequest(request);
    if (authError || !merchantId) {
      return apiJson(request, { status: "error", error: "unauthorized", message: authError || "Unauthorized" }, 401);
    }

    const rateLimit = await withdrawalsLimiter.limit(`api-withdrawal:${merchantId}:${getClientIp(request.headers)}`);
    const rateHeaders = {
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
      "X-RateLimit-Reset": String(rateLimit.reset),
    };
    if (!rateLimit.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return apiJson(request, {
        status: "error",
        error: "rate_limit_exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Trop de demandes de retrait. Réessayez plus tard.",
      }, 429, { ...rateHeaders, "Retry-After": String(retryAfter) });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiJson(request, { status: "error", error: "invalid_json", message: "Le corps JSON est invalide." }, 400, rateHeaders);
    }

    const parsed = WithdrawalCreatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return apiJson(request, {
        status: "error",
        error: "validation_error",
        message: "Les données du retrait sont invalides.",
        details: parsed.error.issues,
      }, 400, rateHeaders);
    }

    const { amount, method, account_currency: sourceCurrency, wallet, description } = parsed.data;
    const adminClient = createAdminClient();
    const { data: merchant, error: merchantError } = await adminClient
      .from("merchants")
      .select("id, email, paypal_enabled, has_usd_account")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchantError) throw merchantError;
    if (!merchant) {
      return apiJson(request, { status: "error", error: "merchant_not_found", message: "Compte marchand introuvable." }, 404, rateHeaders);
    }

    let accessAmountHtg = amount;
    if (sourceCurrency === "USD") {
      const providerConfig = await getPaymentProviderConfig();
      accessAmountHtg = amount * Number(providerConfig.paypal_htg_per_usd || 130);
    }

    const access = await canCreateWithdrawal(merchantId, accessAmountHtg);
    if (!access.allowed) {
      const messages: Record<string, string> = {
        kyc_required: "La vérification KYC est requise pour effectuer un retrait.",
        plan_required: "Un plan actif est requis pour effectuer un retrait.",
        subscription_expired: "Votre abonnement a expiré.",
        withdrawal_limit_reached: `Votre limite journalière de retrait est atteinte (${access.used?.toLocaleString('fr-FR')}/${access.limit?.toLocaleString('fr-FR')} HTG).`,
      };
      return apiJson(request, {
        status: "error",
        error: access.reason,
        code: access.reason.toUpperCase(),
        message: messages[access.reason] || "Retrait non autorisé.",
        limit: access.limit,
        used: access.used,
        requested: access.requested,
        remaining: access.remaining,
      }, 403, rateHeaders);
    }

    const result = await WithdrawalService.processWithdrawal({
      merchantId,
      merchantEmail: merchant.email,
      amount,
      method,
      sourceCurrency,
      receiver: wallet,
      idempotencyKey,
      environment: "live",
      description: description || "Retrait Kobara API",
    });

    if (result.withdrawal) {
      const stored = serializeWithdrawal(result.withdrawal, result.status);
      const normalizedWallet = normalizeHaitianPhoneNumber(wallet) || wallet.trim();
      const expectedDescription = description || "Retrait Kobara API";
      const sameRequest = Math.abs(stored.amount - amount) < 0.001
        && stored.method === method
        && stored.currency === sourceCurrency
        && stored.wallet === normalizedWallet
        && stored.description === expectedDescription;
      if (result.idempotent && !sameRequest) {
        return apiJson(request, {
          status: "error",
          error: "idempotency_key_conflict",
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "Cette Idempotency-Key a déjà été utilisée avec une autre demande de retrait.",
        }, 409, { ...rateHeaders, "Idempotency-Key": idempotencyKey });
      }

      if (result.success || result.requiresVerification) {
        return apiJson(request, {
          status: "success",
          data: stored,
          verification_pending: result.requiresVerification || undefined,
        }, result.status === "completed" ? 200 : 202, {
          ...rateHeaders,
          "Idempotency-Key": idempotencyKey,
          ...(result.idempotent ? { "X-Idempotency-Cached": "true" } : {}),
        });
      }
    }

    const errorCode = result.errorCode || "WITHDRAWAL_FAILED";
    const responseStatus = errorCode === "USD_ACCOUNT_INACTIVE"
      ? 403
      : errorCode === "FUNDS_PENDING_RELEASE"
        || errorCode.toLowerCase().includes("insufficient")
        || /solde insuffisant/i.test(result.error || "")
        ? 409
        : errorCode === "PROVIDER_TRANSFER_FAILED"
          ? 502
          : 422;
    return apiJson(request, {
      status: "error",
      error: errorCode.toLowerCase(),
      code: errorCode,
      message: result.error || "Le retrait n'a pas pu être exécuté.",
      refunded: result.refunded || false,
    }, responseStatus, { ...rateHeaders, "Idempotency-Key": idempotencyKey });
  } catch (error) {
    console.error("[Public Withdrawal API] Error:", error);
    return apiJson(request, {
      status: "error",
      error: "internal_error",
      code: "INTERNAL_ERROR",
      message: "Le service de retrait est temporairement indisponible.",
    }, 500);
  }
}
