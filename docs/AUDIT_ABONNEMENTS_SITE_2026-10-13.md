# Audit Kobara - abonnements et fonctionnalites inachevees

Date : 13 octobre 2026. Perimetre : code du site public, authentification,
dashboard, facturation, retraits et controles SQL des deux bases configurees.
Cet audit ne remplace pas une recette de chaque parcours avec un compte connecte.

## Corrections preparees

- Pro : 1 750 HTG/mois et 20 000 HTG de retraits dashboard par jour.
- Gratuit : 2 500 HTG/jour ; Premium : 50 000 HTG/jour ; Business : plafond NULL (illimite).
- La limite concerne uniquement les retraits du dashboard. Les retraits API
  ne sont pas bloques par ce plafond et ne consomment pas le quota dashboard.
- Chaque jour est delimite par minuit dans America/Port-au-Prince,
  y compris les changements d'heure. Aucun cron de remise a zero n'est requis.
- Les montants bruts dashboard en attente ou termines consomment le quota.
  Echecs, annulations, rejets, abonnements et transferts B2B sont exclus.
- Le controle atomique est dans prepare_dashboard_withdrawal : verrou par
  marchand, verification du quota, reservation et origine en une transaction.
- L'API garde prepare_automatic_withdrawal, sans ce plafond de plan.
- Si la nouvelle fonction SQL manque, le dashboard refuse le retrait plutot
  que de contourner la limite. La migration doit preceder le deploiement du code.
- L'ancien trigger global est retire par la migration car il plafonnerait aussi l'API.
- Le renouvellement du dernier plan payant est accessible apres expiration,
  meme lorsque le plan effectif a deja ete remplace par Gratuit.
- Le cron des abonnements refuse l'acces si CRON_SECRET manque.

Fichiers principaux :
- src/lib/withdrawal-day.ts
- src/lib/server/access.ts
- src/lib/server/usage.ts
- src/lib/server/withdrawals/withdrawal.service.ts
- src/app/dashboard/withdrawals/actions.ts
- src/app/dashboard/billing/billing-client.tsx
- supabase/migrations/20261013223802_haitian_daily_withdrawal_limits.sql

## Etat des bases et deploiement

Les deux bases ont les bons tarifs/plafonds dans plans. Le nouveau projet
contient deja les anciennes fonctions de quotas, le ledger B2B v3 et les tables
WhatsApp ; l'ancien projet ne les contient pas. Ne pas conclure a une panne
production en inspectant uniquement l'ancien projet.

La migration nouvelle a ete executee puis annulee dans une transaction sur
chacune des deux bases pour valider son SQL. Aucun changement persistant n'a
ete applique. Le choix du projet de production reste a confirmer par le proprietaire.

L'origine historique des retraits n'etait pas stockee. La migration les marque
legacy : elle n'invente pas leur canal. Le suivi dashboard fiable commence
avec les demandes effectuees par la nouvelle fonction. Ne pas promettre une
reconstruction exacte des retraits dashboard anterieurs dans la journee de bascule.

## Fonctionnalites inachevees confirmees

### P2 - Connexion et inscription Google non branchees
Les boutons Google n'ont pas de gestionnaire d'action ; aucun provider Google
n'est declare dans src/auth.ts. L'utilisateur voit une commande sans effet.
References : src/app/(auth)/login/page.tsx et src/app/(auth)/register/page.tsx.
Action : terminer OAuth avec configuration valide, ou masquer ces boutons.

### P2 - Analyses : filtres et export non fonctionnels
Les boutons 7j/30j/90j et Rapport de src/app/dashboard/analytics/page.tsx
n'ont pas d'action. La requete reste fixee aux 30 derniers jours.
Action : selection de periode cote serveur/client et export reel.

### P2 - Liens de paiement : pagination non implementee
src/app/dashboard/payment-links/page.tsx charge toute la liste sans pagination.
Precedent et Suivant sont toujours disabled. Avec un grand historique,
la page n'offre aucun parcours fiable vers les autres resultats.
Action : pagination serveur et navigation active, avec comptage reel.

### P2 - Authentification : autres pages encore sur l'ancien layout
AuthShell utilise le nouveau fond seulement pour login, register et challenge-totp.
challenge-email, forgot-password, reset-password et verify-email conservent
le layout a deux colonnes et ses anciens styles.
Action : harmoniser ces parcours, notamment les erreurs et le mobile.

### P3 - Virement bancaire annonce mais indisponible
PayoutSettings affiche Sogebank/Unibank avec Bientot et une section non interactive.
Il ne s'agit pas d'un service disponible. Ne pas le commercialiser comme actif.

## Points a verifier hors du code

- La configuration Wrangler ne declare pas de cron : le declenchement externe
  de /api/cron/subscriptions doit etre confirme, avec son secret et ses journaux.
  L'absence dans ce fichier ne prouve pas l'absence d'un ordonnanceur externe.
- L'activation Meta du numero WhatsApp et la validite du token ne sont pas
  prouvees par l'existence des tables SQL. Tester reception, reponse et transfert humain.
- Les engagements Business (SLA, support 24/7) annonces dans pricing doivent
  etre confirmes par les dispositifs operationnels et conditions commerciales.
- Une recette utilisateur reste necessaire pour Google, remboursement/restitution,
  SDK/plugins et les parcours support ; aucune disponibilite n'est inventee ici.

## Verification

- Tests cibles : 60 reussis, zero echec.
- Couverture ajoutee : minuit local, minuit UTC sans remise a zero, hiver,
  jours de 23/25 heures, changement d'annee, separation dashboard/API,
  renouvellement et protection du cron sans secret.
- SQL valide et rollback sur les deux bases ; aucune operation fournisseur executee.
- Smoke test SQL sur le nouveau projet : plafond dashboard refuse,
  preparation API non plafonnee et appel anon refuse. Identifiant de marchand
  inexistant, transaction annulee ; aucun compte reel ni retrait utilise.
- Aucun push ni deploiement de cette correction effectue pendant l'audit.

## Ordre recommande

1. Confirmer la base production et appliquer la migration cible uniquement.
2. Deployer le code et tester un retrait dashboard, sa limite et la remise a zero.
3. Tester qu'un retrait API conserve authentification, KYC, solde et idempotence,
   mais n'est ni plafonne ni comptabilise dans le quota dashboard.
4. Terminer ou retirer Google, export Rapports et pagination.
5. Harmoniser les pages d'authentification restantes et verifier le cron externe.
