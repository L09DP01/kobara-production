# SDK Node.js

Le SDK Node.js officiel crée des paiements Kobara, demande des retraits MonCash ou NatCash et vérifie les webhooks. Utilisez-le uniquement côté serveur avec une Secret API Key Live.

## Installation

```bash
npm install kobara
```

## Initialisation

```js
import { Kobara } from "kobara";

const kobara = new Kobara({
  secretKey: process.env.KOBARA_SECRET_KEY,
});
```

L'URL Production utilisée par défaut est `https://api.kobara.app/v1`.

## Créer un paiement

```js
const payment = await kobara.payments.create({
  amount: 2500,
  currency: "HTG",
  provider: "kobara",
  description: "Commande ORDER-001",
  customer: {
    name: "Jean Pierre",
    email: "jean@example.com",
    phone: "50937000000",
  },
  success_url: "https://boutique.example/success",
  cancel_url: "https://boutique.example/cancel",
  metadata: { order_id: "ORDER-001" },
}, {
  idempotencyKey: "payment-ORDER-001",
});

console.log(payment.data.checkout_url);
```

Si `idempotencyKey` est omise, le SDK génère une UUID. Pour relancer une requête après une coupure réseau, fournissez votre propre clé stable et réutilisez-la uniquement avec le même contenu.

### Fournisseurs de paiement

| Valeur `provider` | Comportement |
| --- | --- |
| `kobara` | Checkout unifié; le client choisit parmi les moyens actifs. |
| `moncash`, `moncash_web`, `moncash_ussd` | Présélection MonCash. |
| `natcash`, `natcash_web`, `natcash_ussd` | Présélection NatCash. |
| `card` ou `carte` | Présélection carte bancaire. |
| `paypal` | Présélection PayPal. |
| `apple_pay` | Présélection Apple Pay sur les appareils compatibles. |
| `google_pay` | Présélection Google Pay sur les appareils compatibles. |

Une présélection internationale fonctionne seulement si ce moyen et le compte USD du marchand sont actifs. Les données de carte et de portefeuille sont saisies sur le checkout Kobara, jamais dans le payload SDK.

## Créer un retrait

L'API publique accepte uniquement `moncash` et `natcash`. Le compte débité peut être HTG ou USD; le portefeuille reçoit toujours des HTG.

```js
const withdrawal = await kobara.withdrawals.create({
  amount: 1000,
  method: "natcash",
  account_currency: "HTG",
  wallet: "50941234567",
  description: "Retrait principal boutique",
}, {
  idempotencyKey: "withdrawal-ORDER-001",
});

console.log(withdrawal.data.status);
console.log(withdrawal.data.payout_amount);
```

Les frais MonCash et NatCash sont de 5 % du montant brut. Les encaissements locaux deviennent admissibles au retrait après 24 heures. Un retrait peut répondre `200 OK` s'il est terminé ou `202 Accepted` s'il reste en traitement ou en vérification.

## Vérifier un webhook

```js
const event = kobara.webhooks.constructEvent(
  rawBody,
  request.headers["kobara-signature"],
  process.env.KOBARA_WEBHOOK_SECRET,
);
```

Le helper vérifie la signature `t=<timestamp>,v1=<hmac>`, signe exactement `timestamp + "." + rawBody` et refuse par défaut les événements vieux de plus de cinq minutes. Passez impérativement le corps HTTP brut.

## Surface publique actuelle

Cette version correspond aux routes Production publiées: `POST /v1/payments` et `POST /v1/withdrawals`. La consultation des transactions, la gestion des liens de paiement et la configuration des endpoints webhook se font actuellement dans le dashboard.

