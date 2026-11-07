# Audit transversal de l'interface Kobara

## Methode et limites

Le skill `apple-design` est maintenant installe et a ete lu pour la seconde passe. Criteres : previsibilite, controle utilisateur, feedback, lisibilite, focus et preferences d'accessibilite. Le style Kobara et les regles metier sont conserves. Ceci n'est pas une certification Apple.

References :
- https://developer.apple.com/design/human-interface-guidelines/accessibility
- https://developer.apple.com/design/tips/

Inventaire initial AST : 271 fichiers TSX, dont 118 pages, 334 utilisations de boutons et 270 controles de formulaire. Cet inventaire ne signifie pas que chaque page a ete parcourue visuellement. La premiere passe portait sur les composants transversaux, la navigation marchande et un champ du checkout NatCash.

La seconde passe etend la revue aux modales marchand (retraits, clients, cles API, webhooks, QR), au portail et a la navigation System Core, a la documentation et a son assistant. Les recherches couvrent src ; la validation interactive ne couvre pas toutes les pages connectees.

Les tests utilisent des donnees fictives et remplacent les actions serveur par des simulations. Aucun paiement, retrait, changement de business ou envoi d'e-mail reel n'est effectue.

## Problemes confirmes, du plus grave au moins grave

Les lignes indiquent les emplacements apres correction. P1 = obstacle majeur a une action ; P2 = accessibilite ou ergonomie degradee ; P3 = finition.

