import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';

export interface CampaignRecipientInput {
  email: string;
  name?: string;
  type?: 'merchant' | 'customer' | 'user' | 'custom';
  id?: string;
}

export interface CreateCampaignParams {
  title: string;
  subject: string;
  content: string;
  contentHtml?: string;
  audienceType?: 'merchants' | 'customers' | 'users' | 'all' | 'custom';
  recipients: CampaignRecipientInput[];
  dailyLimit?: number; // default 50
  ratePerSecond?: number; // default 7
  scheduledAt?: string | null;
  createdBy?: string;
}

export interface ProcessBatchResult {
  success: boolean;
  campaignId: string;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  remainingPending: number;
  quotaReached: boolean;
  isCompleted: boolean;
  message?: string;
}

export class CampaignService {
  /**
   * Pause between email sends to enforce the rate limit (e.g. max 7/sec = ~145ms delay)
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper to format current date as YYYY-MM-DD
   */
  private static getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Crée une nouvelle campagne et partitionne automatiquement les destinataires en lots de dailyLimit (ex: 50/jour)
   */
  static async createCampaign(params: CreateCampaignParams) {
    const supabase = createAdminClient();
    const dailyLimit = Math.max(1, params.dailyLimit || 50);
    const ratePerSecond = Math.min(20, Math.max(1, params.ratePerSecond || 7));

    // Dédupliquer les e-mails
    const seenEmails = new Set<string>();
    const uniqueRecipients: CampaignRecipientInput[] = [];

    for (const r of params.recipients) {
      const cleanEmail = r.email.trim().toLowerCase();
      if (cleanEmail && !seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        uniqueRecipients.push({
          ...r,
          email: cleanEmail,
        });
      }
    }

    if (uniqueRecipients.length === 0) {
      throw new Error('Aucun destinataire valide spécifié.');
    }

    const scheduledDate = params.scheduledAt ? new Date(params.scheduledAt) : null;
    const isFuture = scheduledDate && scheduledDate.getTime() > Date.now();
    const initialStatus = isFuture ? 'scheduled' : 'in_progress';

    // 1. Créer la campagne
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .insert({
        title: params.title.trim(),
        subject: params.subject.trim(),
        content: params.content.trim(),
        content_html: params.contentHtml?.trim() || null,
        audience_type: params.audienceType || 'merchants',
        status: initialStatus,
        daily_limit: dailyLimit,
        rate_per_second: ratePerSecond,
        total_recipients: uniqueRecipients.length,
        sent_count: 0,
        failed_count: 0,
        pending_count: uniqueRecipients.length,
        scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
        started_at: isFuture ? null : new Date().toISOString(),
        created_by: params.createdBy || null,
      })
      .select('*')
      .single();

    if (campaignError || !campaign) {
      console.error('[CampaignService] Failed to insert campaign:', campaignError);
      throw new Error(`Impossible de créer la campagne: ${campaignError?.message}`);
    }

    // 2. Découpage en lots (Batch 1 = 1..50, Batch 2 = 51..100, etc.)
    const recipientRows = uniqueRecipients.map((recipient, index) => {
      const batchNumber = Math.floor(index / dailyLimit) + 1;
      return {
        campaign_id: campaign.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name || null,
        recipient_type: recipient.type || 'merchant',
        recipient_id: recipient.id || null,
        batch_number: batchNumber,
        status: 'pending',
        attempts: 0,
      };
    });

    // Insertion par blocs de 500 pour éviter de surcharger Supabase
    const CHUNK_SIZE = 500;
    for (let i = 0; i < recipientRows.length; i += CHUNK_SIZE) {
      const chunk = recipientRows.slice(i, i + CHUNK_SIZE);
      const { error: batchInsertError } = await supabase
        .from('email_campaign_recipients')
        .insert(chunk);

      if (batchInsertError) {
        console.error('[CampaignService] Failed to insert recipients:', batchInsertError);
        throw new Error(`Erreur lors de l'enregistrement des destinataires: ${batchInsertError.message}`);
      }
    }

    // 3. Si la campagne doit démarrer immédiatement, lancer le premier lot
    let immediateBatchResult: ProcessBatchResult | null = null;
    if (!isFuture) {
      try {
        immediateBatchResult = await this.processTodayBatch(campaign.id);
      } catch (err) {
        console.error('[CampaignService] Immediate batch execution error:', err);
      }
    }

    return {
      campaign,
      immediateBatchResult,
    };
  }

  /**
   * Traite le lot du jour pour une campagne donnée (respecte le quota quotidien de 50 et le débit de 7/sec)
   */
  static async processTodayBatch(campaignId: string): Promise<ProcessBatchResult> {
    const supabase = createAdminClient();
    const today = this.getTodayDateString();

    // 1. Récupérer la campagne
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campagne introuvable.');
    }

