import type { Metadata } from "next";
import { HelpFooter } from "@/components/help/HelpFooter";
import { HelpHeader } from "@/components/help/HelpHeader";

export const metadata: Metadata = {
  title: { default: "Centre d’aide Kobara", template: "%s | Aide Kobara" },
  description: "Trouvez des réponses sur les paiements, retraits, vérifications, frais et intégrations Kobara.",
};

export default function HelpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-[#FCFAF8]"><HelpHeader />{children}<HelpFooter /></div>;
}
