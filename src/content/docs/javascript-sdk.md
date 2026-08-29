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

const kobara = new Kobara("kbr_pk_test_xxxxxxxxx");
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

const kobara = new Kobara("kbr_pk_test_xxxxxxxxx");

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

