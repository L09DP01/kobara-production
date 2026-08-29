'use client'

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);
  const [osType, setOsType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    if (pathname?.startsWith('/pay')) return;
    
    // Only show the prompt if they haven't dismissed it recently
    const dismissed = localStorage.getItem('kobara_pwa_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 1000 * 60 * 60 * 24 * 7) {
      return; // Hide for 7 days if dismissed
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as any).standalone);

    if (isStandalone) return;

    if (isIos) {
      setOsType('ios');
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    } else if (isAndroid) {
      setOsType('android');
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
    
    // On Desktop, we don't show the install prompt anymore as per requirement.
    setOsType('desktop');
  }, [pathname]);

  const handleInstallClick = () => {
    if (osType === 'ios') {
      // Redirect to the PWA hosted on app.kobara.app
      window.location.href = 'https://app.kobara.app';
    } else if (osType === 'android') {
      // Redirect to download the APK from Google Drive
      window.location.href = 'https://drive.google.com/file/d/1sEgdgo4UsOYW-zf-IfyR6qMj7qdPy_jm/view?usp=sharing';
      handleDismiss(); // Hide after clicking download
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('kobara_pwa_dismissed', Date.now().toString());
  };

  if (pathname?.startsWith('/pay')) return null;
  if (osType === 'desktop') return null; // Don't show on desktop

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-[100] bg-surface-card border border-border-subtle rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white">
                {osType === 'android' ? 'android' : 'phone_iphone'}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-text-primary text-sm">
                {osType === 'android' ? 'Application Android' : 'Application iPhone'}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {osType === 'android' 
                  ? 'Téléchargez notre application officielle pour Android.' 
                  : 'Installez l\'application Kobara pour une meilleure expérience.'}
              </p>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <button 
            onClick={handleInstallClick}
            className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {osType === 'android' ? 'Télécharger l\'APK' : 'Installer l\'application'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
