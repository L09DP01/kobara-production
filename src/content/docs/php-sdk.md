# SDK PHP

Le SDK PHP officiel crée des paiements Kobara, demande des retraits MonCash ou NatCash et vérifie les webhooks. La Secret API Key Live doit rester sur votre serveur.

## Installation

```bash
composer require kobara/php-sdk
```

## Initialisation

```php
use Kobara\KobaraClient;

$kobara = new KobaraClient($_ENV['KOBARA_SECRET_KEY']);
```

L'URL Production utilisée par défaut est `https://api.kobara.app/v1`.

## Créer un paiement

```php
$payment = $kobara->payments->create([
    'amount' => 2500,
    'currency' => 'HTG',
    'provider' => 'kobara',
    'description' => 'Commande ORDER-001',
    'customer' => [
        'name' => 'Jean Pierre',
        'email' => 'jean@example.com',
        'phone' => '50937000000',
    ],
    'success_url' => 'https://boutique.example/success',
    'cancel_url' => 'https://boutique.example/cancel',
    'metadata' => ['order_id' => 'ORDER-001'],
], 'payment-ORDER-001');

echo $payment['data']['checkout_url'];
```

Le second argument est l'`Idempotency-Key`. Si vous l'omettez, le SDK en génère une. Réutilisez votre clé uniquement pour relancer le même payload.

### Fournisseurs de paiement

`provider` accepte `kobara`, `moncash`, `moncash_web`, `moncash_ussd`, `natcash`, `natcash_web`, `natcash_ussd`, `card`, `carte`, `paypal`, `apple_pay` et `google_pay`.

`kobara` laisse le client choisir sur le checkout unifié. Les autres valeurs présélectionnent un moyen actif. Carte, PayPal, Apple Pay et Google Pay exigent l'activation du compte USD. Les données sensibles restent sur le checkout hébergé Kobara.

## Créer un retrait

```php
$withdrawal = $kobara->withdrawals->create([
    'amount' => 1000,
    'method' => 'natcash',
    'account_currency' => 'HTG',
    'wallet' => '50941234567',
    'description' => 'Retrait principal boutique',
], 'withdrawal-ORDER-001');

echo $withdrawal['data']['status'];
```

L'API publique accepte uniquement `moncash` et `natcash`. Le compte débité peut être `HTG` ou `USD`; le montant envoyé au portefeuille est en HTG. Les frais sont de 5 % et les encaissements locaux sont admissibles au retrait après 24 heures.

## Vérifier un webhook

```php
$event = $kobara->webhooks->constructEvent(
    $rawBody,
    $_SERVER['HTTP_KOBARA_SIGNATURE'],
    $_ENV['KOBARA_WEBHOOK_SECRET'],
);
```

Le helper vérifie la chaîne signée `timestamp + "." + rawBody` ainsi qu'une fenêtre anti-rejeu de cinq minutes. Ne reconstruisez pas le JSON avant la vérification.

## Surface publique actuelle

Cette version correspond aux deux routes Production publiées: `POST /v1/payments` et `POST /v1/withdrawals`. Les autres opérations restent disponibles depuis le dashboard, pas depuis l'API publique v1.

