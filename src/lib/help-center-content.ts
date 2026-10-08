export type HelpProductStatus = "available" | "beta" | "coming_soon" | "unavailable";

export type HelpSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
  example?: string;
  notice?: string;
  noticeTone?: "info" | "warning" | "success";
};

export type HelpArticle = {
  id: string;
  slug: string;
  path: string;
  title: string;
  description: string;
  summary: string;
  category: string;
  subcategory?: string;
  sections: HelpSection[];
  keywords: string[];
  relatedArticles: string[];
  audience: string[];
  country: string[];
  paymentMethods: string[];
  plans: string[];
  productStatus: HelpProductStatus;
  developerDocUrl?: string;
  sources?: { label: string; url: string }[];
  lastReviewedAt: string;
  lastUpdatedAt: string;
  published: boolean;
};

export type HelpCategory = {
  slug: string;
  name: string;
  description: string;
  icon: "payments" | "payouts" | "verification" | "pricing" | "developers" | "security" | "balance" | "marketplace" | "legal" | "getting-started";
};

export const helpCategories: HelpCategory[] = [
  { slug: "getting-started", name: "Découvrir Kobara", description: "Comprendre le rôle de Kobara et son fonctionnement.", icon: "getting-started" },
  { slug: "payments", name: "Paiements", description: "Accepter, suivre et confirmer les paiements.", icon: "payments" },
  { slug: "payouts", name: "Retraits", description: "Retirer un solde vers MonCash ou NatCash.", icon: "payouts" },
  { slug: "verification", name: "Vérification", description: "KYC, KYB et documents nécessaires.", icon: "verification" },
  { slug: "pricing", name: "Frais", description: "Comprendre les frais de paiement et de retrait.", icon: "pricing" },
  { slug: "developers", name: "Développeurs", description: "Live, webhooks et bonnes pratiques d’intégration.", icon: "developers" },
  { slug: "balance", name: "Solde", description: "Disponibilité, mouvements et rapprochement.", icon: "balance" },
  { slug: "marketplaces", name: "Marketplaces", description: "Organiser les paiements et les versements vendeurs.", icon: "marketplace" },
  { slug: "security", name: "Sécurité", description: "Protéger votre compte et vos accès.", icon: "security" },
  { slug: "legal", name: "Cadre légal", description: "Rôle de Kobara, opérateurs et informations d’entreprise.", icon: "legal" },
];

const reviewedAt = "2026-09-26";

const article = (
  value: Omit<HelpArticle, "lastReviewedAt" | "lastUpdatedAt" | "published" | "productStatus"> &
    Partial<Pick<HelpArticle, "lastReviewedAt" | "lastUpdatedAt" | "published" | "productStatus">>,
): HelpArticle => ({
  ...value,
  productStatus: value.productStatus ?? "available",
  lastReviewedAt: value.lastReviewedAt ?? reviewedAt,
  lastUpdatedAt: value.lastUpdatedAt ?? reviewedAt,
  published: value.published ?? true,
});

