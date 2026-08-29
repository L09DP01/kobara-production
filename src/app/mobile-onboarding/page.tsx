'use client'

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const ONBOARDING_STEPS = [
  {
    title: "Paiements Simplifiés",
    description: "Acceptez les paiements MonCash et NatCash en quelques clics via nos liens sécurisés ou notre API puissante.",
    icon: "account_balance_wallet"
  },
  {
    title: "Dashboard Intuitif",
    description: "Suivez vos revenus, vos clients et vos retraits en temps réel depuis une interface moderne et fluide.",
    icon: "monitoring"
  },
  {
    title: "Sécurité Maximale",
    description: "Vos fonds et vos données sont protégés grâce à une architecture robuste et sécurisée.",
    icon: "shield_lock"
  }
];

export default function MobileOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // If user already saw onboarding, skip it
    if (localStorage.getItem('kobara_onboarding_done')) {
      router.replace('/login');
    }
  }, [router]);

  if (!isMounted) return null;

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('kobara_onboarding_done', 'true');
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 relative flex flex-col items-center justify-center p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center w-full max-w-sm"
          >
            <div className="w-32 h-32 mb-8 bg-surface-container rounded-full flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[64px] text-primary">
                {ONBOARDING_STEPS[currentStep].icon}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-4 font-display-sm tracking-tight">
              {ONBOARDING_STEPS[currentStep].title}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {ONBOARDING_STEPS[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-8 pb-12 flex flex-col gap-6">
        <div className="flex justify-center gap-2 mb-2">
          {ONBOARDING_STEPS.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep === idx ? 'w-8 bg-primary' : 'w-2 bg-border-subtle'
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextStep}
          className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
        >
          {currentStep === ONBOARDING_STEPS.length - 1 ? "Commencer" : "Suivant"}
          <span className="material-symbols-outlined text-[20px]">
            {currentStep === ONBOARDING_STEPS.length - 1 ? "rocket_launch" : "arrow_forward"}
          </span>
        </button>

        <div className="h-6 flex justify-center items-center">
          {currentStep < ONBOARDING_STEPS.length - 1 && (
            <button
              onClick={finishOnboarding}
              className="text-text-secondary font-medium hover:text-text-primary transition-colors text-sm uppercase tracking-wider"
            >
              Passer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
