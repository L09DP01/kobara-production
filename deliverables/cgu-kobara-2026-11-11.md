# Conditions Générales d'Utilisation

Dernière mise à jour : 11 novembre 2026

Bienvenue sur Kobara. En accédant à notre plateforme et en utilisant notre API de paiement, vous acceptez les présentes Conditions Générales d'Utilisation dans leur intégralité. Lisez-les attentivement avant d'utiliser nos services.

⚠ Kobara est une passerelle technologique de paiement. Kobara n'est pas une banque, ne détient pas de licence bancaire, et n'est pas un établissement financier agréé. Kobara facilite techniquement les transactions via le réseau MonCash, opéré par Digicel Haiti S.A., selon leurs propres conditions générales.

## 1. Définitions

Les termes suivants, utilisés dans les présentes CGU, ont le sens défini ci-après :

| Terme | Définition |
| --- | --- |
| Kobara | Kobara Technologies S.A., société exploitant l'infrastructure API de paiement et propriétaire des présentes CGU. |
| Marchand | Toute entreprise ou personne physique ayant créé et activé un compte marchand Kobara après vérification KYC. |
| Utilisateur final | Client du Marchand effectuant un paiement via une intégration Kobara, sans relation contractuelle directe avec Kobara. |
| Transaction | Toute opération de paiement initiée via l'API Kobara et routée sur le réseau MonCash. |
| Solde | Montant des fonds reçus, confirmés et disponibles dans le compte marchand Kobara, déduction faite des frais applicables. |
| API | Interface de programmation applicative fournie par Kobara, permettant l'intégration des fonctionnalités de paiement dans les systèmes des Marchands. |
| Webhook | Notification HTTP envoyée automatiquement par Kobara vers une URL configurée par le Marchand, lors d'événements de paiement (succès, échec, remboursement). |
| KYC | Know Your Customer — processus réglementaire de vérification d'identité et d'activité, obligatoire pour l'ouverture d'un compte marchand. |
| AML/CFT | Anti-Money Laundering / Counter-Financing of Terrorism — cadre réglementaire de lutte contre le blanchiment et le financement du terrorisme. |

## 2. Éligibilité et Vérification KYC

### 2.1 Conditions d'éligibilité

Pour ouvrir un compte marchand Kobara, vous devez remplir toutes les conditions suivantes :

- Être âgé d'au moins 18 ans
- Être une entreprise légalement enregistrée en Haïti (numéro RCCM valide) ou un travailleur indépendant autorisé à exercer une activité commerciale sur le territoire haïtien
- Posséder un compte MonCash actif, valide et enregistré à votre nom ou au nom de votre entité
- Ne pas faire l'objet de sanctions nationales ou internationales (liste OFAC, gel d'avoir, etc.)

### 2.2 Processus de vérification KYC

L'ouverture d'un compte marchand est conditionnée à la réussite complète d'un processus KYC comprenant la fourniture des documents suivants :

- Numéro RCCM et documents d'enregistrement de l'entreprise
- Numéro d'Identification Fiscale (NIF) à jour
- Pièce d'identité nationale valide du représentant légal
- Justificatif d'activité commerciale (facture, contrat, site web, etc.)
- Informations sur la nature de l'activité et les flux financiers attendus

### 2.3 Suspension et sanctions

Kobara se réserve le droit de refuser, suspendre ou fermer immédiatement tout compte dont les informations KYC s'avèrent inexactes, falsifiées, incomplètes ou ne correspondant plus à la réalité. En cas de fraude avérée lors de l'inscription, Kobara peut retenir les fonds disponibles pendant la durée de l'investigation et signaler les faits aux autorités compétentes.

## 3. Utilisation de l'API Kobara

### 3.1 Licence d'utilisation

Kobara vous accorde une licence d'utilisation de son API limitée, non exclusive, non transférable et révocable, valable uniquement pour les fins d'intégration des fonctionnalités de paiement dans vos propres produits et services légitimes, dans le respect des présentes CGU.

### 3.2 Utilisations interdites

Il vous est strictement interdit de :

- Utiliser l'API Kobara pour des activités illicites, frauduleuses ou contraires aux présentes CGU ou à la législation haïtienne applicable
- Procéder à de l'ingénierie inverse (reverse engineering) de l'API, tenter d'en décompiler le code ou d'en extraire les algorithmes
- Revendre, sous-licencier, louer ou redistribuer l'accès à l'API Kobara à des tiers sans autorisation écrite préalable
- Effectuer des tests de charge abusifs (stress testing, DDoS volontaire) sans accord formel de Kobara
- Automatiser des transactions à des fins de blanchiment, d'arbitrage frauduleux ou de contournement des contrôles AML
- Usurper l'identité de Kobara ou présenter votre produit comme étant développé ou certifié par Kobara

