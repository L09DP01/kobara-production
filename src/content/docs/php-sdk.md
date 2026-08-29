# PHP SDK

Le SDK PHP officiel de Kobara permet d’intégrer facilement :

* les paiements MonCash ;
* les liens de paiement ;
* les retraits ;
* les webhooks ;
* les notifications temps réel ;

dans vos applications PHP.

Le SDK est optimisé pour :

* PHP natif ;
* Laravel ;
* Symfony ;
* CodeIgniter ;
* APIs REST ;
* applications ecommerce.

---

## Installation

Installez le SDK avec Composer :

```bash id="3m8f9v"
composer require kobara/php-sdk
```

---

## Compatibilité

| Framework   | Support |
| ----------- | ------- |
| PHP natif   | ✅       |
| Laravel     | ✅       |
| Symfony     | ✅       |
| CodeIgniter | ✅       |
| APIs REST   | ✅       |

---

## Initialisation

Le SDK doit être initialisé avec votre Secret Key.

⚠️ Toujours côté serveur.

```php id="k4u9pz"
<?php

require 'vendor/autoload.php';

use Kobara\KobaraClient;

$kobara = new KobaraClient(
    getenv('KOBARA_SECRET_KEY')
);
```

---

## Variables d’environnement

```env id="j0m7ra"
KOBARA_SECRET_KEY=kbr_sk_live_VOTRE_CLE_API
```

---

### Important

⚠️ Ne jamais exposer votre Secret Key :

* dans JavaScript ;
* dans le frontend ;
* dans React ;
* dans une application mobile ;
* dans du HTML public.

---

## Premier paiement

### Exemple PHP natif

```php id="8r9x1f"
<?php

require 'vendor/autoload.php';

use Kobara\KobaraClient;

$kobara = new KobaraClient(
    getenv('KOBARA_SECRET_KEY')
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG",

    "description" => "Achat Laravel",

    "customer" => [

        "name" => "Marie Exemple",

        "phone" => "50900000000"

    ]

]);

header("Location: " . $payment->url);

exit();
```

---

## Explication du flux

### 1. Le client clique “Payer”

Votre frontend appelle :

```txt id="7j5m2r"
POST /checkout
```

---

### 2. Votre backend PHP crée le paiement

Le SDK :

* contacte l’API Kobara ;
* sécurise la requête ;
* communique avec MonCash ;
* prépare le checkout MonCash.

---

### 3. Kobara retourne une URL

```json id="2k8c7e"
{
  "url":
  "https://checkout.kobara.app/pay/abc123"
}
```

---

## 4. Redirection utilisateur

```php id="3u6f0r"
header("Location: " . $payment->url);
exit();
```

---

## Pourquoi utiliser le SDK PHP

Le SDK :

* simplifie les intégrations ;
* évite les requêtes HTTP manuelles ;
* gère l’authentification ;
* valide les réponses ;
* simplifie les webhooks ;
* réduit les erreurs.

---

## Créer un paiement

### Exemple complet

```php id="t9d5qp"
$payment = $kobara->payments->create([

    "amount" => 2500,

    "currency" => "HTG",

    "description" => "Commande Kobara",

    "customer" => [

        "name" => "Jean Pierre",

        "email" => "client@email.com",

        "phone" => "50937000000"

    ],

    "metadata" => [

        "order_id" => "ORDER_001"

    ]

]);
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

```json id="2v2m9e"
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

```php id="n8r6l3"
$payment = $kobara->payments->retrieve(
    "pay_123"
);
```

---

## Exemple réponse

```json id="e0z8f6"
{
  "id": "pay_123",
  "status": "succeeded",
  "amount": 2500
}
```

---

## Lister les paiements

```php id="z2g1x8"
$payments = $kobara->payments->list();
```

---

## Payment Links

Créer des liens de paiement partageables.

```php id="v9g8u1"
$link = $kobara->paymentLinks->create([

    "amount" => 1500,

    "currency" => "HTG",

    "title" => "Paiement Boutique"

]);
```

---

## Réponse

```json id="h3u4xz"
{
  "url":
  "https://pay.kobara.app/link/abc123"
}
```

---

## Retraits

Créer un retrait MonCash.

```php id="w8j3b2"
$withdrawal = $kobara->withdrawals->create([

    "amount" => 5000,

    "phone" => "50937000000"

]);
```

---

## Réponse retrait

```json id="0u3z9m"
{
  "id": "wd_001",
  "status": "processing"
}
```

---

## Webhooks

Le SDK PHP aide à vérifier les signatures webhooks.

```php id="9s6t5n"
$event = $kobara->webhooks->constructEvent(

    $payload,

    $signature,

    getenv("KOBARA_WEBHOOK_SECRET")

);
```

---

## Exemple webhook PHP

```php id="6j4x7p"
<?php

$payload = file_get_contents("php://input");

$signature =
    $_SERVER["HTTP_KOBARA_SIGNATURE"];

$environment =
    $_SERVER["HTTP_KOBARA_ENVIRONMENT"];

try {

    $event =
        $kobara->webhooks->constructEvent(

            $payload,

            $signature,

            getenv("KOBARA_WEBHOOK_SECRET")
        );

    if ($event["environment"] !== $environment) {
        throw new Exception("Environment mismatch");
    }

    http_response_code(200);

} catch (Exception $e) {

    http_response_code(400);

    echo $e->getMessage();
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

```php id="8x4n6j"
try {

    $payment =
        $kobara->payments->create([...]);

} catch (Exception $error) {

    echo $error->getMessage();

}
```

---

## Exemple erreur

```json id="7g5n3d"
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

```txt id="3q8m2g"
Frontend
↓
Backend PHP
↓
Kobara SDK
↓
API Kobara
↓
MonCash / MonCash
```

---

## Architecture incorrecte

```txt id="0k3n8r"
Frontend
↓
MonCash directement
```

ou :

```txt id="2u9r1m"
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
✅ sécuriser le backend
✅ logger les erreurs

---

## À éviter

❌ exposer Secret Key
❌ utiliser le SDK côté frontend
❌ appeler MonCash directement
❌ hardcoder les secrets

---

## Exemple Laravel

```php id="m8z0v7"
use Kobara\KobaraClient;

$kobara = new KobaraClient(
    env("KOBARA_SECRET_KEY")
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG"

]);

return redirect($payment->url);
```

---

## Exemple Symfony

```php id="4k7r1v"
$kobara = new KobaraClient(
    $_ENV["KOBARA_SECRET_KEY"]
);

$payment = $kobara->payments->create([

    "amount" => 1000,

    "currency" => "HTG"

]);
```

---


