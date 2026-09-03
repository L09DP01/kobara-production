# Quickstart : Intégration avec Kobara

Bienvenue dans la documentation officielle de **Kobara**, la passerelle permettant d'accepter les moyens locaux et internationaux activés sur votre compte marchand.

Si vous cherchez **api moncash**, **moncash api**, **api natcash** ou **natcash api**, Kobara fournit une API unique pour creer un paiement, rediriger le client vers le checkout et recevoir la confirmation via webhook.

Ce guide rapide vous montrera comment accepter votre premier paiement en moins de 10 minutes.

---

## 1. Créer un compte marchand

Avant de commencer à intégrer l'API, vous devez posséder un compte Kobara actif.

1. Rendez-vous sur la page d'[Inscription](https://kobara.app/register).
2. Remplissez les informations de votre entreprise.
3. Vérifiez votre adresse email.
4. (Optionnel pour le mode Test) Soumettez vos documents KYC pour activer le mode **Live**.

---

## 2. Récupérer vos clés API

Toutes les requêtes adressées à Kobara nécessitent une authentification.

1. Connectez-vous à votre [Dashboard](https://dashboard.kobara.app).
2. Dans le menu de gauche, allez dans **Développeurs > API Keys**.
3. Créez une `Secret API Key Live` (`kbr_sk_live_...`) et conservez-la uniquement sur votre serveur. L'API Production n'accepte ni clé publique ni clé Sandbox.

---

## 3. Accepter un paiement (Exemple API)

La méthode la plus directe pour accepter un paiement est d'appeler l'API de création de paiement depuis votre serveur backend.

### Requête (Node.js / cURL)

```bash
curl -X POST https://api.kobara.app/v1/payments \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "amount": 2500,
    "currency": "HTG",
    "provider": "kobara",
    "customer": {
      "name": "Jean Dupont",
      "phone": "37000000"
    },
    "metadata": {
      "order_id": "ORD-12345"
    },
    "success_url": "https://votre-site.com/checkout/success",
    "cancel_url": "https://votre-site.com/checkout/cancel"
  }'
```

> **💡 Tip : Le champ `provider`**
> - `"kobara"` **(défaut)** : Page de checkout unifiée; le client choisit parmi les moyens actifs.
> - `"moncash"` : Redirige directement vers MonCash.
> - `"natcash"` : Redirige directement vers NatCash.
> - `"card"`, `"paypal"`, `"apple_pay"`, `"google_pay"` : Présélectionne un moyen international si le compte USD et le moyen sont actifs.
>
> Si vous ne spécifiez pas de `provider`, le défaut est `"kobara"`.

### Réponse

L'API retourne un identifiant et une URL `checkout_url`. Redirigez le client vers cette URL pour terminer le paiement sur le checkout hébergé Kobara.

```json
{
  "status": "success",
  "data": {
    "id": "pay_9a8b7c6d5e4f",
    "checkout_url": "https://kobara.app/pay/pay_9a8b7c6d5e4f",
    "status": "pending"
  }
}
```

---

## 4. Écouter les Webhooks (Validation)

Ne vous fiez pas uniquement à la page de succès (`success_url`) pour valider la commande d'un client. Le client pourrait fermer son navigateur trop tôt.

Vous devez configurer un **Webhook** pour que Kobara notifie votre serveur dès que le paiement est réellement confirmé (que ce soit via MonCash ou NatCash).

1. Allez dans **Dashboard > Webhooks**.
2. Ajoutez l'URL de votre serveur (ex: `https://api.votre-site.com/webhooks/kobara`).
3. Écoutez l'événement `payment.succeeded`.

```json
{
  "event_type": "payment.succeeded",
  "data": {
    "payment_id": "pay_9a8b7c6d5e4f",
    "amount": 2500,
    "net_amount": 2427.50,
    "metadata": {
      "order_id": "ORD-12345"
    }
  }
}
```
*Dès que vous recevez ce Webhook, vous pouvez marquer la commande comme "Payée" dans votre base de données !*

---

## Prochaines étapes

Maintenant que vous avez compris le flux global, explorez nos guides détaillés pour votre stack technologique :

* [Comprendre l'Authentification API](/docs/authentication)
* [Utiliser les SDKs (Node.js, PHP, Python)](/docs/nodejs-sdk)
* [Générer des liens de paiement sans coder](/docs/payment-links)
* [Installer le Plugin WordPress/WooCommerce](/docs/wordpress-plugin)