| # | Gravite | Emplacement | Probleme constate et correction | Etat |
|---|---|---|---|---|
| 1 | P1 | src/components/ui/input.tsx:14 | Le champ heritait de la couleur du parent : texte blanc possible sur son fond blanc dans une surface sombre. Ajout explicite de text-foreground, surchargeable par les variantes metier. | Corrige |
| 2 | P1 | src/components/dashboard/sidebar.tsx:74 | Le tiroir mobile conservait ses liens dans le DOM ferme et n'isolait pas le focus a l'ouverture. Remplacement par une vraie modale Radix : focus capture, Echap, fond inerte et retour au declencheur ; fermeture au passage desktop. | Corrige |
| 3 | P1 | src/components/ui/dialog.tsx:59 | Les longues modales centrees pouvaient depasser le viewport et rendre leur debut ou leur validation inaccessibles. Hauteur limitee au viewport dynamique et defilement interne. | Corrige |
| 4 | P1 | src/components/dashboard/top-nav.tsx:216 | Les notifications etaient des div cliquables sans activation clavier. Navigation par un vrai bouton, dismissal dans un bouton separe, sans boutons imbriques. | Corrige |
| 5 | P1 | src/components/dashboard/top-nav.tsx:182 | Le panneau de notifications de largeur fixe pouvait sortir de l'ecran a 320 px. Ancrage mobile aux deux bords avec marges, hauteur bornee ; positionnement desktop conserve. | Corrige |
| 6 | P1 | src/app/pay/[paymentLinkId]/natcash/NatCashWaitingClient.tsx:213 | Le champ TransCode n'etait pas associe a son libelle ni a son erreur. Ajout id/htmlFor, aria-invalid, aria-describedby et role alert. | Corrige |
| 22 | P1 | src/app/dashboard/withdrawals/withdrawals-client.tsx:367 | Retrait, QR B2B (726), detail (757) : absence de focus modal et hauteur non bornee. Migration vers ModalFrame : Echap, focus capture, retour au declencheur et defilement. | Corrige |
| 23 | P1 | src/app/dashboard/api-keys/api-keys-client.tsx:324 | Revocation et creation (353) sans vraie semantique modale. Migration vers ModalFrame. | Corrige |
| 24 | P1 | src/app/dashboard/customers/customers-client.tsx:246 | Detail et creation client (376) laissaient le focus derriere la fenetre. Migration vers ModalFrame. | Corrige |
| 25 | P1 | src/app/dashboard/webhooks/webhooks-client.tsx:258 | Ajout et suppression (300) sans focus capture ni fermeture clavier. Migration vers ModalFrame. | Corrige |
| 26 | P1 | src/app/dashboard/payment-links/LinkActions.tsx:57 | QR de paiement sans focus modal ni limites de viewport. Migration vers ModalFrame. | Corrige |
| 27 | P1 | src/app/system-core/(protected)/withdrawals/withdrawals-admin-client.tsx:283 | Refus de retrait sans focus modal ni defilement borne. Migration vers ModalFrame sans changer les actions financieres. | Corrige |
| 28 | P1 | src/app/system-core/(protected)/payment-provider/page.tsx:246 | Confirmation du changement de fournisseur non modale au clavier. ModalFrame, fermeture bloquee pendant la sauvegarde. | Corrige |
| 29 | P1 | src/components/dashboard/passkey-prompt-modal.tsx:105 | Passkey sans focus modal ni hauteur bornee. ModalFrame, fermeture 44 px, erreur annoncee et succes en region status. | Corrige |
| 30 | P1 | src/app/docs/docs-client.tsx:143 | Liens du menu mobile ferme encore accessibles au clavier. Dialog Radix, versions desktop/mobile separees, fermeture au changement de breakpoint. | Corrige |
| 31 | P1 | src/components/docs/DocsAIAssistant.tsx:313 | Assistant mobile sans focus capture ni Echap et hauteur vh statique. Dialog Radix et hauteur dvh. | Corrige |
| 32 | P1 | src/app/system-core/(protected)/admin-shell.tsx:132 | Menu mobile ferme encore accessible au clavier. Dialog Radix, retour du focus et fermeture au breakpoint. | Corrige |
| 33 | P1 | src/app/system-core/login/page.tsx:69 | Formulaire fixe overflow-hidden coupe sur ecran court/clavier logiciel. min-h-dvh et defilement du document. | Corrige |
| 47 | P1 | src/components/docs/DocsAIAssistant.tsx:60 | sessionStorage bloque faisait echouer le rendu du chat. Lecture/ecriture protegees, conversation en memoire. | Corrige |
| 7 | P2 | src/components/dashboard/top-nav.tsx:285 | Le menu des business n'avait pas de hauteur maximale ; ses actions de fin pouvaient devenir inaccessibles sur un ecran court. Hauteur dynamique et defilement. | Corrige |
| 8 | P2 | src/components/dashboard/top-nav.tsx:237 | L'action de lecture d'une notification n'apparaissait qu'au survol. Bouton toujours visible, nom accessible et cible tactile de 44 px. | Corrige |
| 9 | P2 | src/app/globals.css:495 | Plusieurs boutons et controles mesuraient de 24 a 40 px. Minimum tactile de 44 px pour les pointeurs grossiers ; tailles desktop compactes conservees. | Corrige |
| 10 | P2 | src/components/ui/input.tsx:14 | Les champs communs de 14 px pouvaient declencher le zoom de Safari iOS. Texte mobile de 16 px et hauteur de 44 px, sans interdire le zoom utilisateur. | Corrige |
| 11 | P2 | src/app/globals.css:490 | Les controles personnalises n'avaient pas tous de focus clavier visible. Ajout d'un contour global pour focus-visible. | Corrige |
| 12 | P2 | src/components/dashboard/sidebar.tsx:101 | Le safe area etait pris a l'interieur des 72 px de la barre basse, reduisant la place utile. Hauteur comprenant le safe area, avec reserve correspondante dans dashboard-layout-client.tsx:102. | Corrige |
| 13 | P2 | src/components/dashboard/sidebar.tsx:147 | Titres de sections de 10 px en slate-600 sur fond sombre, et navigation mobile en slate-500. Augmentation a 11 px et slate-400 pour les elements actifs ou disponibles. | Corrige |
| 14 | P2 | src/components/dashboard/top-nav.tsx:11 | Les icones critiques dependaient d'une police distante : noms de glyphes ou absence d'icone si elle ne chargeait pas. Remplacement par Lucide local, icones decoratives masquees aux lecteurs d'ecran. | Corrige |
| 15 | P2 | src/components/dashboard/top-nav.tsx:138 | Le logo sombre manquait de contraste dans l'en-tete sombre ; la marque complete concurrencait les actions sur petit ecran avec parrainage. Icone officielle compacte avant 430 px et logo clair au-dela. | Corrige |
| 16 | P2 | src/components/dashboard/sidebar.tsx:114 | La page courante etait indiquee seulement par le style et un point colore. Ajout aria-current aux liens actifs, et etat depliable aux declencheurs de panneaux. | Corrige |
| 17 | P2 | src/components/dashboard/top-nav.tsx:118 | Aucune possibilite d'eviter la navigation repetitive du dashboard au clavier. Ajout d'un lien de saut vers le contenu principal focusable. | Corrige |
| 18 | P2 | src/app/globals.css:478 | Toutes les barres de defilement etaient masquees globalement, cachant l'existence de contenu supplementaire. Suppression de cette regle globale ; les exceptions locales explicites sont conservees. | Corrige |
| 19 | P2 | src/components/ui/button.tsx:8 | nowrap et hauteur fixe pouvaient couper ou faire deborder un libelle long ou traduit. Retour a la ligne, largeur bornee et hauteur minimale du bouton commun. | Corrige |
| 20 | P2 | src/app/globals.css:9 | --font-sans se referencait elle-meme, rendant le token invalide et la typographie dependante d'un fallback. Raccordement aux polices Next deja chargees ; ajout du token de texte des boutons destructifs manquant a la ligne 29. | Corrige |
| 34 | P2 | src/app/system-core/login/page.tsx:160 | OTP sans clavier numerique ni suggestion de code. inputMode, pattern, one-time-code et texte d'aide associe. | Corrige |
| 35 | P2 | src/app/system-core/login/page.tsx:109 | Libelles non associes et erreur non annoncee. htmlFor/id, alert, aria-invalid et aria-describedby. | Corrige |
| 36 | P2 | src/app/system-core/login/page.tsx:15 | Animations JavaScript ignorant reduced-motion. useReducedMotion dans le portail et le bouton assistant (DocsAIAssistant.tsx:45). | Corrige |
| 37 | P2 | src/components/ui/button.tsx:12 | Texte des variantes default/secondary incompatible avec leurs fonds fixes selon le theme. Texte blanc explicite. | Corrige |
| 38 | P2 | src/components/ui/button.tsx:24 | Hauteur fixe des variantes xs/sm/lg coupant les libelles longs. Hauteur minimale et padding vertical. | Corrige |
| 39 | P2 | src/app/dashboard/payment-links/LinkActions.tsx:14 | Succes de copie annonce avant resolution du presse-papiers. Attente de writeText, erreur visible et region status. | Corrige |
| 40 | P2 | src/app/docs/docs-client.tsx:89 | Copie de code sans feedback ni traitement d'echec. Etat copie, nom accessible, statut, erreur et icone locale. | Corrige |
| 41 | P2 | src/app/dashboard/payment-links/LinkActions.tsx:28 | Actions invisibles au focus clavier desktop. focus-within:opacity-100 et retour a la ligne. | Corrige |
| 42 | P2 | src/app/globals.css:505 | Reduction de transparence ignoree. Surfaces glass, navigation et scrims partages opaques sans blur. | Corrige |
| 43 | P2 | src/app/globals.css:512 | Contraste renforce ignore pour navigation et modales. Fonds solides, bordures definies et focus plus epais. | Corrige |
| 44 | P2 | src/app/system-core/(protected)/admin-shell.tsx:92 | Plusieurs modules actifs sur les chemins de logs imbriques. Chemin le plus specifique et aria-current. | Corrige |
| 46 | P2 | src/components/docs/DocsAIAssistant.tsx:194 | Fermeture masquee entre 768 et 1024 px malgre le panneau mobile actif. Breakpoint lg et nom accessible. | Corrige |
| 48 | P2 | src/components/docs/DocsAIAssistant.tsx:120 | Defilement smooth JavaScript malgre reduced-motion. Defilement instantane selon la preference. | Corrige |
| 49 | P2 | src/app/docs/docs-client.tsx:158 | En-tete trop dense sur tablette et largeur intermediaire : collision titre/actions et dependance aux glyphes distants. Titre adapte, min-width/flex explicites, statut secondaire reserve aux grands ecrans, icones Lucide et noms accessibles. | Corrige |
| 21 | P3 | src/components/ui/dialog.tsx:91 | Le bouton de fermeture de la modale pouvait chevaucher un titre long, et son nom accessible etait en anglais. Reserve a droite, cible de 44 px et libelle Fermer. | Corrige |
| 45 | P3 | src/components/ui/button.tsx:8 | Absence de feedback a la pression. active:brightness-90 sans deplacement de layout. | Corrige |

