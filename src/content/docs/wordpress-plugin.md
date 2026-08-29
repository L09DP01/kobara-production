# WordPress Plugin

Le plugin officiel Kobara WordPress permet d’accepter facilement les paiements MonCash sur votre boutique WooCommerce sans écrire de code.

Le plugin transforme votre site WordPress en plateforme de paiement moderne connectée à :

* Kobara ;
* MonCash ;
* votre dashboard Kobara ;
* vos webhooks ;
* vos analytics.

---

## Fonctionnalités principales

Le plugin permet :

✅ Paiements MonCash WooCommerce
✅ Checkout sécurisé Kobara
✅ Mode Test & Live
✅ Synchronisation automatique des paiements
✅ Notifications temps réel
✅ Support Webhooks
✅ Historique des transactions
✅ Gestion automatique des commandes
✅ Compatible mobile
✅ Compatible WooCommerce moderne

---

## Compatibilité

| Système      | Support |
| ------------ | ------- |
| WordPress 6+ | ✅       |
| WooCommerce  | ✅       |
| PHP 8+       | ✅       |
| Elementor    | ✅       |
| Astra Theme  | ✅       |
| Flatsome     | ✅       |

---

## Installation

Téléchargez le plugin officiel :

```txt id="u2z9rf"
kobara-woocommerce-gateway.zip
```

---

## Étape 1 — Télécharger le plugin

Dans votre dashboard Kobara :

```txt id="m8d4vx"
Developers → Integrations → WordPress Plugin
```

Cliquez :

```txt id="7r0hka"
Download Plugin
```

---

## Étape 2 — Installer dans WordPress

Dans votre dashboard WordPress :

```txt id="7f4k2j"
Extensions → Ajouter
```

Puis :

```txt id="x3u9j0"
Téléverser une extension
```

Sélectionnez :

```txt id="5m1w4f"
kobara-woocommerce-gateway.zip
```

Cliquez :

```txt id="6g5v0m"
Installer maintenant
```

---

## Étape 3 — Activer le plugin

Après installation :

```txt id="t2r9v6"
Activer l’extension
```

---

## Étape 4 — Activer Kobara dans WooCommerce

Dans WordPress :

```txt id="8q2n7p"
WooCommerce → Réglages → Paiements
```

Activez :

```txt id="0m5h3u"
Kobara WooCommerce Gateway
```

---

## Étape 5 — Ajouter vos clés API

Dans les paramètres Kobara WooCommerce :

### Clé publique

```txt id="3r8n2x"
kbr_pk_live_xxxxx
```

---

## Clé secrète

```txt id="v8y5q1"
kbr_sk_live_VOTRE_CLE_API
```

---

## Étape 6 — Configurer le mode

Le plugin supporte :

| Mode | Description     |
| ---- | --------------- |
| Test | Développement   |
| Live | Paiements réels |

---

## Test Mode

Utiliser :

```txt id="q5x1v9"
kbr_pk_test_
kbr_sk_test_
```

---

## Live Mode

Utiliser :

```txt id="s0d6m2"
kbr_pk_live_
kbr_sk_live_
```

---

## Fonctionnement du paiement

### 1. Client clique “Payer”

Sur votre boutique WooCommerce.

---

### 2. WooCommerce appelle Kobara

Le plugin :

* sécurise les données ;
* crée le paiement Kobara ;
* contacte l’API Kobara.

---

### 3. Kobara communique avec MonCash

Kobara :

* prépare le checkout MonCash ;
* sécurise la transaction ;
* génère la session paiement.

---

### 4. Redirection MonCash

Le client est redirigé vers :

```txt id="4t6v3y"
checkout.kobara.app
```

---

### 5. Confirmation paiement

Après paiement :

* Kobara reçoit confirmation ;
* le webhook est déclenché ;
* WooCommerce met à jour la commande.

---

## Statuts WooCommerce

| Statut     | Description         |
| ---------- | ------------------- |
| Pending    | Paiement en attente |
| Processing | Paiement reçu       |
| Completed  | Paiement terminé    |
| Failed     | Paiement échoué     |
| Refunded   | Paiement remboursé  |

---

## Webhooks automatiques

Le plugin configure automatiquement :

* synchronisation paiements ;
* confirmation commandes ;
* mise à jour temps réel.

---

## URL Webhook WooCommerce

Exemple :

```txt id="3y5j7x"
https://votre-site.com/?wc-api=kobara_webhook
```

---

## Vérification signature

Le plugin vérifie automatiquement :

* la signature webhook ;
* la sécurité ;
* la validité des événements.

---

## Interface Checkout

Le plugin fournit :

* checkout mobile-first ;
* expérience MonCash moderne ;
* paiement rapide ;
* UX optimisée Haïti.

---

## Fonctionnalités avancées

### Support QR Code

Le plugin peut afficher :

* QR paiement ;
* liens rapides ;
* checkout mobile.

---

## Paiements mobiles

Compatible :

* Android ;
* iPhone ;
* navigateur mobile ;
* application MonCash.

---

## Notifications automatiques

Le plugin peut :

* envoyer email confirmation ;
* mettre à jour commande ;
* notifier admin ;
* synchroniser dashboard Kobara.

---

## Dashboard Kobara

Toutes les transactions apparaissent automatiquement dans :

```txt id="9h7q0f"
Dashboard → Payments
```

---

## Données synchronisées

| Donnée    | Synchronisée |
| --------- | ------------ |
| Paiements | ✅            |
| Clients   | ✅            |
| Commandes | ✅            |
| Montants  | ✅            |
| Status    | ✅            |
| Retraits  | ✅            |

---

## Sécurité

Le plugin :

* utilise HTTPS ;
* chiffre les requêtes ;
* utilise les webhooks signés ;
* protège les clés API.

---

## Important sécurité

⚠️ Vos Secret Keys restent uniquement sur votre serveur WordPress.

Elles ne sont jamais :

* envoyées au navigateur ;
* exposées au client ;
* visibles publiquement.

---

## Architecture sécurisée

```txt id="8v0n5f"
Client
↓
WooCommerce
↓
Plugin Kobara
↓
API Kobara
↓
MonCash Infrastructure
↓
MonCash
```

---

## Gestion des erreurs

Le plugin gère automatiquement :

* paiements échoués ;
* timeout ;
* erreurs réseau ;
* annulations utilisateur.

---

## Messages utilisateur

Exemple :

```txt id="5f7s1w"
Paiement confirmé avec succès.
```

ou :

```txt id="8k3u6n"
Le paiement a échoué. Veuillez réessayer.
```

---

## Logs WooCommerce

Disponible dans :

```txt id="4w9p8u"
WooCommerce → Status → Logs
```

---

## Sandbox & Tests

Le mode test permet :

* tester sans argent réel ;
* simuler paiements ;
* tester webhooks ;
* tester WooCommerce.

---

## Bonnes pratiques

### À faire

✅ utiliser HTTPS
✅ activer webhooks
✅ utiliser mode test avant production
✅ sauvegarder WordPress
✅ utiliser clés Live uniquement en production

---

### À éviter

❌ exposer Secret Key
❌ modifier le plugin directement
❌ utiliser le mode live pendant les tests

---

## Cas d’utilisation

Le plugin est idéal pour :

* boutiques ecommerce ;
* ventes digitales ;
* formations ;
* abonnements ;
* dons ;
* marketplaces ;
* SaaS.

---

