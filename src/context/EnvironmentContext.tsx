'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment>('test');
  const [canUseLive, setCanUseLive] = useState(false);
  const [kycStatus, setKycStatus] = useState('not_started');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnvironment = async () => {
      try {
        const response = await fetch('/api/dashboard/environment');
        if (response.ok) {
          const data = await response.json();
          setCurrentEnvironment(data.environment);
          setCanUseLive(data.canUseLive);
          setKycStatus(data.kycStatus);
        }
      } catch (error) {
        console.error('Failed to load environment settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnvironment();
  }, []);

  const setEnvironment = async (env: Environment) => {
    if (env === 'live' && !canUseLive) {
      toast.error('KYC requis', {
        description: 'Veuillez vérifier votre compte pour activer le Live Mode.'
      });
      return;
    }

    // Optimistic UI update
    const prevEnv = currentEnvironment;
    setCurrentEnvironment(env);
    
    try {
      const response = await fetch('/api/dashboard/environment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment: env }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erreur lors du changement de mode');
      }

      toast.success(`Passage en mode ${env === 'live' ? 'Live' : 'Test'}`);
      
      // We should reload the page to ensure all components fetch the correct data
      window.location.reload();
      
    } catch (error: any) {
      setCurrentEnvironment(prevEnv); // Revert
      toast.error('Erreur', {
        description: error.message
      });
    }
  };

  return (
    <EnvironmentContext.Provider
      value={{
        currentEnvironment,
        canUseLive,
        kycStatus,
        setEnvironment,
        isLoading,
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
