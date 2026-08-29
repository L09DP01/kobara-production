# Kobara.app — Infrastructure SaaS Fintech pour Haïti 🇭🇹

Kobara est une plateforme de paiement moderne conçue pour permettre aux entrepreneurs, développeurs et entreprises en Haïti d'accepter des paiements **MonCash** via une API robuste, des liens de paiement et des intégrations prêtes à l'emploi.

## 🚀 Vision du Produit

Kobara fonctionne comme un "Stripe pour Haïti", offrant une expérience développeur premium et une interface intuitive pour gérer les transactions financières en temps réel.

### Fonctionnalités Clés
- **Paiements API** : Intégration directe via des requêtes sécurisées.
- **Liens de Paiement** : Créez des liens partageables pour vos clients (WhatsApp, Social Media).
- **Dashboard Marchand** : Suivi des transactions, revenus, frais et retraits.
- **Sécurité Avancée** : Clés API hachées (SHA-256) avec préfixe `kbr_sk_`.
- **Système de Webhooks** : Notifications en temps réel des succès de paiement.
- **Frais Transparents** : Commission fixe de 2.9% par transaction.

---

## 🛠 Stack Technique

- **Frontend** : Next.js 15+ (App Router), TypeScript, Tailwind CSS 4, Framer Motion.
- **Backend** : Server Actions & API Routes (Next.js), Supabase (Auth & PostgreSQL).
- **Sécurité** : Row Level Security (RLS), Hachage SHA-256 pour les credentials.
- **Passerelle** : Intégration via Bazik API pour le traitement MonCash.

---

## 📦 Écosystème Kobara

Le projet est composé de plusieurs sous-systèmes :

1. **[Kobara App](./)** (Ce dépôt) : Le cœur de la plateforme (Dashboard, API, Onboarding).
2. **[Kobara SDK JS](./kobara-js)** : Bibliothèque cliente pour intégrer Kobara dans des applications JavaScript/TypeScript.
3. **[WordPress Plugin](./wordpress-plugin/kobara-wordpress-plugin)** : Extension WooCommerce pour accepter MonCash en quelques clics.

---

## 🔑 Sécurité des Clés API

Kobara utilise une stratégie de sécurité "Default-Deny" :
- Les clés sont identifiées par le préfixe `kbr_sk_test_` ou `kbr_sk_live_`.
- **Aucune clé n'est stockée en clair** dans la base de données. Seuls les hashs SHA-256 sont conservés.
- L'authentification se fait via le header `Authorization: Bearer kbr_sk_...`.

---

## 🚀 Installation & Développement

### 1. Prérequis
- Node.js 20+
- Un projet Supabase configuré (voir les migrations dans `/supabase/migrations`).

### 2. Configuration
Copiez le fichier `.env.example` en `.env.local` et remplissez les variables :
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
BAZIK_API_KEY=...
BAZIK_WEBHOOK_SECRET=...
```

### 3. Lancement
```bash
npm install
npm run dev
```

---

## 📖 API & Documentation

La documentation complète est disponible directement dans le dashboard sous l'onglet `/docs`.

### Exemple de création de paiement (cURL) :
```bash
curl -X POST https://kobara.app/api/v1/payments \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "HTG",
    "description": "Achat Test",
    "successUrl": "https://votresite.com/success"
  }'
```

---

## 📝 Licence
Propriété de Kobara.app. Tous droits réservés.
