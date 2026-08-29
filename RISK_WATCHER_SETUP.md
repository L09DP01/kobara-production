# Kobara Risk Watcher & AI CGU Engine

## Vue d'ensemble
Le système "Risk Watcher" de Kobara est une solution de monitoring des transactions et des comportements des marchands. Il a pour but de protéger la plateforme contre le blanchiment d'argent, la fraude et les abus.

## Composants Principaux
1. **Moteur Système (Hardcoded)** : Détecte les anomalies techniques (abus d'API, pics de volume, tentatives de connexion répétées).
2. **Moteur IA (Gemini)** : Analyse les Conditions Générales d'Utilisation (CGU) et génère des règles de détection automatiquement pour s'assurer que le code respecte les termes légaux mis à jour.
3. **Tableau de Bord Admin** : Permet à l'équipe Compliance d'intervenir en cas d'alertes et de valider les règles suggérées par l'IA.

## Guide de Déploiement

### 1. Variables d'environnement
Ajoutez ou mettez à jour ces variables dans votre fichier `.env` et sur Vercel :

```env
# Authentification et Base de données
NEXTAUTH_SECRET="générer-avec-openssl-rand-base64-32"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."

# Configuration Risk & IA
CRON_SECRET="secret-pour-proteger-la-route-cron"
GOOGLE_GENERATIVE_AI_API_KEY="votre_cle_api_google_gemini"

# Configuration Redis (Upstash) - Optionnel mais recommandé pour les compteurs
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Notifications
SLACK_WEBHOOK_URL=""
DISCORD_WEBHOOK_URL=""
RESEND_API_KEY=""
COMPLIANCE_EMAIL="compliance@kobara.ht"
```

### 2. Base de données
Vérifiez que toutes les migrations situées dans `/supabase/migrations` ont bien été appliquées. Elles créent :
- Les tables pour le monitoring (`merchant_risk_scores`, `risk_alerts`, etc.)
- Les tables pour l'IA (`legal_documents`, `ai_derived_rules`)
- Les politiques RLS sécurisées

### 3. Tâche planifiée (Cron)
Pour analyser les marchands en arrière-plan régulièrement, configurez un Vercel Cron (`vercel.json`) pointant vers :
`POST https://api.kobara.app/risk-watcher/run`
*(Ou `https://votre-domaine.com/api/risk-watcher/run` selon votre configuration réseau).*
N'oubliez pas l'en-tête `Authorization: Bearer VOTRE_CRON_SECRET`.

### 4. Interface d'Administration
L'accès se fait via `/admin/login`.
Assurez-vous que l'utilisateur test possède bien le champ `role` défini à `admin`, `compliance` ou `super_admin` dans la table `users`. L'authentification utilise NextAuth v5 (Auth.js).

## Cycle de vie d'une règle IA
1. L'équipe Légal met à jour les CGU.
2. Un administrateur va dans **Moteur CGU (IA)** et uploade le nouveau texte.
3. Gemini analyse le document et extrait les obligations du marchand (ex: "Interdiction de vendre des cryptomonnaies").
4. L'IA crée des règles d'alerte en attente de validation (statut `pending_review`).
5. L'équipe Compliance valide les règles. Celles-ci deviennent actives (`active`) et sont intégrées au score de risque global des marchands.
