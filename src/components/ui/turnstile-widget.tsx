'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type TurnstileWidgetId = string;

interface TurnstileApi {
  render: (
    container: string | HTMLElement,
    options: Record<string, unknown>
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
  remove: (widgetId?: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (errorCode?: string) => void;
  onExpire?: () => void;
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
}

type WidgetStatus = 'loading' | 'ready' | 'verified' | 'error';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function getErrorMessage(errorCode?: string) {
  if (errorCode === '110200') {
    return "Ce domaine n'est pas autorisé par Cloudflare Turnstile.";
  }

  if (errorCode?.startsWith('1101') || errorCode?.startsWith('4000')) {
    return 'La clé Cloudflare Turnstile est invalide ou désactivée.';
  }

  if (errorCode === '200500') {
    return 'Cloudflare ne peut pas charger la vérification sur ce réseau.';
  }

  return 'La vérification Cloudflare a échoué. Veuillez réessayer.';
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  className = 'my-4 flex w-full flex-col items-center justify-center min-h-[65px]',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onVerify, onError, onExpire });
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    (process.env.NODE_ENV === 'production'
      ? '0x4AAAAAAEO1AvulxYXFX54G'
      : '1x00000000000000000000AA');

  useEffect(() => {
    callbacksRef.current = { onVerify, onError, onExpire };
  }, [onVerify, onError, onExpire]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const armWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      setStatus('error');
      setErrorMessage('La vérification prend trop de temps. Touchez Réessayer.');
      callbacksRef.current.onError?.('timeout');
    }, 20_000);
  }, [clearWatchdog]);

  const resetWidget = useCallback(() => {
    if (!window.turnstile || !widgetIdRef.current) {
      window.location.reload();
      return;
    }

    callbacksRef.current.onExpire?.();
    setErrorMessage('');
    setStatus('loading');
    window.turnstile.reset(widgetIdRef.current);
    armWatchdog();
  }, [armWatchdog]);

  useEffect(() => {
    if (!scriptReady || !window.turnstile || !containerRef.current) return;

    if (widgetIdRef.current) return;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        language: 'auto',
        size: 'flexible',
        appearance: 'always',
        retry: 'auto',
        'retry-interval': 5000,
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        callback: (token: string) => {
          clearWatchdog();
          setStatus('verified');
          setErrorMessage('');
          callbacksRef.current.onVerify(token);
        },
        'error-callback': (errorCode: string) => {
          clearWatchdog();
          setStatus('error');
          setErrorMessage(getErrorMessage(errorCode));
          callbacksRef.current.onError?.(errorCode);
          return true;
        },
        'expired-callback': () => {
          setStatus('ready');
          callbacksRef.current.onExpire?.();
        },
        'timeout-callback': () => {
          setStatus('error');
          setErrorMessage('La vérification a expiré. Veuillez réessayer.');
          callbacksRef.current.onError?.('timeout');
        },
        'unsupported-callback': () => {
          clearWatchdog();
          setStatus('error');
          setErrorMessage("Ce navigateur ne prend pas en charge la vérification Cloudflare.");
          callbacksRef.current.onError?.('unsupported-browser');
        },
        'after-interactive-callback': () => setStatus('ready'),
      });
      armWatchdog();
    } catch (error) {
      console.error('Turnstile render error:', error);
      queueMicrotask(() => {
        setStatus('error');
        setErrorMessage('Impossible de démarrer la vérification Cloudflare.');
        callbacksRef.current.onError?.('render-error');
      });
    }

    return () => {
      clearWatchdog();
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // The widget may already have been removed during navigation.
        }
      }
      widgetIdRef.current = null;
    };
  }, [armWatchdog, clearWatchdog, scriptReady, siteKey, theme]);

  return (
    <div className={className} aria-live="polite">
      <Script
        id={TURNSTILE_SCRIPT_ID}
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => {
          setStatus('error');
          setErrorMessage('Cloudflare ne peut pas être chargé. Vérifiez votre connexion.');
          callbacksRef.current.onError?.('script-load-error');
        }}
      />
      <div ref={containerRef} className="min-h-[65px] w-full max-w-[300px]" />
      {status === 'error' && (
        <div className="mt-2 flex max-w-[320px] flex-col items-center gap-2 text-center">
          <p className="text-xs font-medium text-[#FF8B73]">{errorMessage}</p>
          <button
            type="button"
            onClick={resetWidget}
            className="text-xs font-bold text-[#FF4A1C] underline underline-offset-4"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
