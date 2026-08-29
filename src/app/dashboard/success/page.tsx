'use client'

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get('amount') || '0';
  const recipient = searchParams.get('recipient') || '';
  const type = searchParams.get('type') || 'transfer';

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isTransfer = type === 'transfer';

  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh]">
      <div className="bg-[#121A2F]/80 backdrop-blur-md border border-white/10 p-10 rounded-3xl text-center max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-500">
        
        <div className="w-24 h-24 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-8 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.15)]">
          <span className="material-symbols-outlined text-[48px] text-green-400">
            check_circle
          </span>
        </div>
        
        <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
          {isTransfer ? "Transfert Réussi !" : "Opération Réussie !"}
        </h1>
        
        <p className="text-lg text-slate-400 leading-relaxed mb-10 px-4">
          {isTransfer 
            ? `Vous avez envoyé avec succès ${amount} HTG à ${recipient}.`
            : "Votre opération a été traitée avec succès."
          }
        </p>

        <div className="flex flex-col gap-4">
          <Link 
            href="/dashboard/withdrawals" 
            className="w-full py-4 rounded-xl font-bold bg-[#FF7A00] text-white hover:bg-[#EA580C] transition-colors flex items-center justify-center gap-2"
          >
            Retourner aux opérations
          </Link>
          <Link 
            href="/dashboard" 
            className="w-full py-4 rounded-xl font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            Aller au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
