'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { createAdministrator, setAdministratorActive, type AdministratorActionResult } from './actions';

export type Administrator = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'operations' | 'compliance' | 'support';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
};

const initialState: AdministratorActionResult = { success: false };

export default function AdministratorsClient({
  initialAdministrators,
  currentAdministratorId,
}: {
  initialAdministrators: Administrator[];
  currentAdministratorId: string;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(createAdministrator, initialState);
  const [mutationState, setMutationState] = useState<AdministratorActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (administrator: Administrator) => {
    setMutationState(null);
    setPendingId(administrator.id);
    startTransition(async () => {
      const result = await setAdministratorActive(administrator.id, !administrator.is_active);
      setMutationState(result);
      setPendingId(null);
      if (result.success) router.refresh();
    });
  };

  const feedback = mutationState || (createState.message || createState.error || createState.warning ? createState : null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ADMINISTRATEURS</h1>
        <p className="mt-1 text-sm text-slate-500">Accès et responsabilités du panneau système.</p>
      </div>

      {feedback && (
        <div className={`flex items-start gap-3 border p-4 text-sm ${feedback.error ? 'border-red-900/60 bg-red-950/30 text-red-300' : feedback.warning ? 'border-amber-900/60 bg-amber-950/30 text-amber-300' : 'border-green-900/60 bg-green-950/30 text-green-300'}`}>
          {feedback.error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <div><div>{feedback.error || feedback.message}</div>{feedback.warning && <div className="mt-1">{feedback.warning}</div>}</div>
        </div>
      )}

      <form action={createAction} className="grid gap-3 border border-slate-800 bg-slate-900 p-5 md:grid-cols-4">
        <input name="name" maxLength={120} placeholder="Nom" className="border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        <input name="email" type="email" required placeholder="E-mail" className="border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        <select name="role" defaultValue="operations" className="border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="super_admin">Super administrateur</option>
          <option value="operations">Opérations</option>
          <option value="compliance">Conformité</option>
          <option value="support">Support</option>
        </select>
        <button disabled={createPending} className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-50">
          {createPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Ajouter
        </button>
      </form>

      <div className="border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase text-slate-500 md:grid-cols-[minmax(0,1fr)_160px_100px_190px_auto]">
          <span>Administrateur</span><span className="hidden md:block">Rôle</span><span className="hidden md:block">Statut</span><span className="hidden md:block">Dernière connexion</span><span>Action</span>
        </div>
        {initialAdministrators.map((administrator) => (
          <div key={administrator.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-800 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_160px_100px_190px_auto]">
            <div className="min-w-0"><div className="truncate font-bold text-white">{administrator.name || administrator.email}</div><div className="truncate text-xs text-slate-500">{administrator.email}</div></div>
            <span className="hidden text-xs uppercase text-slate-400 md:block">{administrator.role.replace('_', ' ')}</span>
            <span className={`hidden text-xs font-bold md:block ${administrator.is_active ? 'text-green-400' : 'text-red-400'}`}>{administrator.is_active ? 'ACTIF' : 'INACTIF'}</span>
            <span className="hidden text-xs text-slate-500 md:block">{administrator.last_login_at ? new Date(administrator.last_login_at).toLocaleString('fr-FR') : 'Jamais connecté'}</span>
            <button
              type="button"
              title={administrator.id === currentAdministratorId && administrator.is_active ? 'Votre propre compte ne peut pas être désactivé' : undefined}
              disabled={pending || (administrator.id === currentAdministratorId && administrator.is_active)}
              onClick={() => toggle(administrator)}
              className="flex min-w-24 items-center justify-center gap-2 border border-slate-700 px-3 py-2 text-xs hover:border-slate-500 disabled:opacity-30"
            >
              {pendingId === administrator.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {administrator.is_active ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
