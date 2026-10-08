export type PublicPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  sectionTitle: string;
  sectionIntro: string;
  features: { title: string; description: string }[];
  flow?: string[];
  note?: string;
  details?: { kicker: string; title: string; description: string; bullets: string[] }[];
  faq?: { question: string; answer: string }[];
};

export const productPages: Record<string, PublicPageContent> = {
  payments: {
    eyebrow: "Kobara Payments",
    title: "Des paiements unifiés pour développer votre activité.",
    description: "Acceptez les moyens de paiement disponibles sur Kobara à travers une infrastructure conçue pour les entreprises et plateformes numériques.",
    primaryLabel: "Commencer à accepter des paiements",
    primaryHref: "/register",
    secondaryLabel: "Documentation API",
    secondaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Une infrastructure complète autour de chaque transaction",
    sectionIntro: "Kobara relie la création du paiement, le checkout, la confirmation et vos opérations marchandes sans vous obliger à construire chaque couche séparément.",
    features: [
      { title: "Checkout hébergé", description: "Dirigez le client vers une expérience Kobara cohérente, adaptée au téléphone comme à l’ordinateur." },
      { title: "Statuts vérifiables", description: "Suivez les états en attente, confirmés ou échoués depuis le dashboard et votre intégration." },
      { title: "Webhooks", description: "Recevez les confirmations côté serveur afin d’automatiser commandes, accès et reçus." },
      { title: "Liens sans code", description: "Créez un lien partageable lorsque vous n’avez pas besoin d’une intégration API." },
      { title: "Comptes HTG et USD", description: "Gardez une lecture claire de la devise de référence et du compte crédité." },
      { title: "Historique centralisé", description: "Retrouvez les paiements, clients et références dans un espace marchand unique." },
    ],
    flow: ["Créer le paiement", "Ouvrir le checkout", "Choisir le moyen", "Confirmer", "Recevoir le webhook"],
    details: [
      {
        kicker: "Orchestration",
        title: "Kobara se place entre l’intention de paiement et votre confirmation métier.",
        description: "Votre application crée une transaction et conserve sa propre référence. Kobara présente les moyens activés, suit le traitement puis renvoie un statut exploitable par votre système.",
        bullets: ["Une référence Kobara pour suivre chaque paiement", "Vos métadonnées pour relier une commande ou un client", "Une URL de checkout à ouvrir ou partager", "Un événement serveur pour terminer le flux en arrière-plan"],
      },
      {
        kicker: "Opérations",
        title: "Le paiement reste compréhensible après le checkout.",
        description: "Le dashboard rassemble les montants, devises, moyens utilisés et statuts afin que vos équipes puissent vérifier une opération sans consulter plusieurs systèmes.",
        bullets: ["Recherche par référence ou client", "Lecture claire du brut, des frais et du net", "Suivi même si le client ferme la page", "Historique utilisable par le support marchand"],
      },
    ],
    faq: [
      { question: "Quels moyens apparaissent dans le checkout ?", answer: "Le checkout affiche uniquement les moyens disponibles et activés pour le compte marchand. MonCash et NatCash constituent les options locales principales; les autres moyens restent conditionnels à leur disponibilité et à leur configuration." },
      { question: "Comment savoir qu’un paiement est réellement terminé ?", answer: "Votre système doit utiliser le statut retourné par Kobara et, pour une intégration serveur, traiter le webhook de confirmation. L’ouverture du checkout ne confirme jamais une transaction." },
      { question: "Puis-je utiliser Kobara sans API ?", answer: "Oui. Les liens de paiement permettent d’encaisser sans développement. L’API devient utile lorsque vous souhaitez automatiser la création et la confirmation dans votre propre produit." },
    ],
  },
  "online-payments": {
    eyebrow: "Paiements en ligne",
    title: "Acceptez les paiements là où vos clients achètent.",
    description: "Intégrez les moyens activés sur votre compte Kobara à votre site ou application.",
    primaryLabel: "Commencer",
    primaryHref: "/register",
    secondaryLabel: "Voir la documentation",
    secondaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Une infrastructure pensée pour la conversion",
    sectionIntro: "Du checkout à la confirmation, chaque étape reste cohérente et mesurable.",
    features: [
      { title: "Mobile d’abord", description: "Un checkout clair sur téléphone, tablette et ordinateur." },
      { title: "Moyens adaptés", description: "Affichez uniquement les options activées pour votre activité." },
      { title: "Suivi continu", description: "Gardez le statut de chaque transaction synchronisé." },
    ],
  },
  checkout: {
    eyebrow: "Checkout Kobara",
    title: "Un checkout. Plusieurs façons de payer.",
    description: "Offrez à vos clients une expérience de paiement cohérente, quel que soit le moyen de paiement disponible qu’ils choisissent.",
    primaryLabel: "Essayer le checkout",
    primaryHref: "/register",
    secondaryLabel: "Voir la documentation",
    secondaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Un parcours stable, même lorsque le moyen de paiement change",
    sectionIntro: "La structure, le montant et votre identité restent cohérents. Seules les instructions nécessaires au moyen choisi évoluent.",
    features: [
      { title: "Hébergé par Kobara", description: "Utilisez une page de paiement prête à l’emploi sans maintenir toute l’interface sensible." },
      { title: "Identité marchande", description: "Le nom de l’entreprise, le montant, la description et la référence accompagnent le paiement." },
      { title: "Responsive", description: "Le checkout reste lisible sur téléphone, tablette et ordinateur." },
      { title: "Moyens conditionnels", description: "Cartes, PayPal et crypto apparaissent seulement lorsqu’ils sont disponibles et activés." },
      { title: "Confirmation continue", description: "Le traitement serveur peut se terminer même lorsque le client ferme la page." },
      { title: "Retour contrôlé", description: "Redirigez le client vers votre expérience après succès ou échec lorsque le flux le permet." },
    ],
    flow: ["Votre application crée le paiement", "Kobara ouvre le checkout", "Le client choisit", "Kobara confirme", "Votre système reçoit le webhook"],
    details: [
      {
        kicker: "Expérience client",
        title: "Moins de décisions inutiles au moment de payer.",
        description: "Kobara présente un montant clair et les options réellement utilisables. Le client choisit son moyen sans quitter un parcours visuel cohérent.",
        bullets: ["Montant et devise visibles avant l’action", "Informations client limitées à ce qui est nécessaire", "Instructions adaptées au moyen sélectionné", "Messages d’erreur compréhensibles et actionnables"],
      },
      {
        kicker: "Intégration",
        title: "Votre serveur garde la source de vérité métier.",
        description: "Créez le paiement depuis un environnement serveur, associez votre référence et utilisez la confirmation Kobara avant de livrer une commande ou d’ouvrir un accès.",
        bullets: ["Création depuis l’API ou un lien marchand", "Référence externe et métadonnées", "Vérification du statut côté serveur", "Webhook pour automatiser la suite"],
      },
    ],
    faq: [
      { question: "Le checkout affiche-t-il tous les moyens de paiement ?", answer: "Non. Il affiche les moyens activés et disponibles pour le marchand, afin d’éviter de proposer une option inutilisable au client." },
      { question: "Puis-je personnaliser le checkout ?", answer: "Le checkout reprend l’identité et les informations du marchand ainsi que les données du paiement. Les possibilités exactes dépendent de la configuration disponible dans le dashboard." },
      { question: "Que se passe-t-il si le client ferme la page ?", answer: "Le suivi serveur et les webhooks peuvent continuer à mettre à jour la transaction. Votre système ne doit pas dépendre uniquement de la page de retour affichée au client." },
    ],
  },
  "payment-links": {
    eyebrow: "Liens de paiement",
    title: "Faites-vous payer avec un simple lien.",
    description: "Créez un lien de paiement et partagez-le par WhatsApp, SMS, e-mail ou réseaux sociaux.",
    primaryLabel: "Créer un lien",
    primaryHref: "/register",
    secondaryLabel: "Voir la documentation",
    secondaryHref: "https://docs.kobara.app/docs/payment-links",
    sectionTitle: "Transformez une conversation en paiement traçable",
    sectionIntro: "Le lien conserve le montant, la description et le contexte de la vente tout en donnant au client accès au checkout Kobara.",
    features: [
      { title: "Montant défini", description: "Créez un lien avec un montant et une devise précis pour éviter les erreurs de saisie." },
      { title: "Description claire", description: "Ajoutez le produit, le service ou la référence utile à votre suivi." },
      { title: "Partage immédiat", description: "Envoyez le lien par WhatsApp, SMS, e-mail ou depuis vos réseaux sociaux." },
      { title: "Checkout Kobara", description: "Le client ouvre une page de paiement adaptée aux moyens activés sur votre compte." },
      { title: "Statut centralisé", description: "Suivez le paiement depuis le dashboard au lieu de demander une capture d’écran." },
      { title: "Réutilisable ou ponctuel", description: "Choisissez le format de lien adapté à votre vente et à votre organisation." },
    ],
    flow: ["Créer le lien", "Partager", "Le client paie", "Le paiement apparaît dans Kobara"],
    details: [
      {
        kicker: "Sans code",
        title: "Créez une expérience de paiement sans construire de site.",
        description: "Les liens sont adaptés aux ventes réalisées dans une conversation, sur les réseaux sociaux ou à distance. Votre client reçoit une URL et vous gardez un enregistrement dans Kobara.",
        bullets: ["Ventes WhatsApp et Instagram", "Prestations de freelances et créateurs", "Acomptes et réservations", "Commandes prises par téléphone ou message"],
      },
      {
        kicker: "Suivi",
        title: "Chaque lien possède un contexte exploitable.",
        description: "Vous voyez ce qui a été créé, partagé et payé. Le statut de la transaction reste séparé du simple fait que le client a ouvert le lien.",
        bullets: ["Référence Kobara unique", "Montant et devise conservés", "Client et description associés", "Confirmation visible dans l’historique"],
      },
    ],
    faq: [
      { question: "Le client doit-il avoir un compte Kobara ?", answer: "Non. Le lien ouvre le checkout afin que le client choisisse un moyen disponible et suive les instructions de paiement." },
      { question: "Puis-je partager le même lien sur plusieurs canaux ?", answer: "Oui, lorsque le type de lien créé le permet. Vous pouvez le partager sur WhatsApp, SMS, e-mail ou vos réseaux." },
      { question: "Une ouverture du lien signifie-t-elle que le paiement est reçu ?", answer: "Non. Seul le statut confirmé dans Kobara indique que la transaction est terminée." },
    ],
  },
  "qr-codes": {
    eyebrow: "QR Codes",
    title: "Un scan. Un paiement.",
    description: "Transformez n’importe quel comptoir, facture ou écran en point de paiement.",
    primaryLabel: "Créer un QR Code",
    primaryHref: "/register",
    sectionTitle: "Un point d’entrée mobile vers votre checkout",
    sectionIntro: "Le QR code évite la saisie d’une longue adresse et dirige le client vers les informations de paiement déjà préparées.",
    features: [
      { title: "Affichage flexible", description: "Présentez le QR code sur un téléphone, une tablette, une facture ou un support imprimé." },
      { title: "Montant préparé", description: "Associez le QR à un lien contenant le montant et la description de la vente." },
      { title: "Checkout mobile", description: "Le client arrive sur une interface conçue pour son téléphone." },
      { title: "Moyens activés", description: "Le checkout propose uniquement les options disponibles sur le compte marchand." },
      { title: "Confirmation marchande", description: "Le paiement confirmé remonte dans le dashboard Kobara." },
      { title: "Historique", description: "Conservez la référence et le statut associés à l’opération." },
    ],
    flow: ["Afficher le QR", "Scanner", "Choisir le moyen", "Payer", "Recevoir la confirmation"],
    details: [
      {
        kicker: "En personne ou à distance",
        title: "Le même principe fonctionne sur un comptoir, une affiche ou une facture.",
        description: "Le QR code est simplement une entrée rapide vers une expérience Kobara. Il ne remplace pas la confirmation du paiement dans votre dashboard.",
        bullets: ["Comptoir et point de vente", "Événement ou collecte", "Facture imprimée", "Écran partagé pendant une vente"],
      },
      {
        kicker: "Contrôle",
        title: "Le marchand vérifie le statut, pas une capture d’écran.",
        description: "Une fois le paiement traité, Kobara met à jour la transaction. Votre équipe peut retrouver la référence, le montant et le moyen utilisé.",
        bullets: ["QR lié à une transaction identifiable", "Montant visible avant paiement", "Statut consultable dans Kobara", "Notification exploitable par le marchand"],
      },
    ],
    faq: [
      { question: "Le QR code confirme-t-il automatiquement le paiement ?", answer: "Le scan ouvre le checkout. La confirmation intervient uniquement lorsque Kobara reçoit et traite le résultat du moyen de paiement." },
      { question: "Puis-je imprimer le QR code ?", answer: "Oui, si le lien associé reste valable pour l’usage prévu. Vérifiez toujours le montant et le contexte avant l’impression." },
      { question: "Le client peut-il choisir son moyen de paiement ?", answer: "Oui. Le checkout affiche les moyens activés et disponibles pour le compte marchand." },
    ],
  },
  invoices: {
    eyebrow: "Factures",
    title: "Créez la facture. Envoyez-la. Soyez payé.",
    description: "Centralisez vos factures et permettez à vos clients de les régler en ligne.",
    primaryLabel: "Créer une facture",
    primaryHref: "/register",
    sectionTitle: "De la demande de paiement au règlement",
    sectionIntro: "Présentez une demande structurée, donnez au client un accès direct au paiement et conservez le statut dans Kobara.",
    features: [
      { title: "Informations structurées", description: "Présentez le client, le montant, l’échéance et les éléments utiles à la vente." },
      { title: "Lien de paiement", description: "Permettez au client d’accéder au checkout depuis la demande reçue." },
      { title: "États lisibles", description: "Distinguez une facture préparée, envoyée, consultée ou réglée lorsque ces informations sont disponibles." },
      { title: "Référence unique", description: "Reliez la facture à son paiement et à votre propre référence commerciale." },
      { title: "Historique", description: "Retrouvez le règlement associé depuis votre espace marchand." },
      { title: "Partage à distance", description: "Envoyez la demande au client sans échange manuel de coordonnées de paiement." },
    ],
    flow: ["Créer", "Envoyer", "Le client paie", "Voir le statut", "Conserver l’historique"],
    note: "La disponibilité des fonctions de facturation avancée peut dépendre de votre compte.",
    details: [
      {
        kicker: "Clarté commerciale",
        title: "Le client comprend ce qu’il règle avant d’ouvrir le checkout.",
        description: "Une demande claire réduit les échanges manuels. Le montant, la description et la référence restent liés au paiement Kobara.",
        bullets: ["Nom et informations du client", "Articles ou description du service", "Montant et devise", "Échéance et référence commerciale"],
      },
      {
        kicker: "Suivi",
        title: "La facture et la transaction racontent la même histoire.",
        description: "Après le paiement, votre équipe peut rapprocher la demande envoyée et l’opération reçue sans dépendre d’une preuve transmise par message.",
        bullets: ["Lien direct vers le paiement", "Statut consultable par le marchand", "Référence conservée dans l’historique", "Confirmation exploitable pour votre suivi"],
      },
    ],
    faq: [
      { question: "Toutes les fonctions de facturation sont-elles déjà disponibles ?", answer: "Les capacités avancées peuvent dépendre du compte et de la version actuellement activée. Kobara affiche uniquement les actions réellement accessibles au marchand." },
      { question: "Comment le client paie-t-il une facture ?", answer: "La demande peut contenir un lien vers le checkout Kobara. Le client choisit alors l’un des moyens disponibles sur le compte marchand." },
      { question: "Le statut de la facture remplace-t-il celui du paiement ?", answer: "Non. La transaction Kobara reste la référence pour déterminer si le règlement est confirmé." },
    ],
  },
  "payment-methods": {
    eyebrow: "Moyens de paiement",
    title: "Les moyens de paiement que vos clients utilisent déjà.",
    description: "Connectez plusieurs méthodes à une seule expérience de paiement Kobara.",
    primaryLabel: "Créer un compte",
    primaryHref: "/register",
    secondaryLabel: "Voir l’intégration",
    secondaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Une seule intégration, des options contrôlées",
    sectionIntro: "MonCash et NatCash constituent les moyens locaux principaux. Crypto, PayPal et cartes apparaissent uniquement selon leur disponibilité et leur activation sur le compte marchand.",
    features: [
      { title: "MonCash", description: "Proposez le paiement mobile Digicel en HTG dans le checkout Kobara." },
      { title: "NatCash", description: "Proposez le paiement mobile Natcom en HTG avec un statut centralisé." },
      { title: "Crypto", description: "Affichez les actifs et réseaux pris en charge uniquement lorsque ce moyen est activé." },
      { title: "Cartes", description: "Présentez les cartes prises en charge lorsque la disponibilité et la configuration le permettent." },
      { title: "PayPal", description: "Ajoutez PayPal lorsque le compte marchand et ce moyen sont correctement configurés." },
      { title: "Gestion marchande", description: "Choisissez depuis les paramètres quelles options peuvent apparaître à vos clients." },
    ],
    flow: ["Activer un moyen", "Créer le paiement", "Présenter le checkout", "Le client choisit", "Recevoir le statut"],
    details: [
      {
        kicker: "Expérience unifiée",
        title: "Vos clients choisissent; votre intégration reste la même.",
        description: "Votre système crée un paiement Kobara. Le checkout se charge ensuite de présenter les options disponibles sans vous obliger à construire un parcours entièrement différent pour chaque moyen.",
        bullets: ["Une création de paiement commune", "Un checkout cohérent", "Des statuts normalisés", "Un historique central pour le marchand"],
      },
      {
        kicker: "Disponibilité",
        title: "Ne montrez jamais une option qui ne peut pas fonctionner.",
        description: "L’affichage dépend de la configuration du marchand et de la disponibilité du moyen. Les options conditionnelles doivent rester absentes tant qu’elles ne sont pas activées.",
        bullets: ["MonCash et NatCash selon la configuration du compte", "Crypto selon les actifs et réseaux autorisés", "Cartes selon disponibilité", "PayPal selon configuration et activation"],
      },
    ],
    faq: [
      { question: "Tous les moyens sont-ils activés automatiquement ?", answer: "Non. Les moyens conditionnels doivent être disponibles et activés sur le compte marchand avant d’apparaître dans le checkout." },
      { question: "Dois-je intégrer une API différente pour chaque moyen ?", answer: "Kobara fournit un point d’entrée unifié pour créer le paiement. Le checkout adapte ensuite les instructions au moyen choisi." },
      { question: "Pourquoi un moyen peut-il ne pas apparaître ?", answer: "Il peut être désactivé, indisponible pour le compte, incompatible avec la devise ou soumis à une configuration supplémentaire." },
    ],
  },
};

