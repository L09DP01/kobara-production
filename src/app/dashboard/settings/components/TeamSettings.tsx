'use client'

import { useState } from 'react';
import { inviteTeamMember, removeTeamMember, resendTeamInvite } from '../actions';
import { toast } from "sonner";
import { Users, Mail, Shield, Code, UserCheck, Clock, Send, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function TeamSettings({ members: initialMembers, userRole = 'owner' }: { members: any[]; userRole?: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [loading, setLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'admin'>('developer');

  const isOwner = userRole === 'owner';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !isOwner) return;

    try {
      setLoading(true);
      const res = await inviteTeamMember(inviteEmail, inviteRole);
      
      if (res?.success) {
        toast.success(`Invitation envoyée à ${inviteEmail} !`);
        
        // Use real ID from server response for optimistic UI
        setMembers(prev => [
          ...prev,
          {
            id: (res as any).memberId || 'temp-' + Date.now(),
            email: inviteEmail.toLowerCase().trim(),
            role: inviteRole,
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ]);
        
        setInviteEmail('');
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de l'invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!isOwner) return;
    if (!confirm(`Voulez-vous vraiment retirer l'accès à ${email} ?`)) return;

    try {
      setRemovingId(id);
      await removeTeamMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
      toast.success(`Accès révoqué pour ${email}.`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setRemovingId(null);
    }
  };

  const handleResend = async (id: string, email: string) => {
    if (!isOwner) return;

    try {
      setResendingId(id);
      const res = await resendTeamInvite(id);
      if (res?.success) {
        toast.success(`Invitation renvoyée avec succès à ${email}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du renvoi de l'invitation");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="bg-[#07111F] border border-[#1E2A38] rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E2A38]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 flex items-center justify-center text-[#FF4A1C]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Membres d'Équipe & Accès</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Invitez des développeurs et des administrateurs à collaborer sur votre compte marchand.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0F1626] border border-[#1E2A38] rounded-xl text-xs text-slate-300 self-start sm:self-auto">
          <Shield className="w-3.5 h-3.5 text-[#FF4A1C]" />
          <span>Votre rôle : <strong className="text-white capitalize">{userRole === 'owner' ? 'Propriétaire' : userRole}</strong></span>
        </div>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E2A38] space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-400">
            <Code className="w-4 h-4" />
            <span>Rôle Développeur</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Accès au tableau de bord, à l'API (clés API, webhooks, documentation), aux transactions et clients. Aucun accès aux retraits de fonds.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E2A38] space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
            <Shield className="w-4 h-4" />
            <span>Rôle Administrateur</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Accès étendu au tableau de bord, à la gestion des paiements et des membres d'équipe. Les retraits restent réservés au Propriétaire.
          </p>
        </div>
      </div>

      {/* Invitation Form (Owner only) */}
      {isOwner ? (
        <div className="bg-[#0F1626] border border-[#1E2A38] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#FF4A1C]" />
            <span>Inviter un nouveau membre</span>
          </h3>

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input 
                type="email" 
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="adresse@email.com" 
                required
                className="w-full bg-[#07111F] border border-[#1E2A38] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF4A1C] transition-all"
              />
            </div>

            <select 
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'developer' | 'admin')}
              className="bg-[#07111F] border border-[#1E2A38] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4A1C] transition-all appearance-none cursor-pointer [&>option]:bg-[#07111F]"
            >
              <option value="developer">Développeur</option>
              <option value="admin">Administrateur</option>
            </select>

            <button 
              type="submit" 
              disabled={loading || !inviteEmail}
              className="bg-[#FF4A1C] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#FF4A1C]/90 transition-all shadow-[0_0_15px_rgba(255,74,28,0.25)] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer l'invitation</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Seul le propriétaire de l'entreprise peut inviter ou révoquer des membres d'équipe.</span>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-300 flex items-center justify-between">
          <span>Membres de l'équipe ({members.length})</span>
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-10 bg-[#0F1626]/50 rounded-2xl border border-[#1E2A38] border-dashed">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">Vous êtes actuellement le seul membre de votre équipe.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(member => {
              const isMemberOwner = member.role === 'owner' || member.isOwner;
              const isPending = member.status === 'pending';

              return (
                <div 
                  key={member.id} 
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isMemberOwner
                      ? 'bg-gradient-to-r from-[#FF4A1C]/10 via-[#07111F] to-[#07111F] border-[#FF4A1C]/30'
                      : 'bg-[#0F1626] border-[#1E2A38] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Role Icon Avatar */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isMemberOwner 
                        ? 'bg-[#FF4A1C]/20 border-[#FF4A1C]/40 text-[#FF4A1C]' 
                        : member.role === 'admin'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                    }`}>
                      {isMemberOwner ? <Shield className="w-5 h-5" /> : member.role === 'admin' ? <Shield className="w-5 h-5" /> : <Code className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">{member.email}</span>
                        
                        {/* Role Tag */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider border ${
                          isMemberOwner
                            ? 'bg-[#FF4A1C]/20 border-[#FF4A1C]/30 text-[#FF4A1C]'
                            : member.role === 'admin'
                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                            : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                        }`}>
                          {isMemberOwner ? '👑 Propriétaire' : member.role === 'admin' ? '🛡️ Admin' : '💻 Développeur'}
                        </span>

                        {/* Status Tag */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                          isPending 
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {isPending ? (
                            <>
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>Invitation en attente</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Membre Actif</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        Ajouté le {new Date(member.created_at || Date.now()).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  {/* Actions for owner */}
                  {isOwner && !isMemberOwner && (
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {isPending && (
                        <button 
                          type="button"
                          disabled={resendingId === member.id}
                          onClick={() => handleResend(member.id, member.email)}
                          className="px-3 py-1.5 bg-[#07111F] hover:bg-[#1E2A38] border border-[#1E2A38] text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {resendingId === member.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF4A1C]" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Renvoyer</span>
                        </button>
                      )}

                      <button 
                        type="button"
                        disabled={removingId === member.id}
                        onClick={() => handleRemove(member.id, member.email)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {removingId === member.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Révoquer</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
