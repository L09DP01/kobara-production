# Kobara Connect pour Shopify

## Flux pris en charge

1. Le propriétaire connecte sa boutique depuis `dashboard.kobara.app/integrations/shopify`.
2. Shopify autorise Kobara à lire et mettre à jour les commandes.
3. Une commande Live HTG ou USD impayee ayant choisi la methode manuelle `Kobara` cree un lien unique en HTG, valable 24 heures. Le marchand configure son taux USD/HTG depuis l'interface Shopify de Kobara (valeur initiale 130). Le taux est fige dans chaque nouveau lien et le montant arrondi au centime. Le montant et la devise Shopify d'origine sont conserves. Modifier le taux ne change pas les liens existants. Les commandes HTG ne sont pas converties. Les commandes Test et les autres methodes ne declenchent pas de collecte.
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

L'echange OAuth demande des jetons expirants (`expiring: 1`). Le jeton d'acces, son jeton de renouvellement et leurs echeances sont enregistres ensemble dans `access_token_ciphertext`, jamais dans les metadonnees publiques. Avant un appel authentifie apres installation, Kobara renouvelle le jeton si son expiration est proche. L'enregistrement conditionnel ne peut pas reactiver une installation deconnectee. Aucune migration supplementaire n'est requise pour ce format chiffre. Une fois le jeton de renouvellement expire, le marchand doit reconnecter sa boutique.

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
- Le paiement est collecte en HTG via MonCash/NatCash. Les commandes USD utilisent le taux marchand fige dans le lien, sans conversion pour les commandes HTG. Les autres devises et les commandes Shopify Test ne sont pas collectees. Le checkout affiche seulement le produit, la reference de commande, le taux applicable aux USD et le montant HTG ; les liens Shopify restent exclus des listes de liens classiques du dashboard et de l'API mobile.
- Un paiement Test, d'un autre marchand, d'un mauvais montant ou d'un autre lien ne marque jamais une commande réelle comme payée.
- Les erreurs de confirmation sont inscrites dans l'audit Core (`shopify.order_confirmation_failed`). Une intervention peut être nécessaire si la commande change après émission du lien.
- Les webhooks de conformité doivent être configurés dans Shopify. Les demandes d'accès aux données doivent être traitées par l'équipe ; ce connecteur ne prétend pas générer un export RGPD automatique.

### Déclaration des webhooks de conformité

Les abonnements créés à l'installation pour les commandes ne remplacent pas la déclaration des webhooks de confidentialité au niveau de l'application. Récupérer d'abord la configuration active avec le CLI Shopify officiel, sans écraser une configuration locale existante :

```powershell
shopify app config link --client-id 5efa53e98042062a106f28d8df18b059
```

Ajouter ensuite à la configuration TOML récupérée, en conservant les autres paramètres et abonnements :

```toml
[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://dashboard.kobara.app/api/integrations/shopify/webhooks"
```

Créer et vérifier une version de configuration Shopify avant de la publier. Cela ne déploie pas le serveur Kobara et ne soumet pas l'application à la review. Relancer ensuite les contrôles dans Shopify Partners : une réponse HTTP 401 à une signature invalide ne prouve pas, à elle seule, que les trois abonnements sont déclarés.

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

Tests sur boutique de développement : vérifier OAuth, les signatures des webhooks, les doublons, la déconnexion et la désinstallation. Les boutiques de développement ne doivent pas traiter de transactions réelles. Le connecteur actuel ignore les commandes Shopify Test ; le parcours complet Shopify vers Kobara Test reste à implémenter avant de pouvoir valider une simulation de paiement de bout en bout. Ne jamais désactiver l'isolation Test/Live pour contourner cette limite.
