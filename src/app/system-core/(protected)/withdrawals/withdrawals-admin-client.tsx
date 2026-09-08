'use client'

import { useState, useRef } from 'react';
import { CheckCircle2, XCircle, Banknote, Clock, AlertTriangle, X } from "lucide-react";

interface AdminWithdrawalsClientProps {
  withdrawals: any[];
  approveAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
  markAsPaidAction: (formData: FormData) => Promise<void>;
}

import { useRouter } from 'next/navigation';

function formatAmount(value: number | string | null | undefined, currency?: string | null): string {
  const amount = Number(value || 0);
  return currency === 'USD'
    ? amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`;
}

export function AdminWithdrawalsClient({
  withdrawals,
  approveAction,
  rejectAction,
  markAsPaidAction
}: AdminWithdrawalsClientProps) {
  const router = useRouter();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const formRef = useRef<HTMLFormElement>(null);

  const pendingApproval = withdrawals.filter(w => w.status === 'pending_approval').length;
  const pending = withdrawals.filter(w => w.status === 'pending').length;

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending_approval: { label: 'APPROBATION REQUISE', color: 'bg-red-500/10 text-red-400 border border-red-500/30' },
    pending:          { label: 'EN TRAITEMENT',       color: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
    completed:        { label: 'COMPLÉTÉ',            color: 'bg-green-500/10 text-green-400 border border-green-500/30' },
    paid:             { label: 'PAYÉ',                color: 'bg-green-500/10 text-green-400 border border-green-500/30' },
    rejected:         { label: 'REFUSÉ',              color: 'bg-slate-500/10 text-slate-400 border border-slate-500/30' },
    failed:           { label: 'ÉCHOUÉ',              color: 'bg-red-500/10 text-red-400 border border-red-500/30' },
  };

  const filteredWithdrawals = filterStatus === 'all'
    ? withdrawals
    : withdrawals.filter(w => w.status === filterStatus);

  const openRejectModal = (w: any) => {
    setRejectTarget(w);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    
    setLoadingAction(`reject-${rejectTarget.id}`);
    
    const formData = new FormData();
    formData.set('id', rejectTarget.id);
    formData.set('merchant_id', rejectTarget.merchant_id);
    formData.set('reason', rejectReason.trim());
    formData.set('total', String(rejectTarget.total || rejectTarget.amount));
    formData.set('environment', rejectTarget.environment || 'live');
    
    try {
      await rejectAction(formData);
      router.refresh(); // Forcer le rafraîchissement des données
    } catch (e) {
      console.error("Reject failed", e);
    } finally {
      setLoadingAction(null);
      setRejectModalOpen(false);
      setRejectTarget(null);
      setRejectReason('');
    }
  };

  const handleApprove = async (w: any) => {
    setLoadingAction(`approve-${w.id}`);
    const formData = new FormData();
    formData.set('id', w.id);
    formData.set('merchant_id', w.merchant_id);
    formData.set('total', String(w.total || w.amount));
    formData.set('environment', w.environment || 'live');
    
    try {
      await approveAction(formData);
      router.refresh();
    } catch (e) {
      console.error("Approve failed", e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMarkAsPaid = async (w: any) => {
    setLoadingAction(`paid-${w.id}`);
    const formData = new FormData();
    formData.set('id', w.id);
    formData.set('merchant_id', w.merchant_id);
    
    try {
      await markAsPaidAction(formData);
      router.refresh();
    } catch (e) {
      console.error("Mark as paid failed", e);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">PAYOUTS MANAGEMENT</h1>
        <div className="flex flex-wrap gap-3">
          {pendingApproval > 0 && (
            <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded border border-red-500/20 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {pendingApproval} APPROBATION REQUISE
            </div>
          )}
          {pending > 0 && (
            <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded border border-amber-500/20 text-xs font-bold">
              {pending} EN TRAITEMENT
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'pending_approval', 'pending', 'completed', 'paid', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors border ${
              filterStatus === s
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {s === 'all' ? 'TOUS' : statusConfig[s]?.label || s.toUpperCase()}
            {s !== 'all' && (
              <span className="ml-1.5 text-slate-500">
                ({withdrawals.filter(w => w.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs">RÉFÉRENCE</th>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs">MARCHAND</th>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs">MÉTHODE</th>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs">MONTANT</th>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs">STATUT</th>
              <th className="px-5 py-4 font-semibold tracking-wider text-xs text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredWithdrawals.map((w: any) => (
              <tr key={w.id} className={`hover:bg-slate-800/30 transition-colors ${w.status === 'pending_approval' ? 'bg-red-950/10' : ''}`}>
                <td className="px-5 py-4">
                  <div className="font-mono text-slate-200 text-xs">{w.kobara_reference || w.id.split('-')[0] + '...'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{new Date(w.created_at).toLocaleString('fr-FR')}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-300">{w.merchants?.business_name || 'Unknown'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{w.wallet || '—'}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    w.provider === 'natcash' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    w.provider === 'zelle'   ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    w.provider === 'b2b transfer' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {(w.provider || 'MONCASH').toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="font-bold text-slate-200">Débité : {formatAmount(w.total || w.amount, w.currency)}</div>
                  {w.fees > 0 && <div className="text-[10px] text-slate-500">Frais: {formatAmount(w.fees, w.currency)}</div>}
                  <div className="text-[10px] font-semibold text-emerald-400">À envoyer : {formatAmount(w.payout_amount || w.amount, w.payout_currency || w.currency)}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${statusConfig[w.status]?.color || 'bg-slate-500/10 text-slate-400'}`}>
                    {statusConfig[w.status]?.label || w.status.toUpperCase()}
                  </span>
                  {w.status === 'rejected' && w.rejection_reason && (
                    <div className="text-[10px] text-red-400/70 mt-1 max-w-[200px] truncate" title={w.rejection_reason}>
                      Raison: {w.rejection_reason}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Retraits manuels en attente d'approbation */}
                    {w.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={() => handleApprove(w)}
                          disabled={loadingAction === `approve-${w.id}`}
                          className="inline-flex items-center gap-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {loadingAction === `approve-${w.id}` ? '...' : 'APPROUVER'}
                        </button>
                        <button
                          onClick={() => openRejectModal(w)}
                          className="inline-flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> REFUSER
                        </button>
                      </>
                    )}

                    {/* MonCash en attente de confirmation */}
                    {w.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkAsPaid(w)}
                          disabled={loadingAction === `paid-${w.id}`}
                          className="inline-flex items-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-600/30 px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {loadingAction === `paid-${w.id}` ? '...' : 'MARK PAID'}
                        </button>
                        <button
                          onClick={() => openRejectModal(w)}
                          className="inline-flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> REFUSER
                        </button>
                      </div>
                    )}

                    {(w.status === 'paid' || w.status === 'completed') && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {w.completed_at ? new Date(w.completed_at).toLocaleString('fr-FR') : '—'}
                      </span>
                    )}

                    {w.status === 'rejected' && (
                      <span className="text-[10px] text-slate-500">Refusé</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredWithdrawals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Banknote className="w-6 h-6 opacity-20" />
                    <p>Aucune demande de retrait.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de refus avec raison obligatoire */}
      {rejectModalOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Refuser le retrait
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="text-slate-400">Marchand: <span className="text-white font-semibold">{rejectTarget.merchants?.business_name || 'N/A'}</span></div>
              <div className="text-slate-400">Montant: <span className="text-white font-bold">{formatAmount(rejectTarget.total || rejectTarget.amount, rejectTarget.currency)}</span></div>
              <div className="text-slate-400">À envoyer: <span className="text-emerald-400 font-bold">{formatAmount(rejectTarget.payout_amount || rejectTarget.amount, rejectTarget.payout_currency || rejectTarget.currency)}</span></div>
              <div className="text-slate-400">Méthode: <span className="text-white">{(rejectTarget.provider || 'N/A').toUpperCase()}</span></div>
              <div className="text-slate-400">Wallet: <span className="text-white">{rejectTarget.wallet || '—'}</span></div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Raison du refus <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Informations de compte invalides, montant suspect, vérification KYC insuffisante..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 resize-none"
                autoFocus
              />
              {rejectReason.trim().length === 0 && (
                <p className="text-[10px] text-red-400 mt-1">La raison est obligatoire pour refuser un retrait.</p>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-xs text-amber-300">
              <strong>⚠️ Attention :</strong> Le marchand recevra un email et une notification avec la raison du refus.
              {rejectTarget.status === 'pending' && ' Le montant sera recrédité sur son solde.'}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors border border-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || loadingAction === `reject-${rejectTarget.id}`}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingAction === `reject-${rejectTarget.id}` ? 'Refus en cours...' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
