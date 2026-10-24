import 'server-only';

import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAccessibleMerchants, isMerchantId } from '@/lib/server/merchant-context';
import { businessSchema, createOwnedBusiness } from '@/lib/server/create-business';
import { getBusinessNameValidationError } from '@/lib/business-name';
import { TelegramClient } from './telegram-client';
import { maybeActivateAdditionalBusiness } from '@/lib/server/business-activation';
import { businessEnvironmentLabel } from '@/lib/business-status';

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fields = ['business_name', 'category', 'phone', 'address', 'description', 'website'] as const;
const prompts = [
  'Quel est le nom du nouveau business ? /cancel pour annuler.',
  'Quelle est son activité ? Décrivez sa catégorie (commerce, services, éducation…).',
  'Quel est son téléphone professionnel ? Incluez le préfixe du pays.',
  'Quelle est son adresse professionnelle ? (5 caractères minimum)',
  'Quels produits ou services proposez-vous ? (20 caractères minimum)',
  'Quel est son site web ? Envoyez une URL https:// ou « aucun ».',
];

// The original merchant link remains the ownership anchor. Selection never
// reassigns that link to another merchant or changes notification subscriptions.
export async function getTelegramBusinessAccount(chatId: string | number) {
  const db = createAdminClient();
  const { data: link, error } = await db.from('merchant_telegram_accounts').select('*, merchants(*)')
    .eq('telegram_chat_id', String(chatId)).maybeSingle();
  if (error) throw new Error('telegram_business_lookup_failed');
  const anchor = link?.merchants;
  if (!anchor?.user_id) return null;
  const { data: user, error: userError } = await db.from('users').select('id,is_active').eq('id', anchor.user_id).maybeSingle();
  if (userError) throw new Error('telegram_user_lookup_failed');
  if (!user || user.is_active === false) return null;
  const selected = link.session_state?.active_merchant_id;
  if (!selected || selected === anchor.id) return { link, merchant: await maybeActivateAdditionalBusiness(anchor), ownerId: anchor.user_id };
  if (!isMerchantId(selected)) return null;
  const { data: merchant, error: merchantError } = await db.from('merchants').select('*')
    .eq('id', selected).eq('user_id', anchor.user_id).maybeSingle();
  if (merchantError) throw new Error('telegram_business_lookup_failed');
  return merchant ? { link, merchant: await maybeActivateAdditionalBusiness(merchant), ownerId: anchor.user_id } : null;
}

export async function saveTelegramBusinessState(chatId: string | number, state: any, selection?: string, expectedBusinessId?: string) {
  const db = createAdminClient();
  const { data: link, error } = await db.from('merchant_telegram_accounts').select('id,merchant_id,session_state,updated_at')
    .eq('telegram_chat_id', String(chatId)).maybeSingle();
  if (error || !link) throw new Error('telegram_session_lookup_failed');
  if (expectedBusinessId && expectedBusinessId !== (link.session_state?.active_merchant_id || link.merchant_id)) {
    throw new Error('telegram_business_changed');
  }
  const { active_merchant_id: previousSelection, ...conversation } = state;
  if (!selection && previousSelection && previousSelection !== link.session_state?.active_merchant_id) {
    throw new Error('telegram_business_changed');
  }
  const next = { ...conversation, active_merchant_id: selection || link.session_state?.active_merchant_id };
  // Fail rather than overwrite another concurrent command or business switch.
  const previousTime = Date.parse(link.updated_at || '') || 0;
  const updatedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
  let query = db.from('merchant_telegram_accounts').update({ session_state: next, updated_at: updatedAt }).eq('id', link.id);
  query = link.updated_at ? query.eq('updated_at', link.updated_at) : query.is('updated_at', null);
  const result = await query.select('id').maybeSingle();
  if (result.error || !result.data) throw new Error('telegram_session_changed');
}

