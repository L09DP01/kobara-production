# Configurer les journaux de System Core

Renseignez les valeurs dans les variables et secrets du Worker de production. Ne collez jamais les jetons dans Git, dans le navigateur côté client ou dans un ticket.

## Supabase

1. Sur le projet Live, ouvrez Logs Explorer et vérifiez qu'une requête récente apparaît.
2. Créez un jeton de gestion limité à la lecture des journaux (`analytics_logs_read` sur un jeton granulaire). La clé publique et la clé service role ne remplacent pas ce jeton.
3. Configurez `SUPABASE_MANAGEMENT_TOKEN` en secret et `SUPABASE_PROJECT_REF` avec la référence du projet Live.
4. Ouvrez System Core > System Logs > Supabase. Un HTTP 401/403 indique de vérifier le jeton et ses droits ; une réponse vide n'est pas une erreur de connexion.

[API Supabase : journaux du projet](https://supabase.com/docs/reference/api/v1-get-project-logs)

## Cloudflare

1. Dans Workers & Pages, ouvrez le Worker Kobara de production. Vérifiez que Workers Logs est activé et que des événements sont visibles dans Observability.
2. Dans Query Builder, enregistrez une requête limitée au Worker de production, en vue Events. Vérifiez ses résultats dans Cloudflare avant de recopier son identifiant.
3. Configurez `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_LOG_QUERY_ID` et, en secret, `CLOUDFLARE_OBSERVABILITY_TOKEN`. Limitez le jeton au compte concerné et aux droits de lecture nécessaires à la requête.
4. Ouvrez System Core > System Logs > Cloudflare. Si la lecture échoue, vérifiez la portée du jeton et que la requête enregistrée est bien une vue Events du bon Worker.

[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) · [Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/)

## Diagnostic et intervention

1. Un administrateur autorisé ouvre System Logs > Analyser les journaux. Le diagnostic compare les états de connexion et les niveaux de gravité sur des échantillons de la dernière heure.
2. Pour la synthèse IA, configurez le secret `GEMINI_API_KEY` (ou `GOOGLE_GENERATIVE_AI_API_KEY`). Le modèle est configurable par `LOG_DIAGNOSTIC_AI_MODEL`. Sans IA, les compteurs restent visibles. Aucun message brut n'est envoyé au modèle.
3. En cas de signal critique, ouvrez le journal de la source et notez l'heure, le service et l'identifiant de requête lorsqu'il est disponible. Comparez avec le dernier déploiement et l'état du service chez le fournisseur. Une coïncidence ne suffit pas à confirmer la cause.
4. Si des paiements ou retraits sont touchés, vérifiez leur état auprès du fournisseur avant tout rejeu ou changement de statut. Escaladez au responsable de garde, puis vérifiez la reprise sur les événements récents.

Ce diagnostic est à la demande. Il n'envoie pas de notifications et ne remplace pas les alertes natives des fournisseurs, utiles si Kobara ou Supabase est indisponible.
