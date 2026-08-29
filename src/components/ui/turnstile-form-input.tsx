'use client';

import { useState } from 'react';
import { TurnstileWidget } from './turnstile-widget';

export function TurnstileFormInput({ name = 'cf-turnstile-response' }: { name?: string }) {
  const [token, setToken] = useState('');

  return (
    <div>
      <input type="hidden" name={name} value={token} />
      <TurnstileWidget
        onVerify={(t) => setToken(t)}
        onExpire={() => setToken('')}
        onError={() => setToken('')}
      />
    </div>
  );
}
