# Kobara Connect pour Shopify

## Flux pris en charge

1. Le propriétaire connecte sa boutique depuis `dashboard.kobara.app/integrations/shopify`.
2. Shopify autorise Kobara à lire et mettre à jour les commandes.
3. Une commande Live HTG impayée ayant choisi la méthode manuelle `Kobara` crée un lien unique, valable 24 heures. Les commandes Test et les autres méthodes ne déclenchent pas de collecte.
4. Le client reçoit ce lien par e-mail et paie avec les moyens actifs pour le marchand.
5. Après confirmation Kobara, `orderMarkAsPaid` met la commande à jour dans Shopify.
6. Une déconnexion ou le webhook `app/uninstalled` désactive la connexion et supprime le jeton enregistré. Aucun abonnement ou changement de plan n'est lié à Shopify.

Le bouton Shopify apparaît dans le menu Opérations du dashboard marchand, sur ordinateur et dans le menu mobile. La gestion est réservée au propriétaire vérifié.

La première version utilise une méthode de paiement manuelle Shopify. Une application Shopify standard ne peut pas ajouter un nouveau processeur natif au checkout. Cette capacité nécessite une approbation Payments Extension distincte de Shopify.

## Variables serveur

```env
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=2026-07
SHOPIFY_APP_URL=https://dashboard.kobara.app
SHOPIFY_TOKEN_ENCRYPTION_KEY=
TELEGRAM_BOT_USERNAME=KobaraPayBot
```

`SHOPIFY_TOKEN_ENCRYPTION_KEY` doit être un secret aléatoire dédié. Les jetons d'installation sont chiffrés avec AES-256-GCM avant stockage.

## Configuration Shopify Dev Dashboard

- Application autonome (non intégrée dans un iframe Shopify).
- App URL: `https://dashboard.kobara.app/integrations/shopify`
- Redirect URL: `https://dashboard.kobara.app/api/integrations/shopify/callback`
- Scopes: `read_orders,write_orders`
- Webhook API version: `2026-07`
- Webhook applicatif: `https://dashboard.kobara.app/api/integrations/shopify/webhooks`
- Webhooks de conformité: `customers/data_request`, `customers/redact`, `shop/redact`

Ne pas publier une nouvelle version Shopify avant le déploiement des routes et l'application de la migration `shopify_connect`.

## Méthode manuelle dans la boutique

Dans Shopify Admin, ouvrir **Settings > Payments > Manual payment methods**, créer `Kobara`, puis préciser que le client recevra un lien sécurisé pour finaliser son paiement. Cette méthode crée la commande en attente; Kobara effectue ensuite la collecte et la réconciliation automatique.

## Mise en service

- Migration à appliquer manuellement : `supabase/migrations/20260828165318_shopify_connect.sql`. Elle crée trois tables privées et leurs index. Aucun solde ni paiement existant n'est modifié.
- La présence de secrets en local ne confirme pas leur présence sur Cloudflare. Ajouter les mêmes secrets à l'environnement du Worker avant activation.
- Vérifier les URLs et les scopes ci-dessus dans le Dev Dashboard Shopify et l'accès aux données clients protégées, notamment l'e-mail des commandes.
- La version initiale collecte uniquement MonCash/NatCash en HTG. Les commandes en USD et les paiements Shopify Test ne sont pas collectés.
- Un paiement Test, d'un autre marchand, d'un mauvais montant ou d'un autre lien ne marque jamais une commande réelle comme payée.
- Les erreurs de confirmation sont inscrites dans l'audit Core (`shopify.order_confirmation_failed`). Une intervention peut être nécessaire si la commande change après émission du lien.
- Les webhooks de conformité doivent être configurés dans Shopify. Les demandes d'accès aux données doivent être traitées par l'équipe ; ce connecteur ne prétend pas générer un export RGPD automatique.

## Vérifications après migration

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('shopify_installations', 'shopify_orders', 'shopify_webhook_receipts');

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('shopify_installations', 'shopify_orders', 'shopify_webhook_receipts')
ORDER BY table_name, grantee;
```

Les trois tables doivent avoir RLS activé et aucun accès `anon`/`authenticated`. Ne pas supprimer les tables pour réexécuter la migration si elles existent déjà.

Test réel final : connecter une boutique de développement autorisée, refuser puis accepter OAuth, créer une commande manuelle Kobara, rejouer le même webhook, vérifier le paiement Live contrôlé, puis déconnecter et désinstaller. Ne pas utiliser une commande de production pour un paiement simulé.
