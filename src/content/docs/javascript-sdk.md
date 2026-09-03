# SDK JavaScript / TypeScript

Le package `kobara-js` fournit un client TypeScript léger pour créer des paiements et des retraits Kobara. Malgré son nom, il doit être exécuté côté serveur: il utilise une Secret API Key Live qui ne doit jamais être intégrée à un bundle navigateur ou mobile.

## Installation

```bash
npm install kobara-js
```

## Initialisation

```ts
import { KobaraClient } from "kobara-js";

const kobara = new KobaraClient({
  apiKey: process.env.KOBARA_SECRET_KEY!,
});
```

L'URL par défaut est `https://api.kobara.app/v1`.

## Créer un paiement

```ts
const payment = await kobara.payments.create({
  amount: 1500,
  currency: "HTG",
  provider: "kobara",
  description: "Commande ORDER-001",
  customer: {
    name: "Jean Dupont",
    email: "jean@example.com",
    phone: "50937000000",
  },
  success_url: "https://boutique.example/success",
  cancel_url: "https://boutique.example/cancel",
}, {
  idempotencyKey: "payment-ORDER-001",
});

console.log(payment.data.checkout_url);
```

Le SDK génère une clé d'idempotence si elle n'est pas fournie. Une clé explicite et stable est recommandée pour les nouvelles tentatives réseau.

### Fournisseurs

Les valeurs acceptées sont `kobara`, `moncash`, `moncash_web`, `moncash_ussd`, `natcash`, `natcash_web`, `natcash_ussd`, `card`, `carte`, `paypal`, `apple_pay` et `google_pay`.

`kobara` affiche les moyens actifs sur le checkout unifié. Une valeur précise présélectionne ce moyen. Les moyens internationaux dépendent de leur activation pour le marchand et d'un compte USD actif.

## Créer un retrait

```ts
const withdrawal = await kobara.withdrawals.create({
  amount: 1000,
  method: "moncash",
  account_currency: "USD",
  wallet: "50934567890",
  description: "Retrait solde USD",
}, {
  idempotencyKey: "withdrawal-ORDER-001",
});

console.log(withdrawal.data.payout_amount);
```

Seuls les versements vers `moncash` et `natcash` sont exposés. Le compte source peut être HTG ou USD et le portefeuille reçoit des HTG après frais de 5 % et conversion éventuelle. Le délai de 24 heures s'applique aux encaissements locaux.

## Surface publique actuelle

Le SDK correspond à `POST /v1/payments` et `POST /v1/withdrawals`. Les méthodes de liste, de consultation et de création de liens annoncées par d'anciennes versions de ce guide ne correspondent pas à des routes publiques v1 et ont été retirées.