    if (campaign.status === 'completed') {
      return {
        success: true,
        campaignId,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingPending: 0,
        quotaReached: false,
        isCompleted: true,
        message: 'Cette campagne est déjà terminée.',
      };
    }

    if (campaign.status === 'paused' || campaign.status === 'cancelled') {
      return {
        success: false,
        campaignId,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingPending: campaign.pending_count,
        quotaReached: false,
        isCompleted: false,
        message: `La campagne est actuellement ${campaign.status === 'paused' ? 'en pause' : 'annulée'}.`,
      };
    }

    // 2. Calcul du quota disponible pour aujourd'hui
    let sentToday = 0;
    if (campaign.last_sent_date === today) {
      sentToday = campaign.sent_today_count || 0;
    }

    const dailyLimit = campaign.daily_limit || 50;
    const remainingDailyQuota = Math.max(0, dailyLimit - sentToday);

    if (remainingDailyQuota <= 0) {
      return {
        success: true,
        campaignId,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingPending: campaign.pending_count,
        quotaReached: true,
        isCompleted: false,
        message: `Le quota de ${dailyLimit} e-mails pour aujourd'hui (${today}) est déjà atteint. Le prochain lot sera traité demain.`,
      };
    }

    // 3. Sélectionner les prochains destinataires en attente dans la limite du quota restant
    const { data: recipients, error: recipientsError } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(remainingDailyQuota);

    if (recipientsError) {
      throw new Error(`Erreur de chargement des destinataires: ${recipientsError.message}`);
    }

    if (!recipients || recipients.length === 0) {
      // Plus de destinataires en attente -> Marquer comme terminée
      await supabase
        .from('email_campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          pending_count: 0,
        })
        .eq('id', campaignId);

