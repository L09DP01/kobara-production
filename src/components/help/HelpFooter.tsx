import Link from "next/link";

export function HelpFooter() {
  return (
    <footer className="border-t border-[#E3DEDA] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-[#5C5E66] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Kobara. Centre d’aide marchand.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/contact" className="font-semibold hover:text-[#F45D2C]">Contacter le support</Link>
          <Link href="/privacy" className="font-semibold hover:text-[#F45D2C]">Confidentialité</Link>
          <Link href="/terms" className="font-semibold hover:text-[#F45D2C]">Conditions</Link>
        </div>
      </div>
    </footer>
  );
}
