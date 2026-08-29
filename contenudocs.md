# API Keys

Les API Keys permettent à votre application de communiquer de manière sécurisée avec l’infrastructure Kobara.

Chaque requête envoyée à l’API Kobara doit être authentifiée avec une clé API valide.

Les clés API permettent :

* créer des paiements ;
* générer des liens de paiement ;
* effectuer des retraits ;
* gérer les webhooks ;
* accéder aux données du dashboard ;
* utiliser les SDK Kobara.

---

## Types de clés API

Kobara fournit deux catégories de clés :

| Type       | Utilisation           |
| ---------- | --------------------- |
| Public Key | Frontend / Checkout   |
| Secret Key | Backend / API serveur |

---

## Public Keys

Les clés publiques sont utilisées côté client.

Exemples :

* React ;
* Next.js ;
* Vue ;
* applications mobiles ;
* checkout frontend ;
* SDK JavaScript.

Préfixes :

```txt id="mpd76o"
kbr_pk_test_
kbr_pk_live_
```

---

## Exemple Public Key

```txt id="mujbhn"
kbr_pk_test_a1b2c3d4e5f6
```

---

## Cas d’utilisation

### Initialiser le SDK

```js id="fyicjh"
const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY
);
```

---

## Important

✅ Peut être utilisée dans le navigateur
✅ Utilisée pour lancer le checkout
❌ Ne permet pas d’effectuer des retraits
❌ Ne donne pas accès aux données sensibles
❌ Ne doit pas remplacer le backend

---

## Secret Keys

Les clés secrètes permettent d’effectuer des actions sensibles.

Elles doivent être utilisées uniquement :

* côté serveur ;
* dans les API routes ;
* dans le backend ;
* dans les workers ;
* dans les webhooks.

Préfixes :

```txt id="2p7uoz"
kbr_sk_test_
kbr_sk_live_
```

---

## Exemple Secret Key

```txt id="r82o8n"
kbr_sk_test_VOTRE_CLE_API
```

---

## Important

⚠️ Les Secret Keys ne doivent jamais être exposées dans :

* React ;
* Next.js client ;
* mobile app ;
* navigateur ;
* GitHub ;
* HTML ;
* JavaScript public.

---

## Architecture recommandée

### Correct

```txt id="zyum7u"
Client
↓
Votre backend
↓
API Kobara
↓
MonCash/MonCash
```

---

## Incorrect

```txt id="zaxp8q"
Client
↓
Secret Key Kobara
```

---

## Environnements

Kobara supporte deux environnements.

| Mode | Description       |
| ---- | ----------------- |
| Test | Développement     |
| Live | Production réelle |

---

## Test Mode

Utilisé pour :

* développement ;
* tests ;
* simulation paiements ;
* tests webhooks.

Clés :

```txt id="cf4y2z"
kbr_pk_test_
kbr_sk_test_
```

---

## Live Mode

Utilisé pour :

* vrais paiements ;
* vrais retraits ;
* production.

Clés :

```txt id="pt0ynm"
kbr_pk_live_
kbr_sk_live_
```

---

## Créer une clé API

Dans votre dashboard Kobara :

```txt id="e6m2sl"
Dashboard → API Keys
```

Vous pouvez :

* créer ;
* régénérer ;
* désactiver ;
* supprimer ;
* limiter ;
* renommer vos clés.

---

## Informations disponibles

Chaque clé contient :

| Champ        | Description           |
| ------------ | --------------------- |
| id           | Identifiant unique    |
| name         | Nom personnalisé      |
| type         | public ou secret      |
| environment  | test ou live          |
| created_at   | Date création         |
| last_used_at | Dernière utilisation  |
| permissions  | Permissions associées |

---

## Permissions des clés

Les clés peuvent être limitées à certaines actions.

| Permission        | Description         |
| ----------------- | ------------------- |
| payments.write    | Créer paiements     |
| payments.read     | Lire paiements      |
| links.write       | Créer payment links |
| withdrawals.write | Créer retraits      |
| webhooks.write    | Gérer webhooks      |
| analytics.read    | Lire analytics      |

---

## Exemple permissions limitées

```json id="c17hnn"
{
  "permissions": [
    "payments.write",
    "payments.read"
  ]
}
```

---

## Régénération des clés

Vous pouvez régénérer une clé à tout moment.

⚠️ Après régénération :

* l’ancienne clé devient invalide ;
* toutes les applications utilisant cette clé doivent être mises à jour.

---

## Désactivation des clés

Les clés peuvent être :

* suspendues ;
* réactivées ;
* supprimées.

Utile en cas :

* de fuite ;
* de compromission ;
* de rotation sécurité.

---

## Rotation des clés

Kobara recommande :

✅ rotation régulière des clés
✅ séparation test/live
✅ permissions minimales
✅ surveillance des usages

---

## Variables d’environnement

### Frontend

```env id="v6n3d7"
NEXT_PUBLIC_KOBARA_PUBLIC_KEY=
```

---

### Backend

```env id="yy0kxm"
KOBARA_SECRET_KEY=
```

---

## Exemple Node.js

```js id="my10xk"
import Kobara from "kobara";

const kobara = new Kobara({
  secretKey: process.env.KOBARA_SECRET_KEY
});
```

---

## Exemple cURL

```bash id="rz5ptv"
curl https://api.kobara.app/api/v1/payments \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json"
```

---

## Limitation IP (optionnel)

Les clés peuvent être limitées :

* à certaines IPs ;
* certains serveurs ;
* certains domaines.

---

## Monitoring & Logs

Kobara enregistre :

* IP ;
* timestamp ;
* endpoint ;
* statut ;
* usage ;
* erreurs.

Disponible dans :

* Dashboard
* Audit Logs
* Analytics

---

## Exemple réponse API Key

```json id="brv8dr"
{
  "id": "key_01",
  "name": "Production Server",
  "type": "secret",
  "environment": "live",
  "prefix": "kbr_sk_live_",
  "created_at": "2026-05-09T12:00:00Z"
}
```

---

## Bonnes pratiques sécurité

### À faire

✅ stocker les clés dans `.env`
✅ utiliser HTTPS
✅ limiter permissions
✅ régénérer régulièrement
✅ utiliser backend pour actions sensibles
✅ séparer test et production

---

### À ne jamais faire

❌ exposer Secret Key dans React
❌ publier sur GitHub
❌ envoyer Secret Key au navigateur
❌ stocker dans localStorage
❌ utiliser la même clé partout

---

## Utilisation recommandée

### Frontend

Utiliser :

* Public Key ;
* SDK JavaScript ;
* checkout Kobara.

---

### Backend

Utiliser :

* Secret Key ;
* API Kobara ;
* webhooks ;
* retraits ;
* analytics.




# Authentication

L’API Kobara utilise un système d’authentification sécurisé basé sur des clés API afin de protéger les paiements, les retraits et toutes les opérations sensibles effectuées sur votre compte marchand.

Toutes les requêtes envoyées à l’API Kobara doivent être authentifiées avec un Bearer Token.

---

## Base URL API

### Test Mode

```txt id="5j4wqk"
https://api.kobara.app
```

---

### Live Mode

```txt id="9w4wwd"
https://api.kobara.app
```

---

## HTTPS Obligatoire

⚠️ Toutes les requêtes doivent être effectuées via HTTPS.

Les requêtes HTTP non sécurisées sont automatiquement refusées afin de protéger :

* les paiements ;
* les données clients ;
* les clés API ;
* les transactions MonCash ;
* les webhooks.

---

## Types de clés API

Kobara fournit deux types de clés :

| Type       | Utilisation       |
| ---------- | ----------------- |
| Public Key | Frontend / mobile |
| Secret Key | Backend / serveur |

---

## Clés Publiques

Les clés publiques sont utilisées :

* dans le frontend ;
* dans les applications React ;
* dans les applications mobiles ;
* dans le SDK JavaScript ;
* pour initialiser le checkout Kobara.

Préfixes :

```txt id="6y3oz7"
kbr_pk_test_
kbr_pk_live_
```

---

## Exemple clé publique

```txt id="x16y2t"
kbr_pk_test_a1b2c3d4e5f6
```

---

## Utilisation recommandée

Frontend React :

```js id="x6c6m7"
const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY
);
```

---

## Important

✅ Peut être exposée côté client
✅ Utilisée uniquement pour initialiser le paiement
❌ Ne peut pas effectuer d’actions sensibles
❌ Ne peut pas effectuer de retraits
❌ Ne peut pas accéder aux données privées

---

## Clés Secrètes

Les clés secrètes permettent :

* créer des paiements ;
* effectuer des retraits ;
* rembourser ;
* accéder aux données sensibles ;
* gérer les webhooks ;
* effectuer des actions serveur.

