'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Code2, KeyRound, Loader2, Mail, Send, Shield, Trash2, UserRoundPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { inviteTeamMember, removeTeamMember, resendTeamInvite, revokeTeamDeveloperApiKey, setTeamDeveloperWithdrawalAccess } from '../actions';

type DeveloperKey = { id: string; name: string; prefix: string; scopes: string[]; revoked_at?: string | null; created_at: string };
type TeamMember = {
  id: string; email: string; role: string; status: string; created_at: string; isOwner?: boolean;
  developerConnection?: {
    id: string; status: string; withdrawal_access: boolean; connection_source: string; commission_eligible: boolean;
    developer_accounts?: { display_name?: string; company_name?: string; status?: string } | null;
    api_keys?: DeveloperKey[];
  } | null;
};

export function TeamSettings({ members: initialMembers, userRole = 'owner' }: { members: TeamMember[]; userRole?: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'admin'>('developer');
  const [busy, setBusy] = useState<string | null>(null);
  const isOwner = userRole === 'owner';

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail || !isOwner) return;
    setBusy('invite');
    try {
      const result = await inviteTeamMember(inviteEmail, inviteRole);
      setMembers((current) => [...current, { id: result.memberId || `pending-${Date.now()}`, email: inviteEmail.toLowerCase().trim(), role: inviteRole, status: 'pending', created_at: new Date().toISOString(), developerConnection: null }]);
      setInviteEmail(''); toast.success('Invitation envoyée.');
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible d'envoyer l'invitation."); }
    finally { setBusy(null); }
  }

  async function handleRemove(member: TeamMember) {
    if (!confirm(`Révoquer l'accès de ${member.email} et toutes ses clés Developer ?`)) return;
    setBusy(`remove:${member.id}`);
    try { await removeTeamMember(member.id); setMembers((current) => current.filter((item) => item.id !== member.id)); toast.success('Accès et clés Developer révoqués.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de révoquer l'accès."); }
    finally { setBusy(null); }
  }

  async function handleResend(member: TeamMember) {
    setBusy(`resend:${member.id}`);
    try { await resendTeamInvite(member.id); toast.success(`Invitation renvoyée à ${member.email}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de renvoyer l'invitation."); }
    finally { setBusy(null); }
  }

  async function handleWithdrawalAccess(member: TeamMember, enabled: boolean) {
    setBusy(`withdrawal:${member.id}`);
    try {
      await setTeamDeveloperWithdrawalAccess(member.id, enabled);
      setMembers((current) => current.map((item) => item.id === member.id && item.developerConnection ? { ...item, developerConnection: { ...item.developerConnection, withdrawal_access: enabled } } : item));
      toast.success(enabled ? 'Retraits autorisés pour ce développeur.' : 'Autorisation de retrait supprimée.');
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de modifier l'autorisation."); }
    finally { setBusy(null); }
  }

  async function handleRevokeKey(member: TeamMember, keyId: string) {
    if (!confirm('Révoquer définitivement cette clé API ?')) return;
    setBusy(`key:${keyId}`);
    try {
      await revokeTeamDeveloperApiKey(member.id, keyId);
      setMembers((current) => current.map((item) => item.id !== member.id || !item.developerConnection ? item : { ...item, developerConnection: { ...item.developerConnection, api_keys: (item.developerConnection.api_keys || []).map((key) => key.id === keyId ? { ...key, revoked_at: new Date().toISOString() } : key) } }));
      toast.success('Clé API révoquée.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossible de révoquer cette clé.'); }
    finally { setBusy(null); }
  }

  return <div className="overflow-hidden rounded-md border border-[#26354a] bg-[#0a1422] text-white">
    <header className="flex flex-col gap-4 border-b border-[#26354a] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500/12 text-orange-400"><Users className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">Membres de l’équipe</h2><p className="mt-0.5 text-sm text-slate-400">Accès, permissions et clés créées par vos collaborateurs.</p></div></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-md border border-[#26354a] bg-[#07101d] px-3 py-2 text-xs text-slate-300"><Shield className="h-4 w-4 text-orange-400" /> {isOwner ? 'Propriétaire' : userRole}</span>
    </header>

    {isOwner ? <section className="border-b border-[#26354a] px-5 py-5" aria-labelledby="team-invite-title">
      <div className="mb-4 flex items-start gap-3"><UserRoundPlus className="mt-0.5 h-5 w-5 text-orange-400" /><div><h3 id="team-invite-title" className="font-bold">Inviter un collaborateur</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Un développeur existant relie son compte. S’il n’en possède pas, l’invitation lui permet d’en créer un et de soumettre sa demande au programme Developer. Cette relation d’équipe ne génère aucune commission.</p></div></div>
      <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label className="sr-only" htmlFor="team-email">E-mail professionnel</label><input id="team-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required placeholder="developpeur@agence.com" className="h-11 min-w-0 rounded-md border border-[#33445c] bg-[#07101d] px-3 text-sm outline-none focus:border-orange-500" />
        <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'developer' | 'admin')} className="h-11 rounded-md border border-[#33445c] bg-[#07101d] px-3 text-sm outline-none focus:border-orange-500"><option value="developer">Développeur</option><option value="admin">Administrateur</option></select>
        <button disabled={busy === 'invite'} className="flex h-11 items-center justify-center gap-2 rounded-md bg-orange-600 px-5 text-sm font-bold hover:bg-orange-500 disabled:opacity-50">{busy === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Inviter</button>
      </form>
    </section> : <p className="flex items-center gap-2 border-b border-[#26354a] px-5 py-4 text-sm text-amber-300"><AlertCircle className="h-4 w-4" /> Seul le propriétaire peut gérer les accès.</p>}

    <section aria-labelledby="team-list-title"><h3 id="team-list-title" className="border-b border-[#26354a] px-5 py-4 text-sm font-bold text-slate-300">Équipe ({members.length})</h3><div className="divide-y divide-[#26354a]">
      {members.map((member) => {
        const pending = member.status === 'pending'; const owner = Boolean(member.isOwner); const connection = member.developerConnection; const keys = connection?.api_keys || [];
        return <article key={member.id} className="px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{connection?.developer_accounts?.company_name || connection?.developer_accounts?.display_name || member.email}</p><span className="rounded-sm bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{owner ? 'Propriétaire' : member.role}</span><span className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase ${pending ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{pending ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{pending ? 'Invitation en attente' : 'Actif'}</span></div><p className="mt-1 text-sm text-slate-400">{member.email}</p>{connection && <p className="mt-2 text-xs text-slate-500">Compte Developer : {connection.developer_accounts?.status || 'pending'} · {connection.commission_eligible ? 'Client du programme Developer' : 'Accès d’équipe non rémunéré'}</p>}</div>
            {isOwner && !owner && <div className="flex shrink-0 flex-wrap gap-2">{pending && <button type="button" onClick={() => handleResend(member)} disabled={busy === `resend:${member.id}`} className="flex h-9 items-center gap-2 rounded-md border border-[#33445c] px-3 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"><Mail className="h-4 w-4" /> Renvoyer</button>}<button type="button" onClick={() => handleRemove(member)} disabled={busy === `remove:${member.id}`} className="flex h-9 items-center gap-2 rounded-md border border-red-500/30 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Révoquer</button></div>}
          </div>
          {connection && member.role === 'developer' && !pending && <div className="mt-4 grid gap-4 border-t border-[#26354a] pt-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div><p className="text-xs font-bold uppercase text-slate-500">Permission sensible</p><label className="mt-3 flex items-center justify-between gap-3 text-sm"><span>Créer des retraits</span><button type="button" role="switch" aria-checked={connection.withdrawal_access} disabled={!isOwner || busy === `withdrawal:${member.id}`} onClick={() => handleWithdrawalAccess(member, !connection.withdrawal_access)} className={`relative h-6 w-11 rounded-full transition-colors ${connection.withdrawal_access ? 'bg-emerald-500' : 'bg-slate-700'} disabled:opacity-50`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${connection.withdrawal_access ? 'left-6' : 'left-1'}`} /><span className="sr-only">Autoriser les retraits</span></button></label><p className="mt-2 text-xs leading-5 text-slate-500">Désactivée par défaut. La suppression retire aussi ce droit.</p></div>
            <div><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><KeyRound className="h-4 w-4" /> Clés créées par ce développeur</p><span className="text-xs text-slate-500">{keys.filter((key) => !key.revoked_at).length} active(s)</span></div><div className="mt-2 divide-y divide-[#26354a] border-y border-[#26354a]">{keys.length ? keys.map((key) => <div key={key.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold">{key.name}</p><p className="mt-0.5 truncate font-mono text-xs text-slate-500">{key.prefix}•••• · {(key.scopes || []).join(', ')}</p></div>{key.revoked_at ? <span className="text-xs text-slate-500">Révoquée</span> : <button type="button" onClick={() => handleRevokeKey(member, key.id)} disabled={!isOwner || busy === `key:${key.id}`} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50">Révoquer</button>}</div>) : <p className="py-3 text-sm text-slate-500">Aucune clé créée.</p>}</div></div>
          </div>}
        </article>;
      })}
      {!members.length && <div className="px-5 py-12 text-center"><Code2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">Aucun collaborateur pour le moment.</p></div>}
    </div></section>
  </div>;
}
