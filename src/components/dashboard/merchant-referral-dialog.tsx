'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, Mail, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { updateMerchantReferralCode } from '@/app/dashboard/referrals/actions';

export type MerchantReferralSummary = {
  code: string;
  invitedCount: number;
  earnedHtg: number;
  ownQualifyingHtg: number;
};

export function MerchantReferralDialog({
  open,
  onOpenChange,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: MerchantReferralSummary;
}) {
  const [code, setCode] = useState(summary.code);
  const [savedCode, setSavedCode] = useState(summary.code);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setCode(summary.code);
    setSavedCode(summary.code);
  }, [summary.code]);

  const referralUrl = useMemo(() => `https://kobara.app/r/${savedCode}`, [savedCode]);
  const shareText = `Rejoignez Kobara avec mon invitation : ${referralUrl}`;
  const encodedUrl = encodeURIComponent(referralUrl);
  const encodedText = encodeURIComponent(shareText);

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success('Lien copié.');
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function saveCode() {
    setSaving(true);
    const result = await updateMerchantReferralCode(code);
    setSaving(false);
    if (result.error || !result.code) {
      toast.error(result.error || 'Impossible de modifier le lien.');
      return;
    }
    setCode(result.code);
    setSavedCode(result.code);
    toast.success('Votre lien a été mis à jour.');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-[#29384e] bg-[#0b1524] text-white sm:max-w-xl">
        <DialogHeader className="border-[#29384e] bg-[#0d192a] pr-12 text-left">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
            <Gift className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-bold">Recevez 675 Gdes</DialogTitle>
          <DialogDescription className="text-slate-400">
            Invitez un marchand et suivez votre récompense depuis un seul endroit.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 py-5">
          <div className="grid grid-cols-2 border-y border-[#29384e] py-4">
            <div className="border-r border-[#29384e] pr-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Personnes invitées</p>
              <p className="mt-1 text-2xl font-bold">{summary.invitedCount}</p>
            </div>
            <div className="pl-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Commissions reçues</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{summary.earnedHtg.toLocaleString('fr-FR')} Gdes</p>
            </div>
          </div>

          <section aria-labelledby="referral-link-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 id="referral-link-title" className="text-sm font-bold">Votre lien de parrainage</h3>
              <span className="text-xs text-slate-500">Référence personnalisable</span>
            </div>
            <div className="flex min-w-0 items-stretch rounded-md border border-[#34445d] bg-[#07101d] focus-within:border-orange-500">
              <span className="hidden items-center border-r border-[#34445d] px-3 text-xs text-slate-500 sm:flex">kobara.app/r/</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                aria-label="Référence du lien"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                maxLength={40}
              />
              <button type="button" onClick={copyLink} className="flex h-11 w-11 shrink-0 items-center justify-center border-l border-[#34445d] text-slate-300 hover:text-white" title="Copier le lien">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setShareOpen((value) => !value)} className="flex h-11 w-11 shrink-0 items-center justify-center border-l border-[#34445d] text-slate-300 hover:text-white" title="Partager le lien" aria-expanded={shareOpen}>
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={saveCode} disabled={saving || code === savedCode} className="h-9 rounded-md bg-orange-500 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? 'Enregistrement...' : 'Enregistrer la référence'}
              </button>
            </div>

            {shareOpen && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-y border-[#29384e] py-3 sm:grid-cols-4">
                <a href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noreferrer" className="rounded-md bg-[#132033] px-3 py-2 text-center text-sm font-semibold hover:bg-[#192a41]">WhatsApp</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer" className="rounded-md bg-[#132033] px-3 py-2 text-center text-sm font-semibold hover:bg-[#192a41]">Facebook</a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noreferrer" className="rounded-md bg-[#132033] px-3 py-2 text-center text-sm font-semibold hover:bg-[#192a41]">LinkedIn</a>
                <a href={`mailto:?subject=${encodeURIComponent('Invitation Kobara')}&body=${encodedText}`} className="flex items-center justify-center gap-2 rounded-md bg-[#132033] px-3 py-2 text-sm font-semibold hover:bg-[#192a41]"><Mail className="h-4 w-4" /> E-mail</a>
              </div>
            )}
          </section>

          <section aria-labelledby="referral-faq-title" className="border-t border-[#29384e] pt-5">
            <h3 id="referral-faq-title" className="mb-2 text-sm font-bold">Questions fréquentes</h3>
            <details className="border-b border-[#29384e] py-3">
              <summary className="cursor-pointer text-sm font-semibold">Quand les 675 Gdes sont-ils versés ?</summary>
              <p className="mt-2 text-sm leading-6 text-slate-400">L’invité doit activer Pro et recevoir 10 000 HTG ou 50 USD. Votre entreprise doit aussi avoir encaissé 1 500 HTG via ses propres liens ou clés API. Les paiements créés avec une clé Developer ne comptent pas.</p>
            </details>
            <details className="border-b border-[#29384e] py-3">
              <summary className="cursor-pointer text-sm font-semibold">Comment mon invité est-il reconnu ?</summary>
              <p className="mt-2 text-sm leading-6 text-slate-400">Il doit créer son compte à partir de votre lien. La première attribution enregistrée reste définitive.</p>
            </details>
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
