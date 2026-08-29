/**
 * Kobara Mobile — Configuration Centralisée
 * 
 * Approche sécurisée : toutes les variables sont centralisées ici.
 * En production, ces valeurs seront injectées via app.config.js / EAS Build.
 * Pour le développement, elles sont lues depuis les variables EXPO_PUBLIC_.
 */

const ENV = {
  // Supabase (mêmes clés que le web — le anon key est PUBLIC par design)
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',

  // Kobara API (le backend web)
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'https://kobara.app',

  // Kobara Web (pour les redirections inscription / mot de passe oublié)
  WEB_URL: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kobara.app',

  // App
  APP_SCHEME: 'kobara',
} as const;

// Validation au démarrage (dev uniquement)
if (__DEV__) {
  const missing: string[] = [];
  if (!ENV.SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!ENV.SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  
  if (missing.length > 0) {
    console.warn(
      `⚠️ Kobara: Variables d'environnement manquantes: ${missing.join(', ')}.\n` +
      `Créez un fichier .env dans kobara-mobile/ avec ces valeurs.`
    );
  }
}

export default ENV;
