import { ArrowUpRight, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function HelpHeader() {
  return (
    <header className="border-b border-[#E3DEDA] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/help" className="flex min-w-0 items-center gap-3" aria-label="Accueil du Centre d’aide Kobara">
          <Image src="/Icone.png" alt="" width={28} height={28} className="h-7 w-7 rounded" priority />
          <span className="text-lg font-extrabold text-[#10131D]">KOBARA</span>
          <span className="hidden h-5 w-px bg-[#D8D3CF] sm:block" />
          <span className="hidden text-sm font-semibold text-[#5C5E66] sm:inline sm:text-base">Centre d’aide</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Navigation du centre d’aide">
          <a href="https://docs.kobara.app" className="hidden min-h-10 items-center gap-2 px-3 text-sm font-semibold text-[#333847] hover:text-[#F45D2C] sm:inline-flex">
            <BookOpen className="h-4 w-4" /> Documentation
          </a>
          <a href="https://kobara.app" className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[#D8D3CF] bg-white px-3 text-sm font-semibold text-[#10131D] hover:border-[#F45D2C] hover:text-[#F45D2C]">
            Kobara.app <ArrowUpRight className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