Préfixes :

```txt id="rf12ko"
kbr_sk_test_
kbr_sk_live_
```

---

## Exemple clé secrète

```txt id="9h1z9e"
kbr_sk_test_VOTRE_CLE_API
```

---

## Important

⚠️ Les clés secrètes doivent toujours rester côté serveur.

Ne jamais :

* exposer dans le frontend ;
* envoyer au navigateur ;
* stocker dans du code public ;
* publier sur GitHub.

---

## Architecture sécurisée recommandée

## Correct

```txt id="7dq0jk"
Frontend
↓
Votre backend sécurisé
↓
API Kobara
↓
MonCash / MonCash
```

---

## Incorrect

```txt id="7x7kmu"
Frontend
↓
MonCash directement
```

ou :

```txt id="n4kql4"
Frontend
↓
Kobara Secret Key
```

---

## Authentification Bearer Token

Toutes les requêtes doivent inclure :

```http id="5nnhkl"
Authorization: Bearer VOTRE_SECRET_KEY
```

---

## Exemple cURL

```bash id="0s5r5z"
curl https://api.kobara.app/api/v1/payments \
  -H "Authorization: Bearer kbr_sk_test_VOTRE_CLE_API" \
  -H "Content-Type: application/json"
```

---

## Exemple avec fetch()

```js id="kn5bsv"
const response = await fetch(
  "https://api.kobara.app/api/v1/payments",
  {
    method: "POST",

    headers: {
      "Authorization":
        `Bearer ${process.env.KOBARA_SECRET_KEY}`,

      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      amount: 1000,
      currency: "HTG"
    })
  }
);
```

---

## Exemple Node.js

```js id="x92j5u"
import Kobara from "kobara";

const kobara = new Kobara({
  secretKey: process.env.KOBARA_SECRET_KEY
});
```

---

## Environnements

Kobara supporte :

| Environment | Description       |
| ----------- | ----------------- |
| Test        | Développement     |
| Live        | Production réelle |

---

## Test Mode

Le mode test permet :

* tester les paiements ;
* tester les webhooks ;
* développer sans argent réel ;
* valider les intégrations.

Utiliser :

```txt id="w0hryg"
kbr_pk_test_
kbr_sk_test_
```

---

## Live Mode

Le mode live permet :

* paiements réels ;
* retraits réels ;
* transactions MonCash réelles.

Utiliser :

```txt id="lckzku"
kbr_pk_live_
kbr_sk_live_
```



## Rotation des clés

Kobara permet :

* régénération des clés ;
* désactivation ;
* révocation immédiate ;
* gestion multi-clés.

Disponible dans :

```txt id="4pp1qo"
Dashboard → API Keys
```

---

## Permissions des clés

Certaines clés peuvent être limitées :

| Permission        | Description     |
| ----------------- | --------------- |
| payments.write    | Créer paiements |
| payments.read     | Lire paiements  |
| withdrawals.write | Créer retraits  |
| webhooks.write    | Gérer webhooks  |

---

## Expiration des clés

Les clés API peuvent :

* expirer automatiquement ;
* être limitées par IP ;
* être désactivées manuellement.

---

## Sécurité recommandée

## À faire

✅ Utiliser HTTPS
✅ Stocker les secrets dans `.env`
✅ Vérifier les webhooks
✅ Utiliser le backend pour les actions sensibles
✅ Activer logs et monitoring
✅ Régénérer clés compromises

---

## À ne jamais faire

❌ exposer Secret Key côté client
❌ hardcoder les secrets dans React
❌ publier les clés dans GitHub
❌ utiliser localStorage pour les secrets
❌ appeler MonCash directement depuis le frontend

---

## Bonnes pratiques Kobara

En tant que marchand Kobara :

Vous ne devez jamais interagir directement avec l’infrastructure MonCash/MonCash.

Votre système doit communiquer uniquement avec :

* l’API Kobara ;
* les SDK Kobara ;
* les webhooks Kobara.

Kobara agit comme :

* couche de sécurité ;
* couche d’abstraction ;
* couche de monitoring ;
* infrastructure de paiement unifiée.

---

## Exemple architecture complète

```txt id="0yrzkg"
Client
↓
Frontend App
↓
Kobara SDK
↓
Votre Backend
↓
Kobara API
↓
MonCash Infrastructure
↓
MonCash
```

---

## Codes d’erreurs Authentication

| Code                  | Description    |
| --------------------- | -------------- |
| unauthorized          | Clé invalide   |
| invalid_api_key       | Mauvais format |
| expired_api_key       | Clé expirée    |
| revoked_api_key       | Clé désactivée |
| missing_authorization | Header absent  |

---

## Exemple réponse erreur

```json id="dkt1ao"
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid API key"
  }
}
```

---


# JavaScript SDK

Le SDK JavaScript de Kobara permet d’intégrer rapidement les paiements MonCash dans une application frontend moderne.

Il simplifie :

* la création de paiements ;
* l’ouverture du checkout ;
* la redirection des clients ;
* la gestion des erreurs ;
* la communication sécurisée avec l’API Kobara.

Le SDK est conçu pour fonctionner avec :

* React
* Next.js
* Vue
* Nuxt
* Vanilla JavaScript
* Vite
* Angular
* applications SPA modernes

---

## Installation

Installez le SDK avec npm :

```bash
npm install kobara-js
```

ou avec Yarn :

```bash
yarn add kobara-js
```

ou pnpm :

```bash
pnpm add kobara-js
```

---

## Important — Clés API

Kobara utilise deux types de clés :

| Type       | Utilisation           |
| ---------- | --------------------- |
| Public Key | Frontend / navigateur |
| Secret Key | Backend uniquement    |

⚠️ Très important :

La clé secrète ne doit jamais être exposée dans le frontend.

Dans le navigateur, utilisez uniquement :

```env
NEXT_PUBLIC_KOBARA_PUBLIC_KEY=
```

---

## Initialisation du SDK

```js
import Kobara from "kobara-js";

const kobara = new Kobara("kbr_pk_test_a1b2c3d4e5f6");
```

---

## Mode Test & Live

Kobara supporte deux environnements :

### Test Mode

Permet :

* tester l’intégration ;
* simuler des paiements ;
* vérifier les webhooks ;
* développer sans argent réel.

Exemple :

```js
const kobara = new Kobara("kbr_pk_test_xxxxxxxxx");
```

---

### Live Mode

Utilisé en production avec de vrais paiements.

```js
const kobara = new Kobara("kbr_pk_live_xxxxxxxxx");
```

---

## Créer un paiement

Exemple simple :

```js
import Kobara from "kobara-js";

const kobara = new Kobara("kbr_pk_test_a1b2c3d4e5f6");

async function handleCheckout() {
  const { error } = await kobara.checkout.create({
    amount: 1000,
    currency: "HTG",
    description: "Achat Boutique",
  });

  if (error) {
    console.error(error.message);
  }
}
```

---

## Paramètres disponibles

| Paramètre     | Type   | Description             |
| ------------- | ------ | ----------------------- |
| amount        | number | Montant du paiement     |
| currency      | string | Devise (HTG)            |
| description   | string | Description du paiement |
| customerEmail | string | Email du client         |
| customerName  | string | Nom du client           |
| customerPhone | string | Téléphone du client     |
| metadata      | object | Données personnalisées  |
| successUrl    | string | URL après succès        |
| cancelUrl     | string | URL après annulation    |

---

## Exemple complet

```js
import Kobara from "kobara-js";

const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY
);

async function handleCheckout() {
  const response = await kobara.checkout.create({
    amount: 2500,
    currency: "HTG",

    description: "Commande Boutique",

    customerName: "Jean Pierre",

    customerEmail: "client@email.com",

    customerPhone: "+50900000000",

    successUrl: "https://monsite.com/success",

    cancelUrl: "https://monsite.com/cancel",

    metadata: {
      orderId: "ORD-1023",
      source: "website"
    }
  });

  if (response.error) {
    console.log(response.error.message);
    return;
  }

  console.log(response.paymentUrl);
}
```

---

## Redirection Checkout

Après création du paiement :

```js
window.location.href = response.paymentUrl;
```

Le client sera redirigé vers :

* le checkout Kobara ;
* le paiement MonCash ;
* puis retournera automatiquement vers votre site.

---

## Réponse SDK

Exemple :

```json
{
  "success": true,
  "paymentId": "pay_xxx",
  "paymentUrl": "https://pay.kobara.app/checkout/xxx",
  "status": "pending"
}
```

---

## Gestion des erreurs

Le SDK retourne des erreurs standardisées.

Exemple :

