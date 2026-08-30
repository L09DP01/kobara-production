'use client';

import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';

type Environment = 'test' | 'live';

interface EnvironmentContextType {
  currentEnvironment: Environment;
  canUseLive: boolean;
  kycStatus: string;
  setEnvironment: (env: Environment) => Promise<void>;
  isLoading: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const setEnvironment = async (env: Environment) => {
    if (env !== 'live') {
      toast.info('Sandbox séparé', {
        description: 'Utilisez test.kobara.app pour effectuer des essais sans paiement réel.'
      });
    }
  };

  return (
    <EnvironmentContext.Provider
      value={{
        currentEnvironment: 'live',
        canUseLive: true,
        kycStatus: 'approved',
        setEnvironment,
        isLoading: false,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}
