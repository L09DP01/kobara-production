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

## Isolation test et live

Chaque endpoint appartient à un seul environnement et possède son propre secret de signature.

| Paiement | Endpoints sélectionnés | Header envoyé |
| --- | --- | --- |
| `test` | endpoints actifs `test` uniquement | `Kobara-Environment: test` |
| `live` | endpoints actifs `live` uniquement | `Kobara-Environment: live` |

Un paiement test n'est jamais envoyé à un endpoint live, et inversement. Les tests manuels et les relances restent également attachés à l'endpoint et à l'environnement d'origine.

Vous pouvez utiliser la même URL dans les deux environnements, mais Kobara les considère comme deux configurations distinctes. Utilisez de préférence deux URLs et deux secrets différents pour éviter de mélanger les données de test et de production.

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
Kobara-Environment
Kobara-Timestamp
Content-Type: application/json
```

---

## Vérification sécurité

Votre serveur doit toujours :

* vérifier `Kobara-Signature` ;
* vérifier que le timestamp date de moins de cinq minutes ;
* vérifier que le header et le payload indiquent le même environnement ;
* utiliser le secret de l'endpoint correspondant, et non une clé API Kobara ;
* dédupliquer le traitement avec `environment`, `event_type` et `data.id`.

⚠️ Ne jamais traiter un webhook sans validation signature.

---

## Exemple Header

```http
Kobara-Signature: t=1715264000,v1=2f8a...
Kobara-Event: payment.succeeded
Kobara-Environment: live
Kobara-Timestamp: 1715264000
```

---

## Calcul de la signature

Pour chaque tentative de livraison, Kobara :

1. sérialise le payload JSON et conserve exactement ce corps HTTP ;
2. génère `t`, un timestamp Unix en secondes ;
3. construit la chaîne signée `t + "." + rawBody` ;
4. calcule `HMAC-SHA256(secret_endpoint, chaine_signee)` en hexadécimal ;
5. envoie `Kobara-Signature: t=<timestamp>,v1=<signature>`.

Formule :

```txt
v1 = hex(HMAC-SHA256(webhook_secret, timestamp + "." + raw_http_body))
```

La vérification doit utiliser le **corps brut reçu**, avant tout `JSON.parse`. Une nouvelle sérialisation de l'objet JSON peut modifier les octets et invalider la signature.

---

## Payload webhook

```json
{
  "event_type": "payment.succeeded",
  "environment": "live",
  "timestamp": 1715264000,
  "data": {
    "id": "pay_92jd82",
    "reference": "KOB20260509001",
    "amount": 2500,
    "currency": "HTG",
    "status": "succeeded",
    "provider": "moncash",
    "environment": "live"
  }
}
```

> **Note :** Le champ `provider` et la méthode de paiement indiquent le moyen réellement utilisé par le client (`"moncash"`, `"natcash"`, `"card"`, `"paypal"`, `"apple_pay"` ou `"google_pay"`), même si vous aviez spécifié `"kobara"` lors de la création du paiement.

---



## Vérification Signature (Node.js)

```js
import crypto from "crypto";
import express from "express";

const app = express();

app.post(
  "/webhooks/kobara",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const rawBody = req.body.toString("utf8");
    const signatureHeader = req.get("Kobara-Signature") || "";
    const headerEnvironment = req.get("Kobara-Environment");
    const match = signatureHeader.match(/^t=(\d+),v1=([a-f0-9]{64})$/);

    if (!match) {
      return res.status(400).send("Invalid signature format");
    }

    const [, timestamp, signature] = match;
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));

    if (age > 300) {
      return res.status(400).send("Expired webhook");
    }

    const expected = crypto
      .createHmac("sha256", process.env.KOBARA_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );

    if (!valid) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(rawBody);
    if (
      event.environment !== headerEnvironment ||
      event.data?.environment !== headerEnvironment
    ) {
      return res.status(400).send("Environment mismatch");
    }

    // Dédupliquez avant d'appliquer la confirmation à votre commande.
    const eventKey = `${event.environment}:${event.event_type}:${event.data.id}`;
    console.log("Webhook vérifié", eventKey);

    return res.sendStatus(200);
  },
);
```

---

## Bonnes pratiques

## Obligatoire

✅ vérifier la signature
✅ répondre rapidement `200 OK`
✅ logger les événements
✅ utiliser HTTPS
✅ protéger le endpoint webhook
✅ traiter chaque événement de façon idempotente

---

## Interdit

❌ traiter le webhook sans vérification
❌ exposer le webhook secret
❌ faire confiance uniquement au frontend
❌ ignorer les retries webhook
❌ utiliser `JSON.stringify(req.body)` après le parsing pour vérifier la signature

---

## Relancer un webhook

Si votre serveur ne répond pas correctement :

```http
200 OK
```

Une livraison échouée apparaît dans les logs du dashboard. Utilisez l’action **Renvoyer** pour la relancer vers le même endpoint et dans le même environnement.

Les relances sont enregistrées dans :

```txt
webhook_events.retry_count
```

---