```js
if (response.error) {
  console.log(response.error.code);
  console.log(response.error.message);
}
```

---

## Types d’erreurs

| Code           | Description      |
| -------------- | ---------------- |
| invalid_amount | Montant invalide |
| unauthorized   | Clé API invalide |
| payment_failed | Paiement échoué  |
| network_error  | Erreur réseau    |
| rate_limit     | Trop de requêtes |

---

## Vérification backend

Même si le paiement semble réussi côté frontend :

⚠️ Vous devez toujours vérifier le paiement côté serveur avec les webhooks Kobara.

Ne jamais faire confiance uniquement au frontend.

---

## Architecture recommandée

### Frontend

Le SDK frontend :

* crée le checkout ;
* redirige le client ;
* affiche les erreurs.

### Backend

Votre backend :

* vérifie les webhooks ;
* confirme les paiements ;
* met à jour votre base de données ;
* livre les produits/services.

---

## Exemple architecture

```txt
Client
↓
Frontend React + Kobara SDK
↓
API Kobara
↓
MonCash
↓
Webhook Kobara
↓
Votre Backend
↓
Confirmation commande
```

---

## Utilisation avec React

```tsx
"use client";

import Kobara from "kobara-js";

const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY!
);

export default function CheckoutButton() {
  const handlePay = async () => {
    const response = await kobara.checkout.create({
      amount: 1500,
      currency: "HTG",
      description: "Paiement Produit"
    });

    if (response.paymentUrl) {
      window.location.href = response.paymentUrl;
    }
  };

  return (
    <button onClick={handlePay}>
      Payer avec MonCash
    </button>
  );
}
```

---

## Sécurité

### À faire

✅ utiliser uniquement la Public Key côté client
✅ utiliser HTTPS
✅ vérifier les webhooks côté serveur
✅ utiliser des success URLs sécurisées
✅ stocker les secrets dans `.env`

---

### À ne jamais faire

❌ exposer Secret Key dans le frontend
❌ faire confiance uniquement au frontend
❌ stocker les secrets dans GitHub
❌ appeler directement MonCash depuis le navigateur

---



## Cas d’utilisation

Le SDK peut être utilisé pour :

* ecommerce ;
* abonnements ;
* donations ;
* marketplaces ;
* SaaS ;
* billetterie ;
* paiements mobiles ;
* liens de paiement ;
* checkout MonCash.

---

## Webhooks recommandés

Événements importants :

| Event           | Description     |
| --------------- | --------------- |
| payment.success | Paiement réussi |
| payment.failed  | Paiement échoué |
| payment.expired | Paiement expiré |
| withdrawal.paid | Retrait payé    |

---

## Performance

Le SDK Kobara est :

* léger ;
* optimisé ;
* tree-shakeable ;
* moderne ;
* compatible ES Modules.

---

## Compatibilité

| Framework  | Support |
| ---------- | ------- |
| React      | ✅       |
| Next.js    | ✅       |
| Vue        | ✅       |
| Nuxt       | ✅       |
| Vite       | ✅       |
| Angular    | ✅       |
| Vanilla JS | ✅       |

---

# Node.js SDK

Le SDK Node.js officiel de Kobara permet aux développeurs d’intégrer facilement :

* les paiements MonCash ;
* les liens de paiement ;
* les retraits ;
* les webhooks ;
* les clients ;
* les analytics ;
* les événements temps réel ;

dans leurs applications backend Node.js.

Le SDK est optimisé pour :

* Node.js ;
* Express.js ;
* NestJS ;
* Next.js API Routes ;
* Fastify ;
* serveurs serverless.

---

## Installation

Installez le SDK via npm :

```bash id="1k0s8s"
npm install kobara
```

---

## Compatibilité

| Framework          | Support |
| ------------------ | ------- |
| Node.js            | ✅       |
| Express.js         | ✅       |
| NestJS             | ✅       |
| Next.js API Routes | ✅       |
| Fastify            | ✅       |
| Vercel Functions   | ✅       |

---

## Initialisation

Le SDK doit être initialisé avec votre Secret Key.

⚠️ Toujours côté serveur.

```js id="b1t8gm"
import Kobara from "kobara";

const kobara = new Kobara(
  process.env.KOBARA_SECRET_KEY
);
```

---

## Variables d’environnement

```env id="7uxk2t"
KOBARA_SECRET_KEY=kbr_sk_live_VOTRE_CLE_API
```

---

## Important

⚠️ Ne jamais exposer la Secret Key dans :

* React ;
* navigateur ;
* mobile app ;
* frontend.

---

## Premier paiement

### Exemple Express.js

```js id="r3g1ff"
import express from "express";
import Kobara from "kobara";

const app = express();

app.use(express.json());

const kobara = new Kobara(
  process.env.KOBARA_SECRET_KEY
);

app.post("/create-payment", async (req, res) => {

  try {

    const payment = await kobara.payments.create({

      amount: 1000,

      currency: "HTG",

      customer: {
        name: "Jean Exemple",
        phone: "50900000000"
      }

    });

    res.json({
      paymentUrl: payment.url
    });

  } catch (error) {

    res.status(400).json({
      error: error.message
    });

  }

});

app.listen(3000);
```

---

## Explication du flux

## 1. Le client clique “Payer”

Votre frontend appelle :

```txt id="4hm8jv"
POST /create-payment
```

---

## 2. Votre backend crée le paiement

Le SDK Node.js :

* contacte l’API Kobara ;
* sécurise la requête ;
* communique avec MonCash ;
* prépare le checkout MonCash.

---

## 3. Kobara retourne une URL

```json id="h23z4f"
{
  "paymentUrl": "https://checkout.kobara.app/pay/abc123"
}
```

---

##  4. Le frontend redirige le client

```js id="r6j8u4"
window.location.href = paymentUrl;
```

---

## Pourquoi utiliser le SDK Node.js

Le SDK :

* évite les requêtes manuelles ;
* gère les headers ;
* gère l’authentification ;
* valide les données ;
* simplifie les webhooks ;
* réduit les erreurs.

---

## Créer un paiement

### Exemple complet

```js id="l5m9px"
const payment = await kobara.payments.create({

  amount: 2500,

  currency: "HTG",

  description: "Commande Boutique",

  customer: {
    name: "Jean Pierre",
    email: "client@email.com",
    phone: "50937000000"
  },

  metadata: {
    order_id: "ORDER_001"
  }

});
```

---

## Paramètres disponibles

| Paramètre   | Description            |
| ----------- | ---------------------- |
| amount      | Montant                |
| currency    | Devise                 |
| description | Description            |
| customer    | Informations client    |
| metadata    | Données personnalisées |

---

## Réponse paiement

```json id="4xpt28"
{
  "id": "pay_123",
  "status": "pending",
  "url": "https://checkout.kobara.app/pay/123",
  "amount": 2500,
  "currency": "HTG"
}
```

---

## Vérifier un paiement

```js id="7w8ebv"
const payment = await kobara.payments.retrieve(
  "pay_123"
);
```

---

## Exemple réponse

```json id="9vxlg7"
{
  "id": "pay_123",
  "status": "succeeded",
  "amount": 2500
}
```

---

## Lister les paiements

```js id="w2m4tv"
const payments = await kobara.payments.list();
```

---

## Payment Links

Créer des liens de paiement partageables.

```js id="3p48nh"
const link = await kobara.paymentLinks.create({

  amount: 1500,

  currency: "HTG",

  title: "Paiement Boutique"

});
```

---

## Réponse

```json id="6uh0rb"
{
  "url": "https://pay.kobara.app/link/abc123"
}
```

---

## Retraits

Créer un retrait vers MonCash.

```js id="s6c1ry"
const withdrawal = await kobara.withdrawals.create({

  amount: 5000,

  phone: "50937000000"

});
```

---

## Réponse retrait

```json id="i7e6xw"
{
  "id": "wd_001",
  "status": "processing"
}
```

---

## Webhooks

Le SDK aide à vérifier les signatures webhooks.

```js id="7m5dr3"
const event = kobara.webhooks.constructEvent(

  payload,

  signature,

  process.env.KOBARA_WEBHOOK_SECRET

);
```

---

## Exemple Express Webhook

```js id="9sy6p1"
app.post("/webhook", async (req, res) => {

  const signature =
    req.headers["kobara-signature"];

  try {

    const event =
      kobara.webhooks.constructEvent(

        req.body,

        signature,

        process.env.KOBARA_WEBHOOK_SECRET
      );

    console.log(event);

    res.sendStatus(200);

  } catch (err) {

    res.status(400).send(
      `Webhook Error: ${err.message}`
    );

  }

});
```

---

## Types d’événements

