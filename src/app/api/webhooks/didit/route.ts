import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { activateFreePlanAfterKyc } from "@/lib/server/plans";
import { createNotification, notifyAdminKycSubmission } from "@/lib/server/notifications";

// Canonicalisation : floats entiers (1.0 -> 1)
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

// Canonicalisation : tri lexicographique récursif des clés
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

/**
 * Endpoint Webhook Didit KYC / KYB / Transactions
 * Reçoit les notifications en temps réel de Didit.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Lire le corps brut sans le parser au préalable
    const raw = await req.text();
    const sigV2 = req.headers.get("x-signature-v2") || "";
    const sigV1 = req.headers.get("x-signature") || "";
    const sigSimple = req.headers.get("x-signature-simple") || "";
    const tsHeader = req.headers.get("x-timestamp");
    const ts = Number(tsHeader);

    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    // 2. Fraîcheur temporelle : rejeter tout événement de plus de 300s (anti-rejeu)
    if (webhookSecret && (!ts || Math.abs(Date.now() / 1000 - ts) > 300)) {
      console.warn("[Didit Webhook] Timestamp périmé (> 300s) ou manquant:", ts);
      return new NextResponse("Timestamp périmé (stale)", { status: 401 });
    }

    // 3. Parser le JSON après extraction brute
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[Didit Webhook] JSON invalide");
      return new NextResponse("JSON invalide", { status: 400 });
    }

    // 4. Vérification de signature HMAC-SHA256 à temps constant
    if (webhookSecret) {
      let isVerified = false;

      // Priorité 1 : X-Signature-V2 (Canonicalisation)
      if (sigV2) {
        const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
        const expectedV2 = crypto
          .createHmac("sha256", webhookSecret)
          .update(canonical, "utf8")
          .digest("hex");

        if (
          sigV2.length === expectedV2.length &&
          crypto.timingSafeEqual(Buffer.from(expectedV2), Buffer.from(sigV2))
        ) {
          isVerified = true;
        }
      }

      // Priorité 2 (Fallback) : X-Signature (Raw bytes)
      if (!isVerified && sigV1) {
        const expectedV1 = crypto
          .createHmac("sha256", webhookSecret)
          .update(raw, "utf8")
          .digest("hex");

        if (
          sigV1.length === expectedV1.length &&
          crypto.timingSafeEqual(Buffer.from(expectedV1), Buffer.from(sigV1))
        ) {
          isVerified = true;
        }
      }

      // Priorité 3 (Fallback) : X-Signature-Simple
      if (!isVerified && sigSimple) {
        const simplePayload = `${ts}:${parsed.session_id}:${parsed.status}:${parsed.webhook_type}`;
        const expectedSimple = crypto
          .createHmac("sha256", webhookSecret)
          .update(simplePayload, "utf8")
          .digest("hex");

        if (
          sigSimple.length === expectedSimple.length &&
          crypto.timingSafeEqual(Buffer.from(expectedSimple), Buffer.from(sigSimple))
        ) {
          isVerified = true;
        }
      }

      if (!isVerified) {
        console.error("[Didit Webhook] Échec de vérification de signature (bad sig)");
        return new NextResponse("Signature invalide", { status: 401 });
      }
    }

    const {
      event_id,
      webhook_type = "status.updated",
      status: diditStatus,
      vendor_data: merchantId,
      session_id,
      decision,
      resubmit_info,
    } = parsed;

    if (!merchantId) {
      console.warn("[Didit Webhook] Événement ignoré : vendor_data (merchantId) absent");
      return new NextResponse("ok", { status: 200 });
    }

    const supabase = createAdminClient();

    // 5. Idempotence : déduplication stricte sur event_id
    const dedupeKey = event_id || `${session_id}:${diditStatus}:${webhook_type}`;
    const { data: existingEvent } = await supabase
      .from('kyc_events')
      .select('id')
      .eq('event_type', `didit.${dedupeKey}`)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[Didit Webhook] Événement déjà traité (${dedupeKey}), réponse immédiate 200.`);
      return new NextResponse("ok", { status: 200 });
    }

    // Récupérer le marchand concerné
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name, email, phone, kyc_status')
      .eq('id', merchantId)
      .maybeSingle();

    if (!merchant) {
      console.warn(`[Didit Webhook] Marchand introuvable pour ID ${merchantId}`);
      return new NextResponse("ok", { status: 200 });
    }

    // Extraire les alertes / warnings des tableaux pluriels de décision V3
    const warnings: string[] = [];
    if (decision) {
      decision.id_verifications?.forEach((v: any) => v.warnings && warnings.push(...v.warnings));
      decision.face_matches?.forEach((v: any) => v.warnings && warnings.push(...v.warnings));
      decision.liveness_checks?.forEach((v: any) => v.warnings && warnings.push(...v.warnings));
      decision.aml_screenings?.forEach((v: any) => v.warnings && warnings.push(...v.warnings));
    }
    if (resubmit_info?.reasons) {
      Object.values(resubmit_info.reasons).forEach((r: any) => warnings.push(String(r)));
    }

    // 6. Analyse Antifraude KYC Didit Centralisée (1 identité = 1 compte)
    const { KycFraudEngine } = await import('@/lib/server/kyc/fraud-engine');
    const fraudAnalysis = await KycFraudEngine.analyzeDecision({
      merchantId,
      sessionId: session_id,
      decision,
    });

    if (fraudAnalysis.isFraud && fraudAnalysis.severity === 'critical') {
      console.warn(`[Didit Webhook] FRAUDE CRITIQUE D'IDENTITÉ détectée pour ${merchantId}. Deux comptes suspendus.`);
      
      // Notification neutre de sécurité au client A (sans révéler l'identité de l'autre compte)
      await createNotification(
        merchantId,
        'security_alert',
        'Vérification de sécurité requise',
        'Votre compte a été temporairement suspendu pour vérification de sécurité. Notre équipe de conformité examine votre dossier.',
        merchant.email
      );

      // Si un compte B est lié, notifier également le compte B
      if (fraudAnalysis.relatedMerchantId && fraudAnalysis.relatedMerchantId !== merchantId) {
        const { data: relatedMerchant } = await supabase
          .from('merchants')
          .select('email')
          .eq('id', fraudAnalysis.relatedMerchantId)
          .maybeSingle();

        if (relatedMerchant?.email) {
          await createNotification(
            fraudAnalysis.relatedMerchantId,
            'security_alert',
            'Vérification de sécurité requise',
            'Votre compte a été temporairement suspendu pour vérification de sécurité. Notre équipe de conformité examine votre dossier.',
            relatedMerchant.email
          );
        }
      }

      // Enregistrer l'événement webhook pour l'idempotence
      await supabase.from('kyc_events').insert({
        merchant_id: merchantId,
        kyc_profile_id: null,
        event_type: `didit.${dedupeKey}`,
        payload: {
          session_id,
          fraud_case_id: fraudAnalysis.fraudCaseId,
          severity: fraudAnalysis.severity,
          signals: fraudAnalysis.signals,
        },
      });

      return new NextResponse("ok", { status: 200 });
    }

    // 7. Application de la décision selon les statuts de session Didit
    switch (diditStatus) {
      case "Approved": {
        // Validation KYC complète : Restauration de l'accès opérationnel (active)
        await supabase
          .from('merchants')
          .update({
            account_access: 'active',
            kyc_status: 'approved',
            kyc_verified_at: new Date().toISOString(),
            current_environment: 'live',
          })
          .eq('id', merchantId);

        await supabase
          .from('kyc_profiles')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            gemini_review: { didit_session_id: session_id, decision, warnings },
          })
          .eq('merchant_id', merchantId);

        // Activer le plan gratuit si applicable
        try {
          await activateFreePlanAfterKyc(merchantId);
        } catch (planErr) {
          console.error("[Didit Webhook] Erreur activation plan gratuit:", planErr);
        }

        // Notification Marchand
        await createNotification(
          merchantId,
          'kyc_success',
          'Vérification d\'identité validée',
          'Votre compte a été vérifié avec succès. Vos retraits et paiements réels sont activés.',
          merchant.email
        );

        // Notification Admin
        await notifyAdminKycSubmission({
          merchantId,
          businessName: merchant.business_name || merchant.email,
          merchantEmail: merchant.email,
          merchantPhone: merchant.phone,
          status: 'approved',
          score: 100,
          reasons: ["Vérification biométrique et documentaire validée avec succès par Didit."],
        });
        break;
      }

      case "In Review":
      case "Declined":
      case "Resubmitted": {
        // Conformément à la règle Kobara : ne jamais bloquer en rejected, basculer en revue manuelle
        await supabase
          .from('merchants')
          .update({ kyc_status: 'in_review' })
          .eq('id', merchantId);

        await supabase
          .from('kyc_profiles')
          .update({
            status: 'in_review',
            gemini_review: { didit_session_id: session_id, decision, warnings, diditStatus },
            rejection_reason: warnings.length > 0
              ? warnings.join(' | ')
              : `Revue manuelle requise suite au retour Didit (${diditStatus})`,
          })
          .eq('merchant_id', merchantId);

        // Notification Marchand
        await createNotification(
          merchantId,
          'kyc_review',
          'Vérification en cours d\'examen',
          'Votre dossier d\'identité a été transmis et est en cours d\'examen par notre équipe de conformité.',
          merchant.email
        );

        // Notification Admin avec motifs d'attention
        await notifyAdminKycSubmission({
          merchantId,
          businessName: merchant.business_name || merchant.email,
          merchantEmail: merchant.email,
          merchantPhone: merchant.phone,
          status: 'in_review',
          score: 50,
          reasons: warnings.length > 0
            ? warnings
            : [`Didit a retourné le statut : ${diditStatus}. Examen manuel de conformité requis.`],
        });
        break;
      }

      case "In Progress":
      case "Awaiting User": {
        await supabase
          .from('merchants')
          .update({ kyc_status: 'pending' })
          .eq('id', merchantId);
        break;
      }

      case "Abandoned":
      case "Expired":
      case "KYC Expired":
      case "Kyc Expired": {
        await supabase
          .from('merchants')
          .update({ kyc_status: 'not_started' })
          .eq('id', merchantId);
        break;
      }

      default:
        break;
    }

    // 7. Enregistrer l'événement dans le journal d'audit kyc_events
    await supabase.from('kyc_events').insert({
      merchant_id: merchantId,
      event_type: `didit.${dedupeKey}`,
      payload: {
        event_id,
        webhook_type,
        status: diditStatus,
        session_id,
        decision,
        warnings,
        received_at: new Date().toISOString(),
      },
    });

    // 8. Retourner 200 OK immédiatement (< 5s)
    return new NextResponse("ok", { status: 200 });
  } catch (error: any) {
    console.error("[Didit Webhook] Erreur lors du traitement:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
