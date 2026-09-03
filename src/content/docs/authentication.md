# Authentification API

Les routes publiques Production utilisent une Secret API Key Live transmise comme Bearer Token. Cette clé donne accès à des opérations financières et doit rester exclusivement sur votre serveur.

## Base URL Production

```txt
https://api.kobara.app
```

Les endpoints disponibles sont:

```http
POST /v1/payments
POST /v1/withdrawals
```

## En-têtes requis

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
Content-Type: application/json
Idempotency-Key: identifiant-unique-de-la-demande
```

`Idempotency-Key` est obligatoire pour les créations de paiement et de retrait. Réutilisez une clé seulement pour relancer exactement la même requête.

## Restrictions Production

L'API `api.kobara.app` refuse:

* les clés publiques `kbr_pk_...`;
* les clés Sandbox `kbr_sk_test_...`;
* les clés révoquées;
* les comptes sans KYC approuvé ou suspendus.

Les SDK officiels JavaScript/TypeScript, Node.js, Python et PHP utilisent tous une Secret API Key. Aucun de ces SDK ne doit être exécuté dans un navigateur ou une application mobile.

## Exemple cURL

```bash
curl https://api.kobara.app/v1/payments \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment-order-1001" \
  -d '{
    "amount": 1000,
    "currency": "HTG",
    "provider": "kobara"
  }'
```

## Sécurité

Stockez la clé dans une variable d'environnement serveur. Ne la placez jamais dans un nom de variable `NEXT_PUBLIC_`, du JavaScript livré au navigateur, une application mobile, un dépôt Git ou des logs.

