import 'server-only';

import crypto from 'node:crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';

const HMAC_SECRET = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'kobara_secure_login_salt_2026';

export interface ClientLoginContext {
  rawIp: string;
  ipHash: string;
  ipMasked: string;
  userAgent: string;
  userAgentHash: string;
  deviceFingerprint: string;
  countryCode: string;
}

export class LoginSecurityService {
  /**
   * Extrait et hache cryptographiquement les informations de connexion du client
   */
  static extractContext(headers: Headers): ClientLoginContext {
    const rawIp = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headers.get('x-real-ip')
      || '127.0.0.1';

    const userAgent = headers.get('user-agent') || 'Unknown Device';
    const countryCode = headers.get('cf-ipcountry') || headers.get('x-country-code') || 'HT';

    // 1. Empreinte IP HMAC-SHA256
    const ipHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`ip:${rawIp}`, 'utf8')
      .digest('hex');

    // 2. Masquage IP pour affichage audit (ex: 192.168.***.***)
    const ipParts = rawIp.split('.');
    const ipMasked = ipParts.length === 4
      ? `${ipParts[0]}.${ipParts[1]}.***.***`
      : rawIp.includes(':')
        ? `${rawIp.split(':')[0]}:****:****`
        : rawIp;

    // 3. Hash User-Agent
    const userAgentHash = crypto
      .createHash('sha256')
      .update(userAgent, 'utf8')
      .digest('hex');