      return {
        success: true,
        campaignId,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingPending: 0,
        quotaReached: false,
        isCompleted: true,
        message: 'Tous les destinataires ont déjà été traités.',
      };
    }

    // 4. Envoi régulé avec respect du débit (max 7/sec => ~145ms de pause)
    const ratePerSecond = campaign.rate_per_second || 7;
    const delayBetweenSends = Math.ceil(1000 / ratePerSecond) + 5;

    let batchSentCount = 0;
    let batchFailedCount = 0;

    for (const recipient of recipients) {
      // Marquer le destinataire en cours
      await supabase
        .from('email_campaign_recipients')
        .update({
          status: 'sending',
          attempts: (recipient.attempts || 0) + 1,
        })
        .eq('id', recipient.id);

      try {
        const sendResult = await sendEmail({
          to: recipient.recipient_email,
          subject: campaign.subject,
          text: campaign.content,
          html: campaign.content_html || undefined,
        });

        if (sendResult.success) {
          batchSentCount++;
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', recipient.id);
        } else {
          batchFailedCount++;
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'failed',
              error_message: sendResult.error || "Échec de l'envoi de l'e-mail",
            })
            .eq('id', recipient.id);
        }
      } catch (err: any) {
        batchFailedCount++;
        await supabase
          .from('email_campaign_recipients')
          .update({
            status: 'failed',
            error_message: err.message || 'Erreur inattendue lors de l\'envoi',
          })
          .eq('id', recipient.id);
      }

      // Throttling strict entre les envois
      await this.sleep(delayBetweenSends);
    }

    // 5. Mettre à jour les statistiques de la campagne
    const newSentToday = (campaign.last_sent_date === today ? campaign.sent_today_count : 0) + batchSentCount + batchFailedCount;
    const totalSent = (campaign.sent_count || 0) + batchSentCount;
    const totalFailed = (campaign.failed_count || 0) + batchFailedCount;

    // Compter les restants réels
    const { count: remainingCount } = await supabase
      .from('email_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const actualRemaining = remainingCount || 0;
    const isFinished = actualRemaining === 0;

    await supabase
      .from('email_campaigns')
      .update({
        sent_count: totalSent,
        failed_count: totalFailed,
        pending_count: actualRemaining,
        sent_today_count: newSentToday,
        last_sent_date: today,
        last_batch_at: new Date().toISOString(),
        status: isFinished ? 'completed' : 'in_progress',
        completed_at: isFinished ? new Date().toISOString() : null,
        started_at: campaign.started_at || new Date().toISOString(),
      })
      .eq('id', campaignId);

    return {
      success: true,
      campaignId,
      processedCount: recipients.length,
      sentCount: batchSentCount,
      failedCount: batchFailedCount,
      remainingPending: actualRemaining,
      quotaReached: newSentToday >= dailyLimit,
      isCompleted: isFinished,
      message: `${batchSentCount} e-mail(s) envoyé(s) avec succès${batchFailedCount > 0 ? `, ${batchFailedCount} échec(s)` : ''}. Restant : ${actualRemaining}.`,
    };
  }

  /**
   * Traite automatiquement toutes les campagnes actives pour le cron quotidien
   */
  static async processDailyCampaignBatches(): Promise<{
    processedCampaigns: number;
    results: ProcessBatchResult[];
  }> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Récupérer toutes les campagnes programmées (date échue) ou en cours
    const { data: activeCampaigns, error } = await supabase
      .from('email_campaigns')
      .select('id, title, status, scheduled_at')
      .in('status', ['scheduled', 'in_progress'])
      .order('created_at', { ascending: true });

    if (error || !activeCampaigns || activeCampaigns.length === 0) {
      return { processedCampaigns: 0, results: [] };
    }

    const results: ProcessBatchResult[] = [];

    for (const campaign of activeCampaigns) {
      if (campaign.status === 'scheduled' && campaign.scheduled_at && campaign.scheduled_at > now) {
        // Pas encore l'heure
        continue;
      }

      try {
        const batchResult = await this.processTodayBatch(campaign.id);
        results.push(batchResult);
      } catch (err: any) {
        console.error(`[CampaignService] Error processing campaign ${campaign.id}:`, err);
        results.push({
          success: false,
          campaignId: campaign.id,
          processedCount: 0,
          sentCount: 0,
          failedCount: 0,
          remainingPending: 0,
          quotaReached: false,
          isCompleted: false,
          message: err.message,
        });
      }
    }

    return {
      processedCampaigns: results.length,
      results,
    };
  }

  /**
   * Réinitialise les destinataires en échec pour qu'ils soient renvoyés lors du prochain lot
   */
  static async retryFailedRecipients(campaignId: string) {
    const supabase = createAdminClient();

    // 1. Compter et passer les échecs en pending
    const { data: failedRecipients, error: fetchError } = await supabase
      .from('email_campaign_recipients')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');

    if (fetchError) throw new Error(fetchError.message);
    const countToRetry = failedRecipients?.length || 0;

    if (countToRetry === 0) {
      return { count: 0, message: 'Aucun e-mail en échec à relancer.' };
    }

    const { error: updateError } = await supabase
      .from('email_campaign_recipients')
      .update({
        status: 'pending',
        error_message: null,
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');

    if (updateError) throw new Error(updateError.message);

    // 2. Mettre à jour les compteurs de la campagne
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('pending_count, failed_count')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      await supabase
        .from('email_campaigns')
        .update({
          failed_count: Math.max(0, (campaign.failed_count || 0) - countToRetry),
          pending_count: (campaign.pending_count || 0) + countToRetry,
          status: 'in_progress',
          completed_at: null,
        })
        .eq('id', campaignId);
    }

    return {
      count: countToRetry,
      message: `${countToRetry} destinataire(s) réintégré(s) pour le prochain envoi.`,
    };
  }

  /**
   * Met une campagne en pause
   */
  static async pauseCampaign(campaignId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('email_campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId)
      .in('status', ['in_progress', 'scheduled']);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  /**
   * Reprend une campagne en pause
   */
  static async resumeCampaign(campaignId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('email_campaigns')
      .update({ status: 'in_progress' })
      .eq('id', campaignId)
      .eq('status', 'paused');

    if (error) throw new Error(error.message);
    return { success: true };
  }

  /**
   * Annule une campagne
   */
  static async cancelCampaign(campaignId: string) {
    const supabase = createAdminClient();
    await supabase
      .from('email_campaign_recipients')
      .update({ status: 'cancelled' })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const { error } = await supabase
      .from('email_campaigns')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', campaignId);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  /**
   * Récupère la liste des campagnes
   */
  static async getCampaigns(limit = 50) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  }

  /**
   * Récupère les détails d'une campagne et ses destinataires paginés/filtrés
   */
  static async getCampaignDetails(campaignId: string, options?: {
    status?: 'all' | 'pending' | 'sent' | 'failed';
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const supabase = createAdminClient();
    const status = options?.status || 'all';
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1. Récupérer la campagne
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campagne introuvable.');
    }

    // 2. Requête des destinataires
    let query = supabase
      .from('email_campaign_recipients')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      query = query.or(`recipient_email.ilike.%${q}%,recipient_name.ilike.%${q}%`);
    }

    query = query
      .order('batch_number', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);

    const { data: recipients, count, error: recipientsError } = await query;

    if (recipientsError) {
      throw new Error(recipientsError.message);
    }

    return {
      campaign,
      recipients: recipients || [],
      totalRecipients: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }
}