export const paymentMethodPages: Record<string, PublicPageContent> = {
  moncash: method("MonCash", "Acceptez MonCash avec une expérience Kobara unifiée.", "Paiements mobiles en HTG, statuts suivis et confirmation dans votre dashboard."),
  natcash: method("NatCash", "Acceptez NatCash sans suivi manuel.", "Offrez un paiement mobile en HTG avec un parcours clair et une confirmation centralisée."),
  cards: method("Cartes", "Acceptez les cartes lorsque ce moyen est activé.", "Présentez Visa et Mastercard dans le même checkout que vos autres moyens disponibles."),
  paypal: method("PayPal", "Ajoutez PayPal à votre checkout Kobara.", "Proposez PayPal lorsque votre compte marchand et ce moyen sont correctement configurés."),
  crypto: method("Crypto", "Recevez des paiements en actifs numériques.", "Présentez uniquement les cryptos et réseaux pris en charge, avec un montant et une adresse clairement indiqués."),
};

function method(name: string, title: string, description: string): PublicPageContent {
  return {
    eyebrow: `Moyen de paiement · ${name}`,
    title,
    description,
    primaryLabel: "Créer un compte",
    primaryHref: "/register",
    secondaryLabel: "Voir la documentation",
    secondaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: `Intégrer ${name} dans votre parcours de paiement`,
    sectionIntro: "Kobara garde la création, le checkout, le statut et l’historique dans une expérience cohérente.",
    features: [
      { title: "Activation contrôlée", description: "Le moyen apparaît uniquement lorsqu’il est disponible sur votre compte." },
      { title: "Checkout cohérent", description: "Le client reste dans l’expérience de paiement Kobara." },
      { title: "Confirmation suivie", description: "Consultez le statut et recevez les événements associés." },
    ],
    flow: ["Créer le paiement", `Choisir ${name}`, "Effectuer le paiement", "Recevoir la confirmation"],
  };
}

