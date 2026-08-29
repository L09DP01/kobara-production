import { getServerTranslation } from "@/lib/server/i18n";
import Link from "next/link";
import { ArrowLeft, UserMinus, Shield, Scale, Info } from "lucide-react";

export async function generateMetadata() {
  const { t } = await getServerTranslation();
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

  return (
    <div className="min-h-screen bg-[#020B14] text-[#AAB3C2] selection:bg-[#FF4A1C]/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 right-0 w-full h-[500px] bg-gradient-to-b from-[#1E2A38]/20 to-transparent pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#FF7A00]/5 blur-[150px] rounded-full pointer-events-none" />
      
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
              <Link href="/privacy" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent text-[#AAB3C2] hover:bg-[#07111F] hover:border-[#1E2A38] hover:text-white font-medium transition-colors">
                <Shield className="w-4 h-4" />
                {language === "en" ? "Privacy Policy" : language === "ht" ? "Konfidansyalite" : "Politique de confidentialité"}
              </Link>
              <Link href="/account-closure" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#07111F] border border-[#1E2A38] text-white font-bold transition-colors">
                <UserMinus className="w-4 h-4 text-[#FF7A00]" />
                Clôture de compte
              </Link>
            </nav>
            
            <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-[#07111F] to-[#020B14] border border-[#1E2A38]">
              <Info className="w-8 h-8 text-[#FF7A00] mb-4" />
              <h4 className="text-white font-bold mb-2">Besoin d'aide ?</h4>
              <p className="text-xs text-[#AAB3C2] leading-relaxed">Notre équipe de support est là pour vous accompagner tout au long du processus.</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:w-3/4 max-w-3xl">
          <header className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E2A38]/30 border border-[#1E2A38] text-xs font-bold text-white mb-6">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse"></span>
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
                <div className="prose prose-invert prose-p:text-[#AAB3C2] prose-p:leading-loose prose-p:text-[15px] prose-a:text-[#FF7A00] max-w-none">
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