### 3.3 Rate Limiting et quotas

L'API Kobara est soumise à des limites de débit (rate limits) définis dans la documentation technique disponible sur docs.kobara.ht. Le dépassement répété et abusif de ces limites peut entraîner une suspension temporaire automatique de l'accès, sans préavis.

### 3.4 Sécurité de vos clés API

Vous êtes seul responsable de la sécurité et de la confidentialité de vos clés API et secrets Webhook. Toute activité effectuée avec vos identifiants engage votre responsabilité exclusive, qu'elle soit autorisée ou non par vous.

En cas de compromission suspectée, vous devez :

- Régénérer immédiatement vos clés depuis votre tableau de bord Kobara
- Notifier Kobara dans les 24 heures à security@kobara.app
- Analyser vos logs pour identifier les transactions non autorisées éventuelles

🔐 Kobara recommande fortement l'activation de l'authentification à deux facteurs (MFA) sur votre compte marchand. Cette mesure réduit significativement le risque de compromission.

## 4. Traitement des Paiements

### 4.1 Nature du service

Kobara agit exclusivement en tant que passerelle technologique. Nous facilitons la communication entre votre système et le réseau MonCash. Kobara ne détient pas les fonds de vos clients — le traitement effectif des paiements est réalisé par MonCash/Digicel Haiti conformément à leurs propres conditions.

### 4.2 Frais de traitement

Kobara ne propose aucun plan d’abonnement et ne facture aucun abonnement mensuel. Le tarif standard par paiement réussi est de 3,9 % du montant brut pour MonCash et NatCash, et de 3,5 % + 0,70 USD pour les cartes bancaires lorsque ce moyen est activé. Pour les autres moyens ou les conditions négociées, consultez le tarif applicable à votre compte avant l’opération.

Les frais sont automatiquement déduits du montant crédité à votre Solde. Kobara se réserve le droit de modifier sa grille tarifaire avec un préavis de 30 jours.

### 4.3 Délais de règlement

Les fonds des transactions confirmées sont crédités sur votre Solde Kobara selon les délais définis dans votre contrat marchand. Ces délais peuvent varier en fonction des conditions opérationnelles du réseau MonCash et des vérifications de sécurité Kobara.

### 4.4 Gestion des échecs de transaction

En cas d'échec technique d'une transaction, aucun débit n'est effectué. Les causes d'échec courantes incluent : solde MonCash insuffisant chez l'utilisateur final, numéro de téléphone invalide, timeout du réseau, ou rejet par nos systèmes de détection de fraude. Kobara n'est pas responsable des échecs imputables à l'infrastructure MonCash/Digicel.

### 4.5 Irréversibilité des transactions confirmées

⚠ Une transaction confirmée par le réseau MonCash est définitivement irréversible. Kobara n'a pas la capacité technique d'annuler ni de rembourser une transaction déjà confirmée par MonCash. Toute demande de remboursement vers un utilisateur final relève exclusivement de la responsabilité du Marchand, qui devra initier une nouvelle transaction de remboursement.

## 5. Anti-Fraude et Conformité AML/CFT

### 5.1 Monitoring automatique en temps réel

Kobara maintient des systèmes de surveillance automatique des transactions en temps réel. Toute transaction présentant des signaux d'alerte (montant anormal, fréquence suspecte, profil à risque) peut être automatiquement retardée ou bloquée pour vérification complémentaire.

### 5.2 Blocage automatique

Kobara se réserve le droit de bloquer automatiquement et sans préavis toute transaction ou compte présentant des indicateurs de fraude, de blanchiment de capitaux, de financement du terrorisme, ou d'activité contraire aux présentes CGU. Vous serez notifié dans les meilleurs délais, sauf interdiction légale.

### 5.3 Obligations légales de signalement

Kobara est soumis aux obligations légales de signalement aux autorités compétentes haïtiennes (Unité Centrale de Renseignements Financiers — UCREF) en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme. Tout comportement suspect peut être signalé aux autorités sans obligation de notification préalable au Marchand concerné.

### 5.4 Interdictions absolues

L'utilisation de Kobara est strictement et absolument interdite pour les activités suivantes :