export const solutionPages: Record<string, PublicPageContent> = {
  ecommerce: solutionPage("E-commerce", "Transformez votre boutique en véritable commerce en ligne.", "Faites passer une commande du panier à la confirmation sans demander au client d’envoyer une capture d’écran.", [
    ["Checkout local", "Présentez les moyens activés sur votre compte dans une page de paiement cohérente avec votre boutique."],
    ["Commande réconciliée", "Associez votre identifiant de commande aux métadonnées du paiement pour retrouver chaque vente."],
    ["Confirmation serveur", "Mettez à jour la commande après le webhook de confirmation, même si le client ferme la page."],
    ["Suivi marchand", "Consultez le montant, le moyen, le client et le statut depuis le dashboard Kobara."],
  ], ["Créer la commande", "Créer le paiement Kobara", "Rediriger vers le checkout", "Confirmer par webhook"], [
    ["Avant Kobara", "Les confirmations manuelles ralentissent la préparation des commandes.", ["Numéro partagé dans une conversation", "Capture d’écran difficile à vérifier", "Commande mise à jour à la main", "Support sollicité pour chaque doute"]],
    ["Avec Kobara", "La transaction devient une étape vérifiable de votre parcours e-commerce.", ["Montant fixé depuis le panier", "Référence de commande conservée", "Statut reçu côté serveur", "Historique consultable par l’équipe"]],
  ], [["Puis-je garder mon propre panier ?", "Oui. Votre boutique calcule la commande; Kobara reçoit le montant et les métadonnées nécessaires au paiement."], ["Quand confirmer une commande ?", "Confirmez-la uniquement après le statut final reçu depuis Kobara, idéalement via webhook."]]),
  woocommerce: solutionPage("WooCommerce", "Ajoutez Kobara à votre boutique WordPress.", "Reliez WooCommerce au checkout Kobara sans reconstruire votre catalogue, votre panier ou la gestion des commandes.", [
    ["Extension dédiée", "Configurez Kobara comme moyen de paiement depuis l’administration WordPress."],
    ["Commandes reliées", "La référence WooCommerce accompagne le paiement pour simplifier le rapprochement."],
    ["Retour client", "Après le checkout, le client retrouve le parcours de votre boutique."],
    ["Statut vérifiable", "La commande évolue à partir d’une confirmation Kobara plutôt que d’une simple redirection."],
  ], ["Installer l’extension", "Ajouter les accès Kobara", "Activer le moyen", "Effectuer une vente réelle"], [
    ["Configuration", "Une intégration propre commence par des accès conservés côté serveur.", ["Site servi en HTTPS", "Compte marchand actif", "Clé API stockée dans WordPress", "URL de retour contrôlée"]],
    ["Exploitation", "Le marchand garde ses opérations dans les outils qu’il utilise déjà.", ["Commande visible dans WooCommerce", "Paiement visible dans Kobara", "Référence commune aux deux systèmes", "Diagnostic possible en cas d’échec"]],
  ], [["Dois-je modifier mon thème ?", "Non pour le flux standard: le client part du checkout WooCommerce vers la page hébergée Kobara."], ["Une redirection réussie suffit-elle ?", "Non. Le statut du paiement doit être vérifié avant de considérer la commande comme payée."]]),
  saas: solutionPage("SaaS", "Une infrastructure de paiement conçue pour votre logiciel.", "Ajoutez le paiement à votre produit avec des identifiants stables, des métadonnées et des événements serveur exploitables.", [
    ["API Payments", "Créez une transaction depuis votre backend et recevez un identifiant ainsi qu’une URL de checkout."],
    ["Idempotence", "Utilisez une clé d’idempotence pour éviter les doublons lors d’une reprise réseau."],
    ["Métadonnées", "Reliez le paiement à un utilisateur, une facture, un abonnement ou une opération interne."],
    ["Webhooks", "Déclenchez l’accès au service après un événement de confirmation vérifié côté serveur."],
  ], ["Créer côté serveur", "Ouvrir le checkout", "Recevoir l’événement", "Activer le service"], [
    ["Architecture", "Le navigateur présente le paiement; votre serveur conserve l’autorité métier.", ["Clé secrète jamais exposée au client", "Montant créé depuis le backend", "Retour utilisateur séparé du webhook", "Traitement répétable sans doublon"]],
    ["Observabilité", "Chaque paiement doit pouvoir être expliqué par votre support.", ["Identifiant Kobara enregistré", "Réponse API journalisée sans secret", "Événement webhook horodaté", "État interne rapproché du statut Kobara"]],
  ], [["Puis-je créer le paiement depuis le navigateur ?", "La création authentifiée doit être réalisée depuis votre serveur afin de protéger la clé secrète."], ["Quelle confirmation utiliser ?", "Utilisez le webhook de paiement réussi pour les décisions métier importantes."]]),
  "mobile-apps": solutionPage("Applications mobiles", "Intégrez le paiement au cœur de votre application.", "Préparez le paiement sur votre serveur, ouvrez le checkout Kobara sur mobile et reprenez le parcours sans perdre l’état de la commande.", [
    ["Checkout mobile", "Une interface lisible et tactile conçue pour les écrans étroits."],
    ["Création serveur", "Le montant et les paramètres sensibles restent sous le contrôle de votre backend."],
    ["Retour d’application", "Renvoyez l’utilisateur vers un écran clair après paiement ou annulation."],
    ["Confirmation indépendante", "Votre serveur reçoit le résultat même si l’application est fermée pendant le paiement."],
  ], ["Préparer la commande", "Créer le paiement", "Ouvrir le checkout", "Synchroniser le résultat"], [
    ["Expérience client", "Le retour dans l’application doit expliquer l’état sans promettre trop tôt le succès.", ["Écran d’attente explicite", "Référence conservée localement", "Relance du statut après retour", "Message d’échec actionnable"]],
    ["Fiabilité", "Le webhook reste la source de confirmation pour votre système.", ["Deep link réservé à la navigation", "Validation effectuée côté serveur", "État restauré après fermeture", "Commande protégée contre les doubles actions"]],
  ], [["Le retour dans l’application confirme-t-il le paiement ?", "Non. Il améliore la navigation, mais votre backend doit vérifier le statut Kobara."], ["Le checkout fonctionne-t-il dans un navigateur mobile ?", "Oui. Il est conçu pour s’adapter aux téléphones et tablettes."]]),
  marketplaces: solutionPage("Marketplaces", "Orchestrez les paiements de votre plateforme.", "Donnez à chaque transaction une référence exploitable et centralisez la confirmation sans confondre paiement client et logique multi-acteurs.", [
    ["Références uniques", "Identifiez chaque panier, vendeur ou prestation dans vos propres métadonnées."],
    ["Création centralisée", "Votre plateforme contrôle le montant et crée le paiement depuis son backend."],
    ["Événements serveur", "Distribuez le statut confirmé aux services qui gèrent commande, accès ou livraison."],
    ["Rapports", "Rapprochez les transactions Kobara de vos rapports opérationnels."],
  ], ["Identifier l’opération", "Créer le paiement", "Recevoir la confirmation", "Rapprocher les données"], [
    ["Modèle de données", "Une marketplace fiable sépare la transaction du reste de son workflow.", ["Référence de commande", "Identifiant du vendeur", "Identifiant du client", "Contexte enregistré en métadonnées"]],
    ["Périmètre", "Les flux complexes doivent être validés avec Kobara avant leur mise en production.", ["Règles de crédit documentées", "Permissions limitées par rôle", "Retraits séparés de l’encaissement", "Cas d’annulation définis à l’avance"]],
  ], [["Kobara répartit-il automatiquement un paiement entre plusieurs vendeurs ?", "Ne supposez pas un partage automatique. Contactez Kobara pour valider le modèle opérationnel adapté à votre plateforme."], ["Comment suivre un vendeur ?", "Conservez son identifiant dans vos métadonnées et dans votre propre registre de commandes."]]),
  agencies: solutionPage("Agences & développeurs", "Intégrez Kobara pour tous vos clients.", "Reliez des marchands à votre espace Developer, construisez leurs paiements et gardez des permissions compréhensibles.", [
    ["Clients connectés", "Retrouvez les marchands qui ont accepté de collaborer avec votre compte Developer."],
    ["Accès contrôlés", "Les accès de paiement restent séparés des permissions sensibles comme les retraits."],
    ["Intégrations suivies", "Consultez les clients, volumes et états utiles au maintien de vos projets."],
    ["Programme Developer", "Faites examiner votre profil avant l’activation du programme partenaire."],
  ], ["Créer le profil Developer", "Être activé", "Inviter un marchand", "Construire l’intégration"], [
    ["Collaboration", "Le marchand conserve la maîtrise de son compte et des autorisations accordées.", ["Invitation explicite", "Membre identifiable", "Permissions révocables", "Retraits non ouverts par défaut"]],
    ["Livraison", "Une agence peut standardiser son intégration sans mélanger les données de ses clients.", ["Clés propres à chaque marchand", "Références séparées", "Webhooks configurés par projet", "Support basé sur les journaux"]],
  ], [["Un marchand existant peut-il inviter un développeur ?", "Oui. La relation se crée depuis les accès d’équipe; elle n’accorde pas automatiquement les retraits."], ["L’inscription active-t-elle immédiatement le programme ?", "Non. Le profil Developer doit être examiné et activé."]]),
  "small-business": solutionPage("Petites entreprises", "Commencez à encaisser sans infrastructure complexe.", "Créez un lien ou un QR code, partagez-le au client et retrouvez le paiement dans un seul dashboard.", [
    ["Liens de paiement", "Préparez un montant et partagez une page de paiement sans développer de site."],
    ["QR Codes", "Transformez un comptoir, une facture ou un écran en point d’entrée vers le checkout."],
    ["Historique", "Retrouvez les références et statuts sans conserver des captures dans une conversation."],
    ["Retraits", "Demandez un retrait depuis le compte approprié selon les options disponibles."],
  ], ["Saisir le montant", "Partager le lien ou QR", "Recevoir la confirmation", "Suivre le solde"], [
    ["Au quotidien", "Kobara réduit les tâches répétitives autour d’une vente.", ["Montant lisible avant paiement", "Moyen choisi par le client", "Confirmation retrouvable", "Historique partagé avec l’équipe"]],
    ["Pour commencer", "Quelques réglages suffisent avant le premier encaissement.", ["Profil entreprise complété", "KYC validé", "Moyens souhaités activés", "Premier lien créé depuis le dashboard"]],
  ], [["Ai-je besoin d’un site web ?", "Non. Un lien de paiement ou un QR code suffit pour commencer."], ["Puis-je accepter tous les moyens immédiatement ?", "MonCash et NatCash sont les moyens locaux principaux. Les autres options dépendent de leur disponibilité et de leur activation."]]),
  creators: solutionPage("Créateurs & indépendants", "Transformez chaque conversation en occasion de paiement.", "Envoyez un lien par WhatsApp, SMS ou e-mail et gardez une preuve claire du statut de chaque règlement.", [
    ["Partage direct", "Envoyez le même checkout depuis le canal où votre client vous contacte déjà."],
    ["Montant contextualisé", "Ajoutez une description qui rappelle la prestation, la réservation ou la commande."],
    ["QR réutilisable", "Présentez le paiement pendant un événement, une diffusion ou une rencontre."],
    ["Suivi mobile", "Consultez les opérations et notifications sans gérer un tableau manuel."],
  ], ["Créer l’offre", "Générer le lien", "Partager au client", "Vérifier le paiement"], [
    ["Une vente claire", "Le client sait qui il paie, pourquoi et combien.", ["Nom marchand visible", "Description de la prestation", "Montant et devise explicites", "Moyens disponibles réunis"]],
    ["Moins d’allers-retours", "Le statut remplace les échanges de captures d’écran.", ["Lien envoyé en quelques secondes", "Checkout adapté au mobile", "Paiement retrouvé par référence", "Confirmation visible dans Kobara"]],
  ], [["Puis-je personnaliser le lien ?", "Vous pouvez préparer son montant et sa description afin que le client reconnaisse la demande."], ["Comment prouver qu’un client a payé ?", "Utilisez la transaction et son statut dans Kobara, pas uniquement un message ou une capture d’écran."]]),
};

