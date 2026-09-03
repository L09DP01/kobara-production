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
POST /v1/payment-links
```

---

## Lister les liens

```http
GET /v1/payment-links
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
curl https://api.kobara.app/v1/payment-links \
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