| Event             | Description     |
| ----------------- | --------------- |
| payment.succeeded | Paiement réussi |
| payment.failed    | Paiement échoué |
| withdrawal.paid   | Retrait payé    |
| withdrawal.failed | Retrait échoué  |

---

## Gestion des erreurs

Le SDK retourne des erreurs propres.

```js id="m0e0bg"
try {

  await kobara.payments.create(...);

} catch (error) {

  console.log(error.message);

}
```

---

## Exemple erreur

```json id="9gshij"
{
  "error": {
    "code": "invalid_amount",
    "message": "Amount is required"
  }
}
```

---

## Architecture recommandée

### Correct

```txt id="3y8h95"
Frontend
↓
Votre Backend Node.js
↓
Kobara SDK
↓
API Kobara
↓
MonCash
```

---


## Bonnes pratiques

### À faire

✅ utiliser `.env`
✅ utiliser HTTPS
✅ utiliser webhooks
✅ valider les données
✅ stocker les logs

---

### À éviter

❌ exposer Secret Key
❌ utiliser SDK côté frontend
❌ appeler MonCash directement
❌ hardcoder les secrets

---

## Exemple Next.js API Route

```js id="w4ttcx"
import Kobara from "kobara";

const kobara = new Kobara(
  process.env.KOBARA_SECRET_KEY
);

export async function POST(req) {

  const body = await req.json();

  const payment =
    await kobara.payments.create({

      amount: body.amount,

      currency: "HTG"

    });

  return Response.json(payment);
}
```

---


# Python SDK

Le SDK Python officiel de Kobara permet d’intégrer facilement :

* les paiements MonCash ;
* les liens de paiement ;
* les retraits ;
* les webhooks ;
* les notifications temps réel ;

dans vos applications backend Python.

Le SDK est optimisé pour :

* Django ;
* Flask ;
* FastAPI ;
* aiohttp ;
* applications serverless ;
* APIs modernes Python.

---

## Installation

Installez le SDK avec pip :

```bash id="a7f3n1"
pip install kobara
```

---

## Compatibilité

| Framework  | Support |
| ---------- | ------- |
| FastAPI    | ✅       |
| Django     | ✅       |
| Flask      | ✅       |
| aiohttp    | ✅       |
| Serverless | ✅       |

---

## Initialisation

Le SDK doit être initialisé avec votre Secret Key.

⚠️ Toujours côté serveur.

```python id="7v6l5w"
from kobara import Kobara
import os

client = Kobara(
    api_key=os.environ.get(
        "KOBARA_SECRET_KEY"
    )
)
```

---

## Variables d’environnement

```env id="x4c8yt"
KOBARA_SECRET_KEY=kbr_sk_live_VOTRE_CLE_API
```

---

## Important

⚠️ Ne jamais exposer votre Secret Key :

* dans React ;
* dans le navigateur ;
* dans une app mobile ;
* dans du code frontend.

---

## Premier paiement

### Exemple FastAPI

```python id="q8w2je"
from fastapi import FastAPI
from kobara import Kobara
import os

app = FastAPI()

client = Kobara(
    api_key=os.environ.get(
        "KOBARA_SECRET_KEY"
    )
)

@app.post("/checkout")
def create_checkout():

    payment = client.payments.create(

        amount=1000,

        currency="HTG",

        description="Achat FastAPI",

        success_url=
        "https://mon-site.com/success"

    )

    return {
        "checkout_url": payment.url
    }
```

---

## Explication du flux

### 1. Le client clique “Payer”

Votre frontend appelle :

```txt id="m8c4r2"
POST /checkout
```

---

### 2. Votre backend Python crée le paiement

Le SDK :

* contacte l’API Kobara ;
* sécurise la requête ;
* communique avec MonCash ;
* prépare le checkout MonCash.

---

### 3. Kobara retourne une URL

```json id="n4z7xy"
{
  "checkout_url":
  "https://checkout.kobara.app/pay/abc123"
}
```

---

### 4. Redirection utilisateur

Frontend :

```js id="f4s9v2"
window.location.href = checkout_url;
```

---

## Pourquoi utiliser le SDK Python

Le SDK :

* simplifie les intégrations ;
* évite les requêtes HTTP manuelles ;
* gère les headers ;
* sécurise l’authentification ;
* valide les réponses ;
* simplifie les webhooks.

---

## Créer un paiement

### Exemple complet

```python id="6q3u8r"
payment = client.payments.create(

    amount=2500,

    currency="HTG",

    description="Commande Kobara",

    customer={

        "name": "Jean Pierre",

        "email": "client@email.com",

        "phone": "50937000000"

    },

    metadata={

        "order_id": "ORDER_001"

    }

)
```

---

## Paramètres disponibles

| Paramètre   | Description            |
| ----------- | ---------------------- |
| amount      | Montant                |
| currency    | Devise                 |
| description | Description paiement   |
| customer    | Informations client    |
| metadata    | Données personnalisées |

---

## Réponse paiement

```json id="y5j7gf"
{
  "id": "pay_123",
  "status": "pending",
  "url": "https://checkout.kobara.app/pay/123",
  "amount": 2500,
  "currency": "HTG"
}
```

---

## Vérifier un paiement

```python id="v2f6kb"
payment = client.payments.retrieve(
    "pay_123"
)
```

---

## Exemple réponse

```json id="3r8mzt"
{
  "id": "pay_123",
  "status": "succeeded",
  "amount": 2500
}
```

---

## Lister les paiements

```python id="1w8lqp"
payments = client.payments.list()
```

---

## Payment Links

Créer des liens de paiement partageables.

```python id="0z9z7u"
link = client.payment_links.create(

    amount=1500,

    currency="HTG",

    title="Paiement Boutique"

)
```

---

## Réponse

```json id="v9i1qf"
{
  "url":
  "https://pay.kobara.app/link/abc123"
}
```

---

## Retraits

Créer un retrait MonCash.

```python id="1m0v8s"
withdrawal = client.withdrawals.create(

    amount=5000,

    phone="50937000000"

)
```

---

## Réponse retrait

```json id="h0x9qj"
{
  "id": "wd_001",
  "status": "processing"
}
```

---

## Webhooks

Le SDK Python aide à vérifier les signatures webhooks.

```python id="d3m7q2"
event = client.webhooks.construct_event(

    payload,

    signature,

    os.environ.get(
        "KOBARA_WEBHOOK_SECRET"
    )

)
```

---

## Exemple webhook FastAPI

```python id="e7n3zk"
from fastapi import Request

@app.post("/webhook")
async def webhook(request: Request):

    payload = await request.body()

    signature = request.headers.get(
        "kobara-signature"
    )

    try:

        event = client.webhooks.construct_event(

            payload,

            signature,

            os.environ.get(
                "KOBARA_WEBHOOK_SECRET"
            )

        )

        print(event)

        return {"success": True}

    except Exception as e:

        return {
            "error": str(e)
        }
```

---

## Types d’événements

| Event             | Description     |
| ----------------- | --------------- |
| payment.succeeded | Paiement réussi |
| payment.failed    | Paiement échoué |
| withdrawal.paid   | Retrait payé    |
| withdrawal.failed | Retrait échoué  |

---

## Gestion des erreurs

Le SDK retourne des erreurs propres.

```python id="6u0gq9"
try:

    payment = client.payments.create(...)

except Exception as error:

    print(str(error))
```

---

## Exemple erreur

```json id="9f0v8u"
{
  "error": {
    "code": "invalid_amount",
    "message": "Amount is required"
  }
}
```

---

## Architecture recommandée

### Correct

```txt id="3s7m7w"
Frontend
↓
Backend Python
↓
Kobara SDK
↓
API Kobara
↓
MonCash / MonCash
```

---

## Architecture incorrecte

```txt id="2d7s9l"
Frontend
↓
MonCash directement
```

ou :

```txt id="2j0n4t"
Frontend
↓
Secret Key Kobara
```

---

## Bonnes pratiques

### À faire

✅ utiliser `.env`
✅ utiliser HTTPS
✅ vérifier les webhooks
✅ utiliser backend sécurisé
✅ logger les erreurs

---

### À éviter

❌ exposer Secret Key
❌ utiliser le SDK côté frontend
❌ appeler MonCash directement
❌ hardcoder les secrets

---

## Exemple Django

```python id="t1x9jq"
from django.http import JsonResponse
from kobara import Kobara
import os

client = Kobara(
    api_key=os.environ.get(
        "KOBARA_SECRET_KEY"
    )
)

def create_payment(request):

    payment = client.payments.create(

        amount=1000,

        currency="HTG"

    )

    return JsonResponse({

        "url": payment.url

    })
```

---

## Exemple Flask

