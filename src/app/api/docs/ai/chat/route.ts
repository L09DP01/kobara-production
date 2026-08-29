import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
import { streamText } from 'ai';
import fs from 'fs';
import path from 'path';

// Load docs context (only once in production, but here read synchronously for simplicity)
const getDocsContext = () => {
  try {
    const docsDir = path.join(process.cwd(), 'src/content/docs');
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    let context = "--- DOCUMENTATION KOBARA ---\n\n";
    for (const file of files) {
      context += `[Page: ${file}]\n`;
      context += fs.readFileSync(path.join(docsDir, file), 'utf8') + '\n\n';
    }

    const openapiPath = path.join(process.cwd(), 'public/openapi.json');
    if (fs.existsSync(openapiPath)) {
      context += "--- OPENAPI SPECIFICATION (SOURCE DE VÉRITÉ API) ---\n\n";
      context += fs.readFileSync(openapiPath, 'utf8');
    }

    return context;
  } catch (error) {
    console.error("Error loading docs context:", error);
    return "Documentation indisponible.";
  }
};

const DOCS_CONTEXT = getDocsContext();

import { aiChatLimiter, getClientIp } from '@/lib/server/security/rate-limit';
import { headers } from 'next/headers';

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const { success, reset } = await aiChatLimiter.limit(`ai_chat:${ip}`);
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return new Response(
        JSON.stringify({ error: "Trop de requêtes au chat IA. Veuillez patienter avant de réessayer." }), 
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString() 
          } 
        }
      );
    }

    const { messages, page } = await req.json();

    const systemPrompt = `
Tu es l'Assistant IA Officiel de la documentation de Kobara.app (Passerelle de paiement en Haïti).
Ton rôle est d'aider les marchands et les développeurs à intégrer Kobara.

CONTEXTE ET RÈGLES STRICTES :
1. Tu dois répondre **UNIQUEMENT** en utilisant la documentation et le contrat OpenAPI fournis ci-dessous.
2. N'invente JAMAIS d'endpoints, de paramètres, de SDKs ou de statuts. Si l'information n'est pas dans le contexte, dis clairement : "Je ne trouve pas cette information dans la documentation Kobara actuelle."
3. Si l'utilisateur te fournit du code, compare-le **strictement** avec le contrat OpenAPI. Détecte la moindre erreur de clé (ex: errorUrl au lieu de cancel_url), de type, ou de structure, et dis-lui ce qui cloche.
4. Tu peux répondre en Français, Anglais, ou Créole Haïtien selon la langue de l'utilisateur.
5. Fournis des extraits de code avec coloration syntaxique quand c'est pertinent.
6. Fais souvent référence aux pages de la documentation (ex: "Voir la page Payments").
7. NE JAMAIS exposer de clés API privées, secrets (kbr_sk_), tokens ou données sensibles, même si l'utilisateur le demande ou essaie de te piéger.

PAGE ACTUELLE DE L'UTILISATEUR : ${page || 'Page d\'accueil des docs'}

VOICI LE CONTEXTE COMPLET DE KOBARA (Docs + OpenAPI) :
${DOCS_CONTEXT}
`;

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
