import { sendEmail } from './mail';
import { createAdminClient } from '@/utils/supabase/admin';

export async function createNotification(
  merchantId: string, 
  type: string, 
  title: string, 
  message: string, 
  emailDest?: string,
  resourceId?: string,
  options?: { forceEmail?: boolean },
) {
  const supabase = createAdminClient();
  
  // Insert in-app notification
  const { error } = await supabase
    .from('notifications')
    .insert({
      merchant_id: merchantId,
      type,
      title,
      message,
      resource_id: resourceId
    });
    
  if (error) {
    // If it's a unique constraint violation (23505), it means this notification was already created
    if (error.code === '23505') {
      console.log(`Notification deduplicated: [${type}] for resource ${resourceId}`);
      return { created: false, deduplicated: true, emailSent: false }; // Do not send email again
    }
    console.error("Failed to insert notification:", error);
    return { created: false, deduplicated: false, emailSent: false, emailError: error.message };
  }

  // Send Email if dest is provided
  let emailSent = false;
  let emailError: string | undefined;
  if (emailDest) {
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('current_environment')
      .eq('id', merchantId)
      .maybeSingle();

    if (options?.forceEmail || merchantData?.current_environment !== 'test') {
      const emailResult = await sendEmail({
        to: emailDest,
        subject: title,
        text: message
      });
      emailSent = emailResult.success;
      emailError = emailResult.error;
    } else {
      console.log(`[Mode Test] Email ignoré pour: ${emailDest} - ${title}`);
    }
  }

  // Send Push Notification
  try {
    const { data: merchantPreferences } = await supabase
      .from('merchants')
      .select('notification_prefs')
      .eq('id', merchantId)
      .maybeSingle();

    const preferenceGroup = type.startsWith('payment')
      ? 'payments'
      : type.startsWith('withdrawal')
        ? 'withdrawals'
        : type.startsWith('transfer') || type.startsWith('b2b')
          ? 'transfers'
          : type.includes('security') || type.includes('passkey') || type.includes('2fa')
            ? 'security'
            : null;
    const preferences = merchantPreferences?.notification_prefs as Record<string, boolean> | null;

    if (preferenceGroup && preferences?.[preferenceGroup] === false) {
      return;
    }

    const { data: devices, error: devicesError } = await supabase
      .from('merchant_devices')
      .select('expo_push_token')
      .eq('merchant_id', merchantId);

    if (devicesError) {
      throw devicesError;
    }

    if (devices && devices.length > 0) {
      const { sendPushNotification } = await import('@/lib/notifications/expo-push');
      for (const device of devices) {
        if (device.expo_push_token) {
          await sendPushNotification(device.expo_push_token, title, message, { type, resourceId });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send push notifications:", err);
  }

  return { created: true, deduplicated: false, emailSent, emailError };
}

export async function notifyAdminWithdrawalCreated(
  merchantId: string,
  amount: number,
  method: string,
  withdrawalId?: string,
  wallet?: string,
  totalWithFees?: number,
  currency: 'HTG' | 'USD' = 'HTG',
  sourceTotal?: number,
  sourceCurrency: 'HTG' | 'USD' = currency,
) {
  const adminEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@kobara.app';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  const supabase = createAdminClient();
  const { data: merchant } = await supabase.from('merchants').select('business_name, email, phone').eq('id', merchantId).single();
  const businessName = merchant?.business_name || 'Un marchand';
  const merchantEmail = merchant?.email || '';
  
  const requiresManualApproval = ['natcash', 'zelle', 'paypal'].includes(method.toLowerCase());
  const formatAmount = (value: number) => currency === 'USD'
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : `${value.toLocaleString('fr-FR')} HTG`;
  const formatSourceAmount = (value: number) => sourceCurrency === 'USD'
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : `${value.toLocaleString('fr-FR')} HTG`;

  const subject = requiresManualApproval
    ? `[APPROBATION REQUISE] Retrait ${method} de ${formatAmount(totalWithFees || amount)} — ${businessName}`
    : `[NOUVEAU RETRAIT] ${method} — ${formatAmount(totalWithFees || amount)} — ${businessName}`;

  const body = `
Bonjour Admin,

${requiresManualApproval ? `Un retrait ${method} est en attente de votre approbation manuelle.` : `Un retrait ${method} vient d'être effectué.`}

━━━━━━━━━━━━━━━━━━━━━━━━
DÉTAILS DU RETRAIT
━━━━━━━━━━━━━━━━━━━━━━━━
Marchand   : ${businessName}
Email      : ${merchantEmail}
Méthode    : ${method}
${wallet ? `Portefeuille: ${wallet}` : ''}
Montant net: ${formatAmount(amount)}
${sourceTotal ? `Compte débité: ${formatSourceAmount(sourceTotal)}` : totalWithFees ? `Total débité: ${formatAmount(totalWithFees)}` : ''}
Statut     : ${requiresManualApproval ? 'EN ATTENTE D\'APPROBATION' : 'TRAITÉ'}
━━━━━━━━━━━━━━━━━━━━━━━━

${requiresManualApproval ? `👉 Connectez-vous au panneau admin pour approuver ou rejeter:\n${appUrl}/system-core/withdrawals` : `👉 Voir le panneau admin:\n${appUrl}/system-core/withdrawals`}

Cordialement,
L'équipe technique Kobara
  `.trim();

  await sendEmail({ to: adminEmail, subject, text: body });
}

export async function notifyAdminKycSubmission(params: {
  merchantId: string;
  businessName?: string;
  merchantEmail?: string;
  merchantPhone?: string;
  documentType?: string;
  status: 'approved' | 'in_review';
  score?: number;
  reasons?: string[];
  geminiSummary?: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@kobara.app';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';

  const isManualReview = params.status === 'in_review';
  const subject = isManualReview
    ? `[KYC EN ATTENTE] Revue manuelle requise — ${params.businessName || 'Nouveau marchand'}`
    : `[KYC VALIDÉ IA] Vérification automatique réussie — ${params.businessName || 'Marchand'}`;

  const body = `
Bonjour Admin,

${isManualReview 
  ? "Une nouvelle demande de vérification de compte (KYC) nécessite votre examen manuel." 
  : "Une nouvelle demande de vérification de compte (KYC) a été validée automatiquement par le système."}

━━━━━━━━━━━━━━━━━━━━━━━━
DÉTAILS DU COMPTE MARCHAND
━━━━━━━━━━━━━━━━━━━━━━━━
Entreprise : ${params.businessName || 'Non renseigné'}
Email      : ${params.merchantEmail || 'Non renseigné'}
Téléphone  : ${params.merchantPhone || 'Non renseigné'}
Document   : ${params.documentType || 'Pièce d\'identité'}
Statut KYC : ${isManualReview ? 'EN ATTENTE D\'EXAMEN MANUEL' : 'APPROUVÉ AUTOMATIQUEMENT'}
Score      : ${params.score !== undefined ? `${params.score}/100` : 'N/A'}
${params.reasons && params.reasons.length > 0 ? `Motifs / Alertes :\n- ${params.reasons.join('\n- ')}` : ''}
${params.geminiSummary ? `Synthèse IA : ${params.geminiSummary}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━

👉 Accédez directement au dossier KYC dans votre panneau d'administration :
${appUrl}/system-core/kyc

Cordialement,
Le système automatisé Kobara
  `.trim();

  await sendEmail({ to: adminEmail, subject, text: body });
}

// 1. Nouvelle Paiement (succeeded)
export async function notifyPaymentSucceeded(merchantId: string, email: string, amount: number, currency: string, paymentId?: string) {
  await createNotification(
    merchantId,
    'payment_succeeded',
    'Paiement reçu',
    `Vous avez reçu un paiement de ${amount} ${currency}.`,
    email,
    paymentId
  );
}

export async function notifyPaymentCreated(merchantId: string, email: string, amount: number, currency: string, paymentId?: string) {
  await createNotification(
    merchantId,
    'payment_created',
    'Nouveau paiement créé',
    `Un paiement de ${amount} ${currency} est en attente.`,
    email,
    paymentId
  );
}

export async function notifyPaymentFailed(merchantId: string, email: string, amount: number, currency: string, paymentId?: string) {
  await createNotification(
    merchantId,
    'payment_failed',
    'Paiement échoué',
    `Un paiement de ${amount} ${currency} a échoué.`,
    email,
    paymentId
  );
}

// 2. Activation du Plan
export async function notifyPlanActivation(merchantId: string, email: string, planName: string) {
  await createNotification(
    merchantId,
    'plan_activated',
    'Plan activé avec succès',
    `Votre souscription au plan ${planName} est désormais active. Merci de votre confiance !`,
    email
  );
}

// 3. Rappel KYC
export async function notifyKycReminder(merchantId: string, email: string, reminderDate?: string) {
  return createNotification(
    merchantId,
    'kyc_reminder',
    'Terminez la verification de votre compte Kobara',
    `Votre tableau de bord Production reste verrouille jusqu'a la validation de votre verification KYC. Connectez-vous pour terminer les etapes restantes : https://dashboard.kobara.app/kyc`,
    email,
    reminderDate ? `kyc-reminder-${reminderDate}` : undefined,
    { forceEmail: true },
  );
}

// 4. Succès de changement de mot de passe
export async function notifyPasswordChange(merchantId: string, email: string) {
  await createNotification(
    merchantId,
    'security_alert',
    'Mot de passe modifié',
    `Le mot de passe de votre compte Kobara a été modifié avec succès. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.`,
    email
  );
}

// 5. Succès de KYC
export async function notifyKycSuccess(merchantId: string, email: string) {
  await createNotification(
    merchantId,
    'kyc_success',
    'Vérification KYC validée',
    `Félicitations ! Votre vérification d'identité (KYC) a été validée. Votre compte est maintenant entièrement opérationnel.`,
    email
  );
}

// 6. Révoquer API
export async function notifyApiKeyRevoked(merchantId: string, email: string, keyName: string) {
  await createNotification(
    merchantId,
    'security_alert',
    'Clé API révoquée',
    `La clé API nommée "${keyName}" a été révoquée. Elle ne peut plus être utilisée pour s'authentifier.`,
    email
  );
}

// 7. Activation sécurité 2FA
export async function notify2faActivation(merchantId: string, email: string, method: string) {
  await createNotification(
    merchantId,
    'security_alert',
    'Double authentification (2FA) activée',
    `La double authentification a été activée sur votre compte en utilisant la méthode : ${method}. Votre compte est maintenant plus sécurisé.`,
    email
  );
}

// 8. Activation Passkey
export async function notifyPasskeyAdded(merchantId: string, email: string) {
  await createNotification(
    merchantId,
    'security_alert',
    'Nouvelle clé biométrique (Passkey) ajoutée',
    `Un nouvel appareil a été enregistré pour la connexion biométrique (Passkey). Vous pouvez maintenant vous connecter sans mot de passe.`,
    email
  );
}

// 9. Retrait effectué avec succès
export async function notifyWithdrawalSuccess(merchantId: string, email: string, amount: number, withdrawalId?: string, currency: 'HTG' | 'USD' = 'HTG') {
  await createNotification(
    merchantId,
    'withdrawal_completed',
    '💸 Retrait complété',
    `Votre retrait de ${amount} ${currency} a été effectué avec succès.`,
    email,
    withdrawalId
  );
}

// 10. Retrait échoué
export async function notifyWithdrawalFailed(merchantId: string, email: string, amount: number, withdrawalId?: string, currency: 'HTG' | 'USD' = 'HTG') {
  await createNotification(
    merchantId,
    'withdrawal_failed',
    '⚠️ Retrait échoué',
    `Votre retrait de ${amount} ${currency} a échoué. Le montant a été recrédité sur votre solde ${currency}.`,
    email,
    withdrawalId
  );
}

// 11. Retrait créé
export async function notifyWithdrawalCreated(merchantId: string, email: string, amount: number, withdrawalId?: string, currency: 'HTG' | 'USD' = 'HTG') {
  await createNotification(
    merchantId,
    'withdrawal_created',
    'Demande de retrait',
    `Votre demande de retrait de ${amount} ${currency} a été reçue et est en cours de traitement.`,
    email,
    withdrawalId
  );
}

// B2B Transfers
export async function notifyB2BTransferSent(senderId: string, email: string, amount: number, receiverEmail: string) {
  const title = "Transfert B2B Envoyé";
  const message = `Vous avez envoyé avec succès un transfert B2B de ${amount.toLocaleString('fr-FR')} HTG à ${receiverEmail}.`;
  await createNotification(senderId, 'b2b.sent', title, message, email);
}

export async function notifyB2BTransferReceived(receiverId: string, email: string, amount: number, senderName: string) {
  const title = "Transfert B2B Reçu";
  const message = `Vous avez reçu un transfert B2B de ${amount.toLocaleString('fr-FR')} HTG de la part de ${senderName}.`;
  await createNotification(receiverId, 'b2b.received', title, message, email);
}

// ---------------------------------------------------------------------------
// SUBSCRIPTIONS & CRON
// ---------------------------------------------------------------------------

export async function notifySubscriptionWarning(merchantId: string, email: string, daysLeft: number, resourceId?: string) {
  await createNotification(
    merchantId,
    `subscription_expiring_${daysLeft}_days`,
    'Renouvellement imminent',
    daysLeft === 1
      ? 'Votre abonnement expire demain. Renouvelez-le pour conserver vos fonctionnalités Premium.'
      : `Votre abonnement expire dans ${daysLeft} jours. Renouvelez-le pour conserver vos fonctionnalités Premium.`,
    email,
    resourceId
  );
}

export async function notifySubscriptionRenewed(merchantId: string, email: string, planName: string, amount: number, resourceId?: string) {
  await createNotification(
    merchantId,
    'subscription_renewed',
    'Renouvellement automatique réussi',
    `Votre abonnement au plan ${planName} a été renouvelé avec succès (${amount} HTG ont été déduits de votre solde).`,
    email,
    resourceId
  );
}

export async function notifySubscriptionPlanChanged(
  merchantId: string,
  email: string,
  previousPlanName: string | null,
  planName: string,
  change: 'activated' | 'renewed' | 'upgraded' | 'downgraded',
  paymentLabel: string,
  resourceId?: string,
) {
  const content = {
    activated: {
      title: 'Plan activé avec succès',
      message: `Le plan ${planName} est maintenant actif sur votre compte. Moyen utilisé : ${paymentLabel}.`,
    },
    renewed: {
      title: 'Abonnement renouvelé avec succès',
      message: `Votre abonnement au plan ${planName} a été renouvelé. Moyen utilisé : ${paymentLabel}.`,
    },
    upgraded: {
      title: 'Upgrade du plan réussi',
      message: `Votre compte est passé du plan ${previousPlanName || 'Free'} au plan ${planName}. Moyen utilisé : ${paymentLabel}.`,
    },
    downgraded: {
      title: 'Changement de plan confirmé',
      message: `Votre compte est passé du plan ${previousPlanName || 'précédent'} au plan ${planName}.`,
    },
  }[change];

  await createNotification(
    merchantId,
    `subscription_${change}`,
    content.title,
    content.message,
    email,
    resourceId,
  );
}

export async function notifySubscriptionGracePeriod(merchantId: string, email: string, daysGrace: number, resourceId?: string) {
  await createNotification(
    merchantId,
    'subscription_grace_period',
    'Période de grâce active',
    `Votre abonnement est en période de grâce pour encore ${daysGrace} jour(s). Renouvelez-le avant la fin de cette période.`,
    email,
    resourceId
  );
}

export async function notifySubscriptionDowngraded(merchantId: string, email: string, resourceId?: string) {
  await createNotification(
    merchantId,
    'subscription_downgraded',
    'Fin de la période de grâce - Plan Rétrogradé',
    `Votre période de grâce de 5 jours a pris fin. Votre compte a été rétrogradé au plan Gratuit (Free).`,
    email,
    resourceId
  );
}

export async function notifySubscriptionExpired(
  merchantId: string,
  email: string,
  planName: string,
  currentPeriodEnd: string | null,
  resourceId?: string,
) {
  const expirationDate = currentPeriodEnd
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(currentPeriodEnd))
    : 'une date non définie';

  return createNotification(
    merchantId,
    'subscription_expired',
    'Votre plan a expiré - Passage au plan Free',
    `Votre abonnement ${planName} a expiré le ${expirationDate}. Votre compte a été automatiquement rétrogradé vers le plan Free et toutes les limites du plan Free sont maintenant appliquées. Vous pouvez renouveler votre ancien plan ou choisir un autre plan depuis votre espace Kobara.`,
    email,
    resourceId,
    { forceEmail: true },
  );
}

type ExpirationAuditMetadata = {
  previous_plan?: string;
  subscription_id?: string;
  current_period_end?: string | null;
  expiration_email_sent_at?: string;
  expiration_email_claimed_at?: string | null;
  expiration_email_error?: string | null;
  notification_resource_id?: string;
  [key: string]: unknown;
};

export async function dispatchPendingSubscriptionExpirationEmails(targetMerchantId?: string) {
  const supabase = createAdminClient();
  let auditQuery = supabase
    .from('audit_logs')
    .select('id, merchant_id, metadata, created_at')
    .eq('action', 'plan.auto_downgraded_free')
    .order('created_at', { ascending: false })
    .limit(250);
  if (targetMerchantId) auditQuery = auditQuery.eq('merchant_id', targetMerchantId);

  const [{ data: events, error: eventsError }, { data: freePlan }] = await Promise.all([
    auditQuery,
    supabase
      .from('plans')
      .select('monthly_payment_limit, api_keys_limit, daily_withdrawal_limit, transaction_fee_percent')
      .eq('slug', 'free')
      .maybeSingle(),
  ]);
  if (eventsError) throw new Error(`Impossible de charger les e-mails d'expiration: ${eventsError.message}`);

  const pendingEvents = (events || []).filter((event) => {
    const metadata = (event.metadata || {}) as ExpirationAuditMetadata;
    if (metadata.expiration_email_sent_at) return false;
    if (!metadata.expiration_email_claimed_at) return true;
    return Date.now() - new Date(metadata.expiration_email_claimed_at).getTime() > 10 * 60 * 1000;
  });
  if (!pendingEvents.length) return { checked: 0, sent: 0, failed: 0 };

  const merchantIds = [...new Set(pendingEvents.map((event) => event.merchant_id).filter(Boolean))];
  const { data: merchants, error: merchantsError } = await supabase
    .from('merchants')
    .select('id, email')
    .in('id', merchantIds);
  if (merchantsError) throw new Error(`Impossible de charger les destinataires expirés: ${merchantsError.message}`);
  const emailByMerchant = new Map((merchants || []).map((merchant) => [merchant.id, merchant.email]));

  const limits = [
    freePlan?.monthly_payment_limit == null ? null : `${freePlan.monthly_payment_limit} paiements par mois`,
    freePlan?.api_keys_limit == null ? null : `${freePlan.api_keys_limit} clé API`,
    freePlan?.daily_withdrawal_limit == null ? null : `${Number(freePlan.daily_withdrawal_limit).toLocaleString('fr-FR')} HTG de retrait par jour`,
    freePlan?.transaction_fee_percent == null ? null : `${Number(freePlan.transaction_fee_percent).toLocaleString('fr-FR')} % de frais par transaction`,
  ].filter(Boolean).join(', ');

  let sent = 0;
  let failed = 0;
  for (const event of pendingEvents) {
    const metadata = (event.metadata || {}) as ExpirationAuditMetadata;
    const email = emailByMerchant.get(event.merchant_id);
    if (!email) continue;

    const claimedAt = new Date().toISOString();
    const claimedMetadata = { ...metadata, expiration_email_claimed_at: claimedAt };
    const { data: claimed } = await supabase
      .from('audit_logs')
      .update({ metadata: claimedMetadata })
      .eq('id', event.id)
      .eq('metadata', metadata)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const expirationDate = metadata.current_period_end
      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(metadata.current_period_end))
      : null;
    const planName = metadata.previous_plan || 'payant';
    const resourceId = metadata.notification_resource_id
      || `subscription_auto_downgrade_${metadata.subscription_id || event.id}`;
    await createNotification(
      event.merchant_id,
      'subscription_expired',
      'Plan expiré - compte passé au plan gratuit',
      `Votre abonnement ${planName}${expirationDate ? ` a expiré le ${expirationDate}` : ' a expiré'}. Votre compte utilise maintenant le plan Free.`,
      undefined,
      resourceId,
    );

    const emailResult = await sendEmail({
      to: email,
      subject: 'Votre plan Kobara a expiré - Passage au plan Free',
      text: `Bonjour,\n\nVotre abonnement ${planName}${expirationDate ? ` a expiré le ${expirationDate}` : ' a expiré'}. Votre compte a été automatiquement rétrogradé vers le plan Free.\n\nLes limites Free sont immédiatement réactivées${limits ? ` : ${limits}` : ''}.\n\nVous pouvez renouveler votre ancien plan ou choisir un autre plan depuis votre espace Kobara : ${(process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app')}/dashboard/billing\n\nL'équipe Kobara`,
    });

    const completedMetadata = emailResult.success
      ? { ...claimedMetadata, expiration_email_sent_at: new Date().toISOString(), expiration_email_error: null }
      : { ...claimedMetadata, expiration_email_claimed_at: null, expiration_email_error: emailResult.error || "Échec de l'envoi" };
    await supabase.from('audit_logs').update({ metadata: completedMetadata }).eq('id', event.id);
    if (emailResult.success) sent++;
    else failed++;
  }

  return { checked: pendingEvents.length, sent, failed };
}