```python id="q9t8f0"
from flask import Flask
from kobara import Kobara
import os

app = Flask(__name__)

client = Kobara(
    api_key=os.environ.get(
        "KOBARA_SECRET_KEY"
    )
)

@app.route("/checkout", methods=["POST"])
def checkout():

    payment = client.payments.create(

        amount=1000,

        currency="HTG"

    )

    return {
        "url": payment.url
    }
```

---

# PHP SDK

Le SDK PHP officiel de Kobara permet d’intégrer facilement :

* les paiements MonCash ;
* les liens de paiement ;
* les retraits ;
* les webhooks ;
* les notifications temps réel ;

dans vos applications PHP.

Le SDK est optimisé pour :

* PHP natif ;
* Laravel ;
* Symfony ;
* CodeIgniter ;
* APIs REST ;
* applications ecommerce.

---

## Installation

Installez le SDK avec Composer :

```bash id="3m8f9v"
composer require kobara/php-sdk
```

---

## Compatibilité

| Framework   | Support |
| ----------- | ------- |
| PHP natif   | ✅       |
| Laravel     | ✅       |
| Symfony     | ✅       |
| CodeIgniter | ✅       |
| APIs REST   | ✅       |

---

## Initialisation

Le SDK doit être initialisé avec votre Secret Key.

⚠️ Toujours côté serveur.

```php id="k4u9pz"
<?php

require 'vendor/autoload.php';

use Kobara\KobaraClient;

$kobara = new KobaraClient(
    getenv('KOBARA_SECRET_KEY')
);
```

---

## Variables d’environnement

```env id="j0m7ra"
KOBARA_SECRET_KEY=kbr_sk_live_VOTRE_CLE_API
```

---

### Important

⚠️ Ne jamais exposer votre Secret Key :

* dans JavaScript ;
* dans le frontend ;
* dans React ;
* dans une application mobile ;
* dans du HTML public.

---

## Premier paiement

### Exemple PHP natif

```php id="8r9x1f"
<?php

require 'vendor/autoload.php';

use Kobara\KobaraClient;

$kobara = new KobaraClient(
    getenv('KOBARA_SECRET_KEY')
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG",

    "description" => "Achat Laravel",

    "customer" => [

        "name" => "Marie Exemple",

        "phone" => "50900000000"

    ]

]);

header("Location: " . $payment->url);

exit();
```

---

## Explication du flux

### 1. Le client clique “Payer”

Votre frontend appelle :

```txt id="7j5m2r"
POST /checkout
```

---

### 2. Votre backend PHP crée le paiement

Le SDK :

* contacte l’API Kobara ;
* sécurise la requête ;
* communique avec MonCash ;
* prépare le checkout MonCash.

---

### 3. Kobara retourne une URL

```json id="2k8c7e"
{
  "url":
  "https://checkout.kobara.app/pay/abc123"
}
```

---

## 4. Redirection utilisateur

```php id="3u6f0r"
header("Location: " . $payment->url);
exit();
```

---

## Pourquoi utiliser le SDK PHP

Le SDK :

* simplifie les intégrations ;
* évite les requêtes HTTP manuelles ;
* gère l’authentification ;
* valide les réponses ;
* simplifie les webhooks ;
* réduit les erreurs.

---

## Créer un paiement

### Exemple complet

```php id="t9d5qp"
$payment = $kobara->payments->create([

    "amount" => 2500,

    "currency" => "HTG",

    "description" => "Commande Kobara",

    "customer" => [

        "name" => "Jean Pierre",

        "email" => "client@email.com",

        "phone" => "50937000000"

    ],

    "metadata" => [

        "order_id" => "ORDER_001"

    ]

]);
```

---

## Paramètres disponibles

| Paramètre   | Description            |
| ----------- | ---------------------- |
| amount      | Montant                |
| currency    | Devise                 |
| description | Description paiement   |
| customer    | Informations client    |
| metadata    | Données personnalisées |

---

## Réponse paiement

```json id="2v2m9e"
{
  "id": "pay_123",
  "status": "pending",
  "url": "https://checkout.kobara.app/pay/123",
  "amount": 2500,
  "currency": "HTG"
}
```

---

## Vérifier un paiement

```php id="n8r6l3"
$payment = $kobara->payments->retrieve(
    "pay_123"
);
```

---

## Exemple réponse

```json id="e0z8f6"
{
  "id": "pay_123",
  "status": "succeeded",
  "amount": 2500
}
```

---

## Lister les paiements

```php id="z2g1x8"
$payments = $kobara->payments->list();
```

---

## Payment Links

Créer des liens de paiement partageables.

```php id="v9g8u1"
$link = $kobara->paymentLinks->create([

    "amount" => 1500,

    "currency" => "HTG",

    "title" => "Paiement Boutique"

]);
```

---

## Réponse

```json id="h3u4xz"
{
  "url":
  "https://pay.kobara.app/link/abc123"
}
```

---

## Retraits

Créer un retrait MonCash.

```php id="w8j3b2"
$withdrawal = $kobara->withdrawals->create([

    "amount" => 5000,

    "phone" => "50937000000"

]);
```

---

## Réponse retrait

```json id="0u3z9m"
{
  "id": "wd_001",
  "status": "processing"
}
```

---

## Webhooks

Le SDK PHP aide à vérifier les signatures webhooks.

```php id="9s6t5n"
$event = $kobara->webhooks->constructEvent(

    $payload,

    $signature,

    getenv("KOBARA_WEBHOOK_SECRET")

);
```

---

## Exemple webhook PHP

```php id="6j4x7p"
<?php

$payload = file_get_contents("php://input");

$signature =
    $_SERVER["HTTP_KOBARA_SIGNATURE"];

try {

    $event =
        $kobara->webhooks->constructEvent(

            $payload,

            $signature,

            getenv("KOBARA_WEBHOOK_SECRET")
        );

    http_response_code(200);

} catch (Exception $e) {

    http_response_code(400);

    echo $e->getMessage();
}
```

---

## Types d’événements

| Event             | Description     |
| ----------------- | --------------- |
| payment.succeeded | Paiement réussi |
| payment.failed    | Paiement échoué |
| withdrawal.paid   | Retrait payé    |
| withdrawal.failed | Retrait échoué  |

---

## Gestion des erreurs

Le SDK retourne des erreurs propres.

```php id="8x4n6j"
try {

    $payment =
        $kobara->payments->create([...]);

} catch (Exception $error) {

    echo $error->getMessage();

}
```

---

## Exemple erreur

```json id="7g5n3d"
{
  "error": {
    "code": "invalid_amount",
    "message": "Amount is required"
  }
}
```

---

## Architecture recommandée

### Correct

```txt id="3q8m2g"
Frontend
↓
Backend PHP
↓
Kobara SDK
↓
API Kobara
↓
MonCash / MonCash
```

---

## Architecture incorrecte

```txt id="0k3n8r"
Frontend
↓
MonCash directement
```

ou :

```txt id="2u9r1m"
Frontend
↓
Secret Key Kobara
```

---

## Bonnes pratiques

### À faire

✅ utiliser `.env`
✅ utiliser HTTPS
✅ vérifier les webhooks
✅ sécuriser le backend
✅ logger les erreurs

---

## À éviter

❌ exposer Secret Key
❌ utiliser le SDK côté frontend
❌ appeler MonCash directement
❌ hardcoder les secrets

---

## Exemple Laravel

```php id="m8z0v7"
use Kobara\KobaraClient;

$kobara = new KobaraClient(
    env("KOBARA_SECRET_KEY")
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG"

]);

return redirect($payment->url);
```

---

## Exemple Symfony

```php id="4k7r1v"
$kobara = new KobaraClient(
    $_ENV["KOBARA_SECRET_KEY"]
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG"

]);
```

---


# Integration avec Kobara

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


# Payments API

L’objet **Payment** représente une transaction de paiement initiée via Kobara.

Cette API permet de :

* créer une session de paiement MonCash ;
* générer une URL checkout hébergée ;
* suivre le statut d’un paiement ;
* recevoir les confirmations webhook ;
* synchroniser les transactions avec votre dashboard Kobara.

Toutes les transactions créées via cette API sont enregistrées dans la table :

```txt
payments
```

avec les colonnes :

* `kobara_reference`
* `MonCash_order_id`
* `MonCash_transaction_id`
* `amount`
* `fee_amount`
* `net_amount`
* `status`
* `provider`
* `payment_method`
* `metadata`
* `paid_at`

---

## Endpoint

```http
POST /api/v1/payments
```

Base URL :

```txt
https://api.kobara.app
```

Exemple :

```http
POST https://api.kobara.app/api/v1/payments
```

---

## Authentification

