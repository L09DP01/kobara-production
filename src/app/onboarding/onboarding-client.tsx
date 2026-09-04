'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from './actions';
import { getDashboardUrl } from '@/lib/utils';
import { markClientSessionActive } from '@/lib/session-inactivity';

export function OnboardingClient({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    business_name: '',
    category: '',
    phone: '',
    address: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await completeOnboarding(formData);
      if (res && res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      markClientSessionActive();
      window.location.assign(getDashboardUrl('/dashboard'));
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background-main flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-border-subtle p-8 shadow-sm ambient-shadow relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container-high border border-border-subtle mb-4 shadow-sm">
              <span className="material-symbols-outlined text-primary text-[24px]">storefront</span>
            </div>
            <h1 className="text-headline-md font-headline-md text-text-primary tracking-tight">Bienvenue sur Kobara</h1>
            <p className="text-body-sm text-text-secondary mt-2">
              Configurez votre profil marchand pour commencer à accepter des paiements.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg text-body-sm font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="text-body-sm font-medium text-text-primary">Prénom</label>
                <input 
                  id="first_name"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  type="text" 
                  placeholder="Jean"
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="last_name" className="text-body-sm font-medium text-text-primary">Nom</label>
                <input 
                  id="last_name"
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  type="text" 
                  placeholder="Dupont"
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="business_name" className="text-body-sm font-medium text-text-primary">Nom de l'entreprise</label>
              <input 
                id="business_name"
                name="business_name"
                required
                maxLength={255}
                value={formData.business_name}
                onChange={handleChange}
                type="text" 
                placeholder="Ex: Mon Super Store"
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-text-primary">Adresse Email</label>
              <input 
                disabled
                value={defaultEmail}
                type="email" 
                className="w-full px-4 py-2.5 bg-surface-container-low border border-border-subtle rounded-lg text-text-secondary cursor-not-allowed opacity-70"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category" className="text-body-sm font-medium text-text-primary">Secteur d'activité</label>
              <select 
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="" disabled>Sélectionnez un secteur</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Services numériques">Services numériques (SaaS)</option>
                <option value="Freelance / Agence">Freelance / Agence</option>
                <option value="Éducation / Formations">Éducation / Formations</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-body-sm font-medium text-text-primary">Téléphone professionnel</label>
              <input 
                id="phone"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                type="tel" 
                placeholder="+509 XXXX XXXX"
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="address" className="text-body-sm font-medium text-text-primary">Adresse</label>
              <input 
                id="address"
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                type="text" 
                placeholder="Port-au-Prince, Haïti"
                className="w-full px-4 py-2.5 bg-surface-container-lowest border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-medium hover:opacity-90 transition-opacity mt-6 disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  Création...
                </>
              ) : (
                'Finaliser la configuration'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
