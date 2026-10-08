/* eslint-disable react/no-unescaped-entities */
import { getServerTranslation } from "@/lib/server/i18n";
import Link from "next/link";
import { LegalDocumentShell } from "@/components/marketing/LegalDocumentShell";

export async function generateMetadata() {
  return {
    title: `Clôture de compte — Kobara`,
    description: "Procédure pour demander la clôture de votre compte marchand Kobara.",
  };
}

export default async function AccountClosurePage() {
  const { language } = await getServerTranslation();

  const content = {
    fr: {
      title: "Clôture de Compte",
      lastUpdated: "Dernière mise à jour : 12 juin 2026",
      intro: "Nous sommes désolés de vous voir partir. La présente page décrit la procédure complète pour demander la clôture définitive de votre compte marchand Kobara et comprendre comment nous gérons la suppression de vos données.",
      sections: [
        {
          id: "prerequisites",
          title: "1. Conditions préalables à la clôture",
          content: (
            <>
              <p className="mb-4">Avant de pouvoir clôturer votre compte, vous devez vous assurer que les conditions suivantes sont remplies :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white">Solde à zéro :</strong> Votre solde disponible doit être de 0 HTG. Veuillez effectuer un retrait total de vos fonds.</li>
                <li><strong className="text-white">Aucune transaction en attente :</strong> Toutes vos transactions et demandes de retrait en cours doivent être finalisées.</li>
                <li><strong className="text-white">Aucun litige ouvert :</strong> Vous ne devez avoir aucun litige ou réclamation client en cours de résolution.</li>
              </ul>
            </>
          ),
        },
        {
          id: "procedure",
          title: "2. Procédure de clôture",
          content: (
            <>
              <p className="mb-4">Pour initier la clôture de votre compte, veuillez suivre ces étapes :</p>
              <div className="bg-[#1E2A38]/30 border border-[#1E2A38] rounded-xl p-6">
                <ol className="list-decimal pl-5 space-y-3">
                  <li>Envoyez un email à <a href="mailto:support@kobara.app" className="text-[#FF7A00] font-bold">support@kobara.app</a> depuis l'adresse email associée à votre compte marchand.</li>
                  <li>Indiquez en objet : <strong>"Demande de clôture de compte - [Nom de votre entreprise]"</strong>.</li>
                  <li>Dans le corps de l'email, précisez votre identifiant marchand (Merchant ID).</li>
                  <li>Une fois votre demande reçue, notre équipe de conformité vous contactera sous 48 heures pour vérifier votre identité et valider la clôture.</li>
                </ol>
              </div>
            </>
          ),
        },
        {
          id: "data-retention",
          title: "3. Conservation et suppression des données",
          content: (
            <>
              <p className="mb-4">Conformément aux lois haïtiennes relatives à la lutte contre le blanchiment d'argent (AML) et au financement du terrorisme (CFT) :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li><strong className="text-white">Données de transaction :</strong> Nous sommes légalement tenus de conserver l'historique de vos transactions et vos informations KYC pendant une durée de <strong>5 ans</strong> après la clôture du compte.</li>
                <li><strong className="text-white">Données personnelles :</strong> Toute autre donnée personnelle non soumise à une obligation légale de conservation sera anonymisée ou supprimée de nos serveurs actifs dans un délai de 90 jours suivant la clôture.</li>
              </ul>
              <p>Pour plus de détails, veuillez consulter notre <Link href="/privacy" className="text-[#FF7A00]">Politique de Confidentialité</Link>.</p>
            </>
          ),
        },
        {
          id: "reactivation",
          title: "4. Réactivation de compte",
          content: (
            <p>Une fois votre compte définitivement clôturé, cette action est <strong>irréversible</strong>. Si vous souhaitez utiliser à nouveau les services de Kobara à l'avenir, vous devrez entamer un nouveau processus d'inscription et repasser par l'étape de vérification KYC.</p>
          ),
        }
      ]
    }
  };

  const currentData = content.fr; // Using French as default for this page

  return <LegalDocumentShell language={language} activePath="/account-closure" {...currentData} />;
}
