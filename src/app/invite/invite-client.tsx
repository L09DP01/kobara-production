"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "./actions";

export default function InviteClient({ 
  token, 
  email, 
  businessName, 
  userExists,
  roleLabel = 'Développeur'
}: { 
  token: string, 
  email: string, 
  businessName: string, 
  userExists: boolean,
  roleLabel?: string
}) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const res = await acceptInviteAction(token, password);
    if (res.error) {
      toast.error(res.error);
      setIsSubmitting(false);
    } else {
      toast.success("Invitation acceptée avec succès !");
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1626] flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">mail</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation d'équipe</h1>
          <p className="text-slate-400">
            Vous avez été invité à rejoindre l'équipe de <strong className="text-white">{businessName}</strong> en tant que <strong className="text-orange-400">{roleLabel}</strong>.
          </p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              disabled
              className="w-full bg-black/20 border border-white/10 text-slate-500 px-4 py-3 rounded-xl cursor-not-allowed"
            />
          </div>

          {!userExists && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Créez votre mot de passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
              />
              <p className="text-xs text-slate-500 mt-2">Ce mot de passe vous permettra de vous connecter à Kobara.</p>
            </div>
          )}

          {userExists && (
            <p className="text-sm text-emerald-400 bg-emerald-400/10 p-3 rounded-xl text-center">
              Vous avez déjà un compte Kobara. Cliquez sur le bouton ci-dessous pour accepter l'invitation.
            </p>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'Traitement...' : 'Accepter l\'invitation'}
          </button>
        </form>
      </div>
    </div>
  );
}
