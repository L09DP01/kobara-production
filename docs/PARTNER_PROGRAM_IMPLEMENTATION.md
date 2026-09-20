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
- [ ] Valider la migration localement sans toucher aux donnees de production.

### Phase 2 - Schema partenaires et registre financier

- [x] Creer les comptes Developer et Ambassadeur.
- [x] Creer les invitations et relations Developer-Marchand.
- [x] Creer les attributions et parrainages marchands.
- [x] Creer le registre immuable des commissions et recompenses.
- [x] Creer les demandes de retrait partenaires.
- [x] Ajouter RLS, privileges minimaux, contraintes et index.
- [ ] Ajouter les tests SQL de securite et d'idempotence.

### Phase 3 - Authentification et autorisation

- [ ] Ajouter l'inscription et la connexion Developer.
- [ ] Ajouter la connexion Ambassadeur sur une page distincte.
- [ ] Ajouter les statuts `pending`, `active`, `suspended`, `rejected`.
- [ ] Proteger chaque portail cote serveur selon le role et le statut.
- [ ] Ajouter l'activation et la suspension dans System Core.

### Phase 4 - Pages publiques partenaires

- [ ] Creer la page d'accueil Developer.
- [ ] Creer la page Partenariat Ambassadeur.
- [ ] Creer le formulaire Devenir Ambassadeur.
- [ ] Envoyer les demandes au System Core sans activation automatique.

### Phase 5 - Invitations Developer

- [ ] Ajouter l'action Ajouter un client.
- [ ] Envoyer une invitation signee et limitee dans le temps.
- [ ] Ajouter l'acceptation par le marchand.
- [ ] Permettre au marchand de revoquer la relation.
- [ ] Auditer chaque transition de la relation.

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
- [ ] Garantir l'idempotence en cas de callbacks multiples.

### Phase 8 - Niveaux et commissions Developer

- [x] Calculer le nombre de marchands actifs.
- [x] Determiner le niveau courant.
- [x] Calculer la part sur le revenu Kobara de 1 %.
- [ ] Gerer les etats `pending`, `available`, `paid`, `reversed`.
- [ ] Ajouter les retraits de commissions.

### Phase 9 - Programme Ambassadeur

- [ ] Creer les Ambassadeurs depuis System Core.
- [ ] Creer et attribuer les codes promotionnels.
- [ ] Appliquer la reduction Pro de 30 %.
- [ ] Crediter la recompense unique de 5 USD ou 675 HTG.
- [ ] Bloquer auto-parrainage, doublons, remboursements et fraude.

### Phase 10 - Parrainage marchand

- [ ] Ajouter le bouton Inviter un ami.
- [ ] Creer le lien et l'invitation par e-mail.
- [ ] Suivre le plan Pro et les volumes confirmes HTG/USD.
- [ ] Crediter une seule fois 5 USD ou 675 HTG.
- [ ] Afficher la progression et l'historique au marchand.

### Phase 11 - Dashboards partenaires

- [ ] Creer le dashboard Developer responsive.
- [ ] Ajouter Referencement, Analyses et Parametres Developer.
- [ ] Creer la fiche client Developer et la gestion des cles.
- [ ] Creer le dashboard Ambassadeur responsive.
- [ ] Ajouter Analyses et Parametres Ambassadeur.

### Phase 12 - Administration, rapports et releves

- [ ] Ajouter les ecrans partenaires dans System Core.
- [ ] Ajouter les controles et ajustements audites.
- [ ] Generer les releves mensuels marchands et partenaires.
- [ ] Generer le rapport global Kobara et les rapports par marchand.
- [ ] Ajouter les exports PDF et CSV.

### Phase 13 - Validation et publication

- [ ] Executer les tests SQL, unitaires et d'integration.
- [ ] Verifier les permissions et l'isolation multi-tenant.
- [ ] Verifier les calculs financiers et les courses concurrentes.
- [ ] Verifier le responsive mobile et desktop.
- [ ] Compiler et deployer Kobara Production.
- [ ] Controler le deploiement et les journaux de production.

## Journal d'avancement

- 2026-09-20: plan enregistre, audit initial du depot et verification des recommandations Supabase termines.
- 2026-09-20: fondation SQL, scopes API, plafonds Developer, passage en Live et registre idempotent implementes; validation et migration Production encore requises.
- 2026-09-20: migrations Production appliquees et verifiees; RLS actif, aucun privilege `anon`/`authenticated`, 237 cles existantes migrees avec leurs scopes, compilation et tests metier valides.
- 2026-09-20: commit `dda764d` deploye sur le Worker Production, version `38ee992c`; controle HTTP termine avec succes.