- Blanchiment de capitaux sous toute forme
- Financement du terrorisme, de groupes armés ou d'organisations criminelles
- Toute activité faisant l'objet de sanctions OFAC (Office of Foreign Assets Control) ou d'un embargo international
- Vente de produits ou services illicites selon le droit haïtien
- Jeux d'argent non autorisés par les autorités haïtiennes compétentes
- Contournement de contrôles douaniers, fiscaux ou de change
- Escroqueries, arnaques ou tout dispositif de fraude envers des tiers

La violation de ces interdictions entraîne la résiliation immédiate du compte, le gel des fonds, et le signalement obligatoire aux autorités compétentes.

## 6. Retraits et Gestion du Solde

### 6.1 Éligibilité au retrait

Les frais de retrait sont distincts des frais d’encaissement. Un retrait MonCash ou NatCash est facturé à 5 % du montant brut demandé. Pour Zelle ou PayPal, selon disponibilité, un retrait depuis le solde USD est facturé à 2 %. Depuis le solde HTG, le montant est converti au taux de 142 HTG pour 1 USD sans frais de retrait supplémentaires. Le tableau de bord présente le montant net avant confirmation.

Les demandes de retrait sont disponibles pour tout Marchand disposant d'un compte KYC vérifié et actif, et d'un Solde disponible supérieur au seuil minimum applicable (consultable sur votre tableau de bord Kobara).

### 6.2 Destinations de retrait

Les retraits peuvent être effectués vers :

- Un portefeuille MonCash ou NatCash compatible avec le retrait demandé.
- Zelle ou PayPal depuis le tableau de bord, lorsque le moyen est disponible sur le compte. Ces deux moyens ne sont pas proposés par l’API publique de retrait.

### 6.3 Délais de traitement

Kobara s'engage à traiter les demandes de retrait dans un délai de 1 à 3 jours ouvrés à compter de la validation de la demande, sous réserve des vérifications de sécurité requises et de l'absence de blocage AML.

### 6.4 Gel de fonds

Kobara se réserve le droit de geler temporairement tout ou partie de votre Solde dans les cas suivants :

- Suspicion d'activité frauduleuse ou anomalie détectée sur votre compte
- Litige ou contestation en cours impliquant des transactions sur votre compte
- Réquisition légale, judiciaire ou demande d'autorité compétente
- Violation suspectée ou avérée des présentes CGU

Vous serez notifié du gel dans les meilleurs délais, sauf interdiction légale de divulgation. La durée du gel sera proportionnelle à la nature de l'investigation.

## 7. Litiges et Contestations de Transaction

### 7.1 Responsabilité exclusive du Marchand envers ses clients

Le Marchand est seul responsable de la gestion des réclamations et litiges de ses propres utilisateurs finaux. Kobara n'est pas partie aux contrats commerciaux conclus entre le Marchand et ses clients et ne peut pas se substituer au Marchand dans la résolution de ces litiges.

### 7.2 Procédure de contestation

En cas de contestation d'une transaction impliquant votre compte (signalée par un tiers ou détectée par nos systèmes), Kobara peut vous contacter pour recueillir des éléments de preuve. Vous disposez d'un délai de 5 jours ouvrés pour répondre à toute demande de Kobara dans le cadre d'un litige. L'absence de réponse dans ce délai peut être considérée comme une absence de contestation de votre part.

### 7.3 Chargebacks et frais associés

En cas de chargeback avéré ou de fraude confirmée imputable à votre compte ou à vos intégrations, les frais associés (frais de traitement du chargeback, frais d'investigation) peuvent être directement déduits de votre Solde disponible. Des chargebacks répétés ou un taux de contestation anormalement élevé peuvent entraîner la suspension ou la fermeture définitive de votre compte marchand.

## 8. Limitations de Responsabilité

### 8.1 Disponibilité du service et dépendances tierces

Kobara s'efforce de maintenir la plus haute disponibilité possible de son API, mais ne garantit pas un service ininterrompu à 100%. Kobara n'est pas responsable des interruptions, délais ou défaillances du réseau MonCash/Digicel Haiti, qui relèvent de la responsabilité exclusive de cet opérateur tiers.

### 8.2 Plafond de responsabilité financière

En tout état de cause et dans les limites permises par la loi haïtienne applicable, la responsabilité totale de Kobara envers un Marchand, pour quelque cause que ce soit, ne peut excéder le montant total des frais de traitement effectivement payés par ce Marchand à Kobara au cours des 3 mois précédant l'événement générateur de la réclamation.

### 8.3 Exclusions de responsabilité

Kobara exclut expressément toute responsabilité pour :

- Les pertes résultant d'un cas de force majeure (catastrophes naturelles, pandémies, troubles civils, coupures d'électricité généralisées, défaillances de réseaux tiers)
- Les cyberattaques, attaques DDoS ou intrusions externes non liées à une négligence prouvée de Kobara
- Toute perte financière résultant de la compromission de vos identifiants due à votre propre négligence (partage de clés API, absence de MFA, environnements non sécurisés)
- Les décisions commerciales et financières prises par le Marchand sur la base des données ou du service Kobara
- Les dommages indirects, pertes de profit, pertes de données ou préjudices commerciaux résultant de l'utilisation de nos services

