'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { verifyTurnstileToken } from '@/lib/server/security/turnstile';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/server/partners/auth';
import { encryptPartnerDestination, maskDestination } from '@/lib/server/partners/tokens';

export async function submitAmbassadorApplication(formData: FormData) {
  const turnstile = String(formData.get('cf-turnstile-response') || formData.get('turnstile_token') || '');
  const human = await verifyTurnstileToken(turnstile);
  if (!human.success) return { error: human.error || 'Vérification humaine requise.' };
  const required = ['first_name', 'last_name', 'job_title', 'email', 'phone', 'legal_company_name', 'business_type', 'business_address', 'industry', 'experience', 'products_services', 'primary_need'];
  const values = Object.fromEntries(required.map(key => [key, String(formData.get(key) || '').trim()]));
  if (required.some(key => !values[key])) return { error: 'Complétez tous les champs requis.' };
  const email = values.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('partner_applications').insert({
    program_type: 'ambassador', first_name: values.first_name, last_name: values.last_name,
    job_title: values.job_title, email, phone: values.phone,
    legal_company_name: values.legal_company_name, company_name: values.legal_company_name,
    trading_name: String(formData.get('trading_name') || '').trim() || null,
    business_type: values.business_type, business_address: values.business_address,
    website_or_social: String(formData.get('website_or_social') || '').trim() || null,
    industry: values.industry, experience: values.experience, products_services: values.products_services,
    desired_payment_methods: formData.getAll('desired_payment_methods').map(String),
    primary_need: values.primary_need, message: String(formData.get('message') || '').trim() || null,
  });
  if (error) return { error: "La demande n'a pas pu être envoyée." };
  return { success: true };
}

export async function requestAmbassadorWithdrawal(formData: FormData) {
  const { account, supabase } = await requirePartner('ambassador');
  const amount = Number(formData.get('amount'));
  const currency = String(formData.get('currency') || '').toUpperCase();
  const destinationType = String(formData.get('destination_type') || 'bank');
  const destination = String(formData.get('destination') || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !['USD', 'HTG'].includes(currency) || destination.length < 5) return { error: 'Informations de retrait invalides.' };
  const { error } = await supabase.rpc('request_partner_withdrawal', {
    p_beneficiary_type: 'ambassador', p_beneficiary_id: account.id, p_amount: amount, p_currency: currency,
    p_destination_type: destinationType, p_destination_masked: maskDestination(destination),
    p_destination_encrypted: encryptPartnerDestination(destination), p_idempotency_key: `ambassador:${account.id}:${crypto.randomUUID()}`,
  });
  if (error) return { error: error.message.includes('insufficient') ? 'Solde disponible insuffisant.' : 'Impossible de créer ce retrait.' };
  revalidatePath('/ambassador/portal');
  return { success: true };
}
