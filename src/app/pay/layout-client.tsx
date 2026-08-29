'use client';

import { useEffect } from 'react';

export function PayLayoutClient() {
  useEffect(() => {
    // Apply dark theme to body to prevent white backgrounds from parent paddings
    document.body.style.backgroundColor = '#0F1626';
    
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  return <span className="kobara-payment-surface hidden" aria-hidden="true" />;
}
