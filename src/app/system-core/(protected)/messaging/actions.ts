'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { sendEmail } from "@/lib/server/mail";
import { requireAdmin } from "@/lib/auth/require-admin";
import { CampaignService, CampaignRecipientInput } from "@/lib/server/messaging/campaign-service";
import crypto from 'crypto';

const MAX_RECIPIENTS = 5000;
const MAX_SUBJECT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 50_000;

export interface AudienceMember {
  id: string;
  name: string;
  email: string;
  type: 'merchant' | 'customer' | 'user';
  details?: string;
}

/**
 * Récupère tous les marchands du système
 */
export async function getAdminMerchants() {
  await requireAdmin(['super_admin', 'operations', 'support']);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('merchants')
    .select('id, business_name, email')
    .order('business_name', { ascending: true });

  if (error) throw new Error(`Impossible de charger les marchands: ${error.message}`);
  return data || [];
}

/**
 * Récupère toutes les audiences disponibles (Marchands, Clients, Utilisateurs)
 */
export async function getAdminSystemAudiences(): Promise<{
  merchants: AudienceMember[];
  customers: AudienceMember[];
  users: AudienceMember[];
}> {
  await requireAdmin(['super_admin', 'operations', 'support']);
  const supabase = createAdminClient();

  const [merchantsRes, customersRes, usersRes] = await Promise.all([
    supabase
      .from('merchants')
      .select('id, business_name, email, phone, status')
      .not('email', 'is', null)
      .order('business_name', { ascending: true }),
    supabase
      .from('customers')
      .select('id, name, email, phone')
      .not('email', 'is', null)
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, email, full_name, role')
      .not('email', 'is', null)
      .order('email', { ascending: true }),
  ]);

  const merchants: AudienceMember[] = (merchantsRes.data || []).map((m: any) => ({
    id: m.id,
    name: m.business_name || 'Marchand sans nom',
    email: m.email,
    type: 'merchant' as const,
    details: m.phone ? `Tél: ${m.phone}` : undefined,
  }));

  const customers: AudienceMember[] = (customersRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Client',
    email: c.email,
    type: 'customer' as const,
    details: c.phone ? `Tél: ${c.phone}` : undefined,
  }));

  const users: AudienceMember[] = (usersRes.data || []).map((u: any) => ({
    id: u.id,
    name: u.full_name || u.email.split('@')[0],
    email: u.email,
    type: 'user' as const,
    details: u.role ? `Rôle: ${u.role}` : undefined,
  }));

  return {
    merchants,
    customers,
    users,
  };
}

/**
 * Récupère la liste des campagnes d'e-mails existantes
 */
export async function getAdminCampaigns() {
  await requireAdmin(['super_admin', 'operations', 'support']);
  return await CampaignService.getCampaigns(100);
}

/**
 * Récupère les détails et destinataires d'une campagne avec filtres
 */
export async function getCampaignDetailsAction(campaignId: string, options?: {
  status?: 'all' | 'pending' | 'sent' | 'failed';
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  await requireAdmin(['super_admin', 'operations', 'support']);
  return await CampaignService.getCampaignDetails(campaignId, options);
}

/**
 * Crée une campagne d'e-mails programmée avec découpage automatique en lots journaliers (50/jour) et throttling (7/sec)
 */
export async function createScheduledCampaignAction(params: {
  title: string;
  subject: string;
  content: string;
  contentHtml?: string;
  audienceType: 'merchants' | 'customers' | 'users' | 'all' | 'custom';
  recipients: CampaignRecipientInput[];
  dailyLimit?: number;
  ratePerSecond?: number;
  scheduledAt?: string | null;
  broadcastTelegramChannel?: boolean;
  broadcastTelegramMerchants?: boolean;
}) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);

  if (!params.title?.trim()) return { error: 'Le titre de la campagne est requis.' };
  if (!params.subject?.trim()) return { error: "L'objet de l'e-mail est requis." };
  if (!params.content?.trim()) return { error: 'Le contenu du message est requis.' };
  if (!params.recipients || params.recipients.length === 0) {
    return { error: 'Veuillez sélectionner au moins un destinataire.' };
  }

  if (params.recipients.length > MAX_RECIPIENTS) {
    return { error: `La limite maximale est de ${MAX_RECIPIENTS} destinataires par campagne.` };
  }

  try {
    const result = await CampaignService.createCampaign({
      title: params.title,
      subject: params.subject,
      content: params.content,
      contentHtml: params.contentHtml,
      audienceType: params.audienceType,
      recipients: params.recipients,
      dailyLimit: params.dailyLimit || 50,
      ratePerSecond: params.ratePerSecond || 7,
      scheduledAt: params.scheduledAt,
      createdBy: session.user.id,
    });

    // Diffusion Telegram si sélectionnée
    if (params.broadcastTelegramChannel || params.broadcastTelegramMerchants) {
      try {
        const { TelegramNotifierService } = await import('@/lib/server/telegram/telegram-notifier.service');
        await TelegramNotifierService.broadcastAnnouncement({
          title: params.title,
          subject: params.subject,
          content: params.content,
          sendToChannel: params.broadcastTelegramChannel,
          sendToMerchantsDirect: params.broadcastTelegramMerchants,
        });
      } catch (telErr) {
        console.error('[AdminMessaging] Telegram broadcast failed:', telErr);
      }
    }

    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      admin_id: session.user.id,
      action: 'messaging.campaign_created',
      entity_type: 'email_campaigns',
      entity_id: result.campaign.id,
      metadata: {
        title: params.title,
        recipients_count: params.recipients.length,
        daily_limit: params.dailyLimit || 50,
        rate_per_second: params.ratePerSecond || 7,
        scheduled_at: params.scheduledAt,
        broadcast_telegram_channel: params.broadcastTelegramChannel,
        broadcast_telegram_merchants: params.broadcastTelegramMerchants,
      },
    });

    return {
      success: true,
      campaign: result.campaign,
      batchResult: result.immediateBatchResult,
    };
  } catch (err: any) {
    console.error('[AdminMessaging] createScheduledCampaignAction error:', err);
    return { error: err.message || 'Impossible de créer la campagne.' };
  }
}