    // 4. Device Fingerprint (User-Agent + Headers constants)
    const acceptLanguage = headers.get('accept-language') || '';
    const deviceFingerprint = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`dev:${userAgent}:${acceptLanguage}`, 'utf8')
      .digest('hex');

    return {
      rawIp,
      ipHash,
      ipMasked,
      userAgent,
      userAgentHash,
      deviceFingerprint,
      countryCode,
    };
  }

  /**
   * Évalue si la connexion provient d'un contexte de confiance ou requiert un challenge Step-Up
   */
  static async evaluateLoginContext(params: {
    merchantId: string;
    userId: string;
    context: ClientLoginContext;
  }): Promise<{
    isTrusted: boolean;
    requiresChallenge: boolean;
    isFirstContext: boolean;
    reason: string;
  }> {
    const supabase = createAdminClient();

    // 1. Récupérer l'historique des contextes du marchand
    const { data: existingContexts } = await supabase
      .from('trusted_login_contexts')
      .select('*')
      .eq('merchant_id', params.merchantId)
      .eq('is_trusted', true);

    // Si aucun contexte n'existe encore (premier login du compte), on initialise le contexte de confiance
    if (!existingContexts || existingContexts.length === 0) {
      await supabase.from('trusted_login_contexts').insert({
        merchant_id: params.merchantId,
        user_id: params.userId,
        ip_hash: params.context.ipHash,
        ip_masked: params.context.ipMasked,
        device_fingerprint: params.context.deviceFingerprint,
        user_agent_hash: params.context.userAgentHash,
        country_code: params.context.countryCode,
        is_trusted: true,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      });

      return {
        isTrusted: true,
        requiresChallenge: false,
        isFirstContext: true,
        reason: 'Premier contexte de connexion enregistré et approuvé.',
      };
    }

    const now = new Date();

    // 2. Vérifier si l'IP ou le Device est déjà reconnu et non expiré
    const matchingContext = existingContexts.find(ctx => {
      const notExpired = !ctx.expires_at || new Date(ctx.expires_at) > now;
      const matchesIp = ctx.ip_hash === params.context.ipHash;
      const matchesDevice = ctx.device_fingerprint === params.context.deviceFingerprint;
      return notExpired && (matchesIp || matchesDevice);
    });

    if (matchingContext) {
      // Mettre à jour last_seen_at
      await supabase
        .from('trusted_login_contexts')
        .update({
          last_seen_at: now.toISOString(),
          ip_masked: params.context.ipMasked,
        })
        .eq('id', matchingContext.id);

      return {
        isTrusted: true,
        requiresChallenge: false,
        isFirstContext: false,
        reason: 'Contexte de connexion reconnu et approuvé.',
      };
    }

    // 3. Nouveau contexte détecté ➔ Step-Up Challenge Requis
    const isNewIp = !existingContexts.some(c => c.ip_hash === params.context.ipHash);
    const isNewDevice = !existingContexts.some(c => c.device_fingerprint === params.context.deviceFingerprint);

    // Enregistrer un événement de risque informatif
    try {
      await supabase.from('risk_events').insert({
        merchant_id: params.merchantId,
        event_type: 'login.new_context_detected',
        severity: (isNewIp && isNewDevice) ? 'medium' : 'low',
        description: `Connexion depuis un nouvel environnement (Nouvelle IP: ${isNewIp ? 'Oui' : 'Non'}, Nouvel Appareil: ${isNewDevice ? 'Oui' : 'Non'}).`,
        metadata: {
          ip_masked: params.context.ipMasked,
          country_code: params.context.countryCode,
          user_agent: params.context.userAgent.substring(0, 100),
        },
      });
    } catch (e) {
      console.error('[LoginSecurity] Risk event log error:', e);
    }

    return {
      isTrusted: false,
      requiresChallenge: true,
      isFirstContext: false,
      reason: isNewIp && isNewDevice
        ? 'Nouvelle adresse IP et nouvel appareil détectés.'
        : isNewIp
          ? 'Nouvelle adresse IP détectée.'
          : 'Nouvel appareil détecté.',
    };
  }

  /**
   * Crée et envoie un code de défi de sécurité par email (Step-Up OTP)
   */
  static async createSecurityChallenge(params: {
    merchantId: string;
    userId: string;
    userEmail: string;
    context: ClientLoginContext;
  }): Promise<{ success: boolean; challengeId: string }> {
    const supabase = createAdminClient();

    // 1. Générer un code à 6 chiffres aléatoire
    const rawOtp = crypto.randomInt(100000, 999999).toString();

    // 2. Hash HMAC-SHA256 de l'OTP (ne jamais stocker le code en clair)
    const challengeHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`otp:${params.merchantId}:${rawOtp}`, 'utf8')
      .digest('hex');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // 3. Insérer le challenge en base
    const { data: newChallenge, error } = await supabase
      .from('login_security_challenges')
      .insert({
        merchant_id: params.merchantId,
        user_id: params.userId,
        challenge_hash: challengeHash,
        ip_hash: params.context.ipHash,
        device_fingerprint: params.context.deviceFingerprint,
        attempts: 0,
        max_attempts: 5,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error || !newChallenge) {
      console.error('[LoginSecurity] Failed to create challenge:', error);
      throw new Error("Impossible d'initialiser la vérification de sécurité.");
    }

    // 4. Envoyer l'email sécurisé au marchand
    const emailSubject = "Code de vérification de connexion — Kobara";
    const emailBody = `
Bonjour,

Une tentative de connexion à votre compte Kobara a été effectuée depuis un nouvel environnement :
- Emplacement / Réseau : ${params.context.ipMasked} (${params.context.countryCode})
- Appareil : ${params.context.userAgent.substring(0, 80)}

Pour confirmer qu'il s'agit bien de vous et accéder à votre dashboard, veuillez saisir le code de vérification à 6 chiffres suivant :

${rawOtp}

Ce code est confidentiel et expire dans 10 minutes.
Si vous n'êtes pas à l'origine de cette connexion, veuillez immédiatement modifier votre mot de passe et contacter notre équipe de support.

L'équipe de sécurité Kobara
    `.trim();

    await sendEmail({
      to: params.userEmail,
      subject: emailSubject,
      text: emailBody,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #ea580c; margin-top: 0;">Vérification de sécurité</h2>
          <p>Une connexion à votre compte Kobara a été détectée depuis une nouvelle adresse IP ou un nouvel appareil :</p>
          <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px; color: #4b5563; margin-bottom: 20px;">
            <strong>Réseau :</strong> ${params.context.ipMasked}<br/>
            <strong>Appareil :</strong> ${params.context.userAgent.substring(0, 80)}
          </div>
          <p>Voici votre code de confirmation temporaire :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; font-family: monospace;">
              ${rawOtp}
            </span>
          </div>
          <p style="font-size: 12px; color: #6b7280;">Ce code expire dans 10 minutes. Ne le partagez avec personne.</p>
        </div>
      `,
    });

    return { success: true, challengeId: newChallenge.id };
  }

  /**
   * Vérifie le code Step-Up OTP soumis par l'utilisateur
   */
  static async verifySecurityChallenge(params: {
    merchantId: string;
    userId: string;
    userEmail: string;
    code: string;
    context: ClientLoginContext;
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();
    const cleanCode = params.code.trim();

    if (cleanCode.length !== 6) {
      return { success: false, error: "Le code doit comporter 6 chiffres." };
    }

    // 1. Récupérer le dernier challenge actif
    const { data: challenges } = await supabase
      .from('login_security_challenges')
      .select('*')
      .eq('merchant_id', params.merchantId)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const challenge = challenges?.[0];
    if (!challenge) {
      return { success: false, error: "Aucun défi de sécurité en attente ou le code a expiré." };
    }

    // 2. Vérification des tentatives (Rate Limiting : max 5 essais)
    if (challenge.attempts >= challenge.max_attempts) {
      return { success: false, error: "Nombre maximum de tentatives dépassé. Veuillez demander un nouveau code." };
    }

    // 3. Vérification de l'expiration temporelle
    if (new Date(challenge.expires_at) < new Date()) {
      return { success: false, error: "Le code de vérification a expiré. Veuillez en générer un nouveau." };
    }

    // 4. Calcul du hash attendu
    const expectedHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`otp:${params.merchantId}:${cleanCode}`, 'utf8')
      .digest('hex');

    const isValid = challenge.challenge_hash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(challenge.challenge_hash), Buffer.from(expectedHash));

    if (!isValid) {
      // Incrémenter le compteur de tentatives échouées
      await supabase
        .from('login_security_challenges')
        .update({ attempts: challenge.attempts + 1 })
        .eq('id', challenge.id);

      const remaining = challenge.max_attempts - (challenge.attempts + 1);
      return {
        success: false,
        error: remaining > 0
          ? `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`
          : "Nombre maximum de tentatives atteint. Veuillez demander un nouveau code.",
      };
    }

    // 5. Code Valide : Valider le challenge
    const now = new Date();
    await supabase
      .from('login_security_challenges')
      .update({ verified_at: now.toISOString() })
      .eq('id', challenge.id);

    // 6. Enregistrer le contexte dans trusted_login_contexts pour 90 jours
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('trusted_login_contexts').upsert({
      merchant_id: params.merchantId,
      user_id: params.userId,
      ip_hash: params.context.ipHash,
      ip_masked: params.context.ipMasked,
      device_fingerprint: params.context.deviceFingerprint,
      user_agent_hash: params.context.userAgentHash,
      country_code: params.context.countryCode,
      is_trusted: true,
      first_seen_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      verified_at: now.toISOString(),
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    }, { onConflict: 'merchant_id,ip_hash,device_fingerprint' });

    // 7. Envoyer un email d'alerte sécurité confirmant la nouvelle connexion
    try {
      await sendEmail({
        to: params.userEmail,
        subject: "Nouvelle connexion autorisée — Kobara",
        text: `Bonjour,\n\nUne nouvelle connexion à votre compte Kobara a été validée avec succès depuis l'environnement suivant :\n- Réseau : ${params.context.ipMasked} (${params.context.countryCode})\n- Appareil : ${params.context.userAgent.substring(0, 80)}\n\nSi vous êtes à l'origine de cette action, aucune démarche n'est requise. Dans le cas contraire, sécurisez immédiatement votre compte et contactez le support.\n\nCordialement,\nL'équipe Kobara`,
      });
    } catch (mailErr) {
      console.error('[LoginSecurity] Confirmation email error:', mailErr);
    }

    return { success: true };
  }
}