## Verification

- TypeScript : `npx tsc --noEmit`.
- Navigateur : `node tests/ui/interface-audit-smoke.mjs`.
- Resultat final : 70 controles navigateur reussis ; TypeScript sans erreur. Premiere passe : 37 controles.
- Seconde passe : modales metier, portail, menus documentation/System Core, assistant tablette, contraste renforce, reduction de transparence et absence de collision dans l'en-tete docs a 390, 820, 1024 et 1440 px.
- Captures inspectees : dashboard 320 px, portail sur viewport court et documentation tablette. Les fixtures ne chargent pas les polices Next distantes ; leur rendu en production reste a verifier.
- Viewports : 320, 390, 768 et 1440 px ; saisie, ouverture, focus, fermeture Echap, navigation clavier, panneau mobile, longue modale et reduction des animations.
- Les captures peuvent etre enregistrees avec INTERFACE_SCREENSHOT_DIR.
- Les mutations metier restent simulees dans la fixture ; les composants d'interface testes sont ceux de l'application.
- Tentative de demarrage Next sur le port 3033 : serveur non joignable depuis cet environnement. La verification navigateur utilise donc une fixture isolee des composants reels, pas une session connectee a l'application complete.

## Travail restant pour un audit exhaustif

Mise a jour du 26 octobre : voir [INTERFACE_AUDIT_COVERAGE.md](./INTERFACE_AUDIT_COVERAGE.md) pour la passe connectee marchand/administrateur, les corrections supplementaires, les tests du support et les limites physiques encore ouvertes.

- Parcourir chaque page connectee avec les roles marchand, equipe, partenaire et administrateur, en etats vide, chargement, erreur, succes et suspension.
- Verifier les formulaires specifiques qui n'utilisent pas Input et les etats metier de chaque page en session connectee.
- Tester les lecteurs d'ecran VoiceOver/TalkBack et Safari iOS reels, le clavier logiciel, les safe areas physiques et le grossissement du texte.
- Mesurer les contrastes sur chaque vue et chaque etat ; les controles simplifies ici ne certifient pas toutes les palettes metier.
- Tester les interactions sur appareils physiques ; aucune nouvelle gesture personnalisee n'a ete ajoutee.

Ce rapport ne pretend donc pas que toute l'application est desormais sans defaut. Il repertorie tous les problemes confirmes dans cette passe et leurs corrections, avec une couverture reproductible.
