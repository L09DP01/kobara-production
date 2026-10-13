'use client';

import { CircleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import type { WithdrawalFailureDetails } from '@/lib/withdrawal-failure-details';

export function WithdrawalFailureInfo({ reference, provider, details }: {
  reference: string; provider: string; details: WithdrawalFailureDetails;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" title="Afficher les détails de l’échec" aria-label={`Détails de l’échec du retrait ${reference}`} className="grid h-8 w-8 shrink-0 place-items-center rounded text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">
          <CircleAlert className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-slate-700 bg-slate-950 text-slate-100">
        <DialogHeader className="border-slate-700 bg-slate-900 pr-10 text-left">
          <DialogTitle className="text-lg">Détails du retrait échoué</DialogTitle>
          <DialogDescription className="break-words text-slate-400">{reference} · {provider || 'Fournisseur non renseigné'}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-4 p-5 text-sm">
          <div><dt className="mb-1 text-xs font-semibold text-slate-400">Motif enregistré</dt><dd className="whitespace-pre-wrap break-words text-slate-100">{details.reason}</dd></div>
          {details.httpStatus && <div><dt className="text-xs font-semibold text-slate-400">Code HTTP</dt><dd>{details.httpStatus}</dd></div>}
          {details.providerCode && <div><dt className="text-xs font-semibold text-slate-400">Code fournisseur</dt><dd className="break-words font-mono">{details.providerCode}</dd></div>}
          {details.providerMessage && details.providerMessage !== details.reason && <div><dt className="text-xs font-semibold text-slate-400">Message fournisseur</dt><dd className="break-words">{details.providerMessage}</dd></div>}
          <div><dt className="mb-1 text-xs font-semibold text-slate-400">Recrédit du solde</dt><dd>{details.refundedAt ? `Confirmé le ${new Date(details.refundedAt).toLocaleString('fr-FR', { timeZone: 'America/Port-au-Prince' })}, heure d’Haïti` : 'Aucune confirmation de recrédit enregistrée. Vérifiez le journal comptable.'}</dd></div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
