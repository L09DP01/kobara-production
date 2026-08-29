'use client';

import { useState, useEffect } from 'react';
import { Send, X, Users, CheckCircle2, ShieldCheck } from 'lucide-react';
import { generateTelegramLinkTokenAction } from '@/app/dashboard/settings/actions';
import { toast } from 'sonner';

interface TelegramConnectBannerProps {
  merchantId?: string;
  isTelegramLinked: boolean;
}

export function TelegramConnectBanner({
  merchantId,
  isTelegramLinked,
}: TelegramConnectBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si déjà connecté à Telegram, la bannière disparaît complètement
    if (isTelegramLinked) {
      setIsDismissed(true);
      return;
    }

    // Vérifier si le marchand l'a fermée temporairement dans cette session
    const dismissed = sessionStorage.getItem('kbr_telegram_banner_dismissed');
    if (!dismissed) {
      setIsDismissed(false);

      // Notification toast non-intrusive au premier chargement de la session
      const toastPromptShown = sessionStorage.getItem('kbr_telegram_toast_prompt_shown');
      if (!toastPromptShown) {
        sessionStorage.setItem('kbr_telegram_toast_prompt_shown', 'true');
        setTimeout(() => {
          toast('📱 Alertes de vente en direct sur Telegram', {
            description: 'Liez votre compte Telegram pour être notifié de chaque paiement MonCash & NatCash.',
            action: {
              label: 'Connecter',
              onClick: () => handleConnect(),
            },
            duration: 8000,
          });
        }, 1500);
      }
    }
  }, [isTelegramLinked]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('kbr_telegram_banner_dismissed', 'true');
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await generateTelegramLinkTokenAction();
      if (res?.telegramUrl) {
        toast.success('Ouverture directe de Telegram...');
        // Redirection directe immédiate sans blocage de pop-up par le navigateur
        window.location.href = res.telegramUrl;
      }
    } catch (err: any) {
      toast.error(err.message || 'Impossible de générer le lien Telegram.');
      setLoading(false);
    }
  };

  // Si déjà lié ou fermée par l'utilisateur avec la croix
  if (isTelegramLinked || isDismissed) {
    return null;
  }

  return (
    <div className="relative mx-4 sm:mx-6 lg:mx-8 mb-4 overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-slate-900/80 p-4 sm:p-5 shadow-lg shadow-blue-950/30 backdrop-blur-md transition-all">
      {/* Background Accent Glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

      {/* Close button (Petit X) */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer la notification"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        title="Masquer pour cette session"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-6 sm:pr-8">
        {/* Left: Icon & Text */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Activez vos alertes de paiement en direct sur Telegram
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                Assistant Live & Forum
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Soyez notifié instantanément de chaque encaissement MonCash & NatCash, créez des liens de paiement, gérez vos retraits sécurisés par OTP et échangez avec les marchands sur le canal officiel <strong>@KobaraCommunity</strong>.
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? 'Connexion...' : 'Lier mon Telegram'}
          </button>

          <a
            href="https://t.me/KobaraCommunity"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-950/40 px-3.5 py-2 text-xs font-bold text-blue-300 hover:bg-blue-900/50 hover:text-white transition-all"
          >
            <Users className="h-3.5 w-3.5" />
            Rejoindre le Forum
          </a>
        </div>
      </div>
    </div>
  );
}
