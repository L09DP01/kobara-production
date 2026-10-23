'use client';

import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createBusinessAction } from '@/app/dashboard/businesses/actions';

export function NewBusinessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const fieldClass = 'mt-1.5 w-full rounded-md border border-slate-700 bg-[#07101D] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    const form = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await createBusinessAction({ ...Object.fromEntries(form), requestId: requestId.current });
      if (result.error) { setError(result.error); setPending(false); return; }
      try { localStorage.setItem('kobara_business_context', result.merchantId!); } catch { /* Storage can be disabled. */ }
      window.location.assign('/dashboard/kyc');
    } catch { setError('Connexion interrompue. Vous pouvez réessayer.'); setPending(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-700 bg-[#111C2C] text-white sm:max-w-xl">
      <DialogHeader className="border-slate-700 bg-transparent text-left">
        <DialogTitle>Ajouter un business</DialogTitle>
        <DialogDescription className="pr-5 text-sm text-slate-400">Identité du propriétaire conservée. Validation de la nouvelle activité avant les paiements réels.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block text-sm font-medium">Nom du business<input name="business_name" autoComplete="organization" required maxLength={255} className={fieldClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Activité<select aria-label="Activité" name="category" required className={fieldClass} defaultValue=""><option value="" disabled>Choisir</option><option value="retail">Commerce</option><option value="services">Services</option><option value="education">Éducation</option><option value="digital">Produits numériques</option><option value="other">Autre</option></select></label>
          <label className="block text-sm font-medium">Téléphone professionnel<input name="phone" type="tel" autoComplete="tel" required minLength={8} maxLength={25} className={fieldClass} /></label>
        </div>
        <label className="block text-sm font-medium">Adresse professionnelle<input name="address" autoComplete="street-address" required minLength={5} maxLength={500} className={fieldClass} /></label>
        <label className="block text-sm font-medium">Site de l’activité <span className="font-normal text-slate-400">(facultatif)</span><input name="website" type="url" maxLength={500} placeholder="https://" className={fieldClass} /></label>
        <label className="block text-sm font-medium">Produits ou services proposés<textarea name="description" required minLength={20} maxLength={2000} rows={3} className={fieldClass} /></label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-700 pt-4">
          <button type="button" disabled={pending} onClick={() => onOpenChange(false)} className="rounded-md border border-slate-600 px-4 py-2.5 text-sm">Annuler</button>
          <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Créer le business</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
