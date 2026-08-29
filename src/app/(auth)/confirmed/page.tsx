import Link from 'next/link'
import { ShieldCheck, ArrowRight } from 'lucide-react'

export const metadata = {
  title: "Compte vérifié — Kobara",
  description: "Votre e-mail a été confirmé avec succès.",
};

export default function ConfirmedPage() {
  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-700 ease-out text-center">
      <div className="flex justify-center mb-8">
        <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center relative shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full animate-pulse" />
          <ShieldCheck className="w-12 h-12 text-emerald-400 relative z-10" />
        </div>
      </div>

      <h1 className="text-3xl font-black text-white tracking-tight mb-3">
        Compte vérifié !
      </h1>
      
      <p className="text-[#AAB3C2] text-sm font-medium leading-relaxed mb-10 max-w-sm mx-auto">
        Votre adresse e-mail a été confirmée avec succès. Votre compte est prêt à être utilisé.
      </p>

      <Link 
        href="/dashboard"
        className="w-full h-14 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95 group/btn"
      >
        Accéder au Dashboard
        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </Link>
    </div>
  )
}
