import { getServerTranslation } from "@/lib/server/i18n";
import Link from "next/link";
import { ArrowLeft, FileText, Shield, Scale, Lock } from "lucide-react";

export async function generateMetadata() {
  const { t } = await getServerTranslation();
  return {
    title: `${t("nav.privacy")} — Kobara`,
    description: "Politique de confidentialité des données de la plateforme Kobara.",
  };
}

export default async function PrivacyPage() {
  const { language } = await getServerTranslation();

  const content = {
    fr: {
      title: "Politique de Confidentialité",
      lastUpdated: "Dernière mise à jour : 12 juin 2026",
      intro: "Kobara Technologies S.A. (\"Kobara\", \"nous\") exploite une infrastructure de paiement API qui facilite les transactions MonCash en Haïti. La présente Politique de Confidentialité décrit avec transparence comment nous collectons, utilisons, protégeons et partageons vos données personnelles dans le cadre de nos services. En créant un compte marchand Kobara et en utilisant notre API, vous reconnaissez avoir lu, compris et accepté les pratiques décrites dans ce document.",
      sections: [
        {
          id: "data-collection",
          title: "1. Données Collectées",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">1.1 Données d'identification et KYC</h3>
                <p>Pour ouvrir et maintenir un compte marchand, nous collectons :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Nom complet / raison sociale de l'entreprise</li>
                  <li>Adresse email professionnelle et numéro de téléphone</li>
                  <li>Adresse physique de l'établissement</li>
                  <li>Numéro RCCM (Registre du Commerce et des Sociétés)</li>
                  <li>Numéro d'Identification Fiscale (NIF)</li>
                  <li>Pièces justificatives KYC (document d'identité du représentant légal, justificatif d'activité)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">1.2 Données de transaction</h3>
                <p>Lors de chaque opération de paiement, nous enregistrons :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Montant et devise de la transaction</li>
                  <li>Référence unique et identifiant de transaction</li>
                  <li>Numéro MonCash partiellement masqué (ex. : ****1234)</li>
                  <li>Horodatage (timestamp) de l'opération</li>
                  <li>Statut et résultat de la transaction (succès, échec, erreur)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">1.3 Données techniques</h3>
                <p>Pour la sécurité et le bon fonctionnement du service, nous collectons :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Adresses IP de connexion</li>
                  <li>User-Agent (navigateur ou application utilisée)</li>
                  <li>Logs d'appels API (endpoints appelés, codes de réponse, timestamps)</li>
                  <li>Informations de configuration des Webhooks</li>
                  <li>Métadonnées de session et d'authentification</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">1.4 Données analytiques et cookies</h3>
                <p>Nous utilisons des cookies sur notre tableau de bord marchand. Voir la section 7 pour le détail complet de notre politique de cookies.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">1.5 Données des utilisateurs finaux de vos clients</h3>
                <p>Dans le cadre de vos intégrations, vous pouvez nous transmettre des informations sur vos propres clients (numéros de téléphone, montants). En tant que Marchand, vous êtes seul responsable d'avoir obtenu le consentement approprié de vos utilisateurs finaux avant toute transmission de ces données à Kobara.</p>
              </div>
            </div>
          ),
        },
        {
          id: "legal-basis",
          title: "2. Base Légale du Traitement",
          content: (
            <>
              <p className="mb-4">Tout traitement de données effectué par Kobara repose sur l'une des bases légales suivantes :</p>
              <div className="overflow-x-auto rounded-lg border border-[#1E2A38]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#07111F]">
                    <tr>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Base légale</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Finalité</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Exemples de données concernées</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Exécution du contrat</td>
                      <td className="p-3">Fournir les services de paiement contractuels</td>
                      <td className="p-3">Données KYC, données de transaction, Solde marchand</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Obligation légale</td>
                      <td className="p-3">Conformité AML/KYC imposée par la BRH et les autorités haïtiennes compétentes</td>
                      <td className="p-3">Identité du marchand, logs de transaction (5 ans)</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Intérêt légitime</td>
                      <td className="p-3">Sécurité, détection de fraude, amélioration du service</td>
                      <td className="p-3">Adresses IP, logs API, comportement sur le tableau de bord</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Consentement</td>
                      <td className="p-3">Communications marketing (opt-in explicite requis)</td>
                      <td className="p-3">Email, préférences de communication</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          id: "security",
          title: "3. Sécurité Technique",
          content: (
            <>
              <p className="mb-4">La sécurité de vos données est au cœur de l'architecture de Kobara. Voici les mesures techniques que nous appliquons :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white">Chiffrement en transit :</strong> toutes les communications entre votre système et l'API Kobara sont sécurisées via TLS 1.3. Les connexions en protocoles inférieurs sont automatiquement rejetées.</li>
                <li><strong className="text-white">Hachage des secrets :</strong> les clés API (API Keys) et secrets Webhook sont hachés via Argon2id avant stockage en base de données. Kobara ne peut jamais les lire en clair — vous seul y avez accès après leur génération initiale.</li>
                <li><strong className="text-white">Chiffrement au repos :</strong> les données sensibles stockées en base de données sont chiffrées avec AES-256-GCM.</li>
                <li><strong className="text-white">Principe du moindre privilège :</strong> l'accès aux données de production est strictement limité aux membres de l'équipe Kobara qui en ont besoin opérationnellement. Chaque accès est journalisé et auditable.</li>
                <li><strong className="text-white">Audits de sécurité :</strong> Kobara procède à des revues de sécurité périodiques de son infrastructure, de son code et de ses pratiques internes.</li>
                <li><strong className="text-white">Tests d'intrusion :</strong> des tests de pénétration sont réalisés régulièrement par des tiers indépendants.</li>
              </ul>
            </>
          ),
        },
        {
          id: "sharing",
          title: "4. Partage des Données avec des Tiers",
          content: (
            <>
              <p className="mb-4">Kobara ne vend, ne loue, ni ne commercialise vos données à des tiers à des fins publicitaires ou commerciales, sous aucune forme. Nous pouvons partager certaines données dans les cas strictement suivants :</p>
              <div className="overflow-x-auto rounded-lg border border-[#1E2A38] mb-4">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#07111F]">
                    <tr>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Destinataire</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Raison du partage</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Données partagées</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Base légale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">MonCash / Digicel Haiti</td>
                      <td className="p-3">Exécution technique des paiements</td>
                      <td className="p-3">Références transaction, montants, numéros MonCash masqués</td>
                      <td className="p-3">Contrat</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Prestataires cloud (infrastructure)</td>
                      <td className="p-3">Hébergement sécurisé de nos systèmes</td>
                      <td className="p-3">Données chiffrées uniquement — accès limité</td>
                      <td className="p-3">Intérêt légitime</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Autorités haïtiennes compétentes</td>
                      <td className="p-3">Réquisition judiciaire ou obligation légale AML/CFT</td>
                      <td className="p-3">Sur demande formelle écrite uniquement</td>
                      <td className="p-3">Obligation légale</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Auditeurs de sécurité tiers</td>
                      <td className="p-3">Audit et tests de pénétration mandatés par Kobara</td>
                      <td className="p-3">Données anonymisées ou environnement de test</td>
                      <td className="p-3">Intérêt légitime</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>Tout prestataire tiers avec qui nous partageons des données est contractuellement soumis à des obligations de confidentialité équivalentes aux nôtres.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "5. Conservation des Données",
          content: (
            <>
              <div className="overflow-x-auto rounded-lg border border-[#1E2A38] mb-4">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#07111F]">
                    <tr>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Type de données</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Durée de conservation</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Logs de transaction et données comptables</td>
                      <td className="p-3">5 ans minimum</td>
                      <td className="p-3">Obligation légale haïtienne et AML</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Données de compte marchand actif</td>
                      <td className="p-3">Durée de la relation contractuelle</td>
                      <td className="p-3">Exécution du contrat</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Données d'un compte supprimé</td>
                      <td className="p-3">90 jours (anonymisation), puis suppression</td>
                      <td className="p-3">Gestion des litiges résiduels</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Logs de sécurité (IP, tentatives de connexion)</td>
                      <td className="p-3">12 mois</td>
                      <td className="p-3">Sécurité et détection de fraude</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Documents KYC</td>
                      <td className="p-3">5 ans après clôture du compte</td>
                      <td className="p-3">Obligation légale AML</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>À l'expiration des délais applicables, les données sont soit supprimées définitivement, soit anonymisées de manière irréversible.</p>
            </>
          ),
        },
        {
          id: "rights",
          title: "6. Vos Droits",
          content: (
            <>
              <p className="mb-4">Conformément aux principes internationaux de protection des données personnelles, vous disposez des droits suivants sur les données que nous détenons à votre sujet :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li><strong className="text-white">Droit d'accès :</strong> obtenir une copie complète des données que nous détenons sur votre compte marchand.</li>
                <li><strong className="text-white">Droit de rectification :</strong> corriger toute information inexacte ou incomplète.</li>
                <li><strong className="text-white">Droit à l'effacement :</strong> demander la suppression de vos données, sous réserve des obligations légales de conservation (5 ans pour les données de transaction).</li>
                <li><strong className="text-white">Droit d'opposition :</strong> vous opposer à certains traitements basés sur notre intérêt légitime.</li>
                <li><strong className="text-white">Droit à la portabilité :</strong> recevoir vos données dans un format structuré, lisible par machine (JSON ou CSV).</li>
              </ul>
              <p>Pour exercer l'un de ces droits, envoyez votre demande par email à :<br/><a href="mailto:privacy@kobara.app" className="text-[#34A853]">privacy@kobara.app</a></p>
              <p className="mt-2">Nous nous engageons à accuser réception de votre demande dans les 5 jours ouvrés et à y répondre dans un délai de 30 jours calendaires.</p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "7. Politique de Cookies",
          content: (
            <>
              <p className="mb-4">Kobara utilise des cookies sur son tableau de bord marchand. Aucun cookie n'est utilisé à des fins publicitaires ou de tracking inter-sites.</p>
              <div className="overflow-x-auto rounded-lg border border-[#1E2A38] mb-4">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#07111F]">
                    <tr>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Type de cookie</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Finalité</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Désactivable ?</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white">Cookies fonctionnels</td>
                      <td className="p-3">Gestion de session, authentification sécurisée, mémorisation des préférences de langue</td>
                      <td className="p-3">Non — ils sont essentiels au fonctionnement</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Cookies analytiques</td>
                      <td className="p-3">Mesure d'audience et d'utilisation du tableau de bord (amélioration du service)</td>
                      <td className="p-3">Oui — via les paramètres de votre compte</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>Vous pouvez à tout moment gérer vos préférences cookies depuis les paramètres de votre compte Kobara ou via les paramètres de confidentialité de votre navigateur.</p>
            </>
          ),
        },
        {
          id: "modifications",
          title: "8. Modifications de cette Politique",
          content: (
            <>
              <p className="mb-4">Kobara se réserve le droit de modifier la présente Politique de Confidentialité à tout moment. En cas de modification substantielle :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Vous serez notifié par email à votre adresse enregistrée au moins 30 jours avant l'entrée en vigueur des changements.</li>
                <li>La date de "Dernière mise à jour" en haut de ce document sera actualisée.</li>
                <li>La poursuite de l'utilisation de nos services après la date effective vaut acceptation des nouvelles dispositions.</li>
              </ul>
              <p>La version en vigueur de cette Politique est toujours disponible sur notre site à l'adresse <a href="/privacy" className="text-[#34A853]">kobara.ht/privacy</a>.</p>
            </>
          ),
        },
        {
          id: "contact",
          title: "9. Contact et Gouvernance",
          content: (
            <>
              <p className="mb-4">Le responsable du traitement des données personnelles collectées via les services Kobara est :</p>
              <p className="font-bold text-white mb-4">Kobara Technologies S.A.<br/>Port-au-Prince, Haïti</p>
              <ul className="space-y-1">
                <li>Confidentialité & données personnelles : <a href="mailto:privacy@kobara.app" className="text-[#34A853]">privacy@kobara.app</a></li>
                <li>Questions légales générales : <a href="mailto:legal@kobara.app" className="text-[#34A853]">legal@kobara.app</a></li>
                <li>Incidents de sécurité : <a href="mailto:security@kobara.app" className="text-[#34A853]">security@kobara.app</a></li>
              </ul>
            </>
          ),
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: June 12, 2026",
      intro: "At Kobara, the security of your data and your customers' data is our absolute priority. This document explains how we collect, encrypt, and protect your information during MonCash transactions.",
      sections: [
        {
          id: "data-collection",
          title: "1. Data Collection",
          content: <p>We collect only the data strictly necessary for our payment services: business name, contact details, IP address logs for security, and MonCash transaction metadata (references, partially masked phone numbers, amounts).</p>,
        },
        {
          id: "encryption",
          title: "2. Encryption and Security",
          content: <p>All communications between your infrastructure and the Kobara API are secured via TLS 1.3. Sensitive data, including API Tokens and Webhook secrets, are cryptographically hashed in our database. Even the Kobara team cannot access them in plain text.</p>,
        },
        {
          id: "sharing",
          title: "3. Sharing with Third Parties (MonCash)",
          content: <p>To process payments, certain transactional information must be securely transmitted to Digicel's servers (MonCash). We do not sell, rent, or share your data for advertising purposes with any external third-party partners.</p>,
        },
        {
          id: "rights",
          title: "4. Your Access Rights",
          content: <p>In accordance with industry privacy standards, you can request a copy of the data we hold on your account at any time, or demand the permanent deletion of your merchant account by contacting our compliance team.</p>,
        }
      ]
    },
    ht: {
      title: "Politik Konfidansyalite",
      lastUpdated: "Dènye mizajou: 12 Jen 2026",
      intro: "Nan Kobara, sekirite done ou yo ansanm ak done kliyan ou yo se priyorite nimewo youn nou. Dokiman sa a eksplike kijan nou ranmase, chifre, epi pwoteje enfòmasyon w yo pandan tranzaksyon MonCash yo.",
      sections: [
        {
          id: "data-collection",
          title: "1. Koleksyon Done yo",
          content: <p>Nou sèlman pran done ki vrèman nesesè pou sistèm peman an ka fonksyone byen: non biznis la, enfòmasyon pou kontak, adrès IP pou sekirite, ak enfòmasyon sou tranzaksyon MonCash yo (referans, nimewo ki kache an pati, ak kantite lajan yo).</p>,
        },
        {
          id: "encryption",
          title: "2. Chifreman ak Sekirite",
          content: <p>Tout kominikasyon ki fèt ant sistèm ou a ak API Kobara a fèt an sekirite nan TLS 1.3. Done ki pi sansib yo, tankou Jeton API yo (API Tokens) ak sekrè Webhook yo, se kache nou kache yo (hashed) nan baz done nou an. Menm ekip Kobara a pa ka wè yo byen klè.</p>,
        },
        {
          id: "sharing",
          title: "3. Pataje ak Lòt Konpayi (MonCash)",
          content: <p>Pou peman yo ka pase, gen kèk enfòmasyon ki dwe al jwenn sèvè Digicel yo (MonCash) an sekirite. Nou pa vann, nou pa lwe, epi nou pa pataje done w yo pou zafè piblisite ak okenn lòt patnè deyò.</p>,
        },
        {
          id: "rights",
          title: "4. Dwa Aksè Ou Genyen",
          content: <p>Dapre prensip sekirite done yo itilize toupatou yo, ou gen dwa pou w mande yon kopi done nou genyen sou kont ou a nenpòt kilè, oswa ou ka mande pou yo efase kont machann ou a nèt si w kontakte ekip nou an.</p>,
        }
      ]
    }
  };

  const currentData = currentDataKey(language, content);

  return (
    <div className="min-h-screen bg-[#020B14] text-[#AAB3C2] selection:bg-[#FF4A1C]/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 right-0 w-full h-[500px] bg-gradient-to-b from-[#1E2A38]/20 to-transparent pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#34A853]/5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10 flex flex-col md:flex-row gap-12 lg:gap-24">
        
        {/* Sidebar Navigation */}
        <div className="md:w-1/4 shrink-0">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#FF4A1C] transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          
          <div className="sticky top-24">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Navigation Légale</h3>
            <nav className="space-y-2">
              <Link href="/terms" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent text-[#AAB3C2] hover:bg-[#07111F] hover:border-[#1E2A38] hover:text-white font-medium transition-colors">
                <Scale className="w-4 h-4" />
                {language === "en" ? "Terms of Service" : language === "ht" ? "Kondisyon" : "Conditions d'utilisation"}
              </Link>
              <Link href="/privacy" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#07111F] border border-[#1E2A38] text-white font-bold transition-colors">
                <Shield className="w-4 h-4 text-[#34A853]" />
                {language === "en" ? "Privacy Policy" : language === "ht" ? "Konfidansyalite" : "Politique de confidentialité"}
              </Link>
            </nav>
            
            <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-[#07111F] to-[#020B14] border border-[#1E2A38]">
              <Lock className="w-8 h-8 text-[#34A853] mb-4" />
              <h4 className="text-white font-bold mb-2">Chiffrement AES-256</h4>
              <p className="text-xs text-[#AAB3C2] leading-relaxed">Toutes vos informations sensibles sont chiffrées selon les standards militaires les plus stricts.</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:w-3/4 max-w-3xl">
          <header className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E2A38]/30 border border-[#1E2A38] text-xs font-bold text-white mb-6">
              <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse"></span>
              {currentData.lastUpdated}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
              {currentData.title}
            </h1>
            <p className="text-lg text-[#AAB3C2] leading-relaxed">
              {currentData.intro}
            </p>
          </header>

          <div className="space-y-16">
            {currentData.sections.map((section: any) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-4">
                  {section.title}
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-[#1E2A38] to-transparent"></div>
                </h2>
                <div className="prose prose-invert prose-p:text-[#AAB3C2] prose-p:leading-loose prose-p:text-[15px] prose-a:text-[#34A853] max-w-none">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

function currentDataKey(language: string, content: any) {
  return content[language as keyof typeof content] || content.fr;
}
