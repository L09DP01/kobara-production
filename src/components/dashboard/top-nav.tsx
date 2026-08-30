'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { performFullLogout } from '@/lib/utils/logout-client';
import { markNotificationAsReadAction, markAllNotificationsAsReadAction } from './actions';
import { siteConfig } from '@/config/site';

export default function TopNav({ onToggleSidebar, merchant, user, initialNotifications = [], accessibleMerchants = [], userRole = 'owner' }: { onToggleSidebar: () => void, merchant?: any, user?: any, initialNotifications?: any[], accessibleMerchants?: any[], userRole?: string }) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex min-h-10 items-center gap-3 rounded-lg transition-colors duration-150 hover:bg-white/5 focus:outline-none sm:px-2"
            >
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-white leading-tight">{merchant?.business_name || 'Business'}</p>
                <p className="text-[11px] font-medium text-slate-400 leading-tight">Marchand</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#314158] bg-slate-100 font-bold text-slate-700">
                {merchant?.logo_url ? (
                  <img alt="User profile" className="w-full h-full object-cover" src={merchant.logo_url} />
                ) : (
                  merchant?.business_name ? merchant.business_name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-card border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50 py-2">
                <div className="px-4 py-3 border-b border-border-subtle mb-2">
                  <p className="text-body-sm font-medium text-text-primary truncate">{merchant?.business_name || 'Business'} <span className="ml-2 text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">{userRole === 'owner' ? 'Propriétaire' : userRole === 'admin' ? 'Administrateur' : 'Développeur'}</span></p>
                  <p className="text-[12px] text-text-secondary truncate">{merchant?.email || 'email@example.com'}</p>
                </div>

                {accessibleMerchants && accessibleMerchants.length > 1 && (
                  <div className="px-2 py-2 border-b border-border-subtle mb-2">
                    <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Changer de compte</p>
                    {accessibleMerchants.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          document.cookie = `kobara_active_merchant=${m.id}; path=/; max-age=31536000`;
                          window.location.href = '/dashboard';
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${m.id === merchant?.id ? 'bg-orange-500/10 text-orange-400 font-bold' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <span className="truncate">{m.business_name}</span>
                        <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded ml-2 shrink-0">
                          {m.role === 'owner' ? 'Propriétaire' : m.role === 'admin' ? 'Admin' : 'Développeur'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col px-2">
                  <Link href="/settings" className="px-3 py-2 text-body-sm text-text-primary hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">account_circle</span>
                    Mon profil
                  </Link>
                  <Link href="/billing" className="px-3 py-2 text-body-sm text-text-primary hover:bg-surface-container-low rounded-lg transition-colors flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">credit_card</span>
                      Plan Actuel
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">
                      {merchant?.plan_slug || 'FREE'}
                    </span>
                  </Link>
                  <Link href="/billing" className="px-3 py-2 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined text-[16px]">upgrade</span>
                    Upgrade / Voir les plans
                  </Link>
                  <div className="h-px bg-border-subtle my-2 mx-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-body-sm text-status-error hover:bg-status-error/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
