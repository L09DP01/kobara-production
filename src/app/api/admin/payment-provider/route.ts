import { NextRequest, NextResponse } from "next/server";
import { 
  getPaymentProviderConfig, 
  updatePaymentProviderConfig,
} from "@/lib/server/payments/gateway";
import { createAdminClient } from "@/utils/supabase/admin";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const PaymentProviderUpdateSchema = z.object({
  active_provider: z.enum(["bazik", "paym"]).optional(),
  sms_gateway_enabled: z.boolean().optional(),
  paym_moncash_web: z.boolean().optional(),
  paym_moncash_ussd: z.boolean().optional(),
  paym_natcash_web: z.boolean().optional(),
  paym_natcash_ussd: z.literal(false).optional(),
  paypal_global_enabled: z.boolean().optional(),
  paypal_htg_per_usd: z.number().finite().min(1).max(1000).optional(),
  paypal_fee_percent: z.number().finite().min(0).max(25).optional(),
  paypal_fee_fixed_usd: z.number().finite().min(0).max(100).optional(),
}).strict();

export async function GET() {
  try {
    await requireAdmin(['super_admin', 'operations']);

    const config = await getPaymentProviderConfig();
    return NextResponse.json({ config });
  } catch (error: unknown) {
    console.error("Erreur lecture configuration provider:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(['super_admin', 'operations']);

    const parsedBody = PaymentProviderUpdateSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Configuration de paiement invalide", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsedBody.data;
    const adminEmail = session.user.email;

    const currentConfig = await getPaymentProviderConfig();
    const updatedConfig = await updatePaymentProviderConfig(body, adminEmail);

    // Audit log
    try {
      const supabase = createAdminClient();
      await supabase.from('audit_logs').insert({
        admin_id: session.user.id,
        action: 'PAYMENT_PROVIDER_CONFIG_UPDATED',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'system-core',
        metadata: {
          previous: currentConfig,
          updated: updatedConfig,
          changed_by: adminEmail,
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("Échec d'enregistrement de l'audit log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Configuration mise à jour avec succès",
      config: updatedConfig,
    });
  } catch (error: unknown) {
    console.error("Erreur mise à jour configuration provider:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}
