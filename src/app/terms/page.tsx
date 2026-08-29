import { getServerTranslation } from "@/lib/server/i18n";
import Link from "next/link";
import { ArrowLeft, FileText, Shield, Scale } from "lucide-react";

export async function generateMetadata() {
  const { t } = await getServerTranslation();
  return {
    title: `${t("nav.terms")} — Kobara`,
    description: "Conditions d'utilisation de la plateforme Kobara.",
  };
}

export default async function TermsPage() {
  const { language } = await getServerTranslation();

  const content = {
    fr: {
      title: "Conditions Générales d'Utilisation",
      lastUpdated: "Dernière mise à jour : 12 juin 2026",
      intro: "Bienvenue sur Kobara. En accédant à notre plateforme et en utilisant notre API de paiement, vous acceptez les présentes Conditions Générales d'Utilisation dans leur intégralité. Lisez-les attentivement avant d'utiliser nos services.\n\n⚠ Kobara est une passerelle technologique de paiement. Kobara n'est pas une banque, ne détient pas de licence bancaire, et n'est pas un établissement financier agréé. Kobara facilite techniquement les transactions via le réseau MonCash, opéré par Digicel Haiti S.A., selon leurs propres conditions générales.",
      sections: [
        {
          id: "definitions",
          title: "1. Définitions",
          content: (
            <>
              <p className="mb-4">Les termes suivants, utilisés dans les présentes CGU, ont le sens défini ci-après :</p>
              <div className="overflow-x-auto rounded-lg border border-[#1E2A38]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#07111F]">
                    <tr>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Terme</th>
                      <th className="p-3 border-b border-[#1E2A38] text-white font-semibold">Définition</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold w-1/4">Kobara</td>
                      <td className="p-3">Kobara Technologies S.A., société exploitant l'infrastructure API de paiement et propriétaire des présentes CGU.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">Marchand</td>
                      <td className="p-3">Toute entreprise ou personne physique ayant créé et activé un compte marchand Kobara après vérification KYC.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">Utilisateur final</td>
                      <td className="p-3">Client du Marchand effectuant un paiement via une intégration Kobara, sans relation contractuelle directe avec Kobara.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">Transaction</td>
                      <td className="p-3">Toute opération de paiement initiée via l'API Kobara et routée sur le réseau MonCash.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">Solde</td>
                      <td className="p-3">Montant des fonds reçus, confirmés et disponibles dans le compte marchand Kobara, déduction faite des frais applicables.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">API</td>
                      <td className="p-3">Interface de programmation applicative fournie par Kobara, permettant l'intégration des fonctionnalités de paiement dans les systèmes des Marchands.</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">Webhook</td>
                      <td className="p-3">Notification HTTP envoyée automatiquement par Kobara vers une URL configurée par le Marchand, lors d'événements de paiement (succès, échec, remboursement).</td>
                    </tr>
                    <tr className="border-b border-[#1E2A38]/50">
                      <td className="p-3 text-white font-bold">KYC</td>
                      <td className="p-3">Know Your Customer — processus réglementaire de vérification d'identité et d'activité, obligatoire pour l'ouverture d'un compte marchand.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white font-bold">AML/CFT</td>
                      <td className="p-3">Anti-Money Laundering / Counter-Financing of Terrorism — cadre réglementaire de lutte contre le blanchiment et le financement du terrorisme.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          id: "eligibility",
          title: "2. Éligibilité et Vérification KYC",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">2.1 Conditions d'éligibilité</h3>
                <p>Pour ouvrir un compte marchand Kobara, vous devez remplir toutes les conditions suivantes :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Être âgé d'au moins 18 ans</li>
                  <li>Être une entreprise légalement enregistrée en Haïti (numéro RCCM valide) ou un travailleur indépendant autorisé à exercer une activité commerciale sur le territoire haïtien</li>
                  <li>Posséder un compte MonCash actif, valide et enregistré à votre nom ou au nom de votre entité</li>
                  <li>Ne pas faire l'objet de sanctions nationales ou internationales (liste OFAC, gel d'avoir, etc.)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">2.2 Processus de vérification KYC</h3>
                <p>L'ouverture d'un compte marchand est conditionnée à la réussite complète d'un processus KYC comprenant la fourniture des documents suivants :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Numéro RCCM et documents d'enregistrement de l'entreprise</li>
                  <li>Numéro d'Identification Fiscale (NIF) à jour</li>
                  <li>Pièce d'identité nationale valide du représentant légal</li>
                  <li>Justificatif d'activité commerciale (facture, contrat, site web, etc.)</li>
                  <li>Informations sur la nature de l'activité et les flux financiers attendus</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">2.3 Suspension et sanctions</h3>
                <p>Kobara se réserve le droit de refuser, suspendre ou fermer immédiatement tout compte dont les informations KYC s'avèrent inexactes, falsifiées, incomplètes ou ne correspondant plus à la réalité. En cas de fraude avérée lors de l'inscription, Kobara peut retenir les fonds disponibles pendant la durée de l'investigation et signaler les faits aux autorités compétentes.</p>
              </div>
            </div>
          ),
        },
        {
          id: "api-usage",
          title: "3. Utilisation de l'API Kobara",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">3.1 Licence d'utilisation</h3>
                <p>Kobara vous accorde une licence d'utilisation de son API limitée, non exclusive, non transférable et révocable, valable uniquement pour les fins d'intégration des fonctionnalités de paiement dans vos propres produits et services légitimes, dans le respect des présentes CGU.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">3.2 Utilisations interdites</h3>
                <p>Il vous est strictement interdit de :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Utiliser l'API Kobara pour des activités illicites, frauduleuses ou contraires aux présentes CGU ou à la législation haïtienne applicable</li>
                  <li>Procéder à de l'ingénierie inverse (reverse engineering) de l'API, tenter d'en décompiler le code ou d'en extraire les algorithmes</li>
                  <li>Revendre, sous-licencier, louer ou redistribuer l'accès à l'API Kobara à des tiers sans autorisation écrite préalable</li>
                  <li>Effectuer des tests de charge abusifs (stress testing, DDoS volontaire) sans accord formel de Kobara</li>
                  <li>Automatiser des transactions à des fins de blanchiment, d'arbitrage frauduleux ou de contournement des contrôles AML</li>
                  <li>Usurper l'identité de Kobara ou présenter votre produit comme étant développé ou certifié par Kobara</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">3.3 Rate Limiting et quotas</h3>
                <p>L'API Kobara est soumise à des limites de débit (rate limits) définis dans la documentation technique disponible sur docs.kobara.ht. Le dépassement répété et abusif de ces limites peut entraîner une suspension temporaire automatique de l'accès, sans préavis.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">3.4 Sécurité de vos clés API</h3>
                <p>Vous êtes seul responsable de la sécurité et de la confidentialité de vos clés API et secrets Webhook. Toute activité effectuée avec vos identifiants engage votre responsabilité exclusive, qu'elle soit autorisée ou non par vous.</p>
                <p className="mt-2">En cas de compromission suspectée, vous devez :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Régénérer immédiatement vos clés depuis votre tableau de bord Kobara</li>
                  <li>Notifier Kobara dans les 24 heures à security@kobara.app</li>
                  <li>Analyser vos logs pour identifier les transactions non autorisées éventuelles</li>
                </ul>
                <p className="mt-4 p-4 rounded-xl bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-[#FF4A1C] text-sm font-medium">
                  🔐 Kobara recommande fortement l'activation de l'authentification à deux facteurs (MFA) sur votre compte marchand. Cette mesure réduit significativement le risque de compromission.
                </p>
              </div>
            </div>
          ),
        },
        {
          id: "payments",
          title: "4. Traitement des Paiements",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">4.1 Nature du service</h3>
                <p>Kobara agit exclusivement en tant que passerelle technologique. Nous facilitons la communication entre votre système et le réseau MonCash. Kobara ne détient pas les fonds de vos clients — le traitement effectif des paiements est réalisé par MonCash/Digicel Haiti conformément à leurs propres conditions.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">4.2 Frais de traitement</h3>
                <p>Des frais de traitement sont appliqués à chaque transaction réussie. La structure tarifaire applicable à votre compte est définie dans votre contrat marchand ou dans la grille tarifaire consultable sur votre tableau de bord. À titre indicatif, le modèle standard applicable est de 2,9% du montant brut de la transaction, susceptible de varier selon votre volume mensuel et votre type de compte.</p>
                <p className="mt-2">Les frais sont automatiquement déduits du montant crédité à votre Solde. Kobara se réserve le droit de modifier sa grille tarifaire avec un préavis de 30 jours.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">4.3 Délais de règlement</h3>
                <p>Les fonds des transactions confirmées sont crédités sur votre Solde Kobara selon les délais définis dans votre contrat marchand. Ces délais peuvent varier en fonction des conditions opérationnelles du réseau MonCash et des vérifications de sécurité Kobara.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">4.4 Gestion des échecs de transaction</h3>
                <p>En cas d'échec technique d'une transaction, aucun débit n'est effectué. Les causes d'échec courantes incluent : solde MonCash insuffisant chez l'utilisateur final, numéro de téléphone invalide, timeout du réseau, ou rejet par nos systèmes de détection de fraude. Kobara n'est pas responsable des échecs imputables à l'infrastructure MonCash/Digicel.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2 text-red-400">4.5 Irréversibilité des transactions confirmées</h3>
                <p>⚠ Une transaction confirmée par le réseau MonCash est définitivement irréversible. Kobara n'a pas la capacité technique d'annuler ni de rembourser une transaction déjà confirmée par MonCash. Toute demande de remboursement vers un utilisateur final relève exclusivement de la responsabilité du Marchand, qui devra initier une nouvelle transaction de remboursement.</p>
              </div>
            </div>
          ),
        },
        {
          id: "anti-fraud",
          title: "5. Anti-Fraude et Conformité AML/CFT",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">5.1 Monitoring automatique en temps réel</h3>
                <p>Kobara maintient des systèmes de surveillance automatique des transactions en temps réel. Toute transaction présentant des signaux d'alerte (montant anormal, fréquence suspecte, profil à risque) peut être automatiquement retardée ou bloquée pour vérification complémentaire.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">5.2 Blocage automatique</h3>
                <p>Kobara se réserve le droit de bloquer automatiquement et sans préavis toute transaction ou compte présentant des indicateurs de fraude, de blanchiment de capitaux, de financement du terrorisme, ou d'activité contraire aux présentes CGU. Vous serez notifié dans les meilleurs délais, sauf interdiction légale.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">5.3 Obligations légales de signalement</h3>
                <p>Kobara est soumis aux obligations légales de signalement aux autorités compétentes haïtiennes (Unité Centrale de Renseignements Financiers — UCREF) en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme. Tout comportement suspect peut être signalé aux autorités sans obligation de notification préalable au Marchand concerné.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2 text-red-400">5.4 Interdictions absolues</h3>
                <p>L'utilisation de Kobara est strictement et absolument interdite pour les activités suivantes :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-red-300">
                  <li>Blanchiment de capitaux sous toute forme</li>
                  <li>Financement du terrorisme, de groupes armés ou d'organisations criminelles</li>
                  <li>Toute activité faisant l'objet de sanctions OFAC (Office of Foreign Assets Control) ou d'un embargo international</li>
                  <li>Vente de produits ou services illicites selon le droit haïtien</li>
                  <li>Jeux d'argent non autorisés par les autorités haïtiennes compétentes</li>
                  <li>Contournement de contrôles douaniers, fiscaux ou de change</li>
                  <li>Escroqueries, arnaques ou tout dispositif de fraude envers des tiers</li>
                </ul>
                <p className="mt-2 text-red-400">La violation de ces interdictions entraîne la résiliation immédiate du compte, le gel des fonds, et le signalement obligatoire aux autorités compétentes.</p>
              </div>
            </div>
          ),
        },
        {
          id: "withdrawals",
          title: "6. Retraits et Gestion du Solde",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">6.1 Éligibilité au retrait</h3>
                <p>Les demandes de retrait sont disponibles pour tout Marchand disposant d'un compte KYC vérifié et actif, et d'un Solde disponible supérieur au seuil minimum applicable (consultable sur votre tableau de bord Kobara).</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">6.2 Destinations de retrait</h3>
                <p>Les retraits peuvent être effectués vers :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Votre compte MonCash principal enregistré et vérifié</li>
                  <li>Un compte bancaire haïtien vérifié (selon disponibilité et conditions applicables)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">6.3 Délais de traitement</h3>
                <p>Kobara s'engage à traiter les demandes de retrait dans un délai de 1 à 3 jours ouvrés à compter de la validation de la demande, sous réserve des vérifications de sécurité requises et de l'absence de blocage AML.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">6.4 Gel de fonds</h3>
                <p>Kobara se réserve le droit de geler temporairement tout ou partie de votre Solde dans les cas suivants :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Suspicion d'activité frauduleuse ou anomalie détectée sur votre compte</li>
                  <li>Litige ou contestation en cours impliquant des transactions sur votre compte</li>
                  <li>Réquisition légale, judiciaire ou demande d'autorité compétente</li>
                  <li>Violation suspectée ou avérée des présentes CGU</li>
                </ul>
                <p className="mt-2">Vous serez notifié du gel dans les meilleurs délais, sauf interdiction légale de divulgation. La durée du gel sera proportionnelle à la nature de l'investigation.</p>
              </div>
            </div>
          ),
        },
        {
          id: "disputes",
          title: "7. Litiges et Contestations de Transaction",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">7.1 Responsabilité exclusive du Marchand envers ses clients</h3>
                <p>Le Marchand est seul responsable de la gestion des réclamations et litiges de ses propres utilisateurs finaux. Kobara n'est pas partie aux contrats commerciaux conclus entre le Marchand et ses clients et ne peut pas se substituer au Marchand dans la résolution de ces litiges.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">7.2 Procédure de contestation</h3>
                <p>En cas de contestation d'une transaction impliquant votre compte (signalée par un tiers ou détectée par nos systèmes), Kobara peut vous contacter pour recueillir des éléments de preuve. Vous disposez d'un délai de 5 jours ouvrés pour répondre à toute demande de Kobara dans le cadre d'un litige. L'absence de réponse dans ce délai peut être considérée comme une absence de contestation de votre part.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">7.3 Chargebacks et frais associés</h3>
                <p>En cas de chargeback avéré ou de fraude confirmée imputable à votre compte ou à vos intégrations, les frais associés (frais de traitement du chargeback, frais d'investigation) peuvent être directement déduits de votre Solde disponible. Des chargebacks répétés ou un taux de contestation anormalement élevé peuvent entraîner la suspension ou la fermeture définitive de votre compte marchand.</p>
              </div>
            </div>
          ),
        },
        {
          id: "liability",
          title: "8. Limitations de Responsabilité",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">8.1 Disponibilité du service et dépendances tierces</h3>
                <p>Kobara s'efforce de maintenir la plus haute disponibilité possible de son API, mais ne garantit pas un service ininterrompu à 100%. Kobara n'est pas responsable des interruptions, délais ou défaillances du réseau MonCash/Digicel Haiti, qui relèvent de la responsabilité exclusive de cet opérateur tiers.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">8.2 Plafond de responsabilité financière</h3>
                <p>En tout état de cause et dans les limites permises par la loi haïtienne applicable, la responsabilité totale de Kobara envers un Marchand, pour quelque cause que ce soit, ne peut excéder le montant total des frais de traitement effectivement payés par ce Marchand à Kobara au cours des 3 mois précédant l'événement générateur de la réclamation.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">8.3 Exclusions de responsabilité</h3>
                <p>Kobara exclut expressément toute responsabilité pour :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Les pertes résultant d'un cas de force majeure (catastrophes naturelles, pandémies, troubles civils, coupures d'électricité généralisées, défaillances de réseaux tiers)</li>
                  <li>Les cyberattaques, attaques DDoS ou intrusions externes non liées à une négligence prouvée de Kobara</li>
                  <li>Toute perte financière résultant de la compromission de vos identifiants due à votre propre négligence (partage de clés API, absence de MFA, environnements non sécurisés)</li>
                  <li>Les décisions commerciales et financières prises par le Marchand sur la base des données ou du service Kobara</li>
                  <li>Les dommages indirects, pertes de profit, pertes de données ou préjudices commerciaux résultant de l'utilisation de nos services</li>
                </ul>
              </div>
            </div>
          ),
        },
        {
          id: "intellectual-property",
          title: "9. Propriété Intellectuelle",
          content: (
            <>
              <p className="mb-4">L'API Kobara, sa documentation, ses interfaces utilisateur, ses algorithmes, sa marque, ses logos, ses noms de domaine et l'ensemble de ses actifs technologiques et commerciaux sont la propriété exclusive de Kobara Technologies S.A. et sont protégés par les lois applicables en matière de propriété intellectuelle.</p>
              <p>Il vous est expressément interdit de :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Utiliser la marque, les logos ou tout autre signe distinctif Kobara sans autorisation écrite préalable et explicite</li>
                <li>Créer des produits ou services dérivés basés sur l'API, la documentation ou les algorithmes Kobara</li>
                <li>Présenter votre produit comme étant développé, approuvé, sponsorisé ou certifié par Kobara sans accord formel</li>
                <li>Reproduire ou distribuer la documentation Kobara à des fins commerciales</li>
              </ul>
            </>
          ),
        },
        {
          id: "termination",
          title: "10. Résiliation du Compte",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">10.1 Résiliation par le Marchand</h3>
                <p>Vous pouvez fermer votre compte marchand Kobara à tout moment en soumettant une demande écrite à legal@kobara.app avec un préavis minimum de 15 jours calendaires. Durant ce délai, les transactions et paiements en cours seront finalisés normalement.</p>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">10.2 Résiliation par Kobara</h3>
                <p>Kobara peut suspendre ou résilier votre accès immédiatement et sans préavis dans les cas suivants :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Violation avérée ou suspectée des présentes CGU</li>
                  <li>Activité frauduleuse, blanchiment ou financement d'activités illicites</li>
                  <li>Non-conformité aux exigences KYC/AML ou fourniture d'informations falsifiées</li>
                  <li>Décision judiciaire, réquisition légale ou injonction d'autorité compétente</li>
                  <li>Inactivité prolongée du compte (absence de transaction pendant plus de 12 mois consécutifs)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">10.3 Traitement du solde résiduel</h3>
                <p>En cas de résiliation sans faute de votre part, Kobara s'engage à vous restituer votre Solde disponible dans un délai de 30 jours calendaires suivant la clôture, déduction faite de tout montant dû (frais en cours, litiges ouverts).</p>
                <p className="mt-2">En cas de résiliation pour fraude avérée, les fonds peuvent être retenus pendant la durée de l'investigation et, le cas échéant, transmis aux autorités compétentes conformément aux obligations légales applicables.</p>
              </div>
            </div>
          ),
        },
        {
          id: "modifications",
          title: "11. Modifications des CGU",
          content: (
            <>
              <p className="mb-4">Kobara se réserve le droit de modifier les présentes CGU à tout moment pour refléter les évolutions de son service, de la réglementation haïtienne, ou de ses pratiques commerciales.</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Tout changement substantiel vous sera notifié par email à votre adresse enregistrée au moins 30 jours avant son entrée en vigueur.</li>
                <li>La date de "Dernière mise à jour" en haut du document sera actualisée.</li>
                <li>La version en vigueur est consultable à tout moment sur kobara.ht/terms.</li>
                <li>La poursuite de l'utilisation de nos services après la date effective de modification vaut acceptation tacite des nouvelles CGU.</li>
              </ul>
            </>
          ),
        },
        {
          id: "law",
          title: "12. Droit Applicable et Juridiction",
          content: (
            <>
              <p className="mb-4">Les présentes CGU sont régies par le droit de la République d'Haïti.</p>
              <p className="mb-4">En cas de litige relatif à l'interprétation, l'exécution ou la résiliation des présentes CGU, les parties s'engagent expressément à tenter de le résoudre à l'amiable dans un délai de 30 jours calendaires à compter de la notification écrite du différend, avant tout recours judiciaire.</p>
              <p>À défaut de résolution amiable dans ce délai, les Tribunaux compétents de Port-au-Prince, République d'Haïti, auront juridiction exclusive pour connaître de tout litige relatif aux présentes CGU, nonobstant la pluralité de défendeurs ou l'appel en garantie.</p>
            </>
          ),
        },
        {
          id: "contact",
          title: "13. Contact Légal",
          content: (
            <>
              <p className="mb-4">Pour toute question relative aux présentes CGU, tout litige ou toute notification légale :</p>
              <p className="font-bold text-white mb-4">Kobara Technologies S.A.<br/>Port-au-Prince, Haïti</p>
              <ul className="space-y-1">
                <li>Questions légales et CGU : <a href="mailto:legal@kobara.app" className="text-[#FF4A1C]">legal@kobara.app</a></li>
                <li>Confidentialité & données personnelles : <a href="mailto:privacy@kobara.app" className="text-[#FF4A1C]">privacy@kobara.app</a></li>
                <li>Incidents de sécurité (disponible 24h/24) : <a href="mailto:security@kobara.app" className="text-[#FF4A1C]">security@kobara.app</a></li>
              </ul>
            </>
          ),
        }
      ]
    },
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated: June 12, 2026",
      intro: "Welcome to Kobara. By using our payment infrastructure, you agree to the following terms designed to ensure a safe, reliable ecosystem compliant with Haitian regulations.",
      sections: [
        {
          id: "account",
          title: "1. Account Creation and Eligibility",
          content: <p>To open a Kobara merchant account, you must be a registered business in Haiti or an authorized freelancer. You guarantee that all information provided during registration (KYC) is accurate. Kobara reserves the right to suspend any account with fraudulent information.</p>,
        },
        {
          id: "payments",
          title: "2. MonCash Payment Processing",
          content: <p>Kobara acts as a technology gateway facilitating payments via the MonCash network. We are not a bank. Collected funds are subject to fixed processing fees (e.g., 2.9%). Transactions may be blocked by our algorithms if suspicious activity is detected (anti-fraud).</p>,
        },
        {
          id: "withdrawals",
          title: "3. Withdrawals and Balance Transfers",
          content: <p>Withdrawals from your Kobara balance to your MonCash or bank account are subject to security checks. Kobara commits to processing these requests within a reasonable timeframe. In the event of a dispute, funds may be temporarily frozen.</p>,
        },
        {
          id: "security",
          title: "4. Security and API",
          content: <p>You are responsible for the security of your API keys and account access (MFA recommended). Kobara will not be held liable for any financial loss resulting from a compromise of your credentials due to your negligence.</p>,
        }
      ]
    },
    ht: {
      title: "Kondisyon Itilizasyon",
      lastUpdated: "Dènye mizajou: 12 Jen 2026",
      intro: "Byenvini sou Kobara. Lè w sèvi ak platfòm peman nou an, ou aksepte kondisyon sa yo ki fèt pou garanti yon sistèm ki an sekirite, fyab, epi ki respekte lwa peyi Dayiti.",
      sections: [
        {
          id: "account",
          title: "1. Kreyasyon Kont ak Elijibilite",
          content: <p>Pou w louvri yon kont machann Kobara, fòk ou se yon biznis ki anrejistre legalman an Ayiti oswa yon travayè endepandan ki otorize. Ou garanti tout enfòmasyon ou bay lè w ap anrejistre (KYC) yo kòrèk. Kobara rezève dwa pou l bloke nenpòt kont ki gen fo enfòmasyon.</p>,
        },
        {
          id: "payments",
          title: "2. Pwosesis Peman MonCash",
          content: <p>Kobara se yon pon teknolojik ki fasilite peman sou rezo MonCash la. Nou pa yon bank. Gen frè fiks k ap aplike sou lajan ou resevwa yo (egzanp: 2.9%). Sistèm nou an ka bloke tranzaksyon si li wè gen aktivite sispèk (anti-fwod).</p>,
        },
        {
          id: "withdrawals",
          title: "3. Retrè ak Transfè Lajan",
          content: <p>Retrè ki fèt sot nan balans Kobara w pou al sou kont MonCash oswa kont bank ou oblije pase nan verifikasyon sekirite. Kobara pran angajman pou l trete demann sa yo nan yon tan ki rezonab. Si ta gen yon pwoblèm oswa yon kontestasyon, nou ka bloke lajan an pou yon ti tan.</p>,
        },
        {
          id: "security",
          title: "4. Sekirite ak API",
          content: <p>Se ou menm ki responsab pou sekirite kle API w yo ak aksè nan kont ou (nou konseye w itilize MFA). Kobara p ap responsab pou okenn pèt finansye si w kite yon moun vòlè enfòmasyon w yo poutèt ou pa t fè atansyon.</p>,
        }
      ]
    }
  };

  const currentData = currentDataKey(language, content);

  return (
    <div className="min-h-screen bg-[#020B14] text-[#AAB3C2] selection:bg-[#FF4A1C]/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#1E2A38]/30 to-transparent pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#FF4A1C]/5 blur-[150px] rounded-full pointer-events-none" />
      
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
              <Link href="/terms" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#07111F] border border-[#1E2A38] text-white font-bold transition-colors">
                <Scale className="w-4 h-4 text-[#FF4A1C]" />
                {language === "en" ? "Terms of Service" : language === "ht" ? "Kondisyon" : "Conditions d'utilisation"}
              </Link>
              <Link href="/privacy" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent text-[#AAB3C2] hover:bg-[#07111F] hover:border-[#1E2A38] hover:text-white font-medium transition-colors">
                <Shield className="w-4 h-4" />
                {language === "en" ? "Privacy Policy" : language === "ht" ? "Konfidansyalite" : "Politique de confidentialité"}
              </Link>
            </nav>
            
            <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-[#07111F] to-[#020B14] border border-[#1E2A38]">
              <FileText className="w-8 h-8 text-[#FF4A1C] mb-4" />
              <h4 className="text-white font-bold mb-2">Besoin d'aide légale ?</h4>
              <p className="text-xs text-[#AAB3C2] leading-relaxed mb-4">Notre équipe de conformité est disponible pour répondre à vos questions sur ces conditions.</p>
              <Link href="/contact" className="text-xs font-bold text-[#FF4A1C] hover:text-white transition-colors">Contactez-nous &rarr;</Link>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:w-3/4 max-w-3xl">
          <header className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E2A38]/30 border border-[#1E2A38] text-xs font-bold text-white mb-6">
              <span className="w-2 h-2 rounded-full bg-[#FF4A1C] animate-pulse"></span>
              {currentData.lastUpdated}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6 whitespace-pre-line">
              {currentData.title}
            </h1>
            <p className="text-lg text-[#AAB3C2] leading-relaxed whitespace-pre-line">
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
                <div className="prose prose-invert prose-p:text-[#AAB3C2] prose-p:leading-loose prose-p:text-[15px] prose-a:text-[#FF4A1C] max-w-none">
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
