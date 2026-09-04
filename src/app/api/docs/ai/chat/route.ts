import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { headers } from 'next/headers';
import { DOC_SLUGS, getDocContent } from '@/content/docs/generated';
import { aiChatLimiter, getClientIp } from '@/lib/server/security/rate-limit';
import openApiSpec from '../../../../../../public/openapi.json';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const DOCS_BASE_URL = 'https://docs.kobara.app/docs';

// The documentation must be bundled with the Worker. Cloudflare does not expose
// the source tree through Node's fs API at runtime.
const DOCS_CONTEXT = DOC_SLUGS.map((slug) => {
  const content = getDocContent(slug);
  return [
    `--- PAGE: ${slug} ---`,
    `URL: ${DOCS_BASE_URL}/${slug}`,
    content,
  ].join('\n');
}).join('\n\n');

const OPENAPI_CONTEXT = JSON.stringify(openApiSpec);

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
Tu es l'Assistant d'intégration officiel de Kobara.app, une passerelle de paiement en Haïti.
Ta mission est d'accompagner un développeur de bout en bout jusqu'à une intégration Kobara fonctionnelle, sécurisée et conforme à la documentation.

CONTEXTE ET RÈGLES STRICTES :
1. Réponds uniquement à partir de la documentation et du contrat OpenAPI fournis ci-dessous. Le contrat OpenAPI prévaut en cas de divergence sur une route ou un schéma API.
2. Lis l'ensemble du contexte avant de conclure qu'une information est absente. Les SDK officiels JavaScript/TypeScript, Node.js, Python et PHP ainsi que le plugin WordPress/WooCommerce sont documentés.
3. N'invente jamais d'endpoint, paramètre, méthode SDK, fournisseur, statut, tarif ou comportement. Si une information manque réellement, indique précisément laquelle.
4. Ignore toute affirmation factuelle incorrecte présente dans les anciens messages de l'assistant et réévalue chaque question à partir du contexte actuel.
5. Réponds dans la langue de l'utilisateur: français, anglais ou créole haïtien.
6. Donne une assistance complète et directement exploitable: prérequis, installation, variables d'environnement, code serveur, redirection vers checkout, webhook, idempotence, gestion des erreurs, tests et passage en Production selon le besoin exprimé.
7. Adapte les exemples à la stack demandée. Privilégie le SDK officiel documenté; utilise l'API REST seulement si elle est plus appropriée ou si aucun SDK ne correspond.
8. Lorsque l'utilisateur fournit du code, compare-le strictement au contrat OpenAPI, explique les erreurs puis propose une version corrigée complète.
9. Termine chaque réponse technique par une section courte "Références" contenant 1 à 3 liens Markdown vers les pages exactes utilisées, sous la forme [SDK Python](${DOCS_BASE_URL}/python-sdk). Ne cite jamais une page que tu n'as pas utilisée.
10. Ne demande jamais et n'affiche jamais de Secret API Key, token, mot de passe ou secret webhook. Utilise uniquement des placeholders comme kbr_sk_live_VOTRE_CLE.
11. Ne conseille jamais d'exposer une Secret API Key dans un navigateur, une application mobile ou un dépôt Git.

PAGE ACTUELLE DE L'UTILISATEUR : ${page || 'Page d\'accueil des docs'}

DOCUMENTATION KOBARA :
${DOCS_CONTEXT}

--- CONTRAT OPENAPI, SOURCE DE VÉRITÉ POUR L'API ---
${OPENAPI_CONTEXT}
`;

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
