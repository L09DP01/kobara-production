'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';

export type BusinessRequestState = { success: boolean; message: string };

const requiredFields = ['requester_first_name', 'requester_last_name', 'requester_role', 'professional_email', 'phone', 'legal_business_name', 'trading_name', 'business_type', 'business_address', 'industry', 'business_description', 'products_services'] as const;

export async function submitBusinessRequest(_: BusinessRequestState, formData: FormData): Promise<BusinessRequestState> {
  try {
    const { merchant, userRole } = await getCurrentUserAndMerchant();
    if (userRole !== 'owner') return { success: false, message: 'Seul le propriétaire peut envoyer cette demande.' };
    if (merchant.kyc_status !== 'approved') return { success: false, message: 'Votre vérification KYC doit être approuvée avant une demande Business.' };

    const payload: Record<string, any> = { merchant_id: merchant.id };
    for (const field of requiredFields) {
      const value = String(formData.get(field) || '').trim();
      if (value.length < 2) return { success: false, message: 'Veuillez remplir tous les champs obligatoires.' };
      payload[field] = value;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.professional_email)) return { success: false, message: 'L’e-mail professionnel est invalide.' };
    payload.website_or_social = String(formData.get('website_or_social') || '').trim() || null;
    payload.additional_message = String(formData.get('additional_message') || '').trim() || null;
    payload.desired_payment_methods = formData.getAll('desired_payment_methods').map(String);
    payload.primary_needs = formData.getAll('primary_needs').map(String);
    if (!payload.desired_payment_methods.length || !payload.primary_needs.length) return { success: false, message: 'Choisissez au moins un moyen de paiement et un besoin principal.' };

    const admin = createAdminClient();
    const { data: existing } = await admin.from('business_plan_requests').select('status').eq('merchant_id', merchant.id).maybeSingle();
    if (existing?.status === 'plan_activated') return { success: false, message: 'Le plan Business est déjà actif.' };
    payload.status = existing && !['rejected', 'new_request'].includes(existing.status) ? existing.status : 'new_request';
    const { error } = await admin.from('business_plan_requests').upsert(payload, { onConflict: 'merchant_id' });
    if (error) throw error;
    await admin.from('audit_logs').insert({ merchant_id: merchant.id, action: 'business_plan.requested', entity_type: 'business_plan_requests' });
    revalidatePath('/dashboard/billing');
    revalidatePath('/dashboard/billing/business');
    revalidatePath('/system-core/business-requests');
    return { success: true, message: 'Votre demande a été envoyée. L’équipe Kobara vous contactera pour démarrer le KYB.' };
  } catch (error) {
    console.error('Business plan request failed:', error);
    return { success: false, message: 'Impossible d’envoyer la demande pour le moment.' };
  }
}
