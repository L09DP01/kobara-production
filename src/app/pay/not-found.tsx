import Link from "next/link";

export default function PayNotFound() {
  return (
    <div className="min-h-[100dvh] bg-[#0F1626] flex flex-col items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Lien introuvable</h1>
        <p className="text-slate-400 text-sm mb-6">
          Désolé, ce lien de paiement n'existe pas ou a été supprimé. Veuillez vérifier l'URL et réessayer.
        </p>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