export const helpArticles: HelpArticle[] = [
  article({
    id: "getting-started-what-is-kobara",
    slug: "what-is-kobara",
    path: "what-is-kobara",
    title: "Qu’est-ce que Kobara ?",
    description: "Découvrez le rôle de Kobara dans l’acceptation et l’orchestration des paiements.",
    summary: "Kobara est une infrastructure technologique de paiement développée par Smartcore Groupe. Elle permet aux entreprises de connecter des moyens de paiement disponibles à un checkout, une API et des outils de suivi communs.",
    category: "getting-started",
    sections: [
      { title: "Ce que fait Kobara", paragraphs: ["Kobara fournit la couche technique entre l’entreprise, son client et les moyens de paiement activés. Le marchand peut créer un paiement, envoyer le client vers le checkout Kobara, puis recevoir une confirmation exploitable dans son système."], bullets: ["Checkout hébergé et liens de paiement", "Intégration API et webhooks", "Suivi des transactions et retraits depuis le dashboard"] },
      { title: "Ce que Kobara n’est pas", paragraphs: ["Kobara n’est pas présenté comme un compte bancaire et ne remplace pas MonCash ou NatCash. Ces opérateurs restent les fournisseurs financiers sous-jacents pour les opérations qui utilisent leurs réseaux."], notice: "Les moyens visibles dans le checkout dépendent de leur disponibilité générale et de leur activation sur le compte marchand.", noticeTone: "info" },
    ],
    keywords: ["kobara", "passerelle", "paiement", "smartcore", "définition"], relatedArticles: ["how-kobara-works", "non-custodial", "legal/kobara-bank-fsp"], audience: ["merchant", "developer", "platform"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"],
  }),
  article({
    id: "getting-started-how-kobara-works", slug: "how-kobara-works", path: "how-kobara-works", title: "Comment fonctionne Kobara ?", description: "Comprendre le parcours d’un paiement, de sa création à sa disponibilité.",
    summary: "Votre application ou le dashboard crée un paiement. Le client paie avec un moyen disponible, Kobara enregistre le résultat et informe votre système par webhook.", category: "getting-started",
    sections: [
      { title: "Le parcours d’un paiement", steps: ["Le marchand crée le paiement ou le lien.", "Le client ouvre le checkout et choisit un moyen activé.", "Le fournisseur traite l’opération et Kobara met à jour son statut.", "Kobara envoie un webhook au système marchand.", "Après le délai de disponibilité applicable, le montant net peut être retiré."] },
      { title: "La confirmation qui fait foi", paragraphs: ["Une page de succès aide le client à comprendre le résultat, mais elle ne doit pas être l’unique preuve. Pour une intégration, confirmez toujours le statut côté serveur ou avec l’événement webhook correspondant."], notice: "Ne validez jamais une commande uniquement parce que le navigateur est revenu sur success_url.", noticeTone: "warning" },
    ],
    keywords: ["fonctionnement", "flux", "checkout", "confirmation", "webhook"], relatedArticles: ["payments/payment-status", "developers/webhooks", "balance/availability"], audience: ["merchant", "developer"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/quickstart",
  }),
  article({
    id: "getting-started-non-custodial", slug: "non-custodial", path: "non-custodial", title: "Que signifie « non-custodial » pour Kobara ?", description: "Comprendre le modèle technique annoncé par Kobara et ce qu’il implique pour les fonds.",
    summary: "Dans le modèle présenté par Kobara, la plateforme orchestre et suit les opérations sans se présenter comme une banque ni comme un compte bancaire pour le marchand.", category: "getting-started",
    sections: [
      { title: "Ce que cela signifie", paragraphs: ["Kobara fournit une couche logicielle de création, de confirmation et de rapprochement des paiements. Les opérations MonCash et NatCash s’appuient sur les réseaux des opérateurs concernés."], bullets: ["Le solde Kobara est un registre opérationnel, pas un compte bancaire.", "Les règles de l’opérateur peuvent intervenir dans le traitement.", "Un retrait transfère un montant disponible vers une destination prise en charge."] },
      { title: "Ce que le terme ne garantit pas", paragraphs: ["Le terme décrit ici le modèle produit communiqué par Kobara. Il ne remplace pas un avis juridique et ne constitue pas, à lui seul, une qualification réglementaire."], notice: "Pour une analyse contractuelle ou réglementaire, demandez les documents officiels à Kobara Support.", noticeTone: "warning" },
    ],
    keywords: ["non-custodial", "fonds", "solde", "banque", "custodie"], relatedArticles: ["balance/what-is-balance", "legal/kobara-bank-fsp", "what-is-kobara"], audience: ["merchant", "platform", "legal"], country: ["HT"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "pricing-how-fees-work", slug: "how-fees-work", path: "pricing/how-fees-work", title: "Comment fonctionnent les frais Kobara ?", description: "Comprendre les frais de paiement et de retrait avec des exemples en HTG.",
    summary: "Sur les plans payants, un paiement réussi est facturé 2,9 %. Un retrait MonCash ou NatCash est une opération distincte facturée 5 % du montant demandé.", category: "pricing",
    sections: [
      { title: "Frais sur un paiement", paragraphs: ["Pour un paiement réussi de 10 000 HTG sur un plan payant, 2,9 % correspondent à 290 HTG. Le montant net avant toute autre opération est donc de 9 710 HTG."], example: "10 000 HTG × 2,9 % = 290 HTG de frais de paiement." },
      { title: "Frais sur un retrait", paragraphs: ["Pour un retrait demandé de 10 000 HTG, les frais de 5 % sont déduits du montant brut. Le portefeuille reçoit 9 500 HTG."], example: "10 000 HTG − 500 HTG = 9 500 HTG envoyés." },
      { title: "Deux opérations différentes", paragraphs: ["Les frais de paiement rémunèrent le traitement de l’encaissement. Les frais de retrait rémunèrent une nouvelle opération vers le portefeuille choisi. Ils ne doivent pas être additionnés comme s’il s’agissait d’un taux unique."], notice: "Consultez la page Tarifs avant toute décision : les plans et conditions commerciales peuvent évoluer.", noticeTone: "info" },
    ],
    keywords: ["frais", "2,9", "5 pour cent", "tarif", "commission"], relatedArticles: ["payouts/how-withdrawals-work", "balance/what-is-balance"], audience: ["merchant", "finance"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["paid"],
  }),
  article({
    id: "moncash-accept-payments", slug: "accept-payments", path: "moncash/accept-payments", title: "Comment accepter MonCash avec Kobara ?", description: "Activer MonCash et recevoir une confirmation fiable du paiement.",
    summary: "MonCash doit être disponible et activé sur votre compte. Vous pouvez ensuite créer un paiement depuis le dashboard, un lien ou l’API Kobara.", category: "payments", subcategory: "MonCash",
    sections: [
      { title: "Avant de commencer", bullets: ["Votre compte Kobara doit être autorisé pour l’environnement utilisé.", "MonCash doit être activé dans vos moyens de paiement.", "En API, votre clé doit correspondre à l’environnement Test ou Live."] },
      { title: "Recevoir un paiement", steps: ["Créez le paiement avec le montant, la devise et la référence de commande.", "Ouvrez ou partagez le checkout_url retourné.", "Laissez le client terminer le parcours MonCash.", "Attendez la confirmation serveur ou le webhook payment.succeeded avant de livrer."] },
      { title: "Si le paiement reste en attente", paragraphs: ["Ne créez pas immédiatement une seconde commande. Retrouvez d’abord la transaction dans Kobara et vérifiez son statut ou sa référence fournisseur."], notice: "Kobara ne promet pas de vérifier à l’avance le nom du titulaire d’un numéro MonCash.", noticeTone: "warning" },
    ],
    keywords: ["moncash", "accepter", "encaisser", "checkout", "paiement mobile"], relatedArticles: ["payments/payment-status", "developers/webhooks", "payouts/moncash"], audience: ["merchant", "developer"], country: ["HT"], paymentMethods: ["moncash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/payments",
  }),
  article({
    id: "natcash-accept-payments", slug: "accept-payments", path: "natcash/accept-payments", title: "Comment accepter NatCash avec Kobara ?", description: "Activer NatCash et suivre correctement le résultat d’un paiement.",
    summary: "NatCash doit être disponible et activé sur votre compte. Kobara peut ensuite présenter ce moyen dans le checkout unifié ou le présélectionner via l’API.", category: "payments", subcategory: "NatCash",
    sections: [
      { title: "Avant de commencer", bullets: ["Vérifiez l’activation NatCash dans les paramètres du marchand.", "Utilisez des clés Test pour vos essais et des clés Live uniquement en production.", "Configurez un webhook avant d’automatiser la livraison."] },
      { title: "Recevoir un paiement", steps: ["Créez un paiement avec une référence interne unique.", "Dirigez le client vers le checkout sécurisé.", "Le client termine l’autorisation NatCash.", "Votre serveur traite la confirmation Kobara de façon idempotente."] },
      { title: "Bon réflexe", paragraphs: ["Conservez ensemble l’identifiant Kobara, votre référence de commande et, lorsqu’elle existe, la référence du fournisseur. Ce trio facilite le support et le rapprochement."], notice: "Kobara ne promet pas de vérifier à l’avance le nom du titulaire d’un numéro NatCash.", noticeTone: "warning" },
    ],
    keywords: ["natcash", "accepter", "encaisser", "checkout", "paiement mobile"], relatedArticles: ["payments/payment-status", "developers/webhooks", "payouts/natcash"], audience: ["merchant", "developer"], country: ["HT"], paymentMethods: ["natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/payments",
  }),
  article({
    id: "payments-payment-status", slug: "payment-status", path: "payments/payment-status", title: "Que signifient les statuts d’un paiement ?", description: "Savoir quand attendre, confirmer une commande ou enquêter sur un paiement.",
    summary: "Le statut indique l’état connu par Kobara. Une commande doit être considérée comme payée uniquement lorsque le paiement est confirmé comme réussi.", category: "payments",
    sections: [
      { title: "Statuts principaux", bullets: ["pending : le résultat définitif n’est pas encore confirmé.", "succeeded : le paiement a été confirmé et peut déclencher le traitement de la commande.", "failed : le paiement n’a pas abouti ; ne livrez pas la commande sur cette transaction."] },
      { title: "Éviter les doubles traitements", paragraphs: ["Votre webhook peut être livré plus d’une fois. Enregistrez l’identifiant de l’événement ou du paiement et rendez votre traitement idempotent afin de ne pas valider deux fois la même commande."], notice: "L’affichage de la page de succès dans le navigateur n’est pas une confirmation serveur.", noticeTone: "warning" },
    ],
    keywords: ["statut", "pending", "succeeded", "failed", "paiement réussi"], relatedArticles: ["developers/webhooks", "how-kobara-works", "balance/availability"], audience: ["merchant", "developer", "support"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/payments",
  }),
  article({
    id: "balance-what-is-balance", slug: "what-is-balance", path: "balance/what-is-balance", title: "Qu’est-ce que le solde Kobara ?", description: "Comprendre la différence entre solde affiché, montant en attente et montant disponible.",
    summary: "Le solde Kobara est un registre opérationnel des montants, frais, disponibilités et retraits associés à votre activité. Il ne constitue pas un compte bancaire.", category: "balance",
    sections: [
      { title: "Les montants à distinguer", bullets: ["Solde total : vue comptable des mouvements pris en compte.", "En attente : montants confirmés mais encore soumis au délai de disponibilité.", "Disponible : montant pouvant être utilisé pour un retrait autorisé."] },
      { title: "Pourquoi le solde change", paragraphs: ["Un paiement réussi augmente les mouvements créditeurs après application des règles prévues. Les frais, retraits et éventuels ajustements apparaissent comme des mouvements séparés afin de permettre le rapprochement."], notice: "Utilisez les transactions et relevés Kobara pour expliquer chaque mouvement ; ne traitez pas le solde comme un relevé bancaire.", noticeTone: "info" },
    ],
    keywords: ["solde", "disponible", "attente", "registre", "balance"], relatedArticles: ["balance/availability", "payouts/how-withdrawals-work", "non-custodial"], audience: ["merchant", "finance"], country: ["HT"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "balance-availability", slug: "availability", path: "balance/availability", title: "Quand un paiement devient-il disponible ?", description: "Comprendre le délai de disponibilité appliqué aux encaissements locaux.",
    summary: "Un encaissement MonCash ou NatCash devient disponible au premier des deux moments suivants : 12 heures après sa confirmation ou 08:00 le lendemain, heure d’Haïti.", category: "balance",
    sections: [
      { title: "Exemples horaires", bullets: ["Confirmé à 10:00 : 12 heures plus tard correspond à 22:00 le même jour ; le montant devient disponible à 22:00.", "Confirmé à 19:00 : 12 heures plus tard correspond à 07:00 le lendemain ; le montant devient disponible à 07:00.", "Confirmé à 22:00 : 08:00 le lendemain arrive avant l’échéance de 12 heures ; le montant devient disponible à 08:00."] },
      { title: "Si le montant n’est pas disponible", steps: ["Vérifiez que le paiement est réellement succeeded.", "Confirmez l’heure de confirmation, pas seulement l’heure de création.", "Actualisez le solde après l’échéance calculée.", "Contactez le support avec l’identifiant Kobara si le montant reste bloqué."] },
    ],
    keywords: ["disponibilité", "12 heures", "8 heures", "solde en attente", "délai"], relatedArticles: ["balance/what-is-balance", "payments/payment-status", "payouts/how-withdrawals-work"], audience: ["merchant", "finance"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"],
  }),
  article({
    id: "payouts-how-withdrawals-work", slug: "how-withdrawals-work", path: "payouts/how-withdrawals-work", title: "Comment fonctionnent les retraits Kobara ?", description: "Préparer un retrait, comprendre les frais et suivre son statut.",
    summary: "Un retrait débite le montant brut demandé de votre solde disponible, déduit 5 % de frais et envoie le montant net vers un portefeuille MonCash ou NatCash pris en charge.", category: "payouts",
    sections: [
      { title: "Conditions principales", bullets: ["Le compte doit être autorisé à effectuer des retraits.", "Le solde disponible doit couvrir le montant brut demandé.", "La destination doit être un numéro haïtien acceptable pour la méthode choisie.", "Une demande API exige une clé secrète Live et une clé d’idempotence."] },
      { title: "Calcul", example: "Pour 1 000 HTG demandés : 50 HTG de frais et 950 HTG envoyés au portefeuille." },
      { title: "Suivi", paragraphs: ["Un retrait peut être terminé immédiatement ou rester en traitement pendant une vérification. Ne recréez pas une demande identique : retrouvez son statut avec sa référence ou réutilisez la même clé d’idempotence si l’API le prévoit."], notice: "Les retraits publics actuellement documentés concernent MonCash et NatCash. PayPal et Zelle ne sont pas pris en charge par l’API publique de retrait.", noticeTone: "info" },
    ],
    keywords: ["retrait", "payout", "5 pour cent", "solde disponible", "bénéficiaire"], relatedArticles: ["payouts/failed", "payouts/moncash", "payouts/natcash"], audience: ["merchant", "developer", "finance"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/withdrawals",
  }),
  article({
    id: "payouts-moncash", slug: "moncash", path: "payouts/moncash", title: "Comment effectuer un retrait vers MonCash ?", description: "Envoyer un montant disponible vers un portefeuille MonCash.",
    summary: "Choisissez MonCash, saisissez avec soin le numéro du bénéficiaire et vérifiez le montant net avant de confirmer.", category: "payouts",
    sections: [
      { title: "Depuis le dashboard", steps: ["Ouvrez Retraits et choisissez MonCash.", "Saisissez le montant brut et le numéro de destination.", "Vérifiez les frais et le montant net affichés.", "Confirmez puis conservez la référence du retrait."] },
      { title: "Avant de confirmer", paragraphs: ["Kobara ne doit pas être supposé capable de confirmer à l’avance l’identité civile du titulaire. Vérifiez le numéro avec le bénéficiaire par un canal fiable."], notice: "Une erreur de numéro peut rendre la récupération difficile ou impossible après l’exécution.", noticeTone: "warning" },
    ],
    keywords: ["retrait moncash", "wallet", "numéro", "payout"], relatedArticles: ["payouts/how-withdrawals-work", "payouts/failed", "balance/availability"], audience: ["merchant", "finance"], country: ["HT"], paymentMethods: ["moncash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/withdrawals",
  }),
  article({
    id: "payouts-natcash", slug: "natcash", path: "payouts/natcash", title: "Comment effectuer un retrait vers NatCash ?", description: "Envoyer un montant disponible vers un portefeuille NatCash.",
    summary: "Choisissez NatCash, saisissez le numéro de destination et contrôlez le montant net avant de confirmer l’opération.", category: "payouts",
    sections: [
      { title: "Depuis le dashboard", steps: ["Ouvrez Retraits et choisissez NatCash.", "Saisissez le montant brut et le numéro de destination.", "Contrôlez les frais de 5 % et le net envoyé.", "Confirmez puis suivez le statut avec la référence Kobara."] },
      { title: "Vérifier le bénéficiaire", paragraphs: ["Demandez au bénéficiaire de confirmer son numéro NatCash. L’acceptation technique d’une destination par le réseau n’équivaut pas à une vérification de l’identité de son titulaire."], notice: "Ne confirmez pas un paiement fournisseur sur la seule base de la création du retrait ; attendez son statut terminé.", noticeTone: "warning" },
    ],
    keywords: ["retrait natcash", "wallet", "numéro", "payout"], relatedArticles: ["payouts/how-withdrawals-work", "payouts/failed", "balance/availability"], audience: ["merchant", "finance"], country: ["HT"], paymentMethods: ["natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/withdrawals",
  }),
  article({
    id: "payouts-failed", slug: "failed", path: "payouts/failed", title: "Pourquoi mon retrait a-t-il échoué ?", description: "Identifier les causes courantes d’un retrait refusé et la marche à suivre.",
    summary: "Un retrait peut échouer si le numéro, le solde, l’autorisation du compte ou le fournisseur ne permet pas de terminer l’opération.", category: "payouts",
    sections: [
      { title: "Causes possibles", bullets: ["Solde disponible insuffisant ou fonds encore en attente.", "Numéro invalide pour le réseau choisi.", "KYC ou capacité de retrait non active.", "Compte USD inactif lorsqu’il est choisi comme source.", "Refus ou indisponibilité temporaire du fournisseur."] },
      { title: "Que faire", steps: ["Ouvrez le retrait et notez son code d’erreur ainsi que sa référence.", "Vérifiez le solde disponible et la méthode choisie.", "Confirmez le numéro avec le bénéficiaire.", "Ne recréez pas la demande si le statut indique encore une vérification.", "Contactez Kobara Support si le statut final reste incohérent."] },
      { title: "À propos du solde", paragraphs: ["Lorsque le fournisseur refuse une opération et que l’échec est définitif, le système documenté prévoit le recrédit des fonds réservés. Vérifiez le mouvement correspondant avant toute nouvelle tentative."], notice: "N’envoyez jamais au support une clé API secrète, un mot de passe ou un code de validation du portefeuille.", noticeTone: "warning" },
    ],
    keywords: ["retrait échoué", "provider transfer failed", "solde insuffisant", "numéro invalide"], relatedArticles: ["payouts/how-withdrawals-work", "balance/availability", "security/how-kobara-protects-account"], audience: ["merchant", "developer", "support"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/withdrawals",
  }),
  article({
    id: "verification-why-verify", slug: "why-verify", path: "verification/why-verify", title: "Pourquoi Kobara vérifie-t-il votre identité ?", description: "Comprendre pourquoi certaines capacités exigent une vérification du titulaire et de l’entreprise.",
    summary: "La vérification aide Kobara à connaître les utilisateurs de la plateforme, à protéger les opérations et à déterminer les capacités pouvant être activées.", category: "verification",
    sections: [
      { title: "Pourquoi ces informations sont demandées", bullets: ["Confirmer l’identité de la personne qui contrôle le compte.", "Comprendre l’activité de l’entreprise et ses représentants.", "Réduire les usages frauduleux et les usurpations.", "Respecter les exigences applicables avant l’accès Live ou les retraits."] },
      { title: "Proportionnalité", paragraphs: ["Les documents demandés peuvent varier selon le profil, le pays, l’activité, les volumes ou le résultat des contrôles. Kobara ne publie pas les seuils internes de son système de détection."], notice: "Un document demandé doit être transmis uniquement dans l’interface officielle Kobara ou par un canal confirmé par le support.", noticeTone: "warning" },
    ],
    keywords: ["vérification", "identité", "KYC", "KYB", "pourquoi"], relatedArticles: ["verification/kyc", "verification/kyb", "developers/live-requirements"], audience: ["merchant", "representative"], country: ["HT", "international"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "verification-kyc", slug: "kyc", path: "verification/kyc", title: "Comment fonctionne la vérification KYC ?", description: "Préparer les informations nécessaires pour vérifier une personne.",
    summary: "Le KYC vérifie l’identité de la personne liée au compte à partir d’informations et de documents officiels.", category: "verification",
    sections: [
      { title: "Préparer la vérification", bullets: ["Utilisez votre nom légal tel qu’il figure sur le document.", "Présentez un document original, valide, complet et lisible.", "Suivez les instructions de capture et de vérification faciale lorsqu’elles sont demandées.", "Assurez-vous que les informations du profil correspondent au document."] },
      { title: "Pourquoi une vérification peut attendre", paragraphs: ["Une image floue, un document incomplet, des informations divergentes ou un contrôle supplémentaire peuvent nécessiter une revue. Une attente ne signifie pas automatiquement un refus."], notice: "N’essayez pas plusieurs identités ou plusieurs comptes pour contourner une revue ; contactez le support avec votre identifiant de dossier.", noticeTone: "warning" },
    ],
    keywords: ["KYC", "identité", "document", "biométrie", "vérification faciale"], relatedArticles: ["verification/why-verify", "verification/proof-of-address", "developers/live-requirements"], audience: ["merchant", "representative"], country: ["HT", "international"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "verification-kyb", slug: "kyb", path: "verification/kyb", title: "Comment fonctionne la vérification KYB ?", description: "Comprendre la vérification d’une entreprise, de ses représentants et bénéficiaires effectifs.",
    summary: "Le KYB permet à Kobara de vérifier l’existence de l’entreprise, son activité et les personnes autorisées à agir pour elle.", category: "verification",
    sections: [
      { title: "Informations généralement nécessaires", bullets: ["Nom légal et forme de l’entreprise.", "Adresse et pays d’enregistrement.", "Documents officiels d’enregistrement disponibles.", "Activité, site et description des flux de paiement.", "Représentant autorisé et bénéficiaires effectifs lorsque requis."] },
      { title: "Les exigences peuvent varier", paragraphs: ["Une entreprise individuelle, une société haïtienne et une entreprise étrangère ne présentent pas les mêmes documents. Kobara peut demander des éléments supplémentaires après examen."], notice: "La liste exacte applicable à votre entreprise apparaît dans votre parcours de vérification ou est confirmée par Kobara Support.", noticeTone: "info" },
    ],
    keywords: ["KYB", "entreprise", "bénéficiaire effectif", "représentant", "documents"], relatedArticles: ["verification/why-verify", "verification/proof-of-address", "legal/kobara-smartcore"], audience: ["merchant", "company", "representative"], country: ["HT", "international"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "verification-proof-of-address", slug: "proof-of-address", path: "verification/proof-of-address", title: "Quels justificatifs d’adresse Kobara accepte-t-il ?", description: "Préparer un document récent qui permet de vérifier une adresse.",
    summary: "Le justificatif doit dater de moins de trois mois et rendre visibles le nom, l’adresse, la date et l’émetteur.", category: "verification",
    sections: [
      { title: "Exemples de documents", bullets: ["Relevé bancaire professionnel.", "Facture Internet, téléphone ou électricité.", "Courrier d’une institution financière.", "Document fiscal ou gouvernemental officiel."] },
      { title: "Informations à laisser visibles", bullets: ["Nom de la personne ou de l’entreprise vérifiée.", "Adresse complète.", "Date d’émission.", "Nom ou logo de l’émetteur."] },
      { title: "Informations pouvant être masquées", paragraphs: ["Les transactions, montants et numéros de compte qui ne sont pas nécessaires à la vérification peuvent être masqués, à condition de ne pas cacher les quatre informations essentielles."], notice: "Une capture d’écran modifiée ou un document dont l’émetteur n’est pas identifiable peut être refusé.", noticeTone: "warning" },
    ],
    keywords: ["justificatif d’adresse", "moins de trois mois", "facture", "relevé bancaire"], relatedArticles: ["verification/kyc", "verification/kyb", "verification/why-verify"], audience: ["merchant", "company", "representative"], country: ["HT", "international"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "developers-live-requirements", slug: "live-requirements", path: "developers/live-requirements", title: "Comment passer de Test à Live ?", description: "Préparer le compte et l’intégration avant d’accepter de vrais paiements.",
    summary: "L’environnement Test sert à construire et vérifier l’intégration. L’accès Live exige un compte autorisé, une vérification complète et une configuration de production correcte.", category: "developers",
    sections: [
      { title: "Checklist avant Live", steps: ["Terminez le profil et la vérification KYC/KYB demandée.", "Faites approuver l’activité et les capacités nécessaires.", "Testez les parcours réussi, en attente et échoué.", "Configurez et sécurisez les webhooks.", "Remplacez les clés Test par les clés Live uniquement côté serveur.", "Contrôlez manuellement le premier paiement réel."] },
      { title: "Séparer Test et Live", paragraphs: ["Les clés, transactions et capacités des deux environnements sont distinctes. Une clé Test ne crée pas un paiement réel et une clé Live ne doit jamais être incluse dans le frontend."], notice: "La soumission d’un dossier ne garantit pas l’activation immédiate ; attendez la confirmation visible dans le compte.", noticeTone: "info" },
    ],
    keywords: ["test", "live", "production", "activation", "KYC"], relatedArticles: ["verification/why-verify", "developers/webhooks", "payments/payment-status"], audience: ["developer", "merchant"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/quickstart",
  }),
  article({
    id: "developers-webhooks", slug: "webhooks", path: "developers/webhooks", title: "Comment utiliser les webhooks Kobara en toute sécurité ?", description: "Recevoir une confirmation serveur fiable et éviter les doubles traitements.",
    summary: "Un webhook informe votre serveur d’un événement comme payment.succeeded. Vérifiez sa signature, traitez-le de façon idempotente et renvoyez rapidement une réponse 2xx.", category: "developers",
    sections: [
      { title: "Traitement recommandé", steps: ["Lisez le corps HTTP brut avant tout décodage.", "Vérifiez l’en-tête Kobara-Signature avec votre secret webhook.", "Refusez les signatures invalides ou trop anciennes.", "Identifiez l’événement ou le paiement déjà traité.", "Mettez à jour la commande dans une transaction idempotente.", "Répondez 2xx rapidement et exécutez les tâches longues en arrière-plan."] },
      { title: "En cas d’échec", paragraphs: ["Consultez les logs de l’endpoint, le code HTTP renvoyé et les tentatives. Corrigez d’abord la cause avant de rejouer un événement afin d’éviter un traitement incohérent."], notice: "Ne vous fiez jamais uniquement à success_url : le client peut fermer la page avant le retour ou manipuler la navigation.", noticeTone: "warning" },
    ],
    keywords: ["webhook", "payment.succeeded", "signature", "idempotence", "serveur"], relatedArticles: ["payments/payment-status", "how-kobara-works", "developers/live-requirements"], audience: ["developer"], country: ["global"], paymentMethods: [], plans: ["all"], developerDocUrl: "https://docs.kobara.app/docs/webhooks",
  }),
  article({
    id: "marketplaces-getting-started", slug: "getting-started", path: "marketplaces/getting-started", title: "Comment utiliser Kobara pour une marketplace ?", description: "Séparer le paiement client, le ledger interne et le paiement des vendeurs.",
    summary: "Une marketplace doit maintenir son propre registre des commandes, commissions et montants dus. Kobara fournit les opérations de paiement et de retrait disponibles, mais ne remplace pas ce ledger métier.", category: "marketplaces",
    sections: [
      { title: "Architecture recommandée", steps: ["Créez le paiement acheteur avec une référence de commande.", "Attendez la confirmation serveur Kobara.", "Enregistrez le montant, la commission et la part vendeur dans votre ledger.", "Validez la livraison ou le service selon vos propres règles.", "Déclenchez le paiement vendeur uniquement lorsqu’il est autorisé et disponible.", "Conservez toutes les références pour le rapprochement."] },
      { title: "Responsabilités de la plateforme", bullets: ["Définir les règles de commande et de commission.", "Vérifier ses vendeurs selon ses obligations.", "Gérer les litiges commerciaux et la validation du service.", "Empêcher les doubles paiements aux bénéficiaires."] },
      { title: "Limite importante", paragraphs: ["Kobara ne doit pas être présenté comme un service d’escrow si ce produit n’est pas juridiquement et techniquement disponible."], notice: "Validez l’architecture et les obligations de votre marketplace avec Kobara avant la mise en production.", noticeTone: "warning" },
    ],
    keywords: ["marketplace", "vendeur", "commission", "ledger", "payout"], relatedArticles: ["marketplaces/escrow", "developers/webhooks", "payouts/how-withdrawals-work"], audience: ["platform", "developer", "finance"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["business"], developerDocUrl: "https://docs.kobara.app/docs/quickstart",
  }),
  article({
    id: "marketplaces-escrow", slug: "escrow", path: "marketplaces/escrow", title: "Kobara propose-t-il un service d’escrow ?", description: "Comprendre la différence entre un ledger marketplace et un véritable service d’escrow.",
    summary: "Non. Kobara ne présente pas actuellement son offre comme un service d’escrow. Une marketplace ne doit donc pas promettre à ses utilisateurs qu’un paiement est juridiquement placé sous séquestre par Kobara.", category: "marketplaces", productStatus: "unavailable",
    sections: [
      { title: "Ce que vous pouvez organiser", paragraphs: ["Votre plateforme peut enregistrer qu’une commande est payée, calculer la part vendeur et attendre un événement métier avant d’ordonner un retrait, lorsque son contrat et les capacités disponibles le permettent."], bullets: ["Ledger interne de la marketplace", "États de commande et validation du service", "Règles de commission", "Autorisation interne du payout"] },
      { title: "Ce que vous ne devez pas affirmer", paragraphs: ["Ne qualifiez pas ce fonctionnement d’escrow, de compte séquestre ou de garantie de fonds sans produit, contrat et cadre juridique correspondant."], notice: "Demandez une validation juridique indépendante pour tout modèle qui retient des montants au bénéfice de tiers.", noticeTone: "warning" },
    ],
    keywords: ["escrow", "séquestre", "marketplace", "retenir paiement", "ledger"], relatedArticles: ["marketplaces/getting-started", "payouts/how-withdrawals-work", "legal/kobara-bank-fsp"], audience: ["platform", "legal"], country: ["HT"], paymentMethods: [], plans: ["business"],
  }),
  article({
    id: "refunds-refund-customer", slug: "refund-customer", path: "refunds-disputes/refund-customer", title: "Comment restituer un paiement à un client ?", description: "Comprendre le fonctionnement actuel lorsqu’un paiement confirmé doit être restitué.",
    summary: "Une transaction confirmée n’est pas inversée nativement par Kobara dans le modèle actuellement documenté. Le marchand organise une nouvelle opération pour restituer tout ou partie du montant.", category: "payments",
    sections: [
      { title: "Avant d’agir", steps: ["Vérifiez que le paiement initial est réellement succeeded.", "Confirmez l’identité et la destination du client par un canal fiable.", "Calculez le montant à restituer selon votre politique commerciale.", "Créez et suivez la nouvelle opération séparément.", "Conservez les deux références dans votre dossier de commande."] },
      { title: "Frais et traçabilité", paragraphs: ["Les frais de l’opération initiale ne sont pas automatiquement annulés. Une nouvelle opération peut aussi être soumise aux frais applicables. Présentez ces éléments clairement dans votre politique de remboursement."], notice: "Si un vendeur a déjà été payé, Kobara ne récupère pas automatiquement les fonds auprès de ce vendeur.", noticeTone: "warning" },
    ],
    keywords: ["remboursement", "restitution", "annulation", "paiement confirmé", "litige"], relatedArticles: ["payments/payment-status", "marketplaces/getting-started", "payouts/how-withdrawals-work"], audience: ["merchant", "platform", "support"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"],
  }),
  article({
    id: "security-protect-account", slug: "how-kobara-protects-account", path: "security/how-kobara-protects-account", title: "Comment protéger votre compte Kobara ?", description: "Réduire les risques liés au compte, aux clés API et aux demandes frauduleuses.",
    summary: "La sécurité du compte repose sur des accès individuels, des secrets conservés côté serveur et une vérification systématique des opérations sensibles.", category: "security",
    sections: [
      { title: "Mesures essentielles", bullets: ["Utilisez un mot de passe unique et activez la double authentification lorsqu’elle est proposée.", "Créez un accès distinct pour chaque membre de l’équipe.", "Conservez les clés secrètes uniquement dans des variables d’environnement serveur.", "Révoquez immédiatement une clé ou un accès exposé.", "Vérifiez les domaines kobara.app avant de saisir des informations."] },
      { title: "En cas de suspicion", steps: ["Changez votre mot de passe depuis un appareil fiable.", "Révoquez les sessions et clés concernées.", "Examinez les paiements, retraits et membres récents.", "Contactez Kobara Support avec les références utiles, jamais avec vos secrets."] },
      { title: "Ce que Kobara ne publie pas", paragraphs: ["Les règles exactes de détection de fraude, seuils de scoring et mécanismes internes restent confidentiels afin de ne pas faciliter leur contournement."], notice: "Kobara ne vous demandera jamais votre mot de passe, votre clé API secrète ou le code de validation d’un portefeuille par message.", noticeTone: "warning" },
    ],
    keywords: ["sécurité", "compte compromis", "clé API", "2FA", "phishing"], relatedArticles: ["developers/webhooks", "verification/why-verify", "payouts/failed"], audience: ["merchant", "developer", "team"], country: ["global"], paymentMethods: [], plans: ["all"],
  }),
  article({
    id: "legal-bank-fsp", slug: "kobara-bank-fsp", path: "legal/kobara-bank-fsp", title: "Kobara est-il une banque ou un fournisseur de services de paiement ?", description: "Comprendre le positionnement de Kobara et le rôle des opérateurs financiers sous-jacents.",
    summary: "Kobara se présente comme une infrastructure technologique de paiement, pas comme une banque. La liste officielle BRH consultée pour cette révision mentionne les opérateurs de MonCash et NatCash parmi les fournisseurs autorisés, mais pas Kobara sous ce nom.", category: "legal",
    sections: [
      { title: "Rôle annoncé de Kobara", paragraphs: ["Kobara fournit une couche d’orchestration, un checkout, des API, des webhooks et des outils de suivi. MonCash et NatCash interviennent comme réseaux financiers pour les opérations correspondantes."], notice: "Cette description du produit n’est pas une qualification juridique et ne remplace pas les documents contractuels applicables.", noticeTone: "info" },
      { title: "Ce que montrent les sources officielles", paragraphs: ["Au 26 septembre 2026, la liste publique BRH utilisée pour cette vérification identifie NATCOM/NatCash et Unigestion Holding/MonCash parmi les fournisseurs de services de paiement. Kobara n’y apparaît pas sous ce nom."], bullets: ["Ne présentez pas Kobara comme agréé BRH sans document officiel correspondant.", "Demandez au support l’identité de l’entité contractante et les documents nécessaires à votre due diligence.", "Pour un avis réglementaire, consultez un professionnel qualifié."] },
    ],
    keywords: ["BRH", "banque", "FSP", "agrément", "réglementation"], relatedArticles: ["what-is-kobara", "non-custodial", "legal/kobara-smartcore"], audience: ["merchant", "legal", "platform"], country: ["HT"], paymentMethods: ["moncash", "natcash"], plans: ["all"], sources: [
      { label: "Banque de la République d’Haïti — Fournisseurs de services de paiement", url: "https://www.brh.ht/supervision-bancaire/fournisseurs-de-services-de-paiement/" },
      { label: "Banque de la République d’Haïti", url: "https://www.brh.ht/" },
    ],
  }),
  article({
    id: "legal-kobara-smartcore", slug: "kobara-smartcore", path: "legal/kobara-smartcore", title: "Quel est le lien entre Kobara et Smartcore Groupe ?", description: "Comprendre qui développe Kobara et où obtenir les informations contractuelles officielles.",
    summary: "Kobara est présenté comme un produit développé par Smartcore Groupe. Les informations de l’entité contractante doivent être vérifiées sur votre contrat, vos factures ou auprès de Kobara Support.", category: "legal",
    sections: [
      { title: "Développement du produit", paragraphs: ["Smartcore Groupe est indiqué comme le développeur de Kobara. Cette relation de développement ne suffit pas, à elle seule, à identifier l’entité précise qui contracte avec chaque marchand ou dans chaque pays."] },
      { title: "Pour votre due diligence", bullets: ["Demandez le nom légal complet de l’entité contractante.", "Demandez son adresse légale et ses identifiants d’enregistrement applicables.", "Vérifiez les conditions d’utilisation et la facture ou le contrat signé.", "Conservez la réponse officielle dans votre dossier fournisseur."] },
      { title: "Informations non publiées ici", paragraphs: ["Ce centre d’aide n’invente pas de NIF, RCCM, adresse ou entité américaine. Lorsque ces informations ne sont pas confirmées dans une source officielle Kobara, elles doivent être demandées au support."], notice: "Contactez Kobara Support avant de communiquer publiquement une information corporative non vérifiée.", noticeTone: "warning" },
    ],
    keywords: ["Smartcore Groupe", "entité légale", "Kobara", "contrat", "NIF"], relatedArticles: ["legal/kobara-bank-fsp", "what-is-kobara", "verification/kyb"], audience: ["merchant", "legal", "procurement"], country: ["HT", "international"], paymentMethods: [], plans: ["all"],
  }),
];

export const publishedHelpArticles = helpArticles.filter((item) => item.published);

export function getHelpArticle(path: string) {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return publishedHelpArticles.find((item) => item.path === normalized);
}

export function getHelpCategory(slug: string) {
  return helpCategories.find((item) => item.slug === slug);
}

export function getHelpArticlesByCategory(category: string) {
  return publishedHelpArticles.filter((item) => item.category === category);
}

export function getHelpArticleHref(item: Pick<HelpArticle, "path">) {
  return `/help/${item.path}`;
}
