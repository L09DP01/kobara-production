# Plugin Kobara pour WooCommerce

Le plugin Kobara permet à une boutique WooCommerce d'envoyer son client vers le checkout sécurisé Kobara, puis de mettre automatiquement la commande à jour après confirmation du paiement.

## Ce que supporte la version 2

- checkout Kobara unifié avec les moyens activés sur le compte marchand ;
- présélection facultative de MonCash, NatCash, carte, PayPal, Apple Pay ou Google Pay ;
- commandes en HTG ou USD ;
- environnements Sandbox et Production strictement séparés ;
- Checkout classique et Checkout Blocks de WooCommerce ;
- synchronisation des commandes réussies ou échouées par webhook signé ;
- compatibilité HPOS.

La disponibilité réelle d'un moyen dépend de son activation sur le compte Kobara. Pour les paiements internationaux, le compte USD du marchand doit également être actif.

## Installation

1. [Téléchargez `kobara-woocommerce.zip`](/downloads/kobara-woocommerce.zip) depuis Kobara.
2. Dans WordPress, ouvrez **Extensions > Ajouter une extension > Téléverser une extension**.
3. Sélectionnez l'archive, installez-la puis activez **Kobara Payments for WooCommerce**.
4. Ouvrez **WooCommerce > Réglages > Paiements > Kobara Payments**.

Le plugin requiert WordPress 6+, WooCommerce 7+ et PHP 7.4+.

## Configuration Sandbox

1. Créez un compte sur [test.kobara.app](https://test.kobara.app/register).
2. Créez une clé secrète Sandbox `kbr_sk_test_...`.
3. Activez **Mode Test** dans WooCommerce.
4. Collez la clé Sandbox dans **Clé Secrète (Test)**.
5. Collez le secret du webhook Sandbox dans **Secret Webhook**.

En mode Test, le plugin appelle exclusivement :

```text
https://test.kobara.app/api/v1/payments
```

Aucun fournisseur de paiement réel n'est appelé par le Sandbox.

## Configuration Production

1. Utilisez un compte marchand Kobara vérifié.
2. Créez une clé secrète Live `kbr_sk_live_...`.
3. Désactivez **Mode Test** dans WooCommerce.
4. Collez la clé dans **Clé Secrète (Live)**.
5. Utilisez le secret du webhook Production.

En Production, le plugin appelle exclusivement :

```text
https://api.kobara.app/v1/payments
```

La clé secrète reste sur le serveur WordPress. Le plugin n'utilise pas de clé publique.

## Expérience de paiement

Le réglage recommandé est **Checkout Kobara unifié**. Kobara présente alors au client uniquement les moyens disponibles pour ce marchand et cette transaction.

Vous pouvez aussi présélectionner un moyen précis :

| Réglage | Provider API |
| --- | --- |
| Checkout Kobara unifié | `kobara` |
| MonCash | `moncash` |
| NatCash | `natcash` |
| Carte | `card` |
| PayPal | `paypal` |
| Apple Pay | `apple_pay` |
| Google Pay | `google_pay` |

## Webhook WooCommerce

Ajoutez cette URL dans **Dashboard Kobara > Webhooks** :

```text
https://votre-boutique.com/?wc-api=kobara_webhook
```

Abonnez l'endpoint au minimum à :

- `payment.succeeded` ;
- `payment.failed`.

Le plugin vérifie l'en-tête `Kobara-Signature` au format `t=TIMESTAMP,v1=SIGNATURE`. La signature HMAC-SHA256 couvre exactement `TIMESTAMP.CORPS_BRUT` et les événements âgés de plus de cinq minutes sont refusés.

Lors de `payment.succeeded`, la commande passe au statut payé selon le flux WooCommerce. Lors de `payment.failed`, une commande encore impayée passe au statut échoué.

## Déroulement d'une commande

1. Le client choisit Kobara dans le checkout WooCommerce.
2. Le serveur WordPress crée le paiement avec une clé d'idempotence propre à la commande.
3. Le client est redirigé vers le checkout Kobara.
4. Kobara traite le moyen disponible choisi ou présélectionné.
5. Le webhook signé confirme le résultat à WooCommerce.

La page de retour du navigateur ne doit jamais être utilisée seule comme preuve de paiement. La mise à jour fiable vient du webhook signé.

## Dépannage

### Kobara n'apparaît pas au checkout

- vérifiez que la passerelle est activée ;
- renseignez la clé correspondant au mode sélectionné ;
- utilisez HTG ou USD comme devise WooCommerce ;
- vérifiez que WooCommerce et le plugin sont actifs.

### La commande reste en attente

- contrôlez que l'URL webhook est active dans le même environnement que la clé API ;
- vérifiez que le secret webhook est identique dans Kobara et WooCommerce ;
- consultez **WooCommerce > État > Journaux** et l'historique des webhooks Kobara.

### L'API refuse un moyen de paiement

Le moyen demandé n'est peut-être pas activé pour le marchand. Pour les cartes et portefeuilles internationaux, vérifiez également l'activation du compte USD.

## Mise à jour depuis la version 1

Après installation de la version 2 :

1. ouvrez de nouveau les réglages Kobara ;
2. choisissez l'expérience de paiement ;
3. vérifiez le mode et la clé secrète ;
4. remplacez l'ancien webhook par le secret correspondant à l'environnement ;
5. réalisez une commande Sandbox complète avant la Production.
