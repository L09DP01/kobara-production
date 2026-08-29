'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toggleMerchantPayPal } from './actions';

export function MerchantPayPalToggle({ 
  merchantId, 
  initialEnabled,
}: { 
  merchantId: string; 
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setFeedback(null);

    const targetStatus = !enabled;
    const res = await toggleMerchantPayPal(merchantId, targetStatus);

    setLoading(false);
    if (res.success) {
      setEnabled(targetStatus);
      setFeedback({
        type: 'success',
        message: targetStatus
          ? 'Accès international autorisé. Cette autorisation reste active indépendamment du réglage global.'
          : 'Accès international suspendu pour ce marchand.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Erreur lors du changement de statut.',
      });
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded text-xs font-bold transition-all border shadow-sm ${
          enabled
            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
        } disabled:opacity-50`}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Mise à jour en cours...</span>
          </>
        ) : (
          <span>{enabled ? 'DÉSACTIVER PAYPAL' : 'ACTIVER PAYPAL POUR CE MARCHAND'}</span>
        )}
      </button>

      {feedback && (
        <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 border animate-in fade-in duration-150 ${
          feedback.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
