import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#E8EDF2] px-4 py-3 selection:bg-[#F45D2C]/20 sm:px-6">
      <div
        aria-hidden
        className="absolute -inset-5 scale-[1.035] bg-cover bg-center blur-[5px] saturate-[0.86]"
        style={{ backgroundImage: "url('/images/dashboard-login-background.png')" }}
      />
      <div aria-hidden className="absolute inset-0 bg-[#E8EDF2]/58 backdrop-blur-[1px]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,rgba(252,247,244,0.48)_0%,rgba(232,237,242,0.24)_48%,rgba(252,247,244,0.42)_100%)]" />

      <div className="absolute bottom-5 right-7 z-20 hidden items-center gap-5 text-xs font-semibold text-[#5C5E66] sm:flex">
        <span>© Kobara</span>
        <Link href="/privacy" className="transition-colors hover:text-[#F45D2C]">Confidentialité</Link>
        <Link href="/terms" className="transition-colors hover:text-[#F45D2C]">Conditions</Link>
      </div>

      <section className="relative z-10 mx-auto flex h-full w-full max-w-[500px] items-center justify-center">
        <div className="w-full origin-center [@media(max-width:639px)_and_(max-height:860px)]:scale-[0.94] [@media(max-height:760px)]:scale-[0.9] [@media(max-height:660px)]:scale-[0.8]">
          {children}
        </div>
      </section>
    </main>
  );
}

export function AuthCardBrand() {
  return (
    <Link href="/" aria-label="Accueil Kobara" className="mb-2 flex items-center justify-center gap-2">
      <Image src="/Icone.png" alt="" width={26} height={26} priority className="h-6 w-6 object-contain" />
      <span className="text-lg font-black text-[#10131D]">KOBARA</span>
    </Link>
  );
}