Cette route nécessite une **Secret API Key** Kobara.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
```

⚠️ Les clés secrètes doivent toujours rester côté serveur.

Ne jamais :

* exposer une Secret Key dans React ;
* exposer une clé dans le navigateur ;
* appeler l’API Kobara directement depuis le frontend.

---

## Idempotency Key

Pour éviter les doubles paiements causés par :

* un refresh navigateur ;
* une erreur réseau ;
* une reconnexion ;
* un retry automatique ;

envoyez toujours un header :

```http
Idempotency-Key
```

Exemple :

```http
Idempotency-Key: 8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712
```

Kobara retournera la même transaction si la requête a déjà été traitée.

---

## Créer un paiement

### Requête

```json
{
  "amount": 2500,
  "currency": "HTG",
  "description": "Abonnement Premium (1 mois)",
  "customer": {
    "name": "Jean Exemple",
    "email": "jean@example.com",
    "phone": "50900000000"
  },
  "metadata": {
    "internal_order_id": "ORD-89457",
    "plan_tier": "premium"
  },
  "success_url": "https://monsite.com/success",
  "error_url": "https://monsite.com/error",
  "webhook_url": "https://monsite.com/webhooks/kobara"
}
```

---

## Champs de la requête

### `amount`

Montant du paiement.

```json
"amount": 2500
```

Type :

```txt
number
```

---

## `currency`

Devise utilisée.

Actuellement :

```txt
HTG
```

---

## `description`

Description visible dans :

* le dashboard ;
* les logs ;
* certaines interfaces checkout.

Exemple :

```json
"description": "Abonnement Premium"
```

---

## `customer`

Informations du payeur.

```json
{
  "name": "Jean Exemple",
  "email": "jean@example.com",
  "phone": "50900000000"
}
```

Ces données peuvent être enregistrées automatiquement dans :

```txt
customers
```

---

## `metadata`

Objet JSON libre permettant de stocker :

* IDs internes ;
* références commandes ;
* IDs utilisateurs ;
* plans ;
* tags ;
* informations métier.

```json
"metadata": {
  "internal_order_id": "ORD-89457",
  "plan_tier": "premium"
}
```

Stocké dans :

```txt
payments.metadata
```

---

## `success_url`

URL de redirection après paiement réussi.

```json
"success_url": "https://monsite.com/success"
```

---

## `error_url`

URL de redirection après :

* annulation ;
* expiration ;
* échec paiement.

```json
"error_url": "https://monsite.com/error"
```

---

## `webhook_url`

URL webhook utilisée pour recevoir les événements temps réel.

```json
"webhook_url": "https://monsite.com/webhooks/kobara"
```

---

## Réponse API

### Réponse 200 OK

```json
{
  "id": "4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
  "merchant_id": "f4db35f5-6a8e-4e2d-9155-95b05f1d8a91",
  "customer_id": "6dc9f8d7-f44e-43f9-b497-58bb5a1a5a31",
  "kobara_reference": "KBR-PAY-20260509-001",
  "amount": 2500,
  "fee_amount": 72.50,
  "net_amount": 2427.50,
  "currency": "HTG",
  "status": "pending",
  "provider": "moncash",
  "payment_method": "moncash",
  "checkout_url": "https://pay.kobara.app/c/KBR-PAY-20260509-001",
  "success_url": "https://monsite.com/success",
  "error_url": "https://monsite.com/error",
  "webhook_url": "https://monsite.com/webhooks/kobara",
  "metadata": {
    "internal_order_id": "ORD-89457",
    "plan_tier": "premium"
  },
  "created_at": "2026-05-09T16:22:11Z"
}
```

---


## Réponse paiement confirmé

```json
{
  "id": "4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
  "kobara_reference": "KBR-PAY-20260509-001",
  "status": "succeeded",
  "MonCash_transaction_id": "trx_987654321",
  "paid_at": "2026-05-09T16:30:44Z"
}
```

---

## Workflow complet

```txt
1. Votre backend crée le paiement.
2. Kobara génère checkout_url.
3. Le frontend redirige le client.
4. Le client paie via MonCash.
5. MonCash confirme le paiement.
6. Kobara met à jour payments.status.
7. Kobara envoie le webhook.
8. Votre backend confirme la commande.
9. Le dashboard Kobara est mis à jour.
```

---

## Exemple Node.js

```js
const payment = await kobara.payments.create({
  amount: 2500,
  currency: "HTG",
  description: "Abonnement Premium",
  customer: {
    name: "Jean Exemple",
    email: "jean@example.com",
    phone: "50900000000"
  },
  metadata: {
    internal_order_id: "ORD-89457"
  },
  success_url: "https://monsite.com/success",
  error_url: "https://monsite.com/error",
  webhook_url: "https://monsite.com/webhooks/kobara"
});
```

---

## Exemple cURL

```bash
curl https://api.kobara.app/api/v1/payments \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712" \
  -d '{
    "amount": 2500,
    "currency": "HTG",
    "description": "Abonnement Premium",
    "customer": {
      "name": "Jean Exemple",
      "email": "jean@example.com",
      "phone": "50900000000"
    },
    "metadata": {
      "internal_order_id": "ORD-89457"
    },
    "success_url": "https://monsite.com/success",
    "error_url": "https://monsite.com/error",
    "webhook_url": "https://monsite.com/webhooks/kobara"
  }'
```

---

## Sécurité

## Obligatoire

✅ créer les paiements côté backend
✅ utiliser `.env`
✅ vérifier les webhooks
✅ logger les événements
✅ utiliser HTTPS
✅ utiliser `Idempotency-Key`

---

## Interdit

❌ exposer `kbr_sk_*` côté client
❌ appeler MonCash directement
❌ faire confiance uniquement à la redirection frontend
❌ stocker les secrets dans GitHub

---

# Payment Links API

Les **Payment Links** permettent de générer des liens de paiement partageables sans devoir développer une intégration complète.

Ils sont idéals pour :

* WhatsApp ;
* Instagram ;
* TikTok ;
* Facebook ;
* SMS ;
* email ;
* boutiques simples ;
* paiements manuels ;
* dons ;
* abonnements ;
* ventes rapides.

Chaque lien créé est enregistré dans la table :

```txt
payment_links
```

et peut automatiquement générer des entrées dans :

```txt
payments
```

après qu’un client effectue un paiement.

---

## Endpoints

## Créer un lien

```http
POST /api/v1/payment-links
```

---

## Lister les liens

```http
GET /api/v1/payment-links
```

---

## Authentification

Cette API nécessite une Secret Key Kobara.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
```

---

## Créer un Payment Link

## Requête

```json
{
  "title": "Abonnement Premium",
  "description": "Accès premium pendant 30 jours",
  "amount": 2500,
  "currency": "HTG",
  "success_url": "https://monsite.com/success",
  "error_url": "https://monsite.com/error",
  "expires_at": "2026-06-01T00:00:00Z",
  "metadata": {
    "plan": "premium"
  }
}
```

---

## Champs

## `title`

Nom affiché sur la page paiement.

Correspond à :

```txt
payment_links.title
```

Exemple :

```json
"title": "Abonnement Premium"
```

---

## `description`

Description affichée au client.

Correspond à :

```txt
payment_links.description
```

---

## `amount`

Montant fixe du paiement.

Correspond à :

```txt
payment_links.amount
```

⚠️ Si ce champ est vide (`null`), le client peut entrer son propre montant.

Très utile pour :

* dons ;
* paiements libres ;
* fundraising.

---

## `currency`

Devise du paiement.

```json
"currency": "HTG"
```

---

## `success_url`

Redirection après paiement réussi.

---

## `error_url`

Redirection après :

* échec ;
* annulation ;
* expiration.

---

## `expires_at`

Date d’expiration du lien.

Correspond à :

```txt
payment_links.expires_at
```

Après expiration :

* le lien devient inutilisable ;
* les paiements sont refusés.

---

## `metadata`

Objet JSON libre.

Stocké dans :

```txt
payment_links.metadata
```

---

## Réponse API

```json
{
  "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "merchant_id": "7db0f6f7-81d2-4b52-bd58-2b8d1f0b37d0",
  "title": "Abonnement Premium",
  "description": "Accès premium pendant 30 jours",
  "amount": 2500,
  "currency": "HTG",
  "slug": "premium-plan-29dk3",
  "status": "active",
  "success_url": "https://monsite.com/success",
  "error_url": "https://monsite.com/error",
  "expires_at": "2026-06-01T00:00:00Z",
  "metadata": {
    "plan": "premium"
  },
  "checkout_url": "https://pay.kobara.app/l/premium-plan-29dk3",
  "created_at": "2026-05-09T18:40:00Z"
}
```

