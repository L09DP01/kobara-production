# Audit fonctionnel de System Core

Audit statique des 30 routes de page et des actions et services associés examinés, complété par les captures fournies. Les données, les droits effectifs et la fréquence d'utilisation en production n'ont pas été vérifiés. Un module hors menu n'est pas nécessairement désactivé. Les ajouts ci-dessous sont des recommandations, pas des fonctionnalités livrées.

## Priorités

1. **P1 — Fiabilité des chiffres.** Dans `dashboard/page.tsx:23`, la requête des paiements réussis Live ne sélectionne pas la devise et les sommes sont calculées côté application. Le volume présenté comme HTG peut mélanger HTG et USD si les deux existent dans la sélection. L'absence de pagination explicite expose aussi le total au plafond de lignes de la source. Agréger en base par devise, période et environnement ; distinguer frais collectés et revenu net ; afficher une erreur au lieu d'un zéro trompeur. Le rapport mensuel sépare déjà HTG et USD : réutiliser la même définition des chiffres.
2. **P1 — Commande globale trop exposée.** La ligne 62 du dashboard affiche un horaire fixe de maintenance hors suspension. La capture montre aussi un texte promotionnel sur les anciens plans dans ce bloc. À la ligne 66, la suspension est directement accessible. Centraliser l'action dans Alertes et maintenance, montrer la date enregistrée et le fuseau d'Haïti, et demander une confirmation explicite. Vérifier la bannière publique et le réglage enregistré avant de supprimer l'ancien texte ; la capture ne prouve pas qu'il est diffusé publiquement.
3. **P1 — Droits à vérifier côté serveur.** Le layout protégé monte le menu mais ne contrôle pas lui-même le rôle (`layout.tsx:6`). Plusieurs lectures, notamment Transactions, Audit et Sessions, n'ont pas de garde de rôle explicite dans la page inspectée. Le contrôle de session en amont ne remplace pas une autorisation par module. Définir lecture, export et mutation séparément, limiter les champs, puis tester chaque rôle et les liens directs. Aucun contournement n'a été testé.
4. **P1 — Décisions financières et conformité.** Les retraits, corrections de paiement et dossiers KYC existent déjà. Vérifier la cohérence des écritures, des statuts, des notifications et du journal en cas d'échec partiel. Le KYC principal écrit dans plusieurs tables (`kyc/page.tsx:129` et suivantes) : tester la reprise et privilégier une décision atomique lorsque les écritures doivent réussir ensemble.
5. **P2 — Les états doivent être vérifiables.** Health présente Resend comme indicateur d'e-mail transactionnel alors que le chemin principal du code utilise Cloudflare. Le statut de la base sur le dashboard reflète seulement les requêtes de cette page. Séparer configuration, dernière exécution, erreur et disponibilité réelle.
6. **P2 — Les liens sans usage courant encombrent le menu.** Les captures montrent une liste plate avec défilement et des intitulés mixtes. Regrouper, traduire de façon cohérente et donner la priorité aux files de travail, pas aux outils rares.

## Inventaire et décision par page

Chemins relatifs à `src/app/system-core` ; la plupart vivent sous `(protected)`.

