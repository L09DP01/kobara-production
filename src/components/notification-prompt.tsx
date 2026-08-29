'use client'

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if we are in a browser environment that supports notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Check if permission is already granted or denied
      if (Notification.permission === 'default') {
        // Check if user dismissed it recently
        const dismissed = localStorage.getItem('kobara_notif_dismissed');
        if (!dismissed || Date.now() - parseInt(dismissed) > 1000 * 60 * 60 * 24 * 7) {
          // Delay prompt slightly so it's not overwhelming on load
          const timer = setTimeout(() => {
            setShowPrompt(true);
          }, 5000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, []);

  const handleAllowClick = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowPrompt(false);
        new Notification('Kobara', {
          body: 'Les notifications de la PWA sont maintenant actives.',
        });
      } else {
        setShowPrompt(false);
        localStorage.setItem('kobara_notif_dismissed', Date.now().toString());
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('kobara_notif_dismissed', Date.now().toString());
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-96 z-[100] bg-surface-card border border-border-subtle rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-500">notifications_active</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-text-primary text-sm">Activer les notifications PWA</h3>
              <p className="text-xs text-text-secondary mt-0.5">Recevez les alertes Kobara sur cet appareil.</p>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <button 
            onClick={handleAllowClick}
            className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            Autoriser
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
