# SDK Python

Le SDK Python officiel crée des paiements Kobara, demande des retraits MonCash ou NatCash et vérifie les webhooks. Utilisez-le uniquement dans votre backend avec une Secret API Key Live.

## Installation

```bash
pip install kobara
```

## Initialisation

```python
import os
from kobara import Kobara

client = Kobara(api_key=os.environ["KOBARA_SECRET_KEY"])
```

L'URL Production utilisée par défaut est `https://api.kobara.app/v1`.

## Créer un paiement

```python
payment = client.payments.create({
    "amount": 2500,
    "currency": "HTG",
    "provider": "kobara",
    "description": "Commande ORDER-001",
    "customer": {
        "name": "Jean Pierre",
        "email": "jean@example.com",
        "phone": "50937000000",
    },
    "success_url": "https://boutique.example/success",
    "cancel_url": "https://boutique.example/cancel",
    "metadata": {"order_id": "ORDER-001"},
}, idempotency_key="payment-ORDER-001")

print(payment["data"]["checkout_url"])
```

Sans `idempotency_key`, le SDK génère une UUID. Fournissez une clé stable pour pouvoir relancer exactement la même requête après une coupure réseau.

### Fournisseurs de paiement

`provider` accepte `kobara`, `moncash`, `moncash_web`, `moncash_ussd`, `natcash`, `natcash_web`, `natcash_ussd`, `card`, `carte`, `paypal`, `apple_pay` et `google_pay`.

`kobara` ouvre le checkout unifié. Une autre valeur présélectionne le moyen correspondant, sous réserve qu'il soit actif pour le marchand et globalement disponible. Les moyens internationaux nécessitent un compte USD actif. Les données sensibles sont saisies sur le checkout Kobara, jamais dans le payload SDK.

## Créer un retrait

```python
withdrawal = client.withdrawals.create({
    "amount": 1000,
    "method": "moncash",
    "account_currency": "HTG",
    "wallet": "50934567890",
    "description": "Retrait principal boutique",
}, idempotency_key="withdrawal-ORDER-001")

print(withdrawal["data"]["status"])
print(withdrawal["data"]["payout_amount"])
```

Seuls `moncash` et `natcash` sont acceptés. Le compte source peut être `HTG` ou `USD`, mais le portefeuille reçoit des HTG. Les frais sont de 5 % du montant brut. Un encaissement local devient disponible au premier des deux moments suivants: 12 heures après sa confirmation ou à 08:00 le jour suivant en heure d'Haïti.

## Vérifier un webhook

```python
event = client.webhooks.construct_event(
    raw_body,
    request.headers["Kobara-Signature"],
    os.environ["KOBARA_WEBHOOK_SECRET"],
)
```

Le helper vérifie `HMAC-SHA256(secret, timestamp + "." + rawBody)` et une tolérance anti-rejeu de cinq minutes. Utilisez le corps HTTP brut avant tout décodage JSON.

## Surface publique actuelle

Cette version correspond à `POST /v1/payments` et `POST /v1/withdrawals`. Les listes, consultations unitaires et liens de paiement ne sont pas exposés par l'API publique v1 actuelle; gérez-les dans le dashboard.