function solutionPage(eyebrow: string, title: string, description: string, features: [string, string][], flow: string[], details: [string, string, string[]][], faq: [string, string][]): PublicPageContent {
  return {
    eyebrow: `Solution · ${eyebrow}`,
    title,
    description,
    primaryLabel: eyebrow === "Agences & développeurs" ? "Rejoindre le programme" : "Créer un compte",
    primaryHref: eyebrow === "Agences & développeurs" ? "/developer" : "/register",
    secondaryLabel: "Parler à notre équipe",
    secondaryHref: "/contact",
    sectionTitle: `Kobara pour ${eyebrow.toLowerCase()}`,
    sectionIntro: "Des outils choisis pour ce modèle d’activité, avec un périmètre et des responsabilités clairement définis.",
    features: features.map(([featureTitle, featureDescription]) => ({ title: featureTitle, description: featureDescription })),
    flow,
    details: details.map(([detailTitle, detailDescription, bullets], index) => ({ kicker: index === 0 ? "Expérience" : "Opérations", title: detailTitle, description: detailDescription, bullets })),
    faq: faq.map(([question, answer]) => ({ question, answer })),
  };
}

export const developerPages: Record<string, PublicPageContent> = {
  program: {
    eyebrow: "Developer Partner Program",
    title: "Construisez avec Kobara pour vos clients.",
    description: "Créez votre profil Developer, invitez des marchands et gérez leurs intégrations avec des permissions contrôlées.",
    primaryLabel: "Rejoindre le programme",
    primaryHref: "/developer/register",
    secondaryLabel: "Connexion Developer",
    secondaryHref: "/developer/login",
    sectionTitle: "Un espace conçu pour les intégrateurs",
    sectionIntro: "Séparez clairement les accès du développeur et les décisions réservées au marchand.",
    features: [
      { title: "Clients connectés", description: "Suivez les marchands qui vous ont autorisé à intervenir." },
      { title: "Clés limitées", description: "Créez des accès de paiement sans ouvrir les retraits par défaut." },
      { title: "Commissions visibles", description: "Consultez vos récompenses et leur état depuis votre espace." },
    ],
  },
  sdks: {
    eyebrow: "SDKs & Libraries",
    title: "Intégrez Kobara dans votre langage préféré.",
    description: "Retrouvez les guides JavaScript, Node.js, Python et PHP avec des exemples centrés sur les flux Kobara.",
    primaryLabel: "Ouvrir la documentation",
    primaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Des outils cohérents autour de l’API",
    sectionIntro: "Chaque intégration suit les mêmes concepts: authentification, création, statut et webhook.",
    features: [
      { title: "JavaScript", description: "Intégrez Kobara dans vos applications web modernes." },
      { title: "Node.js", description: "Créez les paiements depuis votre backend." },
      { title: "Python", description: "Utilisez l’API depuis vos services Python." },
      { title: "PHP", description: "Connectez Kobara à vos applications et CMS PHP." },
    ],
  },
  integrations: {
    eyebrow: "Intégrations",
    title: "Passez plus vite de l’idée au paiement.",
    description: "Utilisez les guides, SDKs et webhooks Kobara pour créer une intégration maintenable.",
    primaryLabel: "Voir le Quickstart",
    primaryHref: "https://docs.kobara.app/docs/quickstart",
    sectionTitle: "Un flux d’intégration prévisible",
    sectionIntro: "Construisez autour de références stables et d’événements serveur vérifiables.",
    features: [
      { title: "Authentification", description: "Utilisez les clés depuis un environnement serveur sécurisé." },
      { title: "Création de paiement", description: "Recevez une référence et une URL de checkout." },
      { title: "Webhooks", description: "Mettez à jour votre système après confirmation." },
    ],
  },
};

