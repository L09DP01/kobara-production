import { AlertTriangle, BellRing, CalendarClock, CircleCheck, Power } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getMaintenanceState } from '@/lib/server/maintenance';
import { isMaintenanceActive } from '@/lib/maintenance-state';
import { savePlatformAlertSettings, setPlatformMaintenance } from '../health/maintenance-actions';

export const dynamic = 'force-dynamic';

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function SystemAlertsPage() {
  const [state, session] = await Promise.all([getMaintenanceState(), requireAdmin()]);
  const active = isMaintenanceActive(state);
  const canManage = session.user.role === 'super_admin';
  const toggleAction = setPlatformMaintenance.bind(null, !active);
  const inputClass = 'mt-2 w-full border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-orange-500 disabled:opacity-50';

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-orange-400"><BellRing className="h-5 w-5" /><span className="text-xs font-bold tracking-widest">COMMUNICATION SYSTÈME</span></div>
        <h1 className="mt-2 text-2xl font-bold text-white">ALERTS & MAINTENANCE</h1>
      </header>

      <section className={`border p-5 ${active ? 'border-red-500/50 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/10'}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            {active ? <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" /> : <CircleCheck className="h-6 w-6 shrink-0 text-emerald-400" />}
            <div><h2 className="font-bold text-white">{active ? 'SERVICES SUSPENDUS' : 'SERVICES OPÉRATIONNELS'}</h2><p className="mt-1 text-sm text-slate-400">{active ? state.maintenance_message : 'Les paiements, retraits, connexions et inscriptions sont actifs.'}</p></div>
          </div>
          <form action={toggleAction} className="w-full lg:w-auto">
            <button disabled={!canManage} className={`flex w-full items-center justify-center gap-2 border px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-60 ${active ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-red-500 bg-red-600 text-white'}`}>
              <Power className="h-4 w-4" />{active ? 'RÉACTIVER LE SYSTÈME' : 'PAUSER LE SYSTÈME'}
            </button>
          </form>
        </div>
      </section>

      <form action={savePlatformAlertSettings} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5 border border-slate-800 bg-slate-900 p-5">
          <div><h2 className="font-bold text-white">MESSAGE PUBLIC</h2><p className="mt-1 text-xs text-slate-500">Ce contenu apparaît dans la bannière publique et sur la page de maintenance.</p></div>
          <label className="block text-xs font-bold text-slate-400">TITRE<input name="title" required maxLength={120} defaultValue={state.title} disabled={!canManage} className={inputClass} /></label>
          <label className="block text-xs font-bold text-slate-400">MESSAGE D’ANNONCE<textarea name="message" required maxLength={500} rows={4} defaultValue={state.message} disabled={!canManage} className={inputClass} /></label>
          <label className="block text-xs font-bold text-slate-400">MESSAGE PENDANT LA PAUSE<textarea name="maintenance_message" required maxLength={500} rows={4} defaultValue={state.maintenance_message} disabled={!canManage} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300"><input type="checkbox" name="announcement_enabled" defaultChecked={state.announcement_enabled} disabled={!canManage} className="mt-1" /><span><strong className="block text-white">Afficher l’annonce</strong>Bannière visible sans suspendre les services.</span></label>
            <label className="flex items-start gap-3 border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300"><input type="checkbox" name="auto_start" defaultChecked={state.auto_start} disabled={!canManage} className="mt-1" /><span><strong className="block text-white">Pause automatique</strong>Active la maintenance à la date prévue.</span></label>
          </div>
          <label className="block text-xs font-bold text-slate-400"><span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />DATE PROGRAMMÉE</span><input type="datetime-local" name="scheduled_for" defaultValue={toDateTimeLocal(state.scheduled_for)} disabled={!canManage} className={inputClass} /></label>
          <button disabled={!canManage} className="border border-orange-500 bg-orange-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">ENREGISTRER L’ALERTE</button>
        </section>

        <aside className="h-fit border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-bold tracking-widest text-slate-500">APERÇU</div>
          <div className={`mt-4 border p-4 ${active ? 'border-red-500/40 bg-red-950/30' : 'border-amber-500/40 bg-amber-950/20'}`}>
            <div className="flex items-start gap-3"><AlertTriangle className={`h-5 w-5 shrink-0 ${active ? 'text-red-400' : 'text-amber-400'}`} /><div><p className="text-sm font-bold text-white">{active ? 'Maintenance en cours' : state.title}</p><p className="mt-2 text-xs leading-relaxed text-slate-300">{active ? state.maintenance_message : state.message}</p></div></div>
          </div>
          <dl className="mt-5 space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-slate-500">Annonce</dt><dd className="text-slate-200">{state.announcement_enabled ? 'Visible' : 'Masquée'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Automatisation</dt><dd className="text-slate-200">{state.auto_start ? 'Active' : 'Inactive'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Programmation</dt><dd className="text-right text-slate-200">{state.scheduled_for ? new Date(state.scheduled_for).toLocaleString('fr-HT') : 'Aucune'}</dd></div></dl>
        </aside>
      </form>
      {!canManage && <p className="text-xs text-slate-500">Modification réservée au super administrateur.</p>}
    </div>
  );
}
