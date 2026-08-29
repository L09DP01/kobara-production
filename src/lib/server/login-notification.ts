/**
 * Service d'envoi d'email de notification de connexion
 * 
 * Envoie un email au marchand à chaque connexion réussie avec :
 * - Nom de l'appareil (Desktop, Mobile, Tablette)
 * - Navigateur et version
 * - Système d'exploitation
 * - Lieu approximatif (via ipinfo.io)
 * - Heure de connexion
 * - Méthode d'authentification (mot de passe, passkey, SSO mobile)
 */

interface LoginNotificationParams {
  email: string;
  merchantName?: string;
  ip: string;
  userAgent: string;
  method: 'password' | 'passkey' | 'mobile-sso';
}

interface GeoInfo {
  city: string;
  region: string;
  country: string;
}

async function getGeoFromIP(ip: string): Promise<GeoInfo> {
  const defaultGeo: GeoInfo = { city: 'Inconnu', region: '', country: '' };
  
  // Skip for localhost/private IPs
  if (!ip || ip === 'anonymous' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { city: 'Local', region: '', country: 'Développement' };
  }

  const apiKey = process.env.IPINFO_API_KEY;
  if (!apiKey) {
    console.warn('[LOGIN NOTIFY] IPINFO_API_KEY not set, skipping geolocation');
    return defaultGeo;
  }

  try {
    const res = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`, {
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (!res.ok) {
      console.error(`[LOGIN NOTIFY] ipinfo.io returned ${res.status}`);
      return defaultGeo;
    }

    const data = await res.json();
    return {
      city: data.city || 'Inconnu',
      region: data.region || '',
      country: data.country || '',
    };
  } catch (error) {
    console.error('[LOGIN NOTIFY] Geolocation lookup failed:', error);
    return defaultGeo;
  }
}

function getMethodLabel(method: string): string {
  switch (method) {
    case 'passkey': return '🔐 Passkey (Biométrie)';
    case 'mobile-sso': return '📱 Application Mobile (SSO)';
    case 'password':
    default: return '🔑 Mot de passe';
  }
}

export async function sendLoginNotificationEmail(params: LoginNotificationParams): Promise<void> {
  const { email, merchantName, ip, userAgent, method } = params;

  try {
    // 1. Parse User-Agent
    const { parseUserAgent } = await import('@/lib/utils/parse-user-agent');
    const { browser, os, device } = parseUserAgent(userAgent);

    // 2. Get geolocation from IP
    const geo = await getGeoFromIP(ip);
    const locationStr = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');

    // 3. Format time
    const now = new Date();
    const timeStr = now.toLocaleString('fr-FR', {
      timeZone: 'America/Port-au-Prince',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 4. Build and send email
    const { sendEmail } = await import('@/lib/server/mail');

    const subject = '🔔 Nouvelle connexion à votre compte Kobara';
    const greeting = merchantName ? `Bonjour ${merchantName},` : 'Bonjour,';

    const text = `${greeting}

Une nouvelle connexion a été détectée sur votre compte Kobara.

📋 Détails de la connexion :
━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ Appareil    : ${device}
🌐 Navigateur  : ${browser}
💻 Système     : ${os}
📍 Lieu        : ${locationStr}
🕐 Heure       : ${timeStr}
🔑 Méthode     : ${getMethodLabel(method)}
🌐 Adresse IP  : ${ip}
━━━━━━━━━━━━━━━━━━━━━━━━━

Si cette connexion est légitime, aucune action n'est requise.

⚠️ Si vous ne reconnaissez pas cette activité, veuillez immédiatement :
1. Changer votre mot de passe
2. Révoquer vos clés API
3. Contacter notre support à support@kobara.app

Cordialement,
L'équipe Sécurité Kobara`;

    const html = buildLoginNotificationHTML({
      greeting,
      device,
      browser,
      os,
      location: locationStr,
      time: timeStr,
      method: getMethodLabel(method),
      ip,
    });

    await sendEmail({ to: email, subject, html, text });

    console.log(`[LOGIN NOTIFY] Email sent to ${email} (method: ${method}, ip: ${ip})`);
  } catch (error) {
    // Ne jamais bloquer la connexion à cause d'un échec d'email
    console.error('[LOGIN NOTIFY] Failed to send login notification email:', error);
  }
}

function buildLoginNotificationHTML(params: {
  greeting: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  time: string;
  method: string;
  ip: string;
}): string {
  const { greeting, device, browser, os, location, time, method, ip } = params;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nouvelle connexion détectée</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Card -->
    <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #E5E7EB;">
      
      <!-- Header -->
      <div style="background-color: #FFFBEB; padding: 32px 40px; text-align: center; border-bottom: 1px solid #E5E7EB;">
        <h1 style="color: #E53E3E; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Kobara</h1>
      </div>

      <!-- Body -->
      <div style="padding: 40px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 24px;">🔔 Nouvelle connexion détectée</h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">${greeting}</p>
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 28px;">
          Une nouvelle connexion a été détectée sur votre compte Kobara. Voici les détails :
        </p>

        <!-- Details Card -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; width: 130px; vertical-align: top;">🖥️ Appareil</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500;">${device}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">🌐 Navigateur</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #E5E7EB;">${browser}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">💻 Système</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #E5E7EB;">${os}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">📍 Lieu</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #E5E7EB;">${location}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">🕐 Heure</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #E5E7EB;">${time}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">🔑 Méthode</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; border-top: 1px solid #E5E7EB;">${method}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 600; vertical-align: top; border-top: 1px solid #E5E7EB;">🌐 Adresse IP</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500; font-family: 'Courier New', monospace; border-top: 1px solid #E5E7EB;">${ip}</td>
            </tr>
          </table>
        </div>

        <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
          Si cette connexion est légitime, aucune action n'est requise.
        </p>

        <!-- Warning -->
        <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 18px; margin-top: 24px;">
          <p style="color: #DC2626; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">⚠️ Activité non reconnue ?</p>
          <p style="color: #7F1D1D; font-size: 13px; line-height: 1.5; margin: 0;">
            Si vous ne reconnaissez pas cette connexion, changez immédiatement votre mot de passe, révoquez vos clés API et contactez notre support à <a href="mailto:support@kobara.app" style="color: #DC2626;">support@kobara.app</a>.
          </p>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">© ${new Date().getFullYear()} Kobara App. Tous droits réservés.</p>
      <p style="color: #9CA3AF; font-size: 14px; margin: 8px 0 0 0;">Infrastructure de paiement pour Haïti.</p>
    </div>
  </div>
</body>
</html>
  `;
}
