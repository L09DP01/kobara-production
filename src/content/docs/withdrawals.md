# API Retraits

L'API Retraits permet d'envoyer le solde disponible d'un marchand vers un compte **MonCash** ou **NatCash**. La réservation du solde et la création du retrait sont atomiques afin d'éviter les doubles débits.

## Endpoint

```http
POST https://api.kobara.app/v1/withdrawals
```

Cette route accepte uniquement une **Secret API Key Live**. Elle doit être appelée depuis votre serveur.

```http
Authorization: Bearer kbr_sk_live_VOTRE_CLE_API
Idempotency-Key: retrait-commande-8844
Content-Type: application/json
```

`Idempotency-Key` est obligatoire. Réutilisez la même valeur uniquement pour relancer exactement la même demande. Kobara retournera le retrait existant sans débiter le solde une deuxième fois.

## Méthodes prises en charge

| Méthode | Devise reçue | Frais |
| --- | --- | ---: |
| `moncash` | HTG | 5 % |
| `natcash` | HTG | 5 % |

L'API publique ne prend pas en charge les retraits PayPal ou Zelle.

## Créer un retrait

```json
{
  "amount": 1000,
  "method": "moncash",
  "account_currency": "HTG",
  "wallet": "50934567890",
  "description": "Retrait principal boutique"
}
```

### Champs

| Champ | Type | Requis | Description |
| --- | --- | --- | --- |
| `amount` | number | oui | Montant brut à débiter du solde Kobara, avec deux décimales au maximum. |
| `method` | string | non | `moncash` ou `natcash`. Valeur par défaut: `moncash`. |
| `account_currency` | string | non | Compte Kobara à débiter: `HTG` ou `USD`. Valeur par défaut: `HTG`. |
| `wallet` | string | oui | Numéro haïtien du destinataire, avec ou sans l'indicatif `509`. |
| `description` | string | non | Description interne, limitée à 255 caractères. |

Si `account_currency` vaut `USD`, le compte USD du marchand doit être actif. Kobara convertit le montant net en HTG avec le taux enregistré au moment du retrait.

## Calcul des frais

Les frais de 5 % sont inclus dans le montant demandé et déduits avant l'envoi au portefeuille mobile.

Pour un retrait de `1000 HTG`:

```txt
Montant débité : 1000 HTG
Frais (5 %)    :   50 HTG
Montant envoyé :  950 HTG
```

Le délai de sécurité de 24 heures sur les encaissements MonCash et NatCash reste applicable. Un montant visible dans le solde peut donc ne pas être encore disponible au retrait.

## Réponse

Un retrait terminé immédiatement retourne `200 OK`. Un retrait accepté mais encore en cours de confirmation retourne `202 Accepted`.

```json
{
  "status": "success",
  "data": {
    "id": "7d89abc1-23de-44bc-91fd-2c8b2d3c1a55",
    "reference": "WTH8F3D4E2A93C24C0F",
    "status": "completed",
    "method": "moncash",
    "amount": 1000,
    "fees": 50,
    "net_amount": 950,
    "currency": "HTG",
    "payout_amount": 950,
    "payout_currency": "HTG",
    "exchange_rate": 130,
    "wallet": "50934567890",
    "description": "Retrait principal boutique",
    "created_at": "2026-09-03T15:00:00.000Z"
  }
}
```

`amount` représente le débit brut du compte, `fees` les frais retenus, `net_amount` le montant net dans la devise du compte source et `payout_amount` le montant envoyé en HTG.

## Exemple cURL

```bash
curl https://api.kobara.app/v1/withdrawals \
  -X POST \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: retrait-commande-8844" \
  -d '{
    "amount": 1000,
    "method": "natcash",
    "account_currency": "HTG",
    "wallet": "50941234567"
  }'
```

## Erreurs principales

| HTTP | Code | Signification |
| ---: | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Clé d'idempotence absente ou invalide. |
| 400 | `validation_error` | Corps JSON, méthode, montant ou numéro invalide. |
| 401 | `SECRET_API_KEY_REQUIRED` | Secret API Key absente ou invalide. |
| 403 | `KYC_REQUIRED` | Le compte marchand n'est pas autorisé à retirer. |
| 403 | `USD_ACCOUNT_INACTIVE` | Le compte USD choisi n'est pas actif. |
| 409 | `FUNDS_PENDING_RELEASE` | Une partie du solde est encore sous délai de sécurité. |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | La même clé a été utilisée avec une demande différente. |
| 429 | `RATE_LIMIT_EXCEEDED` | Trop de demandes ont été envoyées. |
| 502 | `PROVIDER_TRANSFER_FAILED` | L'opérateur a refusé le transfert et les fonds ont été recrédités. |

Ne relancez pas automatiquement une demande dont la réponse indique `verification_pending: true`. Kobara conserve alors les fonds réservés pendant la vérification du statut auprès de l'opérateur.
