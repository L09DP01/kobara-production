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
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

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

  },
);
```

`req.body` doit être le `Buffer` brut reçu. Ne le remplacez pas par un objet déjà traité par `express.json()`.

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


