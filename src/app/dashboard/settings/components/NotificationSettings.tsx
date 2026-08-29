'use client'

import { useEffect, useState } from 'react';
import {
  updateNotificationSettings,
  getTelegramLinkStatusAction,
  generateTelegramLinkTokenAction,
  unlinkTelegramAccountAction,
  toggleTelegramNotificationsAction,
} from '../actions';
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle, ExternalLink, RefreshCw, Bell, ShieldCheck } from 'lucide-react';

type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export function NotificationSettings({ settings }: { settings: any }) {
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<BrowserNotificationPermission>('unsupported');
  const [notifications, setNotifications] = useState(settings?.notifications_json || {
    payment_success: true,
    payment_failed: true,
    withdrawal_success: true,
    security_alerts: true
  });

  // Telegram State
  const [telegramStatus, setTelegramStatus] = useState<{
    linked: boolean;
    telegramUsername: string | null;
    firstName: string | null;
    notificationsEnabled: boolean;
    linkedAt: string | null;
    botUsername: string;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }

    loadTelegramStatus();
  }, []);

  const loadTelegramStatus = async () => {
    try {
      const status = await getTelegramLinkStatusAction();
      setTelegramStatus(status);
    } catch (err) {
      console.error("Failed to load telegram status:", err);
    }
  };

  const handleConnectTelegram = async () => {
    try {
      setTelegramLoading(true);
      const res = await generateTelegramLinkTokenAction();
      if (res?.telegramUrl) {
        toast.success("Ouverture directe de Telegram...");
        // Redirection directe vers l'application Telegram sans blocage de pop-up
        window.location.href = res.telegramUrl;
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible de générer le lien Telegram.");
      setTelegramLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm("Voulez-vous vraiment dissocier votre compte Telegram ?")) return;
    try {
      setTelegramLoading(true);
      await unlinkTelegramAccountAction();
      toast.success("Compte Telegram dissocié avec succès.");
      await loadTelegramStatus();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la dissociation.");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleToggleTelegramNotifications = async () => {
    if (!telegramStatus?.linked) return;
    try {
      const nextState = !telegramStatus.notificationsEnabled;
      await toggleTelegramNotificationsAction(nextState);
      setTelegramStatus((prev: any) => ({ ...prev, notificationsEnabled: nextState }));
      toast.success(nextState ? "Notifications Telegram activées." : "Notifications Telegram désactivées.");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleToggle = (key: string) => {
    setNotifications((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error("Les notifications navigateur ne sont pas supportées sur cet appareil.");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      toast.success("Notifications PWA activées.");
      new Notification('Kobara', {
        body: 'Les notifications de la PWA sont maintenant actives.',
      });
    } else {
      toast.error("Notifications refusées. Vous pouvez les autoriser depuis les paramètres du navigateur.");
    }
  };

  const handleTestBrowserNotification = () => {
    if (permission !== 'granted') {
      toast.error("Activez d'abord les notifications PWA.");
      return;
    }

    new Notification('Kobara', {
      body: 'Notification test: votre PWA peut afficher les alertes.',
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateNotificationSettings(notifications);
      toast.success("Préférences de notifications sauvegardées !");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Telegram Bot Integration Card (Live Only Assistant) */}
      <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 rounded-3xl border border-blue-500/30 p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <Send className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Bot Assistant Telegram</h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  Mode Réel (Live Only)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Connectez votre compte marchand pour recevoir vos alertes de paiement en temps réel, consulter votre solde réel, générer des liens de paiement et demander des retraits sécurisés par OTP directement dans Telegram.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {telegramStatus?.linked ? (
              <button
                type="button"
                onClick={handleUnlinkTelegram}
                disabled={telegramLoading}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Dissocier
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectTelegram}
                disabled={telegramLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {telegramLoading ? 'Connexion...' : 'Connecter mon Telegram'}
              </button>
            )}
          </div>
        </div>

        {/* Telegram Status Info */}
        <div className="rounded-2xl border border-blue-500/20 bg-slate-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {telegramStatus?.linked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <span className="text-white font-bold">Compte associé : </span>
                  <span className="text-blue-400 font-mono">
                    {telegramStatus.telegramUsername ? `@${telegramStatus.telegramUsername}` : (telegramStatus.firstName || 'Connecté')}
                  </span>
                  {telegramStatus.linkedAt && (
                    <span className="text-slate-500 ml-2 text-[11px]">
                      (depuis le {new Date(telegramStatus.linkedAt).toLocaleDateString('fr-HT')})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-slate-400">Aucun compte Telegram lié pour le moment.</span>
              </>
            )}
          </div>

          {telegramStatus?.linked && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 font-medium flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramStatus.notificationsEnabled}
                  onChange={handleToggleTelegramNotifications}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                Alertes push instantanées
              </label>
              <button
                type="button"
                onClick={loadTelegramStatus}
                className="text-slate-500 hover:text-white transition-colors"
                title="Actualiser le statut"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Standard Notification Preferences */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Préférences de notifications</h2>
            <p className="text-sm text-slate-400">Choisissez les alertes email et activez les notifications de la PWA sur cet appareil.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Notifications PWA</h3>
            <p className="text-sm text-slate-400 mt-1">
              {permission === 'granted'
                ? "Les notifications navigateur sont actives sur cet appareil."
                : permission === 'denied'
                  ? "Les notifications sont bloquées dans le navigateur."
                  : permission === 'default'
                    ? "Autorisez les notifications pour recevoir les alertes sur la PWA."
                    : "Ce navigateur ne supporte pas les notifications PWA."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleEnableBrowserNotifications}
              disabled={permission === 'unsupported' || permission === 'granted'}
              className="bg-white text-black px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {permission === 'granted' ? 'Activées' : 'Activer PWA'}
            </button>
            <button
              type="button"
              onClick={handleTestBrowserNotification}
              disabled={permission !== 'granted'}
              className="bg-white/10 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              Tester
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'payment_success', label: 'Paiements réussis', desc: 'Recevoir un email lorsqu\'un client paie avec succès.' },
            { key: 'payment_failed', label: 'Paiements échoués', desc: 'Être alerté lors d\'un échec de paiement.' },
            { key: 'withdrawal_success', label: 'Retraits traités', desc: 'Notification quand un retrait arrive sur votre compte.' },
            { key: 'security_alerts', label: 'Alertes de sécurité', desc: 'Connexions inhabituelles ou changements importants.' }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
              <div>
                <h3 className="text-base font-bold text-white">{item.label}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={notifications[item.key]} 
                  onChange={() => handleToggle(item.key)} 
                />
                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/10 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
