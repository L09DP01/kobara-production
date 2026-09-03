# API Paiements Kobara (MonCash, NatCash, Carte Bancaire, Apple Pay & PayPal)

L'objet **Payment** représente une transaction de paiement initiée via Kobara.

Kobara sert de couche d'intégration unifiée pour **MonCash**, **NatCash**, **Carte Bancaire (Débit/Crédit)**, **Apple Pay**, **Google Pay** et **PayPal**. Une seule API permet de créer un paiement, choisir le moyen ou laisser le client choisir sur le checkout unifié, suivre le statut et recevoir les confirmations webhook.

Cette API permet de :

* créer une session de paiement (MonCash, NatCash, Carte/PayPal ou Kobara Checkout) ;
* générer une URL checkout sécurisée ;
* suivre le statut d'un paiement en temps réel ;
* recevoir les confirmations webhook signées HMAC ;
* synchroniser les transactions et soldes avec votre dashboard Kobara.

Toutes les transactions créées via cette API sont enregistrées dans la table `payments` avec référence unique, montants bruts, frais et montants nets.

---

## Endpoint

```http
POST /v1/payments
```

Base URL :
```txt
https://api.kobara.app
```

Exemple :
```http
POST https://api.kobara.app/v1/payments
```

---

## Authentification

Cette route nécessite une **Secret API Key** Kobara.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
```

⚠️ Les clés secrètes doivent toujours rester côté serveur.

---

## Idempotency Key

Pour éviter les doubles paiements causés par des retries ou pertes de connexion, envoyez systématiquement un header `Idempotency-Key` :

```http
Idempotency-Key: 8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712
```

---

## Créer un paiement

### Requête JSON

```json
{
  "amount": 2500,
  "currency": "HTG",
  "provider": "kobara",
  "description": "Abonnement Premium (1 mois)",
  "customer": {
    "name": "Jean Exemple",
    "email": "jean@example.com",
    "phone": "50934567890"
  },
  "metadata": {
    "internal_order_id": "ORD-89457",
    "plan_tier": "premium"
  },
  "success_url": "https://monsite.com/success",
  "cancel_url": "https://monsite.com/cancel"
}
```

---

## Champs de la requête

### `amount` *(number, requis)*
Montant du paiement (ex: `2500`).

### `currency` *(string, optionnel)*
Devise utilisée (`"HTG"` par défaut).

### `provider` *(string, optionnel)*
Spécifie l'expérience de paiement que vous souhaitez offrir à votre client :

* `"kobara"` **(Défaut, Recommandé)** : Redirige vers la page de *Kobara Checkout* unifié. Le client choisit librement parmi tous les moyens de paiement activés (MonCash, NatCash, Carte/PayPal).
* `"card"` *(alias historique : `"carte"`)* : présélectionne les champs sécurisés de carte de débit ou crédit sur le checkout Kobara.
* `"paypal"` : présélectionne la connexion au compte PayPal.
* `"apple_pay"` : présélectionne Apple Pay lorsque le navigateur et l’appareil sont éligibles.
* `"google_pay"` : présélectionne Google Pay lorsque le navigateur et l’appareil sont éligibles.
* `"moncash"` : Redirige **directement** vers la page de paiement MonCash.
* `"natcash"` : Redirige **directement** vers le paiement NatCash.

Les paiements internationaux sont convertis en USD selon le taux configuré par Kobara au moment où l’ordre est créé. Si la méthode demandée n’est pas disponible sur l’appareil, le checkout propose automatiquement une méthode compatible. Les données de carte ne transitent jamais par votre serveur ni par l’API de votre marchand.

### `description` *(string, optionnel)*
Description visible dans le dashboard et sur la page de paiement.

### `customer` *(object, optionnel)*
Informations du client (`name`, `email`, `phone`).

### `metadata` *(object, optionnel)*
Objet JSON libre permettant de stocker vos identifiants internes et références de commande.

### `success_url` *(string, optionnel)*
URL de redirection vers votre site après paiement réussi.

### `cancel_url` *(string, optionnel)*
URL de redirection vers votre site si le client annule le paiement.

---

## Réponse API

### Réponse 200 OK

```json
{
  "status": "success",
  "data": {
    "id": "4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
    "reference": "KOB1786816177430123456",
    "amount": 2500,
    "net_amount": 2427.5,
    "fee_amount": 72.5,
    "status": "pending",
    "environment": "live",
    "paid_at": null,
    "checkout_url": "https://pay.kobara.app/checkout/4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
    "url": "https://pay.kobara.app/checkout/4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
    "payment_url": "https://pay.kobara.app/checkout/4dd6a06c-cf68-42cf-91b5-2f3e92f5b861",
    "paymentUrl": "https://pay.kobara.app/checkout/4dd6a06c-cf68-42cf-91b5-2f3e92f5b861"
  }
}
```

---

## Exemple Node.js

```js
const response = await fetch("https://api.kobara.app/v1/payments", {
  method: "POST",
  headers: {
    "Authorization": "Bearer kbr_sk_live_VOTRE_CLE_API",
    "Content-Type": "application/json",
    "Idempotency-Key": "unique-order-uuid-12345"
  },
  body: JSON.stringify({
    amount: 2500,
    currency: "HTG",
    provider: "card", // Présélectionne la carte sur le checkout hébergé
    description: "Abonnement Premium",
    customer: {
      name: "Jean Exemple",
      email: "jean@example.com",
      phone: "50934567890"
    },
    success_url: "https://monsite.com/success",
    cancel_url: "https://monsite.com/cancel"
  })
});

const data = await response.json();
console.log("URL de redirection paiement :", data.data.checkout_url);
```

---

## Exemple cURL

```bash
curl https://api.kobara.app/v1/payments \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712" \
  -d '{
    "amount": 2500,
    "currency": "HTG",
    "provider": "kobara",
    "description": "Abonnement Premium",
    "customer": {
      "name": "Jean Exemple",
      "email": "jean@example.com",
      "phone": "50934567890"
    },
    "success_url": "https://monsite.com/success",
    "cancel_url": "https://monsite.com/cancel"
  }'
```
