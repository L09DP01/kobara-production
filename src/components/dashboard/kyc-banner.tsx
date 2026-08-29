'use client';

import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export function KycRequiredBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6 lg:px-8">
      <div className="max-w-[1080px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">warning</span>
          <p className="text-sm font-medium text-amber-800">
            Vérifiez votre compte pour activer les paiements réels, les retraits et le plan gratuit.
          </p>
        </div>
        <Link
          href="/kyc"
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:text-amber-900 transition-colors"
        >
          Vérifier mon compte <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