## 9. Propriété Intellectuelle

L'API Kobara, sa documentation, ses interfaces utilisateur, ses algorithmes, sa marque, ses logos, ses noms de domaine et l'ensemble de ses actifs technologiques et commerciaux sont la propriété exclusive de Kobara Technologies S.A. et sont protégés par les lois applicables en matière de propriété intellectuelle.

Il vous est expressément interdit de :

- Utiliser la marque, les logos ou tout autre signe distinctif Kobara sans autorisation écrite préalable et explicite
- Créer des produits ou services dérivés basés sur l'API, la documentation ou les algorithmes Kobara
- Présenter votre produit comme étant développé, approuvé, sponsorisé ou certifié par Kobara sans accord formel
- Reproduire ou distribuer la documentation Kobara à des fins commerciales

## 10. Résiliation du Compte

### 10.1 Résiliation par le Marchand

Vous pouvez fermer votre compte marchand Kobara à tout moment en soumettant une demande écrite à legal@kobara.app avec un préavis minimum de 15 jours calendaires. Durant ce délai, les transactions et paiements en cours seront finalisés normalement.

### 10.2 Résiliation par Kobara

Kobara peut suspendre ou résilier votre accès immédiatement et sans préavis dans les cas suivants :

- Violation avérée ou suspectée des présentes CGU
- Activité frauduleuse, blanchiment ou financement d'activités illicites
- Non-conformité aux exigences KYC/AML ou fourniture d'informations falsifiées
- Décision judiciaire, réquisition légale ou injonction d'autorité compétente
- Inactivité prolongée du compte (absence de transaction pendant plus de 12 mois consécutifs)

### 10.3 Traitement du solde résiduel

En cas de résiliation sans faute de votre part, Kobara s'engage à vous restituer votre Solde disponible dans un délai de 30 jours calendaires suivant la clôture, déduction faite de tout montant dû (frais en cours, litiges ouverts).

En cas de résiliation pour fraude avérée, les fonds peuvent être retenus pendant la durée de l'investigation et, le cas échéant, transmis aux autorités compétentes conformément aux obligations légales applicables.

## 11. Modifications des CGU

Kobara se réserve le droit de modifier les présentes CGU à tout moment pour refléter les évolutions de son service, de la réglementation haïtienne, ou de ses pratiques commerciales.

- Tout changement substantiel vous sera notifié par email à votre adresse enregistrée au moins 30 jours avant son entrée en vigueur.
- La date de "Dernière mise à jour" en haut du document sera actualisée.
- La version en vigueur est consultable à tout moment sur kobara.ht/terms.
- La poursuite de l'utilisation de nos services après la date effective de modification vaut acceptation tacite des nouvelles CGU.

## 12. Droit Applicable et Juridiction

Les présentes CGU sont régies par le droit de la République d'Haïti.

En cas de litige relatif à l'interprétation, l'exécution ou la résiliation des présentes CGU, les parties s'engagent expressément à tenter de le résoudre à l'amiable dans un délai de 30 jours calendaires à compter de la notification écrite du différend, avant tout recours judiciaire.

À défaut de résolution amiable dans ce délai, les Tribunaux compétents de Port-au-Prince, République d'Haïti, auront juridiction exclusive pour connaître de tout litige relatif aux présentes CGU, nonobstant la pluralité de défendeurs ou l'appel en garantie.

## 13. Contact Légal

Pour toute question relative aux présentes CGU, tout litige ou toute notification légale :

Kobara Technologies S.A.
Port-au-Prince, Haïti

- Questions légales et CGU : [legal@kobara.app](mailto:legal@kobara.app)
- Confidentialité & données personnelles : [privacy@kobara.app](mailto:privacy@kobara.app)
- Incidents de sécurité (disponible 24h/24) : [security@kobara.app](mailto:security@kobara.app)
