import { Clock3, ShieldCheck } from 'lucide-react';
import { getMaintenanceState } from '@/lib/server/maintenance';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const state = await getMaintenanceState();
  return (
    <main className="min-h-[100dvh] bg-[#020B14] px-5 py-16 text-white flex items-center justify-center">
      <div className="w-full max-w-xl border border-slate-800 bg-[#07111F] p-8 sm:p-10 shadow-2xl">
        <div className="mb-8 flex h-12 w-12 items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-400">
          <Clock3 className="h-6 w-6" />
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-400">Kobara</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Maintenance en cours</h1>
        <p className="mt-4 leading-7 text-slate-300">{state.maintenance_message}</p>
        <div className="mt-8 flex gap-3 border-t border-slate-800 pt-6 text-sm text-slate-400">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>Les données et les soldes restent protégés. Les confirmations reçues des partenaires sont conservées pendant l’intervention.</p>
        </div>
      </div>
    </main>
  );
}
