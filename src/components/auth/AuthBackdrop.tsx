"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function AuthBackdrop({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    // Measure the unscaled content so errors and CAPTCHA updates also fit.
    const fit = () => {
      const availableHeight = Math.max(0, frame.clientHeight - 8);
      setScale(Math.min(1, availableHeight / Math.max(1, content.offsetHeight)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(content);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

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

      <section ref={frameRef} className="relative z-10 mx-auto flex h-full w-full max-w-[500px] items-center justify-center">
        <div ref={contentRef} className="w-full shrink-0 origin-center" style={{ transform: `scale(${scale})` }}>
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
