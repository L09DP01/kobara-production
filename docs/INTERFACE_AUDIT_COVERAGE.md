# Audit apple-design : couverture connectee du 26 octobre 2026

Cette passe complete le rapport INTERFACE_AUDIT.md. Elle ne constitue pas une certification exhaustive. Aucune mutation de paiement, retrait, droits, KYC ou message n'a ete effectuee en production.

## Problemes confirmes, par gravite

| Priorite | Fichier et ligne | Probleme | Correction locale |
| --- | --- | --- | --- |
| P2 | src/app/dashboard/support/support-client.tsx:20 | Une exception d'envoi laissait le formulaire en chargement sans reprise. | try/catch/finally, saisie conservee en erreur. |
| P2 | src/app/dashboard/support/support-client.tsx:12 | Categorie initiale Paiements absente des valeurs des options. | Valeur payment coherente, y compris apres succes. |
| P2 | src/app/dashboard/settings/components/ProfileSettings.tsx:93 | Douze champs visibles sans nom accessible. | Noms accessibles explicites reprenant les libelles. |
| P2 | src/app/dashboard/support/support-client.tsx:60 | Categorie, sujet et message sans association au libelle. | htmlFor/id. |
| P2 | src/app/dashboard/payments/payments-filter.tsx:38 | Recherche sans nom accessible. | aria-label. |
| P2 | src/app/dashboard/customers/customers-client.tsx:149 | Recherche sans nom accessible. | aria-label. |
| P2 | src/app/dashboard/withdrawals/withdrawals-client.tsx:651 | Filtre de statut sans nom accessible. | aria-label. |
| P2 | src/app/system-core/(protected)/administrators/administrators-client.tsx:61 | Nom, e-mail et role de creation d'acces sans nom accessible. | aria-label, sans changement des droits. |
| P2 | src/app/system-core/(protected)/merchants/page.tsx:39 | Recherche marchand sans nom accessible. | aria-label. |
| P2 | src/app/system-core/(protected)/transactions/page.tsx:32 | Statut et recherche de reference sans nom accessible. | aria-label. |
| P2 | src/app/system-core/(protected)/sessions/page.tsx:40 | Texte secondaire mesure a environ 4,23:1. | slate-400 remplace slate-500 sur ce paragraphe ; nouvelle mesure en production apres deploiement requise. |
| P3 | src/app/dashboard/payments/page.tsx:178 | Aucun titre principal h1. | Le titre existant devient h1, sans changement visuel. |

## Couverture reelle

Vue initiale rendue, lecture seule, donnees existantes, Chrome Windows. Les valeurs privees ne sont pas recopiees dans ce rapport.

| Role | Vues examinees | Limite |
| --- | --- | --- |
| Marchand | dashboard, payments, payment-links, customers, withdrawals, dashboard/integrations/shopify, analytics, statements, api-keys, webhooks, settings, support | Vue initiale uniquement ; session ensuite expiree. Les panneaux conditionnels et toutes les combinaisons d'etat ne sont pas couverts. |
| Marchand | developers redirige vers onboarding | Transition observee ; destination non validee, ne compte pas comme vue auditee. |
| Administrateur | dashboard, payment-provider, merchants, kyc, transactions, business-requests, partners, reports, withdrawals, support, shopify-privacy, administrators, health, alerts, messaging, smart-promotions, promo-codes, sms-gateway, logs, audit, sessions | Premiere passe DOM des vues initiales. Pas d'action d'administration executee. Logs Supabase/Cloudflare, details et sous-pages non parcourus. |
| Equipe | Non teste en session propre | Aucun onglet de ce role identifie. Le compte proprietaire ne remplace pas une session equipe. |
| Partenaire | Non teste en session propre | La page administrateur partners ne remplace pas une session partenaire. |

Dimensions reellement mesurees : marchand 1777 x 787 ; administrateur 1600 x 765 puis 1600 x 709. Une demande de viewport n'a pas ete appliquee comme prevu : aucun resultat mobile connecte n'est revendique.

## Etats et tests locaux

- Support reel monte dans une fixture isolee : champs accessibles, categorie initiale, chargement, succes, erreur retournee, exception reseau, conservation de saisie et possibilite de reessayer. 12 controles reussis via `node tests/ui/support-audit.mjs`.
- Composants partages : 70 controles reussis via `node tests/ui/interface-audit-smoke.mjs` (voir rapport principal).
- Ces fixtures ne creent aucun ticket, retrait ou paiement reel. Elles ne prouvent pas tous les etats metier des pages completes.
- Aucun compte n'a ete suspendu pour provoquer un etat d'erreur ; aucune permission n'a ete changee.

## Contraste : limites de mesure

La premiere sonde ignorait les couleurs CSS lab() de Tailwind. Ses resultats a zero ne sont PAS des validations de contraste. Une conversion Lab D50 vers sRGB a ensuite permis un echantillon sur Sessions : texte slate-500 de 14 px a environ 4,23:1 sur son fond opaque, sous le seuil 4,5:1. Cette mesure ponctuelle ne couvre pas toutes les vues, gradients, transparences et etats.

## Tests physiques restant obligatoires

Non executes : VoiceOver sur iPhone, TalkBack sur Android, Safari iOS reel, clavier logiciel, safe areas physiques et texte agrandi sur appareil. Une emulation Chrome n'est pas un substitut.

Pour chaque role et chaque formulaire : navigation au lecteur d'ecran et ordre de focus, annonce des erreurs/succes, retour du focus apres fermeture, clavier n'occultant pas l'action, zoom/texte a 200 %, orientation paysage, zones du notch et indicateur d'accueil. Relever appareil/OS/navigateur/role/route/etat/resultat avant de marquer une cellule validee.

L'audit exhaustif reste ouvert sur les sessions equipe/partenaire, les etats conditionnels complets et les appareils physiques.

En fin de passe, la session administrateur redirige egalement vers system-core/login?reason=timeout. Les deux sessions devront etre reconnectees pour poursuivre les sous-pages. Les dimensions temporaires du navigateur ont ete reinitialisees.
