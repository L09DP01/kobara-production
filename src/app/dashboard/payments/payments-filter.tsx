'use client'

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useEnvironment } from '@/context/EnvironmentContext';

export function PaymentsFilter({ exportButton }: { exportButton?: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const status = searchParams.get('status') || 'all';
  const { currentEnvironment, setEnvironment, canUseLive } = useEnvironment();

  const updateFilters = (newQ: string, newStatus: string) => {
    const params = new URLSearchParams();
    if (newQ) params.set('q', newQ);
    if (newStatus && newStatus !== 'all') params.set('status', newStatus);
    router.push(`/dashboard/payments?${params.toString()}`);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== (searchParams.get('q') || '')) {
         updateFilters(q, status);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q, status]);

  return (
    <div className="space-y-4">
      {/* ── Search + Actions (same row) ── */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-text-secondary text-[18px] sm:text-[20px]">search</span>
          <input
            className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-surface-card border border-border-subtle rounded-xl text-xs sm:text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm transition-all duration-200"
            placeholder="Rechercher..."
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {/* Export Button (passed from parent) */}
        {exportButton}
        {/* Créer un lien */}
        <Link href="/payment-links" className="flex items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-primary text-on-primary rounded-xl text-xs sm:text-sm font-semibold hover:opacity-90 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-sm whitespace-nowrap shrink-0">
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">add_link</span>
          <span className="hidden sm:inline">Créer un lien</span>
        </Link>
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => updateFilters(q, 'all')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold shadow-sm transition-all duration-200 ${
            status === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-card text-text-secondary border border-border-subtle hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">list</span>
          Tous
        </button>
        <button 
          onClick={() => updateFilters(q, 'succeeded')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5 ${
            status === 'succeeded' ? 'bg-status-success/20 text-status-success border-status-success/40' : 'bg-status-success/5 text-status-success/70 border-status-success/10 hover:bg-status-success/10'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
          Succès
        </button>
        <button 
          onClick={() => updateFilters(q, 'pending')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5 ${
            status === 'pending' ? 'bg-status-warning/20 text-status-warning border-status-warning/40' : 'bg-status-warning/5 text-status-warning/70 border-status-warning/10 hover:bg-status-warning/10'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span>
          En attente
        </button>
        <button 
          onClick={() => updateFilters(q, 'failed')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 hover:-translate-y-0.5 ${
            status === 'failed' ? 'bg-status-error/20 text-status-error border-status-error/40' : 'bg-status-error/5 text-status-error/70 border-status-error/10 hover:bg-status-error/10'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-error"></span>
          Échoué
        </button>
      </div>

      {/* Mobile Environment Switcher */}
      <div className="sm:hidden flex items-center justify-between bg-surface-container-low px-4 py-3 rounded-xl border border-border-subtle shadow-sm mt-2">
        <span className={`text-sm font-bold ${currentEnvironment === 'test' ? 'text-amber-600' : 'text-text-secondary'}`}>Mode Test</span>
        <button 
          onClick={() => setEnvironment(currentEnvironment === 'test' ? 'live' : 'test')}
          disabled={!canUseLive}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${!canUseLive ? 'opacity-50 cursor-not-allowed bg-gray-300' : (currentEnvironment === 'live' ? 'bg-status-success' : 'bg-amber-500')}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentEnvironment === 'live' ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-bold ${currentEnvironment === 'live' ? 'text-status-success' : 'text-text-secondary'}`}>Mode Live</span>
      </div>
    </div>
  );
}
