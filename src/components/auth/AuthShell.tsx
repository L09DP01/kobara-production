"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthVisual } from "@/components/auth/AuthVisual";
import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") {
    return <div className="kobara-public min-h-[100dvh] font-sans text-[#10131D]">{children}</div>;
  }

  return (
    <div className="kobara-public min-h-screen bg-[#FCF7F4] font-sans text-[#10131D] selection:bg-[#F45D2C]/20">
      <PublicHeader />
      <div className="flex min-h-[calc(100dvh-72px)] w-full overflow-hidden">
        <div className="relative z-10 flex w-full flex-col justify-center px-6 py-14 sm:px-12 lg:w-[45%] lg:px-16 xl:w-[40%]">
          <div className="mx-auto w-full max-w-[420px]">{children}</div>
        </div>

        <div className="public-dark-panel relative hidden border-l border-[#333847] bg-[#10131D] lg:flex lg:w-[55%] xl:w-[60%]">
          <AuthVisual />
        </div>
      </div>
      <Footer />
    </div>
  );
}
