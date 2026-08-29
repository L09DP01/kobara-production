# Withdrawals API

Les **Withdrawals** permettent aux marchands Kobara de transférer les fonds disponibles depuis leur balance marchande vers un portefeuille mobile autorisé.

Chaque retrait est enregistré et suivi dans le système Kobara avec :

* un identifiant unique ;
* le montant ;
* le wallet destination ;
* le statut ;
* les références internes ;
* les timestamps ;
* les métadonnées personnalisées.

---

## Endpoint

```http
POST /api/v1/withdrawals
```

Base URL :

```txt
https://api.kobara.app
```

---

## Authentification

Cette route nécessite une Secret Key Kobara.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
```

Toutes les requêtes doivent être effectuées via HTTPS.

---

## Conditions avant retrait

Le marchand doit :

* avoir un compte actif ;
* disposer d’un solde disponible suffisant ;
* respecter les limites de son abonnement ;
* respecter les éventuelles limites KYC ;
* fournir un wallet valide.

Kobara vérifie automatiquement :

* la balance disponible ;
* les limites journalières ;
* les limites mensuelles ;
* le statut du compte ;
* les permissions API.

---

## Créer un retrait

## Requête

```json
{
  "amount": 5000,
  "wallet": "509XXXXXX",
  "description": "Retrait principal boutique",
  "webhook_url": "https://monsite.com/webhooks/kobara",
  "metadata": {
    "internal_payout_id": "PAYOUT-8844"
  }
}
```

---

## Champs

## `amount`

Montant du retrait.

Correspond à :

```txt
withdrawals.amount
```

---

## `wallet`

Numéro destination du retrait.

Correspond à :

```txt
withdrawals.wallet
```

Exemple :

```json
"wallet": "509XXXXXX"
```

---

## `description`

Description interne du retrait.

Correspond à :

```txt
withdrawals.description
```

---

## `webhook_url`

URL qui recevra les événements liés au retrait.

---

## `metadata`

Objet JSON libre permettant de stocker des références internes.

Correspond à :

```txt
withdrawals.metadata
```

---

## Réponse API

```json
{
  "id": "7d89abc1-23de-44bc-91fd-2c8b2d3c1a55",
  "merchant_id": "f4db35f5-6a8e-4e2d-9155-95b05f1d8a91",
  "reference": "KBR-WD-20260509-001",
  "amount": 5000,
  "fees": 0,
  "total": 5000,
  "wallet": "509XXXXXX",
  "description": "Retrait principal boutique",
  "status": "pending",
  "webhook_url": "https://monsite.com/webhooks/kobara",
  "created_at": "2026-05-09T19:10:00Z"
}
```

---

## Champs de réponse

## `id`

UUID interne du retrait.

Correspond à :

```txt
withdrawals.id
```

---

## `reference`

Référence unique Kobara du retrait.

Correspond à :

```txt
withdrawals.reference
```

---

## `amount`

Montant demandé.

---

## `fees`

Frais appliqués au retrait.

Correspond à :

```txt
withdrawals.fees
```

---

## `total`

Montant total débité du solde marchand.

Correspond à :

```txt
withdrawals.total
```

---

## `wallet`

Wallet destination.

---

## `status`

Statut actuel du retrait.

Valeurs possibles :

| Statut     | Description         |
| ---------- | ------------------- |
| pending    | retrait créé        |
| processing | traitement en cours |
| completed  | retrait terminé     |
| failed     | retrait échoué      |
| cancelled  | retrait annulé      |

Correspond à :

```txt
withdrawals.status
```

---

## Workflow retrait

```txt
1. Le marchand demande un retrait.
2. Kobara vérifie la balance disponible.
3. Kobara crée l'entrée withdrawals.
4. Le retrait est traité.
5. Le statut est mis à jour.
6. Un webhook est envoyé.
7. Le dashboard merchant est synchronisé.
```

---


## Exemple Node.js

```js
const withdrawal = await kobara.withdrawals.create({
  amount: 5000,
  wallet: "509XXXXXX",
  description: "Retrait boutique"
});
```

---

## Exemple cURL

```bash
curl https://api.kobara.app/api/v1/withdrawals \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "wallet": "509XXXXXX"
  }'
```

---

## Sécurité

## Obligatoire

✅ vérifier la balance disponible
✅ logger tous les retraits
✅ vérifier les limites abonnement
✅ protéger les Secret Keys
✅ utiliser HTTPS

---

## Interdit

❌ effectuer les retraits côté frontend
❌ exposer les Secret Keys
❌ bypass l’API Kobara
❌ autoriser un retrait sans validation balance

---

## Événements Webhook liés

| Event                 | Description        |
| --------------------- | ------------------ |
| withdrawal.created    | retrait créé       |
| withdrawal.processing | traitement démarré |
| withdrawal.completed  | retrait terminé    |
| withdrawal.failed     | retrait échoué     |

---