---

## Checkout URL

Le lien public généré :

```txt
https://pay.kobara.app/l/premium-plan-29dk3
```

peut être partagé :

* sur WhatsApp ;
* sur Instagram ;
* dans une bio TikTok ;
* par SMS ;
* dans une facture ;
* sur un bouton paiement.

---

## Statuts Payment Link

| Statut   | Description |
| -------- | ----------- |
| active   | lien actif  |
| disabled | désactivé   |
| expired  | expiré      |

Correspond à :

```txt
payment_links.status
```

---

## Workflow Payment Link

```txt
1. Merchant crée un lien.
2. Kobara génère checkout_url.
3. Merchant partage le lien.
4. Client ouvre la page paiement.
5. Client paie via MonCash.
6. Kobara crée une entrée payments.
7. Webhook envoyé.
8. Dashboard mis à jour.
```

---

## Exemple Node.js

```js
const paymentLink = await kobara.paymentLinks.create({
  title: "Abonnement Premium",
  amount: 2500,
  currency: "HTG",
  success_url: "https://monsite.com/success",
  error_url: "https://monsite.com/error"
});
```

---

## Exemple cURL

```bash
curl https://api.kobara.app/api/v1/payment-links \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Abonnement Premium",
    "amount": 2500,
    "currency": "HTG"
  }'
```

---

# Webhooks

Les **Webhooks** permettent à Kobara d’envoyer des événements en temps réel vers votre serveur.

Ils sont essentiels pour :

* confirmer un paiement ;
* mettre à jour une commande ;
* débloquer un abonnement ;
* envoyer une notification ;
* synchroniser votre système.

Les événements webhook sont enregistrés dans :

```txt
webhook_events
```

et les endpoints dans :

```txt
webhook_endpoints
```

---

## Fonctionnement

```txt
Client paie
↓
Kobara reçoit confirmation
↓
Kobara déclenche webhook
↓
Votre serveur reçoit événement
↓
Votre système met à jour la commande
```

---

## Endpoint webhook côté client

Exemple :

```txt
https://monsite.com/api/webhooks/kobara
```

Méthode :

```http
POST
```

---

## Headers envoyés

```http
Kobara-Signature
Kobara-Event
Kobara-Timestamp
Content-Type: application/json
```

---

## Vérification sécurité

Votre serveur doit toujours :

* vérifier `Kobara-Signature` ;
* vérifier le timestamp ;
* vérifier que la requête vient bien de Kobara.

⚠️ Ne jamais traiter un webhook sans validation signature.

---

## Exemple Header

```http
Kobara-Signature: t=1715264000,v1=2f8a...
Kobara-Event: payment.succeeded
```

---

## Payload webhook

```json
{
  "id": "evt_29dj39dk2",
  "type": "payment.succeeded",
  "created_at": "2026-05-09T18:55:00Z",
  "data": {
    "payment": {
      "id": "pay_92jd82",
      "kobara_reference": "KBR-PAY-20260509-001",
      "amount": 2500,
      "currency": "HTG",
      "status": "succeeded"
    }
  }
}
```

---



## Vérification Signature (Node.js)

```js
import crypto from "crypto";

const signature = req.headers["kobara-signature"];
const payload = JSON.stringify(req.body);

const expected = crypto
  .createHmac("sha256", process.env.KOBARA_WEBHOOK_SECRET)
  .update(payload)
  .digest("hex");

if (signature !== expected) {
  throw new Error("Invalid webhook signature");
}
```

---

## Bonnes pratiques

## Obligatoire

✅ vérifier la signature
✅ répondre rapidement `200 OK`
✅ logger les événements
✅ utiliser HTTPS
✅ protéger le endpoint webhook

---

## Interdit

❌ traiter le webhook sans vérification
❌ exposer le webhook secret
❌ faire confiance uniquement au frontend
❌ ignorer les retries webhook

---

## Retries automatiques

Si votre serveur ne répond pas correctement :

```http
200 OK
```

Kobara réessaiera automatiquement l’envoi.

Les retries sont enregistrés dans :

```txt
webhook_events.retry_count
```

---

# Withdrawals API

Les **Withdrawals** permettent aux marchands Kobara de transférer les fonds disponibles depuis leur balance marchande vers un portefeuille mobile autorisé.

Chaque retrait est enregistré et suivi dans le système Kobara avec :

* un identifiant unique ;
* le montant ;
* le wallet destination ;
* le statut ;
* les références internes ;
* les timestamps ;
* les métadonnées personnalisées.

---

## Endpoint

```http
POST /api/v1/withdrawals
```

Base URL :

```txt
https://api.kobara.app
```

---

## Authentification

Cette route nécessite une Secret Key Kobara.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
```

Toutes les requêtes doivent être effectuées via HTTPS.

---

## Conditions avant retrait

Le marchand doit :

* avoir un compte actif ;
* disposer d’un solde disponible suffisant ;
* respecter les limites de son abonnement ;
* respecter les éventuelles limites KYC ;
* fournir un wallet valide.

Kobara vérifie automatiquement :

* la balance disponible ;
* les limites journalières ;
* les limites mensuelles ;
* le statut du compte ;
* les permissions API.

---

## Créer un retrait

## Requête

```json
{
  "amount": 5000,
  "wallet": "509XXXXXX",
  "description": "Retrait principal boutique",
  "webhook_url": "https://monsite.com/webhooks/kobara",
  "metadata": {
    "internal_payout_id": "PAYOUT-8844"
  }
}
```

---

## Champs

## `amount`

Montant du retrait.

Correspond à :

```txt
withdrawals.amount
```

---

## `wallet`

Numéro destination du retrait.

Correspond à :

```txt
withdrawals.wallet
```

Exemple :

```json
"wallet": "509XXXXXX"
```

---

## `description`

Description interne du retrait.

Correspond à :

```txt
withdrawals.description
```

---

## `webhook_url`

URL qui recevra les événements liés au retrait.

---

## `metadata`

Objet JSON libre permettant de stocker des références internes.

Correspond à :

```txt
withdrawals.metadata
```

---

## Réponse API

```json
{
  "id": "7d89abc1-23de-44bc-91fd-2c8b2d3c1a55",
  "merchant_id": "f4db35f5-6a8e-4e2d-9155-95b05f1d8a91",
  "reference": "KBR-WD-20260509-001",
  "amount": 5000,
  "fees": 0,
  "total": 5000,
  "wallet": "509XXXXXX",
  "description": "Retrait principal boutique",
  "status": "pending",
  "webhook_url": "https://monsite.com/webhooks/kobara",
  "created_at": "2026-05-09T19:10:00Z"
}
```

---

## Champs de réponse

## `id`

UUID interne du retrait.

Correspond à :

```txt
withdrawals.id
```

---

## `reference`

Référence unique Kobara du retrait.

Correspond à :

```txt
withdrawals.reference
```

---

## `amount`

Montant demandé.

---

## `fees`

Frais appliqués au retrait.

Correspond à :

```txt
withdrawals.fees
```

---

## `total`

Montant total débité du solde marchand.

Correspond à :

```txt
withdrawals.total
```

---

## `wallet`

Wallet destination.

---

## `status`

Statut actuel du retrait.

Valeurs possibles :

| Statut     | Description         |
| ---------- | ------------------- |
| pending    | retrait créé        |
| processing | traitement en cours |
| completed  | retrait terminé     |
| failed     | retrait échoué      |
| cancelled  | retrait annulé      |

Correspond à :

```txt
withdrawals.status
```

---

## Workflow retrait

```txt
1. Le marchand demande un retrait.
2. Kobara vérifie la balance disponible.
3. Kobara crée l'entrée withdrawals.
4. Le retrait est traité.
5. Le statut est mis à jour.
6. Un webhook est envoyé.
7. Le dashboard merchant est synchronisé.
```

---


## Exemple Node.js

```js
const withdrawal = await kobara.withdrawals.create({
  amount: 5000,
  wallet: "509XXXXXX",
  description: "Retrait boutique"
});
```

---

## Exemple cURL

```bash
curl https://api.kobara.app/api/v1/withdrawals \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "wallet": "509XXXXXX"
  }'