/**
 * Déclenche manuellement le lot d'aujourd'hui pour une campagne (max 50)
 */
export async function processCampaignTodayBatchAction(campaignId: string) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);

  try {
    const result = await CampaignService.processTodayBatch(campaignId);

    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      admin_id: session.user.id,
      action: 'messaging.batch_processed_manual',
      entity_type: 'email_campaigns',
      entity_id: campaignId,
      metadata: {
        sent: result.sentCount,
        failed: result.failedCount,
        remaining: result.remainingPending,
      },
    });

    return result;
  } catch (err: any) {
    return { error: err.message || 'Erreur lors du traitement du lot.' };
  }
}

/**
 * Relance les destinataires qui ont échoué lors des envois précédents
 */
export async function retryFailedRecipientsAction(campaignId: string) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);

  try {
    const result = await CampaignService.retryFailedRecipients(campaignId);

    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      admin_id: session.user.id,
      action: 'messaging.retry_failed',
      entity_type: 'email_campaigns',
      entity_id: campaignId,
      metadata: { count: result.count },
    });

    return { success: true, ...result };
  } catch (err: any) {
    return { error: err.message || 'Erreur lors de la réinitialisation des échecs.' };
  }
}

/**
 * Met en pause une campagne
 */
export async function pauseCampaignAction(campaignId: string) {
  await requireAdmin(['super_admin', 'operations', 'support']);
  try {
    return await CampaignService.pauseCampaign(campaignId);
  } catch (err: any) {
    return { error: err.message || 'Impossible de mettre en pause.' };
  }
}

/**
 * Reprend une campagne en pause
 */
export async function resumeCampaignAction(campaignId: string) {
  await requireAdmin(['super_admin', 'operations', 'support']);
  try {
    return await CampaignService.resumeCampaign(campaignId);
  } catch (err: any) {
    return { error: err.message || 'Impossible de reprendre la campagne.' };
  }
}

/**
 * Annule une campagne
 */
export async function cancelCampaignAction(campaignId: string) {
  await requireAdmin(['super_admin', 'operations', 'support']);
  try {
    return await CampaignService.cancelCampaign(campaignId);
  } catch (err: any) {
    return { error: err.message || "Impossible d'annuler la campagne." };
  }
}

/**
 * Envoi direct legacy vers les notifications internes et e-mails
 */
export async function sendBulkAdminMessage(merchantIds: string[], subject: string, message: string) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);
  const recipientIds = [...new Set(merchantIds)].slice(0, 500);
  const normalizedSubject = subject.trim();
  const normalizedMessage = message.trim();
  if (!recipientIds.length || !normalizedSubject || !normalizedMessage) {
    return { error: 'Sélectionnez au moins un marchand et remplissez tous les champs' };
  }
  if (normalizedSubject.length > MAX_SUBJECT_LENGTH) return { error: 'Le sujet est trop long' };
  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) return { error: 'Le message est trop long' };

  const supabase = createAdminClient();

  const { data: merchants, error: merchantsError } = await supabase
    .from('merchants')
    .select('id, email, business_name')
    .in('id', recipientIds);

  if (merchantsError) return { error: `Impossible de charger les destinataires: ${merchantsError.message}` };
  if (!merchants?.length) {
    return { error: 'Aucun marchand trouvé' };
  }

  const campaignId = crypto.randomUUID();
  const { error: notificationError } = await supabase.from('notifications').insert(
    merchants.map((merchant) => ({
      merchant_id: merchant.id,
      type: 'admin_message',
      title: normalizedSubject,
      message: normalizedMessage,
      resource_id: campaignId,
    })),
  );
  if (notificationError) {
    return { error: `Le message n'a pas pu être enregistré: ${notificationError.message}` };
  }

  const results: { email: string; business_name: string; success: boolean; error?: string }[] = [];

  const sendToMerchant = async (merchant: { id: string; email: string; business_name: string }) => {
    try {
      const emailResult = await sendEmail({
        to: merchant.email,
        subject: `Kobara - ${normalizedSubject}`,
        text: normalizedMessage,
      });
      if (!emailResult.success) throw new Error(emailResult.error || "Échec de l'envoi de l'e-mail");

      results.push({ email: merchant.email, business_name: merchant.business_name, success: true });
    } catch (error: unknown) {
      results.push({
        email: merchant.email,
        business_name: merchant.business_name,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  };

  for (let index = 0; index < merchants.length; index += 7) {
    await Promise.all(merchants.slice(index, index + 7).map(sendToMerchant));
    await new Promise((r) => setTimeout(r, 150));
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  await supabase.from('audit_logs').insert({
    admin_id: session.user.id,
    action: 'messaging.bulk_sent',
    entity_type: 'notifications',
    metadata: { campaign_id: campaignId, recipients: merchants.length, email_sent: sent, email_failed: failed, subject: normalizedSubject },
  });

  return {
    success: true,
    partial: failed > 0,
    results,
    sent,
    failed,
    delivered: merchants.length,
    total: merchants.length,
  };
}
