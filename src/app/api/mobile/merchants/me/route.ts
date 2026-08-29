import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  BUSINESS_NAME_TAKEN_MESSAGE,
  getBusinessNameValidationError,
  isBusinessNameConflict,
  normalizeBusinessName,
} from "@/lib/business-name";
import { PayPalService } from "@/lib/server/payments/paypal";

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", payload.sub)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    const safeMerchant = {
      ...merchant,
      available_balance_usd: usdAccount.isActive ? merchant.available_balance_usd : null,
      available_balance_usd_test: usdAccount.isActive ? merchant.available_balance_usd_test : null,
      usd_account: {
        created: usdAccount.hasAccount,
        active: usdAccount.isActive,
        status: usdAccount.status,
      },
    };

    return NextResponse.json({ success: true, data: safeMerchant });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const body = await req.json();
    const { business_name, email, phone, address } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (business_name !== undefined) {
      const normalizedName = normalizeBusinessName(business_name);
      const validationError = getBusinessNameValidationError(normalizedName);
      if (validationError) {
        return NextResponse.json(
          { error: validationError, code: "INVALID_BUSINESS_NAME" },
          { status: 400 }
        );
      }
      updates.business_name = normalizedName;
    }

    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .update(updates)
      .eq("user_id", payload.sub)
      .select()
      .single();

    if (merchantError) {
      console.error("[Merchant Update Error]:", merchantError);
      if (isBusinessNameConflict(merchantError)) {
        return NextResponse.json(
          { error: BUSINESS_NAME_TAKEN_MESSAGE, code: "BUSINESS_NAME_TAKEN" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Impossible de mettre à jour le profil." }, { status: 400 });
    }

    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    const safeMerchant = {
      ...merchant,
      available_balance_usd: usdAccount.isActive ? merchant.available_balance_usd : null,
      available_balance_usd_test: usdAccount.isActive ? merchant.available_balance_usd_test : null,
      usd_account: {
        created: usdAccount.hasAccount,
        active: usdAccount.isActive,
        status: usdAccount.status,
      },
    };

    return NextResponse.json({ success: true, data: safeMerchant });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