```

---

## Sécurité

## Obligatoire

✅ vérifier la balance disponible
✅ logger tous les retraits
✅ vérifier les limites abonnement
✅ protéger les Secret Keys
✅ utiliser HTTPS

---

## Interdit

❌ effectuer les retraits côté frontend
❌ exposer les Secret Keys
❌ bypass l’API Kobara
❌ autoriser un retrait sans validation balance

---

## Événements Webhook liés

| Event                 | Description        |
| --------------------- | ------------------ |
| withdrawal.created    | retrait créé       |
| withdrawal.processing | traitement démarré |
| withdrawal.completed  | retrait terminé    |
| withdrawal.failed     | retrait échoué     |

---

# Metadata Expansion

Kobara supporte les objets `metadata` sur plusieurs ressources :

* payments ;
* payment_links ;
* withdrawals ;
* customers.

Les metadata permettent de relier les objets Kobara à votre propre système métier.

---

## Metadata

## Objectif

Le champ `metadata` permet d’ajouter des données personnalisées :

* ID commande ;
* ID utilisateur ;
* plan ;
* source ;
* tags ;
* références internes.

---

## Exemple metadata

```json
"metadata": {
  "internal_order_id": "ORD-8844",
  "user_id": "usr_9922",
  "campaign": "summer-sale"
}
```

---

## Bonnes pratiques Metadata

## Recommandé

✅ stocker des IDs internes
✅ stocker des références métier
✅ stocker des données reconciliation

---

## À éviter

❌ mots de passe
❌ tokens
❌ données sensibles
❌ secrets API

---

## Expansion des objets

Pour optimiser les performances, certains endpoints retournent uniquement les IDs liés.

Exemple :

```json
{
  "customer_id": "cus_123"
}
```

---

## Paramètre expand

Vous pouvez demander à Kobara de développer certains objets liés.

Exemple :

```http
GET /api/v1/payments/pay_123?expand[]=customer
```

---

## Exemple réponse expand

```json
{
  "id": "pay_123",
  "customer": {
    "id": "cus_123",
    "name": "Jean Exemple",
    "email": "jean@example.com"
  }
}
```

---

## Expansions supportées

| Ressource      | Expand disponible |
| -------------- | ----------------- |
| payments       | customer          |
| payments       | payment_link      |
| webhook_events | webhook_endpoint  |
| withdrawals    | merchant          |

---

## Bonnes pratiques Expansion

## Recommandé

✅ utiliser expand uniquement si nécessaire
✅ limiter les expansions profondes
✅ utiliser pagination

---

## À éviter

❌ expand massif
❌ nested expansions excessives
❌ charger des objets inutilement

---

# Errors API

L’API Kobara utilise les codes HTTP standards pour communiquer le résultat d’une requête.

Les réponses sont toujours structurées afin de permettre :

* un debugging rapide ;
* une gestion fiable des erreurs ;
* une meilleure expérience utilisateur ;
* une intégration robuste côté backend.

---

## Structure générale des erreurs

Lorsqu’une erreur survient, Kobara retourne :

* un code HTTP ;
* un objet `error` ;
* un message lisible ;
* un type d’erreur ;
* parfois le paramètre concerné.

---

## Format de réponse erreur

```json id="kobara-error-format"
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "Le champ 'amount' est requis.",
    "param": "amount"
  }
}
```

---

## Champs de l’objet error

| Champ   | Description            |
| ------- | ---------------------- |
| type    | catégorie de l’erreur  |
| code    | code technique interne |
| message | message lisible        |
| param   | champ concerné         |

---

## Codes HTTP supportés

## 200 / 201 — Success

La requête a réussi.

Exemples :

* paiement créé ;
* lien généré ;
* webhook enregistré ;
* retrait accepté.

---

## Exemple

```json id="success-response"
{
  "id": "pay_92a8f",
  "status": "pending"
}
```

---

## 400 — Bad Request

La requête est invalide.

Causes fréquentes :

* champ manquant ;
* montant invalide ;
* mauvais format JSON ;
* devise invalide ;
* payload vide.

---

## Exemple

```json id="bad-request"
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "Le champ 'amount' est requis.",
    "param": "amount"
  }
}
```

---

## 401 — Unauthorized

La requête n’est pas authentifiée.

Causes fréquentes :

* Secret Key absente ;
* clé invalide ;
* clé révoquée ;
* mauvais Bearer token.

---

## Exemple

```json id="unauthorized-response"
{
  "error": {
    "type": "authentication_error",
    "code": "invalid_api_key",
    "message": "La clé API fournie est invalide."
  }
}
```

---

## 403 — Forbidden

La clé API ne possède pas les permissions nécessaires.

Causes fréquentes :

* utilisation d’une clé publique côté serveur ;
* tentative de retrait avec clé publique ;
* permissions insuffisantes ;
* environnement incorrect.

---

## Exemple

```json id="forbidden-response"
{
  "error": {
    "type": "permission_error",
    "code": "forbidden",
    "message": "Cette action nécessite une Secret Key."
  }
}
```

---

## 404 — Not Found

La ressource demandée n’existe pas.

Causes fréquentes :

* payment introuvable ;
* payment_link supprimé ;
* webhook inexistant ;
* mauvais ID.

---

## Exemple

```json id="not-found-response"
{
  "error": {
    "type": "invalid_request_error",
    "code": "resource_missing",
    "message": "Le paiement demandé est introuvable."
  }
}
```

---

## 409 — Conflict

Conflit lié à l’idempotence ou à l’état de la ressource.

Causes fréquentes :

* même Idempotency-Key réutilisée ;
* double création ;
* conflit de traitement.

---

## Exemple

```json id="conflict-response"
{
  "error": {
    "type": "idempotency_error",
    "code": "key_already_used",
    "message": "Cette clé d'idempotence a déjà été utilisée."
  }
}
```

---

## 429 — Too Many Requests

La limite de requêtes API a été dépassée.

Kobara applique un rate limit pour :

* protéger l’infrastructure ;
* éviter les abus ;
* garantir la stabilité.

---

## Bonnes pratiques

✅ utiliser retry avec backoff
✅ limiter les boucles API
✅ utiliser cache local
✅ utiliser webhooks plutôt que polling

---

## Exemple

```json id="rate-limit-response"
{
  "error": {
    "type": "rate_limit_error",
    "code": "too_many_requests",
    "message": "Trop de requêtes envoyées."
  }
}
```

---

## 500+ — Server Error

Erreur interne inattendue.

Causes possibles :

* erreur serveur ;
* timeout ;
* service temporairement indisponible ;
* erreur infrastructure.

---

## Exemple

```json id="server-error-response"
{
  "error": {
    "type": "api_error",
    "code": "internal_error",
    "message": "Une erreur interne est survenue."
  }
}
```

---

## Types d’erreurs

| Type                  | Description               |
| --------------------- | ------------------------- |
| invalid_request_error | requête invalide          |
| authentication_error  | problème authentification |
| permission_error      | permissions insuffisantes |
| rate_limit_error      | limite dépassée           |
| api_error             | erreur interne            |
| idempotency_error     | conflit idempotence       |

---

## Gestion recommandée côté backend

### Toujours faire

✅ logger les erreurs
✅ logger les request_id
✅ afficher un message utilisateur propre
✅ utiliser try/catch
✅ gérer les retries intelligemment

---

## Exemple Node.js

```js id="node-error-handling"
try {
  const payment = await kobara.payments.create({
    amount: 1000
  });

} catch (error) {

  console.error(error);

  if (error.code === "parameter_missing") {
    return res.status(400).json({
      message: "Montant requis"
    });
  }

  return res.status(500).json({
    message: "Erreur interne"
  });
}
```

---

## Exemple Frontend

```js id="frontend-error-example"
if (response.error) {
  showToast(response.error.message);
}
```

---

## Gestion des retries

Certaines erreurs peuvent être retentées automatiquement :

| Code | Retry recommandé |
| ---- | ---------------- |
| 429  | oui              |
| 500  | oui              |
| 503  | oui              |
| 400  | non              |
| 401  | non              |

---

## Retry exponentiel recommandé

```txt id="retry-strategy"
1ère tentative : 1 seconde
2ème tentative : 2 secondes
3ème tentative : 4 secondes
4ème tentative : 8 secondes
```

---

## Sécurité

Ne jamais :

* exposer les détails internes serveur ;
* afficher les stack traces ;
* afficher les Secret Keys ;
* retourner les erreurs SQL brutes.

---

## Bonnes pratiques UX

## Recommandé

✅ messages utilisateur simples
✅ logs détaillés côté serveur
✅ retry automatique discret
✅ états loading/error clairs

---

## Exemple UX

❌ Mauvais :

```txt id="bad-ux"
SQLSTATE[42P01]: relation payments does not exist
```

✅ Bon :

```txt id="good-ux"
Une erreur est survenue lors du paiement. Réessayez dans quelques instants.
```

---

## Corrélation & Debugging

Chaque requête Kobara peut retourner un identifiant interne :

```http id="request-id"
Kobara-Request-Id: req_82hd7s9sh
```

Conservez cet ID dans vos logs pour faciliter :

* le debugging ;
* le support ;
* les audits techniques.

---
