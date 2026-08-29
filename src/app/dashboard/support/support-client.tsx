'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { submitSupportTicket } from './actions';

export function SupportClient({ merchant, user }: { merchant: any, user: any }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'Paiements',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const res = await submitSupportTicket(formData);
    
    setLoading(false);
    
    if (res && res.error) {
      toast.error(res.error);
    } else {
      setSuccess(true);
      toast.success("Votre demande a bien été envoyée. Notre équipe vous répondra sous 24h.");
      setFormData({ subject: '', category: 'Paiements', message: '' });
      
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Contact Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 shadow-sm">
          <h2 className="font-headline-md text-white mb-6">Envoyer un message</h2>
          
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-status-success/10 border border-status-success/20 flex items-start gap-3">
              <span className="material-symbols-outlined text-status-success mt-0.5">check_circle</span>
              <div>
                <p className="font-semibold text-status-success">Message envoyé avec succès</p>
                <p className="text-body-sm text-status-success/80 mt-1">Notre équipe de support vous répondra sur votre adresse email ({user?.email}) dans les plus brefs délais.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-white">Catégorie</label>
                <select 
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-body-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-white"
                >
                  <option value="">Sélectionner une catégorie</option>
                  <option value="technical">Problème technique / API</option>
                  <option value="billing">Facturation & Frais</option>
                  <option value="account">Gestion de compte / KYC</option>
                  <option value="payment">Problème de paiement</option>
                  <option value="other">Autre demande</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-white">Sujet</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Erreur lors de l'intégration API"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-body-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-white"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-body-sm font-semibold text-white">Votre message</label>
              <textarea 
                required
                rows={6}
                placeholder="Décrivez votre problème en détail..."
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-body-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-white resize-y"
              />
              <p className="text-[12px] text-slate-400 mt-1">Veuillez ne pas inclure de mots de passe ou d'informations bancaires sensibles dans ce formulaire.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Envoyer le message
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Contact Info & FAQ Sidebar */}
      <div className="space-y-6">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full -z-10"></div>
          <h3 className="font-headline-sm text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400">contact_support</span>
            Contact direct
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-slate-400">mail</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Support</p>
                <a href="mailto:support@kobara.app" className="text-sm font-semibold text-orange-400 hover:underline">support@kobara.app</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-slate-400">phone_in_talk</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Téléphone / WhatsApp</p>
                <a href="tel:+50940035664" className="text-sm font-semibold text-white hover:text-orange-400 transition-colors">+509 4003 5664</a>
                <p className="text-xs text-slate-400 mt-0.5">Lun-Ven, 9h-17h</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 rounded-2xl border border-blue-500/30 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[18px]">forum</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Forum Communautaire Telegram</h4>
              <p className="text-[11px] text-slate-400">Actualités, entraide marchands & développeurs</p>
            </div>
          </div>
          <a
            href="https://t.me/KobaraCommunity"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <span>Rejoindre @KobaraCommunity</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 shadow-sm">
          <h3 className="font-headline-sm text-white mb-4">Liens utiles</h3>
          <ul className="space-y-2">
            <li>
              <a href="https://wa.me/50940035664?text=Bonjour,%20j'ai%20besoin%20d'assistance%20avec%20Kobara" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/20 text-sm text-emerald-400 hover:text-emerald-300 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-400">chat</span>
                  Assistance WhatsApp (+509 4003 5664)
                </div>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            </li>
            <li>
              <a href="/developers" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/20 text-sm text-white hover:text-orange-400 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-orange-400">menu_book</span>
                  Documentation API
                </div>
                <span className="material-symbols-outlined text-[16px] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">arrow_forward</span>
              </a>
            </li>
            <li>
              <a href="/settings" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/20 text-sm text-white hover:text-orange-400 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-orange-400">settings</span>
                  Paramètres du compte
                </div>
                <span className="material-symbols-outlined text-[16px] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">arrow_forward</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