export class TelegramBusinesses {
  static async show(chatId: string | number) {
    const account = await getTelegramBusinessAccount(chatId);
    if (!account) return { success: true };
    await saveTelegramBusinessState(chatId, {}, undefined, account.merchant.id);
    const businesses = (await getAccessibleMerchants(account.ownerId)).filter(b => b.user_id === account.ownerId && b.role === 'owner');
    const buttons = businesses.map(b => [{
      text: `${b.id === account.merchant.id ? '✓ ' : ''}${String(b.business_name).slice(0, 45)} · ${businessEnvironmentLabel(b)}`,
      callback_data: `business:switch:${b.id}`,
    }]);
    buttons.push([{ text: '+ Ajouter un business', callback_data: 'business:create' }]);
    await TelegramClient.sendMessage(chatId, `<b>Mes business</b>\nBusiness actif : <b>${escape(account.merchant.business_name)}</b>\n\nChoisissez votre business. Les opérations en cours seront annulées.`, {
      parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons },
    });
    return { success: true };
  }

  static async switch(chatId: string | number, merchantId: string) {
    const account = await getTelegramBusinessAccount(chatId);
    if (!account || !isMerchantId(merchantId)) return { success: true };
    const businesses = await getAccessibleMerchants(account.ownerId);
    const target = businesses.find(b => b.id === merchantId && b.user_id === account.ownerId && b.role === 'owner');
    if (!target) {
      await TelegramClient.sendMessage(chatId, 'Ce business n’est pas autorisé pour votre compte Telegram.');
      return { success: true };
    }
    await saveTelegramBusinessState(chatId, {}, target.id, account.merchant.id);
    await TelegramClient.sendMessage(chatId, `Business actif : <b>${escape(target.business_name)}</b>.\nLes opérations précédentes ont été annulées. /business pour changer de business.`, { parse_mode: 'HTML' });
    return { success: true };
  }

  static async startCreate(chatId: string | number) {
    const account = await getTelegramBusinessAccount(chatId);
    if (!account) return { success: true };
    await saveTelegramBusinessState(chatId, {
      step: 'business_form', field: 0, details: { requestId: randomUUID() }, source_merchant_id: account.merchant.id,
    }, undefined, account.merchant.id);
    await TelegramClient.sendMessage(chatId, prompts[0]);
    return { success: true };
  }

  static async step(chatId: string | number, text: string, state: any) {
    const account = await getTelegramBusinessAccount(chatId);
    if (!account || state.source_merchant_id !== account.merchant.id) {
      await TelegramClient.sendMessage(chatId, 'Le business actif a changé. Recommencez avec /business.');
      return { success: true };
    }
    if (state.step === 'business_confirm') {
      if (text.toLowerCase() !== '/confirmer') {
        await TelegramClient.sendMessage(chatId, 'Envoyez /confirmer pour créer ce business ou /cancel pour annuler.');
        return { success: true };
      }
      const result = await createOwnedBusiness(account.ownerId, account.merchant.id, state.details);
      if (result.error || !result.merchantId) {
        await TelegramClient.sendMessage(chatId, result.error || 'La création a échoué.');
        return { success: true };
      }
      await saveTelegramBusinessState(chatId, {}, result.merchantId, account.merchant.id);
      await TelegramClient.sendMessage(chatId, `Business <b>${escape(state.details.business_name)}</b> créé et sélectionné.\nL’identité du propriétaire est conservée. L’activation en Production est automatique si les contrôles KYC et de restriction sont validés.\n/business pour consulter le statut ou changer de business.`, { parse_mode: 'HTML' });
      return { success: true };
    }
    const index = state.field;
    if (!Number.isInteger(index) || index < 0 || index >= fields.length) {
      await saveTelegramBusinessState(chatId, {}, undefined, account.merchant.id);
      return { success: true };
    }
    const field = fields[index];
    const value = field === 'website' && text.trim().toLowerCase() === 'aucun' ? '' : text.trim();
    const validation = businessSchema.shape[field].safeParse(value);
    const nameError = field === 'business_name' ? getBusinessNameValidationError(value) : null;
    if (!validation.success || nameError) {
      await TelegramClient.sendMessage(chatId, nameError || `Valeur invalide. ${prompts[index]}`);
      return { success: true };
    }
    const details = { ...state.details, [field]: value };
    if (index + 1 < fields.length) {
      await saveTelegramBusinessState(chatId, { ...state, field: index + 1, details }, undefined, account.merchant.id);
      await TelegramClient.sendMessage(chatId, prompts[index + 1]);
    } else {
      await saveTelegramBusinessState(chatId, { ...state, step: 'business_confirm', details }, undefined, account.merchant.id);
      await TelegramClient.sendMessage(chatId, `<b>Confirmer le nouveau business</b>\n\n${fields.map(key => escape(details[key] || '—')).join('\n')}\n\nValidation séparée de l’activité avant activation.\nEnvoyez /confirmer pour créer, /cancel pour annuler.`, { parse_mode: 'HTML' });
    }
    return { success: true };
  }
}
