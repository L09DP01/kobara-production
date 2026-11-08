# Révision de la base Kobara — constat et périmètre

Date : 8 novembre 2026. Livrable principal : `base-connaissances-kobara-v2.md`.
L'original du dossier Downloads n'est pas modifié. Aucune base Kapso n'est remplacée et aucune donnée client de production n'est consultée pour cette révision.

## Changements prioritaires

1. Retrait du transfert automatique sur salutation, frustration, mot « bloqué », question vague, premier résultat de recherche vide ou simple citation d'un ancien tarif.
2. Séparation entre question générale, dépannage guidé et demande d'action privée. La demande explicite d'humain et les incidents concrets de sécurité restent prioritaires.
3. Ajout d'une méthode de clarification courte, d'exemples français/créole et d'une matrice de 35 questions fréquentes.
4. Correction de la disponibilité locale : premier de 12 heures après confirmation ou prochain 08:00 en Haïti, y compris le même matin.
5. Correction des plafonds : 50 000 HTG/jour dashboard et 75 000 HTG/opération ; ils ne sont pas interchangeables.
6. Distinction frais locaux d'encaissement, retraits locaux et retraits Zelle/PayPal selon la devise source. Suppression du « 5 % sur tous les retraits ».
7. Ajout du multi-business et de la séparation identité/sécurité/Telegram du compte et configuration opérationnelle du business.
8. Ajout des scénarios Shopify : méthode manuelle, e-mail, conversion au taux marchand, validité 24 h, commande créée différente de paiement confirmé, liens suivis dans Shopify.
9. Explication du titulaire légitime et de la revérification sans accusation automatique ni divulgation du compte en conflit.
10. Documentation officielle à partager pour toute demande d'intégration ; orientation vers l'assistant de code de la documentation, sans ticket systématique.
11. Limitation des promesses de Test/Sandbox : les capacités réelles de production et la démonstration Shopify sont distinctes.
12. Retrait des garanties techniques/juridiques non prouvées par cette revue : algorithmes déployés universellement, pentests tiers, agréments, délais personnels de remboursement ou de clôture.

## Sources internes examinées

- `src/lib/help-center-content.ts` : articles publiés, FAQ paiement, KYC, solde, frais, marketplace et sécurité.
- `src/lib/merchant-pricing.ts` : frais locaux et plafonds.
- `src/lib/withdrawal-currency.ts` : Zelle/PayPal, conversion et frais selon la source.
- `src/lib/server/withdrawals/withdrawal.service.ts` : moyens, restrictions, minimum USD et suivi des demandes.
- `src/content/docs/withdrawals.md` : contrat public du retrait API, idempotence et résultats incertains.
- `src/lib/server/withdrawals/funds-availability.ts` et migrations de disponibilité du 21 octobre : règle du prochain 08:00.
- `src/lib/shopify-policy.ts`, `src/lib/server/shopify.ts` et page dashboard Shopify : admissibilité, taux et envoi du lien.
- `src/lib/account-settings-policy.ts`, `src/lib/server/account-settings.ts` : sécurité du compte.
- `src/lib/server/create-business.ts`, `src/lib/server/business-activation.ts` : propriétaire et activation conditionnelle.
- `src/lib/server/telegram/telegram-businesses.ts` et bot : association et contexte d'activité.
- `src/lib/payment-routing.ts` : formats et réseaux, préfixes Natcom 55 et 56.
- Pages Tarifs, Conditions, Confidentialité et Clôture ; traitement de paiement réussi.

## Contradictions ou limites à traiter séparément dans le produit

- Les CGU publiques présentent encore un tarif indicatif de 2,9 %, alors que Tarifs et le code local affichent 3,9 % pour MonCash/NatCash. Ne pas modifier un contrat via la base de connaissances.
- Les CGU citent encore `docs.kobara.ht` ; le lien opérationnel utilisé est `docs.kobara.app`.
- L'identité de l'entité contractante et certaines formulations réglementaires ne peuvent pas être certifiées par un audit de code. Le centre d'aide distingue Smartcore Groupe et la confirmation contractuelle ; les textes légaux nomment une société. Une confirmation éditoriale/juridique reste nécessaire.
- Les garanties TLS/algorithmes/audits de la politique ne prouvent pas à elles seules leur déploiement sur tous les composants. Elles ne sont pas converties en attestation par l'agent.
- Les textes de clôture et les CGU présentent des modalités et délais différents. La base donne le canal de demande, sans garantir un délai individuel.
- Certains guides décrivent Test/Live de manière générale alors que les routes publiques de production exigent Live. La disponibilité exacte d'un environnement de test doit être confirmée pour le parcours utilisé.
- Le traitement des retraits dépend aussi de réglages serveur et du résultat réseau : ne pas promettre que chaque MonCash/NatCash est instantané ou automatique.

## Consultation publique et limitations

Les pages `https://kobara.app/`, `/pricing`, `/terms`, `/privacy` et le Quickstart de la documentation ont été accessibles via l'outil de consultation. Plusieurs adresses du domaine pay, du centre d'aide ou de pages documentaires détaillées n'ont pas été récupérables par cet outil. Cela ne prouve pas une panne publique ou une erreur 404 ; leur contenu a été rapproché des fichiers du dépôt quand disponible.

Cette revue est documentaire et statique. Elle ne constitue pas un audit exhaustif de chaque écran connecté, des contrats, des règles personnalisées, de la base de production ou des droits réels de chaque marchand. Les exemples ne représentent aucune transaction réelle.

## Validation recommandée avant remplacement dans Kapso

- Faire valider les règles sensibles et contradictions ci-dessus par Lorvens.
- Vérifier les réponses avec les scénarios de salutation, compte bloqué vague, KYC attente, humain demandé, usurpation concrète, Shopify, API et délais de disponibilité.
- Tester qu'une recherche pertinente ne déclenche pas `handoff_to_human`, et qu'un transfert réel utilise l'outil au lieu d'une simple annonce.
- Vérifier séparément le déploiement et l'activation du webhook d'alerte d'équipe : la base ne garantit pas la livraison d'un e-mail.
- Remplacer uniquement la base unique après validation ; ne pas conserver la version 1.1 active à côté de la 2.0.
