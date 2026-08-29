"use client";

import { useState } from "react";
import { toast } from "sonner";
import { inviteTeamMemberAction, removeTeamMemberAction, resendInvitationAction } from "./actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function TeamClient({ initialMembers }: { initialMembers: any[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsInviting(true);
    const formData = new FormData();
    formData.append("email", email);

    const res = await inviteTeamMemberAction(formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Invitation envoyée avec succès.");
      setEmail("");
      // Real time update would be better, but we rely on next/cache revalidatePath to refresh data
      // For instant UI update:
      setMembers(prev => [{
        id: 'temp-' + Date.now(),
        email: email,
        role: 'developer',
        status: 'pending',
        created_at: new Date().toISOString()
      }, ...prev]);
    }
    setIsInviting(false);
  };

  const handleRemove = async (id: string, emailStr: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer l'accès à ${emailStr} ?`)) return;

    const res = await removeTeamMemberAction(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Membre retiré.");
      setMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleResend = async (id: string) => {
    const res = await resendInvitationAction(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Invitation renvoyée !");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Équipe</h1>
        <p className="text-slate-400">Gérez les accès développeurs de votre compte marchand.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Inviter un développeur</h2>
        <form onSubmit={handleInvite} className="flex gap-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adresse@email.com" 
            required
            className="flex-1 bg-black/20 border border-white/10 text-white placeholder-slate-500 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button 
            type="submit" 
            disabled={isInviting}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isInviting ? 'Envoi...' : 'Inviter'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-4">
          Les développeurs ont accès au tableau de bord, à l'API et aux paiements, mais ne peuvent pas effectuer de retraits ni modifier les paramètres sensibles.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Membres actuels</h2>
        </div>
        
        {members.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">group</span>
            <p className="text-slate-400 font-medium">Vous êtes le seul membre de votre équipe.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {members.map(member => (
              <div key={member.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white flex items-center gap-3">
                    {member.email}
                    {member.status === 'pending' && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase tracking-wider">En attente</span>
                    )}
                    {member.status === 'active' && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-4">
                    <span>Rôle : <strong className="text-slate-300">Développeur</strong></span>
                    <span>•</span>
                    <span>Ajouté le {format(new Date(member.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {member.status === 'pending' && (
                    <button 
                      onClick={() => handleResend(member.id)}
                      className="text-sm font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Renvoyer email
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemove(member.id, member.email)}
                    className="text-sm font-medium text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Révoquer accès
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
