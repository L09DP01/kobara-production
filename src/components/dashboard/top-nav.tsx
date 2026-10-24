'use client';

import { useState, useRef, useEffect } from 'react';
import { businessEnvironmentLabel } from '@/lib/business-status';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { performFullLogout } from '@/lib/utils/logout-client';
import { markNotificationAsReadAction, markAllNotificationsAsReadAction } from './actions';
import { siteConfig } from '@/config/site';
import { MerchantReferralDialog, type MerchantReferralSummary } from './merchant-referral-dialog';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { switchBusinessAction } from '@/app/dashboard/businesses/actions';
import { NewBusinessDialog } from './new-business-dialog';

const EMPTY_NOTIFICATIONS: any[] = [];

export default function TopNav({ onToggleSidebar, merchant, user, initialNotifications = EMPTY_NOTIFICATIONS, accessibleMerchants = [], userRole = 'owner', referralSummary = null }: { onToggleSidebar: () => void, merchant?: any, user?: any, initialNotifications?: any[], accessibleMerchants?: any[], userRole?: string, referralSummary?: MerchantReferralSummary | null }) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isNewBusinessOpen, setIsNewBusinessOpen] = useState(false);
  const [switchingBusiness, setSwitchingBusiness] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState('');
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setNotifications(initialNotifications); }, [initialNotifications]);
  useEffect(() => {
    const onBusinessChange = (event: StorageEvent) => {
      if (event.key === 'kobara_business_context' && event.newValue && event.newValue !== merchant?.id) window.location.assign('/dashboard');
    };
    window.addEventListener('storage', onBusinessChange);
    return () => window.removeEventListener('storage', onBusinessChange);
  }, [merchant?.id]);
  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (profileRef.current?.contains(document.activeElement)) profileButtonRef.current?.focus();
        setIsProfileOpen(false); setIsNotifOpen(false);
      }
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  const switchBusiness = async (id: string) => {
    if (switchingBusiness || id === merchant?.id) return;
    setSwitchingBusiness(id); setBusinessError('');
    try {
      const result = await switchBusinessAction(id);
      if (result.error) { setBusinessError(result.error); setSwitchingBusiness(null); return; }
      try { localStorage.setItem('kobara_business_context', id); } catch { /* Storage can be disabled. */ }
      window.location.assign('/dashboard');
    } catch { setBusinessError('Impossible de changer de business. Réessayez.'); setSwitchingBusiness(null); }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsProfileOpen(false);
    await performFullLogout();
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await markNotificationAsReadAction(id);
  };

  const markAllAsRead = async () => {
    if (merchant?.id) {
      setNotifications([]);
      await markAllNotificationsAsReadAction(merchant.id);
    }
  };

  const getNotifStyle = (type: string) => {
    switch (type) {
      case 'payment_received': return { icon: 'payments', bg: 'bg-status-success/20 text-status-success', dot: 'bg-status-success' };
      case 'security_alert': return { icon: 'shield', bg: 'bg-status-error/20 text-status-error', dot: 'bg-status-error' };
      case 'kyc_reminder':
      case 'kyc_success': return { icon: 'how_to_reg', bg: 'bg-primary-fixed/30 text-primary', dot: 'bg-primary' };
      case 'plan_activated': return { icon: 'workspace_premium', bg: 'bg-secondary-fixed/30 text-secondary', dot: 'bg-secondary' };
      default: return { icon: 'notifications', bg: 'bg-surface-container text-text-secondary', dot: 'bg-text-secondary' };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffInMinutes = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (diffInMinutes < 1) return "À l'instant";
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours} h`;
    return `Il y a ${Math.floor(diffInHours / 24)} j`;
  };

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#223047] bg-[#07101D]/90 px-4 text-white backdrop-blur-xl transition-colors duration-200 sm:px-6 lg:px-8">
      {/* Left: Greeting / Search */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Mobile menu toggle */}
        <button 
          onClick={onToggleSidebar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Mobile Logo */}
        <a href={siteConfig.url} className="lg:hidden flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Kobara Logo"
            className="h-auto w-24 object-contain"
          />
        </a>

      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex items-center gap-1 sm:gap-2">
          {referralSummary && userRole === 'owner' && (
            <button
              type="button"
              onClick={() => setIsReferralOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 text-xs font-bold text-orange-300 transition-colors hover:bg-orange-500/20 lg:hidden"
              aria-label="Recevez 675 Gdes en invitant un marchand"
            >
              <span className="material-symbols-outlined text-[17px]">redeem</span>
              <span><span className="hidden min-[430px]:inline">Recevez </span>675 Gdes</span>
            </button>
          )}
          
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-card border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50">
                <div className="p-4 border-b border-border-subtle flex justify-between items-center">
                  <h3 className="font-headline-sm text-text-primary">Notifications</h3>
                  {notifications.length > 0 && (
                    <button onClick={markAllAsRead} className="text-[12px] font-medium text-primary hover:underline transition-all">
                      Tout effacer
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-30">notifications_off</span>
                      <p className="text-sm font-medium">Aucune notification</p>
                      <p className="text-xs opacity-70 mt-1">Vous n'avez aucune notification non lue.</p>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const style = getNotifStyle(notif.type);
                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsNotifOpen(false);
                            if (notif.type.includes('payment')) router.push('/payments');
                            else if (notif.type.includes('withdrawal')) router.push('/withdrawals');
                            else if (notif.type.includes('kyc') || notif.type.includes('security')) router.push('/settings');
                            else router.push('/dashboard');
                          }}
                          className="block p-4 hover:bg-surface-container-lowest transition-colors border-b border-border-subtle last:border-0 relative group cursor-pointer"
                        >
                          <div className="flex gap-3 items-start">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                              <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
                            </div>
                            <div className="min-w-0 flex-1 pr-6">
                              <p className="font-body-base text-body-base text-text-primary font-bold">{notif.title}</p>
                              <p className="text-body-sm text-text-secondary mt-0.5 line-clamp-2 leading-snug">{notif.message}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">{formatTimeAgo(notif.created_at)}</p>
                              </div>
                            </div>
                            {/* Unread indicator */}
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-2 ${style.dot}`}></div>
                            
                            {/* Hover action to dismiss */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                              }}
                              className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 p-1.5 bg-surface-container hover:bg-border-subtle rounded-md transition-all text-text-secondary hover:text-text-primary"
                              title="Marquer comme lu et effacer"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <Link href="/settings" className="hidden h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white sm:flex" aria-label="Paramètres">
            <span className="material-symbols-outlined text-[24px]">settings</span>
          </Link>
          
          <div ref={profileRef} className="relative sm:ml-1">
            <button 
              ref={profileButtonRef}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-expanded={isProfileOpen}
              aria-controls="business-switcher"
              aria-label="Choisir un business"
              className="flex min-h-10 items-center gap-3 rounded-lg transition-colors duration-150 hover:bg-white/5 focus-visible:outline focus-visible:outline-orange-400 sm:px-2"
            >
              <div className="hidden max-w-48 sm:block text-right">
                <p className="truncate text-sm font-bold text-white leading-tight">{merchant?.business_name || 'Business'}</p>
                <p className="text-[11px] font-medium text-slate-400 leading-tight">Marchand</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#314158] bg-slate-100 font-bold text-slate-700">
                {merchant?.logo_url ? (
                  <img alt="User profile" className="w-full h-full object-cover" src={merchant.logo_url} />
                ) : (
                  merchant?.business_name ? merchant.business_name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isProfileOpen && (
              <div id="business-switcher" className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[#314158] bg-[#111C2C] py-2 text-white shadow-xl">
                <div className="mb-2 border-b border-slate-700 px-4 py-3">
                  <p className="truncate text-sm font-medium text-white">{merchant?.business_name || 'Business'} <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{userRole === 'owner' ? 'Propriétaire' : userRole === 'admin' ? 'Administrateur' : 'Développeur'}</span></p>
                  {merchant?.email && <p className="truncate text-xs text-slate-400">{merchant.email}</p>}
                </div>

                <div className="mb-2 border-b border-slate-700 px-2 py-2">
                    <p className="mb-2 px-2 text-xs font-semibold text-slate-400">Mes business</p>
                    <div className="max-h-[min(40dvh,320px)] overflow-y-auto">
                    {accessibleMerchants.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => switchBusiness(m.id)}
                        disabled={!!switchingBusiness}
                        aria-current={m.id === merchant?.id ? 'true' : undefined}
                        className={`flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-orange-400 disabled:opacity-70 ${m.id === merchant?.id ? 'bg-orange-500/10 text-orange-400' : 'text-slate-200 hover:bg-white/5'}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-600 bg-slate-800 text-xs font-bold text-white">{m.logo_url ? <img src={m.logo_url} alt="" className="h-full w-full object-cover" /> : String(m.business_name || 'Business').split(/\s+/).slice(0, 2).map((word: string) => word[0]).join('').toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.business_name}</span><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] ${m.kyc_status === 'approved' && m.current_environment === 'live' && !m.shopify_review_mode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>{businessEnvironmentLabel(m)}</span></span>
                        {switchingBusiness === m.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : m.id === merchant?.id ? <Check className="h-4 w-4 shrink-0 text-orange-400" aria-label="Business actif" /> : null}
                      </button>
                    ))}
                    </div>
                    {userRole === 'owner' && <button type="button" onClick={() => { setIsProfileOpen(false); setIsNewBusinessOpen(true); }} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-orange-400 hover:bg-orange-500/10"><span className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-orange-500/60"><Plus className="h-4 w-4" /></span>Ajouter un business</button>}
                    {businessError && <p role="alert" className="px-3 py-2 text-xs text-red-300">{businessError}</p>}
                </div>
                
                <div className="flex flex-col px-2">
                  {referralSummary && userRole === 'owner' && (
                    <button
                      type="button"
                      onClick={() => { setIsProfileOpen(false); setIsReferralOpen(true); }}
                      className="hidden w-full items-center justify-between rounded-lg px-3 py-2 text-left text-body-sm text-orange-300 transition-colors hover:bg-orange-500/10 lg:flex"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">redeem</span>
                        Recevez 675 Gdes
                      </span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  )}
                  <Link href="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors hover:bg-white/5">
                    <span className="material-symbols-outlined text-[18px]">account_circle</span>
                    Mon profil
                  </Link>
                  <div className="mx-1 my-2 h-px bg-slate-700"></div>
                  <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full text-left px-3 py-2 text-body-sm text-status-error hover:bg-status-error/10 rounded-lg transition-colors flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    <NewBusinessDialog open={isNewBusinessOpen} onOpenChange={setIsNewBusinessOpen} />
    {referralSummary && (
      <MerchantReferralDialog open={isReferralOpen} onOpenChange={setIsReferralOpen} summary={referralSummary} />
    )}
    </>
  );
}