| Page | Usage observé et relations | Décision et raison |
| --- | --- | --- |
| Racine | Redirige vers le dashboard. | Garder la route technique, sans lien séparé. |
| Connexion | Demande puis vérifie un code administrateur. | Garder hors menu ; tester expiration, retour navigateur et redirection interne. |
| Dashboard | Indicateurs, volume sur 30 jours, dernières inscriptions, maintenance. | Garder la synthèse ; déplacer la mutation globale et ajouter des raccourcis vers les files existantes. |
| Payment Providers | Paramétrage du routage fournisseur. | Garder en Configuration, distinct du suivi de solde ; réserver les changements aux rôles habilités et tracer les bascules. |
| Treasury | Solde fournisseur, séparé du registre Kobara. | Garder en Finance ; ne pas présenter ce solde comme le total dû aux marchands. Ajouter rapprochement si aucune autre vue ne le couvre. |
| Merchants | Annuaire avec recherche. | Garder comme entrée principale vers la fiche ; distinguer comptes propriétaires et activités liées. |
| Merchants / détail | Identité, réglages, paiements et actions de suspension. | Garder ; relier les dossiers KYC, sessions et transactions au même marchand. Clarifier compte versus activité. |
| KYC Review | Profils, pièces, doublons, décisions et certains traitements de clôture. | Garder en Conformité ; séparer les vues Revue, Doublons et Clôtures au sein du module, sans inventer une nouvelle capacité. |
| Transactions | Registre global et filtres. | Garder en Finance ; pagination et devise explicites, aucune action de correction dans la liste. |
| Transactions / détail | Paiement, marchand, chronologie, webhooks et correction en attente. | Garder ; distinguer événements du paiement et historique général du marchand. Vérifier la preuve et les effets d'une correction. |
| Withdrawals | Liste et décisions via procédure de gestion. | Garder en Finance ; rendre visibles états et prochaines actions, distinguer approbation, exécution et résultat fournisseur. |
| Reports | Rapports mensuels et CSV, avec totaux HTG/USD. | Garder, secondaire dans Finance. Ce n'est pas un doublon du registre : le rapport agrège une période. Afficher erreurs et fraîcheur. |
| Business Requests | Demandes commerciales avec suivi KYB et anciens statuts de plan. | Garder le suivi commercial/KYB s'il sert encore ; retirer le vocabulaire d'abonnement après vérification des déclencheurs et des dossiers ouverts. Ne pas confondre avec l'ajout d'une activité. |
| Partners | Développeurs, candidatures, ambassadeurs et retraits partenaires. | Garder comme espace distinct des marchands ; utiliser des onglets pour ces parcours, avec liens vers les rapports. |
| Support | Liste de tickets. | Garder comme file opérationnelle ; distinguer ticket réel et simple échange. |
| Support / détail | Conversation, réponse et changement d'état. | Garder ; relier marchand et référence de paiement sans demander des renseignements déjà disponibles. |
| WhatsApp | État du workflow Kapso et accès aux connaissances. | Déplacer sous Support comme canal. Ne pas présenter cette page comme une deuxième boîte de réception. |
| WhatsApp / connaissances | Gestion de la source de l'agent avec autorisation spécifique. | Garder comme sous-page de WhatsApp ; préserver la restriction du propriétaire autorisé. |
| Shopify Privacy | Demandes de confidentialité Shopify, suivi et export associé. | Garder sous Conformité. Masquer le menu Shopify marchand n'est pas un motif pour supprimer ce traitement. |
| Moteur CGU | Publication publique, analyse IA et gestion des règles. | Garder ; séparer « CGU publiques », « Avis aux marchands » et « Règles proposées ». Publier un texte ne doit pas activer une règle de risque. |
| Risk Monitoring | Interface de surveillance avec composants et API présents ; Health indique la suspension. | Garder hors navigation principale tant que l'exécution et les dossiers ne sont pas validés. Ne pas confondre présence de code et capacité opérationnelle. |
| System Logs | Événements de diagnostic applicatif/support. | Regrouper dans Journaux, onglet Application. |
| Logs / fournisseur | Une route dynamique affiche Supabase ou Cloudflare. | Regrouper dans le même écran de navigation avec deux sources. Garder les données distinctes. |
| Audit Logs | Journal des actions administratives. | Garder distinct des journaux techniques, sous Sécurité ; protéger les exports et l'accès. |
| Sessions | Historique des connexions marchandes et révocation. | Garder sous Sécurité ; lien depuis la fiche marchand et libellé précisant le périmètre marchand. |
| Administrators | Comptes et rôles administratifs. | Garder sous Sécurité, accès super administrateur. |
| System Health | Indicateurs de configuration, état, tâches planifiées et réglage Shopify. | Garder la santé et les contrôles ; déplacer le réglage d'affichage Shopify vers Configuration et la suspension vers Maintenance. |
| Alerts & Maintenance | Message public, planification et bascule de service. | Garder comme seul endroit pour changer l'état global ; séparer annonce, planification et mise en maintenance. |
| Messaging | Audiences et campagnes administratives. | Garder sous Communications ; isoler clairement notifications de compte et marketing. |
| Promotions IA | Segments, brouillons, approbation, pause et lots.  | Garder comme onglet de Communications : groupe apparenté à Messaging, mais préparation et approbation distinctes. |
| Promo Codes | Écran alimenté par les plans et les marchands ; références également côté partenaires. | Sortir du menu général après inventaire des usages partenaires ; ne désactiver que les parcours liés aux abonnements effectivement retirés. |
| SMS Gateway | Boîte NatCash et rapprochement manuel ou exclusion. | Garder comme outil spécialisé lié aux exceptions de paiement. Ne pas le confondre avec une messagerie sortante. |
| Subscriptions | Vue historique hors menu avec action de resynchronisation. | Laisser hors menu, audit des appels et dépendances ; passer en lecture seule si aucune obligation de gestion résiduelle ne justifie l'action. Préserver l'historique. |

