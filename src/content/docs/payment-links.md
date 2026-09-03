# Liens de paiement

Les liens de paiement permettent d'encaisser sans développer une intégration API. Le marchand crée le lien depuis son dashboard Kobara, choisit le montant et partage l'URL avec son client.

## Créer un lien

Dans le dashboard, utilisez **Créer un lien**, puis renseignez le montant, la devise, la description et, si nécessaire, les URLs de retour. Le client ouvre ensuite le checkout Kobara et choisit parmi les moyens actifs sur le compte marchand.

Les liens conviennent notamment aux ventes par WhatsApp, aux factures, aux dons et aux paiements ponctuels.

## Disponibilité API

La version publique v1 n'expose pas encore de route `/v1/payment-links`. Ne construisez donc pas d'appel SDK ou cURL vers ce chemin: il répondrait `404`.

Les SDK officiels actuels couvrent les deux opérations publiques disponibles:

```http
POST https://api.kobara.app/v1/payments
POST https://api.kobara.app/v1/withdrawals
```

La création, la désactivation et le suivi des liens de paiement restent disponibles dans le dashboard Kobara.

