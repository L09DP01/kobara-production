import 'server-only';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';

/**
 * Charge dynamiquement la documentation Kobara et la spécification OpenAPI en temps réel
 */
function getLiveDocsContext(): string {
  try {
    const docsDir = path.join(process.cwd(), 'src/content/docs');
    let context = '=== DOCUMENTATION OFFICIELLE KOBARA (TEMPS RÉEL) ===\n\n';

    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const slug = file.replace('.md', '');
        const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
        context += `[DOCUMENTATION: ${file} | URL: https://docs.kobara.app/docs/${slug}]\n${content}\n\n`;
      }
    }

    const openapiPath = path.join(process.cwd(), 'public/openapi.json');
    if (fs.existsSync(openapiPath)) {
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      context += `=== CONTRAT OPENAPI V1 (SOURCE DE VÉRITÉ STRICTE) ===\n${openapiContent}\n\n`;
    }

    return context;
  } catch (error) {
    console.error('[TelegramAiAssistant] Error loading live docs context:', error);
    return 'Documentation Kobara en cours de mise à jour.';
  }
}

const SYSTEM_PROMPT_TEMPLATE = `
Tu es l'Expert Technique et Assistant IA Officiel de Kobara (Kobara.app).
Ton rôle est d'assister les marchands, CTOs et développeurs avec une précision absolue sur l'intégration de la passerelle de paiement Kobara (MonCash, NatCash, Liens de Paiement, Retraits, Webhooks).

--- RÈGLES FONDAMENTALES ---
1. SOURCE DE VÉRITÉ EN TEMPS RÉEL :
Tu as accès à l'intégralité de la documentation et de la spécification OpenAPI v1 de Kobara ci-dessous. Toutes tes réponses techniques doivent être STRICTEMENT conformes à ces fichiers. N'invente JAMAIS de faux endpoints ou de mauvais noms de champs.

2. EXPLICATIONS D'INTÉGRATION CLAIRES & CODE EXEMPLES :
- Quand un développeur demande comment intégrer Kobara, donne une explication étape par étape :
  Étape 1 : Obtenir les clés API (Mode Test 'kbr_test_...' ou Mode Live 'kbr_live_...') depuis le Dashboard (/dashboard/developers).
  Étape 2 : Créer un paiement via POST https://api.kobara.app/v1/payments (ou un lien de paiement via POST https://api.kobara.app/v1/payment-links).
  Étape 3 : Rediriger l'utilisateur vers checkout_url ou traiter l'USSD MonCash/NatCash.
  Étape 4 : Configurer le webhook et vérifier la signature HMAC-SHA256 (Header: 'X-Kobara-Signature').
- Fournis des exemples de code propres et prêts à l'emploi (cURL, Node.js / TypeScript, PHP, Python, ou plugin WooCommerce) selon le langage demandé.

3. LIENS DE RÉFÉRENCE DE LA DOCUMENTATION :
À la fin de tes réponses techniques, inclus TOUJOURS les liens exacts vers la documentation Kobara correspondante :
- Quickstart : https://docs.kobara.app/docs/quickstart
- Créer des paiements : https://docs.kobara.app/docs/payments
- Liens de paiement : https://docs.kobara.app/docs/payment-links
- Webhooks & Sécurité : https://docs.kobara.app/docs/webhooks
- Module WooCommerce / WordPress : https://docs.kobara.app/docs/wordpress-plugin
- SDK Node.js : https://docs.kobara.app/docs/nodejs-sdk
- SDK PHP : https://docs.kobara.app/docs/php-sdk
- SDK Python : https://docs.kobara.app/docs/python-sdk
- Clés API : https://docs.kobara.app/docs/api-keys
- Retraits : https://docs.kobara.app/docs/withdrawals
- Gestion des erreurs : https://docs.kobara.app/docs/errors

4. LANGUES & TON :
- Réponds avec clarté, pédagogie et professionnalisme en Français (ou en Créole Haïtien si l'utilisateur s'exprime en créole).
- Si le marchand a un problème complexe non résolu, suggère le support WhatsApp : +509 4003 5664 (https://wa.me/50940035664).

5. SÉCURITÉ :
- Ne jamais inventer ou exposer de clés privées réelles (utilise des placeholders comme 'kbr_live_votre_cle_secrete').
`.trim();

export class TelegramAiAssistant {
  /**
   * Génère une réponse intelligente basée sur la documentation temps réel et OpenAPI
   */
  static async answerMerchantQuery(userQuery: string, merchantName?: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return (
        "Bonjour ! Notre assistant IA technique est temporairement indisponible.\n\n" +
        "👉 Vous pouvez consulter la documentation officielle sur : https://docs.kobara.app/docs/quickstart\n" +
        "🟢 Ou contacter notre support technique sur WhatsApp : +509 4003 5664 (https://wa.me/50940035664)"
      );
    }

    try {
      const google = createGoogleGenerativeAI({ apiKey });
      const liveDocs = getLiveDocsContext();

      const fullSystemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\n${liveDocs}`;

      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        system: fullSystemPrompt,
        prompt: `Marchand / Développeur : ${merchantName || 'Partenaire Kobara'}\nQuestion : ${userQuery}`,
        temperature: 0.2,
      });

      return text.trim();
    } catch (error: any) {
      console.error('[TelegramAiAssistant] Gemini error:', error);
      return (
        "Désolé, une erreur est survenue lors de l'analyse de votre demande.\n\n" +
        "👉 Consultez directement la documentation en ligne : https://docs.kobara.app/docs/quickstart\n" +
        "🟢 Ou contactez notre support WhatsApp : +509 4003 5664 (https://wa.me/50940035664)"
      );
    }
  }
}
