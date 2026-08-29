/**
 * Configuration centralisée pour WebAuthn / Passkeys dans Kobara.
 * 
 * Assure la cohérence de l'RPID (kobara.app) et de la liste des origines autorisées
 * (kobara.app, dashboard.kobara.app, localhost, etc.) sur toutes les routes API Passkey.
 */

export function getWebAuthnConfig(req?: Request) {
  let rpID = 'localhost';
  
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      rpID = new URL(process.env.NEXT_PUBLIC_APP_URL).hostname;
    } catch (e) {
      rpID = 'localhost';
    }
  }

  // Si on est sur localhost/dev, utiliser 'localhost'
  if (req) {
    const host = req.headers.get('host')?.split(':')[0];
    if (host === 'localhost' || host === '127.0.0.1') {
      rpID = 'localhost';
    }
  }

  // Liste des origines autorisées pour SimpleWebAuthn verification
  const expectedOriginSet = new Set<string>([
    'https://kobara.app',
    'https://dashboard.kobara.app',
    'https://pay.kobara.app',
    'http://localhost:3000',
    'http://dashboard.localhost:3000',
    'http://kobara.local:3000',
    'http://dashboard.kobara.local:3000',
  ]);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    expectedOriginSet.add(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.NEXT_PUBLIC_DASHBOARD_URL) {
    expectedOriginSet.add(process.env.NEXT_PUBLIC_DASHBOARD_URL);
  }

  // Ajouter l'origine de la requête entrante si présente
  if (req) {
    const reqOrigin = req.headers.get('origin') || req.headers.get('referer');
    if (reqOrigin) {
      try {
        const originUrl = new URL(reqOrigin).origin;
        expectedOriginSet.add(originUrl);
      } catch (e) {
        // Ignorer les URLs invalides
      }
    }
  }

  return {
    rpID,
    rpName: 'Kobara',
    expectedOrigin: Array.from(expectedOriginSet),
  };
}
