'use client';

import { useEffect, useRef } from 'react';

export function ShopifyConnectionRefresh({ automatic }: { automatic: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (automatic && !submitted.current && form.current) {
      submitted.current = true;
      form.current.requestSubmit();
    }
  }, [automatic]);

  return <form ref={form} action="/api/integrations/shopify/link" method="post">
    <input type="hidden" name="mode" value="refresh" />
    {automatic && <p role="status" className="text-sm text-slate-300">Actualisation de la connexion Shopify...</p>}
    <button type="submit" className="mt-2 min-h-11 text-sm font-semibold text-orange-300 underline underline-offset-4">Actualiser la connexion Shopify</button>
  </form>;
}
