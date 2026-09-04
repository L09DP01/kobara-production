"use client";

import { useState, useEffect } from "react";
import { DesktopSidebar, MobileBottomNav, MobileSidebar } from "@/components/dashboard/sidebar";
import TopNav from "@/components/dashboard/top-nav";
import { KycRequiredBanner } from "@/components/dashboard/kyc-banner";
import { siteConfig } from "@/config/site";

import { PasskeyPromptModal } from "@/components/dashboard/passkey-prompt-modal";
import { SubscriptionStatusPopup } from '@/components/dashboard/subscription-status-popup';
import { TelegramConnectBanner } from '@/components/dashboard/telegram-connect-banner';
import type { SubscriptionEntitlement } from '@/lib/server/subscription-entitlement';

export default function DashboardLayoutClient({
  children,
  merchant,
  user,
  isGuest = false,
  initialNotifications = [],
  accessibleMerchants = [],
  userRole = 'owner',
  hasPasskey = false,
  subscriptionEntitlement = null,
  isTelegramLinked = false,
}: {
  children: React.ReactNode;
  merchant?: any;
  user?: any;
  isGuest?: boolean;
  initialNotifications?: any[];
  accessibleMerchants?: any[];
  userRole?: string;
  hasPasskey?: boolean;
  subscriptionEntitlement?: SubscriptionEntitlement | null;
  isTelegramLinked?: boolean;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Apply dark theme to body to prevent white backgrounds from parent paddings
  useEffect(() => {
    if (!isGuest) {
      document.body.style.backgroundColor = '#07101D';
    }
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [isGuest]);

  // Guest view: no sidebar, no top-nav toggle — just the content
  if (isGuest) {
    return (
      <div className="kobara-dashboard-shell min-h-[100dvh] bg-[#07101D] font-body-base text-body-base text-white antialiased">
        {/* Minimal guest top bar with login CTA */}
        <div className="h-16 border-b border-[#1E2A38] bg-[#020B14]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
          <a href={siteConfig.url} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Icone.png"
              alt="Kobara"
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-bold text-white tracking-tight">Kobara</span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href={`${siteConfig.url}/login`}
              className="text-sm font-semibold text-[#AAB3C2] hover:text-white transition-colors"
            >
              Connexion
            </a>
            <a
              href={`${siteConfig.url}/register`}
              className="h-9 px-5 rounded-full bg-[#FF4A1C] hover:bg-[#FF2E14] text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(255,74,28,0.3)] hover:shadow-[0_0_25px_rgba(255,74,28,0.5)] flex items-center"
            >
              Créer un compte
            </a>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="kobara-dashboard-shell relative flex min-h-[100dvh] flex-1 flex-col bg-[#07101D] font-body-base text-body-base text-white antialiased">
      <DesktopSidebar userRole={userRole} />
      <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={userRole} />

      <div className="flex min-h-full flex-1 flex-col transition-[padding] duration-200 lg:pl-60">
        <TopNav onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} merchant={merchant} user={user} initialNotifications={initialNotifications} accessibleMerchants={accessibleMerchants} userRole={userRole} />
        
        {/* Telegram Connect & Community Banner (disappears if connected, closable with X) */}
        <TelegramConnectBanner merchantId={merchant?.id} isTelegramLinked={isTelegramLinked} />

        {merchant && merchant.kyc_status !== 'approved' && (
          <KycRequiredBanner />
        )}
        <SubscriptionStatusPopup entitlement={subscriptionEntitlement} />
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <MobileBottomNav onOpenMore={() => setIsSidebarOpen(true)} userRole={userRole} />

      {/* Passkey Security Recommendation Popup (1x / day if user has no passkey) */}
      <PasskeyPromptModal merchantId={merchant?.id} hasPasskey={hasPasskey} />
    </div>
  );
}
