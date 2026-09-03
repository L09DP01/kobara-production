# Clés API

Les clés API identifient le marchand et l'environnement qui effectue une requête. Créez, révoquez et renommez vos clés depuis **Dashboard > Clés API**.

## Clé secrète Production

Préfixe:

```txt
kbr_sk_live_
```

Elle authentifie les deux routes publiques de Production:

```http
POST https://api.kobara.app/v1/payments
POST https://api.kobara.app/v1/withdrawals
```

Elle est requise par tous les SDK officiels actuels et doit rester côté serveur.

## Clés Sandbox

Les clés `kbr_sk_test_...` appartiennent au Sandbox et ne sont pas acceptées par `api.kobara.app`. Utilisez-les uniquement avec l'environnement Test indiqué dans votre dashboard Sandbox.

## Clés publiques

Une clé `kbr_pk_...` n'autorise ni paiement, ni retrait sur l'API publique v1 Production. Elle ne doit pas être passée aux SDK serveur documentés ici. Le checkout reçu après la création d'un paiement est une URL hébergée: votre frontend redirige le client vers cette URL sans recevoir la Secret API Key.

## Rotation

Lors d'une rotation:

1. créez une nouvelle clé;
2. déployez-la dans votre backend;
3. vérifiez un appel de paiement;
4. révoquez l'ancienne clé.

Ne stockez jamais une clé réelle dans le code, Git, les logs, `localStorage` ou une variable publique de frontend.

