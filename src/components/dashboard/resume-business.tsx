'use client';

import { useEffect, useState } from 'react';
import { switchBusinessAction } from '@/app/dashboard/businesses/actions';

export function ResumeBusiness({ merchantId }: { merchantId: string }) {
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    switchBusinessAction(merchantId).then(result => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else window.location.replace('/dashboard');
    }).catch(() => { if (!cancelled) setError('Connexion interrompue. Veuillez réessayer.'); });
    return () => { cancelled = true; };
  }, [merchantId]);
  return <main className="min-h-dvh bg-[#07101D] p-8 text-white">
    <p role={error ? 'alert' : 'status'}>{error || 'Ouverture de votre dernier business…'}</p>
    {error && <a href="/businesses?choose=1" className="mt-4 inline-block text-orange-400">Changer de business</a>}
  </main>;
}
