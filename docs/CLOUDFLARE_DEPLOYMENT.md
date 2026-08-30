# Deployer Kobara Production sur Cloudflare Workers

Kobara Production utilise Next.js 16 avec des Server Actions, des Route Handlers, du rendu serveur et un middleware. Le deploiement cible donc Cloudflare Workers via OpenNext, et non un export statique Cloudflare Pages.

## 1. Preparer Cloudflare

1. Ajouter `kobara.app` a Cloudflare et verifier que la zone DNS est active.
2. Dans **Workers & Pages**, creer une application Workers connectee au depot GitHub `L09DP01/kobara-production`.
3. Selectionner la branche de production `main`.
4. Utiliser Node.js 20.9 ou plus recent.
5. Activer R2 puis creer le bucket `kobara-production-opennext-cache`. Il conserve le cache Next.js et les invalidations `revalidatePath` entre les instances.
6. Activer Image Transformations pour le binding `IMAGES` utilise par `next/image`.
7. Activer un plan Workers qui accepte un script compresse d'au moins 8 MiB. Le dernier dry-run produit environ 6,7 MiB compresses et depasse la limite du plan gratuit.
8. Configurer la commande de build :

   ```bash
   npm ci && npm run cf:build
   ```

9. Configurer la commande de deploiement :

   ```bash
   npx opennextjs-cloudflare deploy -- --keep-vars
   ```

Le fichier `wrangler.jsonc` attache le meme Worker aux domaines :

- `kobara.app`
- `www.kobara.app`
- `dashboard.kobara.app`
- `api.kobara.app`
- `pay.kobara.app`
- `docs.kobara.app`

Cloudflare demandera la confirmation des domaines personnalises lors du premier deploiement. Les enregistrements DNS concurrents doivent etre retires uniquement au moment de la bascule.

## 2. Variables d'environnement

Le fichier `.env.example` est la liste de reference. Ne jamais televerser un fichier `.env` dans GitHub.

Dans **Workers & Pages > kobara-production > Settings > Variables and Secrets** :

- ajouter les valeurs `NEXT_PUBLIC_*` comme variables de build et variables d'execution ;
- ajouter les identifiants non sensibles comme variables d'execution ;
- ajouter les cles, jetons et secrets avec le type **Secret** ;
- ne pas definir `NODE_ENV` manuellement ;
- utiliser les identifiants de production, jamais ceux du Sandbox.

Les variables `NEXT_PUBLIC_*` sont integrees au JavaScript pendant le build. Toute modification de leur valeur exige un nouveau deploiement.

### Variables indispensables au noyau

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DASHBOARD_URL`
- `NEXT_PUBLIC_KOBARA_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`
- `KYC_IDENTITY_FINGERPRINT_SECRET`
- `CRON_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Les groupes PayPal, Didit, Resend, Paym, Bazik, SMS et Telegram sont obligatoires uniquement lorsque le service correspondant est active. `DATABASE_URL` et `SUPABASE_URL` servent aux scripts de migration et ne sont pas necessaires dans le Worker.

## 3. Taches planifiees

Le fichier `vercel.json` n'est pas execute par Cloudflare. Configurer un moniteur planifie authentifie qui appelle :

- `POST https://api.kobara.app/api/cron/expire-payments` chaque jour a `00:00 UTC` ;
- `POST https://api.kobara.app/api/cron/subscriptions` chaque jour a `08:00 UTC` ;
- `POST https://api.kobara.app/api/cron/kyc-reminders` chaque jour a `14:00 UTC`.

Chaque appel doit envoyer :

```text
Authorization: Bearer <CRON_SECRET>
```

La synchronisation des soldes marchands reste geree par la tache Supabase `sync-merchant-balances` deja autorisee. Ne pas creer une deuxieme execution Cloudflare pour cette synchronisation.

## 4. Migration et bascule sans interruption

1. Executer les migrations Supabase requises avant la bascule, notamment `20260830193436_hold_local_payment_funds_24h.sql`.
2. Deployer d'abord le Worker sur son URL `workers.dev`.
3. Tester l'accueil, l'authentification, le dashboard, un paiement local, PayPal si active, un webhook et un retrait.
4. Verifier les journaux Workers et les journaux Supabase.
5. Ajouter les domaines personnalises au Worker.
6. Retirer les anciens enregistrements DNS conflictuels seulement apres validation.
7. Conserver l'ancien hebergement disponible pendant la periode de verification afin de permettre un retour DNS rapide.

## 5. Commandes locales

```bash
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

`npm run cf:deploy` exige une session Wrangler authentifiee ou les variables CI `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`. Ces deux valeurs appartiennent au pipeline de deploiement et ne doivent pas etre ajoutees aux secrets applicatifs du Worker.
