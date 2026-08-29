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

    environment = request.headers.get(
        "kobara-environment"
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

        if event.get("environment") != environment:
            raise ValueError("Environment mismatch")

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