export const resourcePages: Record<string, PublicPageContent> = {
  help: resourcePage("Centre d’aide", "Trouvez rapidement la bonne réponse.", "Identifiez le sujet, rassemblez les bonnes références et contactez Kobara seulement avec les informations nécessaires.", "Contacter le support", "/contact", [
    ["Compte et accès", "Connexion, vérification, sessions, sécurité et récupération de l’accès."],
    ["Paiements", "Statuts, références, moyens utilisés et confirmation d’une opération."],
    ["Retraits", "Compte débité, montant, destination, authentification et suivi de la demande."],
    ["Intégration", "Clés API, webhooks, erreurs et comportement du checkout."],
  ], [
    ["Avant de contacter le support", "Une demande précise permet une réponse plus rapide sans exposer de secret.", ["Référence Kobara du paiement", "Date et montant", "Page ou action concernée", "Message d’erreur sans clé API"]],
    ["Ne partagez jamais", "Les secrets ne doivent pas être envoyés dans un ticket ou une capture.", ["Mot de passe", "Code OTP ou 2FA", "Clé API secrète", "PIN d’un moyen de paiement"]],
  ], [["Où trouver la référence d’un paiement ?", "Ouvrez la transaction dans votre dashboard; utilisez cette référence dans votre demande."], ["Le support peut-il demander mon mot de passe ?", "Non. Ne communiquez jamais votre mot de passe, OTP, PIN ou clé API secrète."]]),
  faq: resourcePage("FAQ", "Les réponses aux questions les plus fréquentes.", "Compte, activation, paiements, retraits et API expliqués sans détour.", "Voir la documentation", "https://docs.kobara.app/docs/quickstart", [
    ["Démarrage", "Comprendre le compte marchand, le KYC et les étapes nécessaires avant l’encaissement."],
    ["Moyens de paiement", "Savoir pourquoi une option apparaît, reste désactivée ou dépend d’une configuration."],
    ["Transactions", "Distinguer création, traitement, confirmation, échec et expiration."],
    ["Développeurs", "Protéger les clés, gérer les webhooks et diagnostiquer une requête."],
  ], [
    ["Paiements", "Un checkout ouvert n’est jamais une preuve de paiement.", ["Attendre un statut final", "Vérifier la bonne devise", "Conserver la référence", "Utiliser le webhook côté serveur"]],
    ["Compte", "Les fonctions sensibles dépendent de l’état et des autorisations du compte.", ["KYC avant les fonctions protégées", "Moyens activés dans les paramètres", "Accès d’équipe révocables", "Business soumis à examen"]],
  ], [["MonCash et NatCash sont-ils disponibles par défaut ?", "Ils constituent les moyens locaux principaux. Leur utilisation effective dépend de l’état du compte et de la configuration opérationnelle."], ["Pourquoi un paiement reste-t-il en attente ?", "Le moyen n’a peut-être pas encore retourné de confirmation finale. Consultez la transaction avant toute livraison."]]),
};

function resourcePage(eyebrow: string, title: string, description: string, primaryLabel: string, primaryHref: string, features: [string, string][], details: [string, string, string[]][], faq: [string, string][]): PublicPageContent {
  return {
    eyebrow: `Ressource · ${eyebrow}`,
    title,
    description,
    primaryLabel,
    primaryHref,
    secondaryLabel: "Parler à Kobara",
    secondaryHref: "/contact",
    sectionTitle: `Explorer ${eyebrow.toLowerCase()}`,
    sectionIntro: "Un contenu structuré autour des décisions et problèmes que rencontrent réellement les marchands et leurs équipes.",
    features: features.map(([featureTitle, featureDescription]) => ({ title: featureTitle, description: featureDescription })),
    details: details.map(([detailTitle, detailDescription, bullets], index) => ({ kicker: index === 0 ? "Repères" : "Bonnes pratiques", title: detailTitle, description: detailDescription, bullets })),
    faq: faq.map(([question, answer]) => ({ question, answer })),
  };
}
