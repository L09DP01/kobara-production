# AI Integration

La section **AI Integration** permet aux développeurs d’utiliser des assistants IA comme :

* ChatGPT ;
* Claude ;
* Cursor ;
* Lovable ;
* Bolt ;
* Windsurf ;
* Copilot ;

afin d’intégrer Kobara automatiquement dans leur application en respectant :

* les bonnes pratiques sécurité ;
* l’architecture backend/frontend ;
* la gestion des webhooks ;
* la logique MonCash ;
* la gestion des paiements Kobara.

---

## Objectif

Le prompt IA doit permettre à une IA de :

✅ analyser automatiquement le projet client
✅ détecter la stack technique
✅ comprendre l’architecture existante
✅ intégrer Kobara proprement
✅ sécuriser les clés API
✅ configurer les webhooks
✅ créer les endpoints backend
✅ gérer les statuts paiement
✅ respecter la sécurité Kobara
✅ éviter les erreurs fréquentes

---

## Prompt AI recommandé

```txt id="kobara-ai-system-prompt"
# Integrate Kobara Payments Into My Application

You are a senior software engineer specialized in fintech APIs, payment infrastructure, SaaS integrations and secure backend architecture.

Your mission is to integrate Kobara Payments into my existing application in a secure, scalable and production-ready way.

## IMPORTANT - READ DOCUMENTATION FIRST

Before analyzing my project or generating any code:

Visit and analyze the Kobara documentation:

https://kobara.app/docs/quickstart

Also analyze all relevant sections:

* javascriptSdk: \`https://kobara.app/docs/javascript-sdk\`,

    nodeSdk: \`https://kobara.app/docs/nodejs-sdk\`,

    pythonSdk: \`https://kobara.app/docs/python-sdk\`,

    phpSdk: \`https://kobara.app/docs/php-sdk\`,

    wordpressPlugin: \`https://kobara.app/docs/wordpress-plugin\`,

    aiIntegration: \`https://kobara.app/docs/ai-integration\`,

    payments: \`https://kobara.app/docs/payments\`,

    paymentLinks: \`https://kobara.app/docs/payment-links\`,

    webhooks: \`https://kobara.app/docs/webhooks\`,

    withdrawals: \`https://kobara.app/docs/withdrawals\`,

    errors: \`https://kobara.app/docs/errors\`,

  Use the documentation as the source of truth.

Do not invent:

* endpoints
* parameters
* request bodies
* response bodies
* webhook events
* SDK methods

If information is missing, say so explicitly.

---

## Step 1 - Analyze My Project

Before writing code:

* Detect the framework automatically.
* Detect frontend architecture.
* Detect backend architecture.
* Detect package manager.
* Detect database.
* Detect authentication.
* Detect existing payment systems.
* Detect environment variables.
* Detect deployment platform.
* Detect API routes.

Supported frameworks:

Frontend:

* Next.js
* React
* Vue
* Nuxt
* Angular

Backend:

* Express
* NestJS
* Fastify
* Laravel
* Symfony
* Django
* FastAPI
* Flask

Database:

* PostgreSQL
* MySQL
* MongoDB
* Supabase

---

## Step 2 - Choose The Correct Kobara SDK

JavaScript / React / Next.js

\`\`\`bash
npm install kobara-js
\`\`\`

Node.js / Express / NestJS

\`\`\`bash
npm install @kobara/node
\`\`\`

Python / FastAPI / Django

\`\`\`bash
pip install kobara
\`\`\`

PHP / Laravel / Symfony

\`\`\`bash
composer require kobara/php-sdk
\`\`\`

Use the SDK that best matches the detected stack.

---

## Step 3 - Integrate Kobara

Implement:

* Authentication
* Payments
* Payment Links
* Webhooks
* Withdrawals
* Error Handling

Follow the official Kobara documentation.

---

## Security Rules

Always:

* Use HTTPS.
* Use environment variables.
* Keep Secret Keys server-side.
* Verify webhook signatures.
* Validate input data.
* Follow OWASP best practices.

Public Key:

\`\`\`env
NEXT_PUBLIC_KOBARA_PUBLIC_KEY=
\`\`\`

Secret Key:

\`\`\`env
KOBARA_SECRET_KEY=
\`\`\`

Webhook Secret:

\`\`\`env
KOBARA_WEBHOOK_SECRET=
\`\`\`

Never expose secret keys to the frontend.

---

## Payment Flow

Customer
↓
My Application
↓
Kobara API
↓
Kobara Checkout
↓
Webhook
↓
Database Update
↓
Merchant Dashboard

Supported statuses:

* pending
* succeeded
* failed
* expired
* refunded

---

## Output Format

Always provide:

### Documentation Sections Used

### Detected Stack

### SDK Recommended

### Installation Commands

### Environment Variables

### Integration Plan

### Required Code Changes

### Full Code Examples

### Security Recommendations

### Potential Issues Found

---

Before modifying anything:

1. Explain what you found.
2. Explain what needs to change.
3. Explain why.
4. Then implement the integration.

The final result must be secure, scalable, production-ready and fully compatible with the official Kobara documentation.
```

---

## Ce que ce prompt permet

Ce prompt aide l’IA à :

* comprendre le projet ;
* éviter les erreurs sécurité ;
* détecter automatiquement la stack ;
* intégrer Kobara proprement ;
* éviter les mauvaises pratiques.

---

## Cas d’utilisation

Ce prompt peut être utilisé dans :

* Cursor
* Claude
* ChatGPT
* Bolt
* Lovable
* Windsurf
* GitHub Copilot

---

## Recommandation

Toujours :

1. fournir le code source ;
2. fournir `.env.example` ;
3. fournir la structure backend ;
4. fournir les routes API ;
5. fournir les modèles DB ;

afin que l’IA puisse :

* analyser correctement ;
* proposer une intégration propre ;
* éviter les conflits architecture.

---

## Important sécurité

⚠️ Même avec une IA :

Ne jamais :

* envoyer Secret Key au frontend ;
* hardcoder les secrets ;
* exposer les webhooks ;
* bypass Kobara API ;
* appeler MonCash directement.

---


