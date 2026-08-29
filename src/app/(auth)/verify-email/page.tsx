import Link from 'next/link'
import { MailCheck, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: "Vérification e-mail — Kobara",
  description: "Vérifiez votre boîte e-mail pour activer votre compte.",
};

export default async function VerifyEmailPage(props: { searchParams: Promise<{ email?: string }> }) {
  const searchParams = await props.searchParams;
  const email = searchParams.email || 'votre adresse e-mail';

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out text-center">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 rounded-3xl flex items-center justify-center relative shadow-[0_0_30px_rgba(255,74,28,0.2)]">
          <div className="absolute inset-0 bg-[#FF4A1C]/10 blur-xl rounded-full animate-pulse" />
          <MailCheck className="w-10 h-10 text-[#FF4A1C] relative z-10" />
        </div>
      </div>

      <h1 className="text-3xl font-black text-white tracking-tight mb-3">
        Vérifiez votre e-mail
      </h1>
      
      <p className="text-[#AAB3C2] text-sm font-medium leading-relaxed mb-8 max-w-sm mx-auto">
        Nous avons envoyé un lien de confirmation à l'adresse <span className="text-white font-bold">{email}</span>. Veuillez cliquer sur ce lien pour activer votre compte.
      </p>

      <div className="bg-[#07111F] border border-[#1E2A38] rounded-2xl p-5 mb-8 text-xs text-[#AAB3C2] font-medium leading-relaxed shadow-inner">
        Vous n'avez pas reçu l'e-mail ? Pensez à vérifier vos courriers indésirables (spams).
      </div>

      <div className="pt-2">
        <Link 
          href="/login"
          className="w-full h-14 bg-[#07111F] hover:bg-[#1E2A38] border border-[#1E2A38] text-white rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 group/btn"
        >
          <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" />
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
