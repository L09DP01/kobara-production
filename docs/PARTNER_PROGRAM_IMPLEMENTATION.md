# Programme Partenaires Kobara - Plan d'implementation

Ce document est la source de verite du chantier Developer, Ambassadeur et parrainage marchand.
Une etape est cochee uniquement apres implementation, verification et revue de securite.

## Regles metier confirmees

- Un marchand a une seule attribution initiale: `direct`, `merchant_referral`, `developer_referral` ou `ambassador_promo`.
- Une cle creee par un developpeur commence avec le scope `payments:create` uniquement.
- Les retraits par un developpeur exigent une autorisation explicite et revocable du marchand.
- Pendant l'integration, les cles developpeur acceptent au total au maximum 7 000 HTG et 55 USD, suivis separement.
- Le marchand passe de `integration` a `live` apres son premier paiement reel reussi avec une cle creee directement par son compte marchand.
- Le bonus Developer de 10 USD est unique. Il est debloque quand le plan Pro est actif et que le premier paiement API marchand admissible est definitivement confirme.
- Les commissions Developer sont calculees sur le revenu Kobara de 1 %, jamais sur le montant total du paiement.
- Niveaux Developer: 1-4 = 10 %, 5-19 = 30 %, 20-49 = 50 %, 50+ = conditions Agency configurees par l'administration.
- Un Ambassadeur est cree uniquement par un administrateur apres une demande de partenariat.
- Le code Ambassadeur accorde 30 % de reduction sur le plan Pro et une recompense unique de 5 USD ou 675 HTG.
- Le parrainage marchand accorde une recompense unique de 5 USD ou 675 HTG apres activation du plan Pro et 10 000 HTG ou 50 USD de paiements reels confirmes.
- Aucun element Sandbox ou de test ne doit apparaitre dans Kobara Production.

## Suivi

### Phase 1 - Audit et fondations

- [x] Examiner l'architecture Next.js, Supabase, Auth, paiements, plans et cles API existantes.
- [x] Verifier les recommandations Supabase actuelles sur RLS, privileges et SSR.
- [x] Cartographier les points exacts de creation et de finalisation des paiements.
- [x] Definir les invariants financiers et les transitions de statut.
- [x] Valider la migration et son ordre d'execution avant application Production.

### Phase 2 - Schema partenaires et registre financier

- [x] Creer les comptes Developer et Ambassadeur.
- [x] Creer les invitations et relations Developer-Marchand.
- [x] Creer les attributions et parrainages marchands.
- [x] Creer le registre immuable des commissions et recompenses.
- [x] Creer les demandes de retrait partenaires.
- [x] Ajouter RLS, privileges minimaux, contraintes et index.
- [x] Ajouter les tests SQL de securite et d'idempotence.

### Phase 3 - Authentification et autorisation

- [x] Ajouter l'inscription et la connexion Developer.
- [x] Ajouter la connexion Ambassadeur sur une page distincte.
- [x] Ajouter les statuts `pending`, `active`, `suspended`, `rejected`.
- [x] Proteger chaque portail cote serveur selon le role et le statut.
- [x] Ajouter l'activation et la suspension dans System Core.

### Phase 4 - Pages publiques partenaires

- [x] Creer la page d'accueil Developer.
- [x] Creer la page Partenariat Ambassadeur.
- [x] Creer le formulaire Devenir Ambassadeur.
- [x] Envoyer les demandes au System Core sans activation automatique.

### Phase 5 - Invitations Developer

- [x] Ajouter l'action Ajouter un client.
- [x] Envoyer une invitation signee et limitee dans le temps.
- [x] Ajouter l'acceptation par le marchand.
- [x] Permettre au marchand de revoquer la relation.
- [x] Auditer chaque transition de la relation.

### Phase 6 - Cles API Developer

- [x] Identifier le createur de chaque cle API.
- [x] Appliquer les scopes Developer.
- [x] Appliquer les plafonds cumulatifs de 7 000 HTG et 55 USD.
- [x] Ajouter l'autorisation explicite pour les retraits.
- [x] Bloquer cote serveur toute operation hors scope.

### Phase 7 - Passage en Live et bonus Developer

- [x] Identifier les paiements crees avec une cle marchand.
- [x] Passer automatiquement la relation a `live`.
- [x] Verifier le plan Pro actif.
- [x] Crediter une seule fois le bonus de 10 USD.
- [x] Garantir l'idempotence en cas de callbacks multiples.

### Phase 8 - Niveaux et commissions Developer

- [x] Calculer le nombre de marchands actifs.
- [x] Determiner le niveau courant.
- [x] Calculer la part sur le revenu Kobara de 1 %.
- [x] Gerer les etats `pending`, `available`, `paid`, `reversed`.
- [x] Ajouter les retraits de commissions.

### Phase 9 - Programme Ambassadeur

- [x] Creer les Ambassadeurs depuis System Core.
- [x] Creer et attribuer les codes promotionnels.
- [x] Appliquer la reduction Pro de 30 %.
- [x] Crediter la recompense unique de 5 USD ou 675 HTG.
- [x] Bloquer auto-parrainage, doublons, remboursements et fraude.

### Phase 10 - Parrainage marchand

- [x] Ajouter le bouton Inviter un ami.
- [x] Creer le lien et l'invitation par e-mail.
- [x] Suivre le plan Pro et les volumes confirmes HTG/USD.
- [x] Crediter une seule fois 5 USD ou 675 HTG.
- [x] Afficher la progression et l'historique au marchand.

### Phase 11 - Dashboards partenaires

- [x] Creer le dashboard Developer responsive.
- [x] Ajouter Referencement, Analyses et Parametres Developer.
- [x] Creer la fiche client Developer et la gestion des cles.
- [x] Creer le dashboard Ambassadeur responsive.
- [x] Ajouter Analyses et Parametres Ambassadeur.

### Phase 12 - Administration, rapports et releves

- [x] Ajouter les ecrans partenaires dans System Core.
- [x] Ajouter les controles et ajustements audites.
- [x] Generer les releves mensuels marchands et partenaires.
- [x] Generer le rapport global Kobara et les rapports par marchand.
- [x] Ajouter les exports PDF et CSV.

### Phase 13 - Validation et publication

- [x] Executer les tests SQL, unitaires et d'integration.
- [x] Verifier les permissions et l'isolation multi-tenant.
- [x] Verifier les calculs financiers et les courses concurrentes.
- [ ] Verifier le responsive mobile et desktop.
- [ ] Compiler et deployer Kobara Production.
- [ ] Controler le deploiement et les journaux de production.

## Journal d'avancement

- 2026-09-20: plan enregistre, audit initial du depot et verification des recommandations Supabase termines.
- 2026-09-20: fondation SQL, scopes API, plafonds Developer, passage en Live et registre idempotent implementes; validation et migration Production encore requises.
- 2026-09-20: migrations Production appliquees et verifiees; RLS actif, aucun privilege `anon`/`authenticated`, 237 cles existantes migrees avec leurs scopes, compilation et tests metier valides.
- 2026-09-20: commit `dda764d` deploye sur le Worker Production, version `38ee992c`; controle HTTP termine avec succes.
- 2026-09-20: portails Developer et Ambassadeur, invitations, parrainage marchand, retraits partenaires, administration et rapports implementes.
- 2026-09-20: migration `complete_partner_program` appliquee en Production apres confirmation explicite; 184 marchands attribues, zero attribution manquante, RPC financieres reservees au `service_role` et RLS verifie.
- 2026-09-20: 52 tests partenaires et paiements valides; compilation TypeScript et lint cible valides. Verification responsive et deploiement Worker encore requis.