## Navigation recommandée

- **Accueil** : Vue d'ensemble, avec liens vers retraits à examiner, KYC, tickets et exceptions existantes si leurs compteurs sont fiables.
- **Marchands** : Annuaire, Demandes Business, Partenaires. Les fiches restent accessibles depuis leurs listes.
- **Finance** : Transactions, Retraits, Trésorerie, Rapports. Rapprochement SMS accessible comme sous-vue d'exceptions.
- **Conformité** : KYC, Confidentialité Shopify, CGU. Risque hors menu tant que suspendu.
- **Support et communications** : Tickets, WhatsApp, Communications (Messages et Promotions IA).
- **Système et sécurité** : Santé, Maintenance, Journaux techniques, Audit, Sessions, Administrateurs et Configuration (fournisseurs, visibilité Shopify).

## Ajouts prioritaires et emplacement

| Ajout recommandé | Où | Utilité et limite |
| --- | --- | --- |
| Détail des avis CGU par version | CGU → Avis aux marchands | La file et ses états existent dans le code, mais pas de tableau de suivi dans la page inspectée. Montrer en attente, accepté par Cloudflare, à vérifier et ignoré ; une acceptation n'est pas une livraison. Ne pas relancer automatiquement les résultats incertains. |
| Dernière exécution des tâches | Santé → Tâches planifiées | Montrer le dernier succès, le dernier échec et le nombre restant pour les tâches critiques. Le secret configuré et les journaux existants ne constituent pas un suivi synthétique. |
| Rapprochement financier par devise | Trésorerie | Comparer soldes fournisseurs, écritures internes et retraits en cours ; isoler les écarts et expliquer leur périmètre. Vérifier les sources comptables disponibles avant de définir les calculs. |
| Paramètres opérationnels | Système → Configuration | Donner une place au réglage de visibilité Shopify et aux paramètres fournisseurs existants, sans les mélanger avec un diagnostic de santé. |
| File d'exceptions et raccourcis | Dashboard → À traiter | Remonter les dossiers existants à partir des statuts réels. Ajouter d'abord des liens et des compteurs fiables ; pas de deuxième base de tickets ni de nouveau moteur de décisions. |

## Ordre de mise en œuvre

1. Corriger les chiffres et les autorisations ; nettoyer la bannière obsolète et retirer la suspension du dashboard.
2. Regrouper les menus sans casser les URL, puis vérifier navigation par rôle et sur mobile.
3. Ajouter le suivi des avis CGU et des tâches planifiées.
4. Évaluer le rapprochement financier et l'usage réel des parcours historiques avant archivage ou retrait.

Contrôles restant à faire en environnement authentifié : navigation selon les quatre rôles, états vide/chargement/erreur, permissions des exportations, rapprochement sur un jeu de données connu, déroulement des lots CGU sans envoi réel, contrastes et clavier. Les captures et le code ne valident pas ces scénarios à eux seuls.
