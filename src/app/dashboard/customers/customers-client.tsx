'use client'

import { useState } from 'react';
import { createCustomer } from './actions';

export function CustomersClient({ customers, stats }: { customers: any[], stats?: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const displayStats = stats || {
    totalClients: customers.length,
    activeClients: customers.filter(c => (c.payments?.length || 0) > 0).length,
    volumeMoyen: 0
  };

  const avatarColors = [
    'from-red-400 to-pink-500', 'from-blue-400 to-indigo-500', 'from-green-400 to-emerald-500',
    'from-purple-400 to-violet-500', 'from-orange-400 to-amber-500', 'from-teal-400 to-cyan-500',
  ];

  const getAvatarColor = (name: string) => {
    const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
  };

  const getCustomerStats = (customer: any) => {
    const payments = customer.payments || [];
    
    // Only count succeeded/completed payments towards the volume
    const successfulPayments = payments.filter((p: any) => p.status === 'succeeded' || p.status === 'completed');
    
    const totalVolume = successfulPayments.reduce((acc: number, p: any) => acc + Number(p.net_amount || p.amount || 0), 0);
    const totalFees = successfulPayments.reduce((acc: number, p: any) => acc + Number(p.fee_amount || 0), 0);
    
    let lastPaymentDate = null;
    let paymentMode = 'N/A';
    if (payments.length > 0) {
      const sorted = [...payments].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      lastPaymentDate = new Date(sorted[0].created_at);
      paymentMode = sorted[0].provider || 'MonCash';
    }

    return {
      paymentCount: payments.length,
      successfulCount: successfulPayments.length,
      totalVolume,
      totalFees,
      lastPaymentDate,
      paymentMode
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createCustomer({ name, email, phone });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const openCustomerDetail = (customer: any) => {
    setSelectedCustomer(customer);
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    succeeded: { label: 'Succès', color: 'bg-green-500/20 text-green-400 border-green-500/20' },
    completed: { label: 'Succès', color: 'bg-green-500/20 text-green-400 border-green-500/20' },
    failed: { label: 'Échoué', color: 'bg-red-500/20 text-red-400 border-red-500/20' },
    pending: { label: 'En attente', color: 'bg-orange-500/20 text-orange-400 border-orange-500/20' },
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6 pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">Gérez vos clients et visualisez leur historique de paiement.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Nouveau client
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white/5 rounded-3xl border border-white/10 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-blue-400">group</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Clients</p>
            <p className="text-2xl font-bold text-white">{displayStats.totalClients}</p>
          </div>
        </div>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-green-400">trending_up</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Clients Actifs</p>
            <p className="text-2xl font-bold text-white">{displayStats.activeClients}</p>
          </div>
        </div>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-purple-400">payments</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Volume Moyen</p>
            <p className="text-2xl font-bold text-white">
              {Math.round(displayStats.volumeMoyen).toLocaleString('fr-FR')} HTG
            </p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5">
          <div className="relative w-full sm:w-96">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input 
              className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm" 
              placeholder="Rechercher par nom, email ou téléphone..." 
              type="text"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/10 transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-slate-400">download</span>
            Exporter CSV
          </button>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 bg-transparent">
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">Téléphone</th>
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">Mode de paiement</th>
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">Volume Total</th>
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">Dernier paiement</th>
                <th className="py-3.5 px-5 text-[11px] text-slate-400 font-bold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-white divide-y divide-white/10">
              {customers.length > 0 ? customers.map((customer) => {
                const cStats = getCustomerStats(customer);
                return (
                  <tr key={customer.id} className="hover:bg-white/5 transition-colors group cursor-pointer border-l-[3px] border-l-transparent hover:border-l-orange-500">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(customer.name)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                          {(customer.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white">{customer.name || 'Client Inconnu'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-slate-400 text-sm">{customer.phone || 'Aucun'}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        {cStats.paymentMode !== 'N/A' && <span className="material-symbols-outlined text-[14px] text-slate-500">smartphone</span>}
                        <span className="font-bold capitalize">{cStats.paymentMode}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold">{cStats.totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 text-sm">
                      {cStats.lastPaymentDate ? cStats.lastPaymentDate.toLocaleDateString('fr-FR') : 'Aucun'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button 
                        onClick={() => openCustomerDetail(customer)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        Détails
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-4xl text-slate-500/30">groups</span>
                    </div>
                    <p className="text-sm text-slate-400 font-bold">Aucun client trouvé</p>
                    <p className="text-xs text-slate-500 mt-1">Vos clients apparaîtront ici après leur premier paiement ou ajout manuel</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-bold">Affichage de {customers.length} client(s)</p>
          <div className="flex gap-1.5">
            <button className="px-3 py-1.5 border border-white/10 rounded-lg text-xs font-bold text-slate-500 hover:bg-white/10 disabled:opacity-40" disabled>Précédent</button>
            <button className="px-3 py-1.5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40" disabled>Suivant</button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* CUSTOMER DETAIL MODAL */}
      {/* ═══════════════════════════════════════════════ */}
      {selectedCustomer && (() => {
        const cs = getCustomerStats(selectedCustomer);
        const payments = selectedCustomer.payments || [];
        const sortedPayments = [...payments].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedCustomer(null)}>
            <div 
              className="bg-[#0F1729] w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(selectedCustomer.name)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {(selectedCustomer.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedCustomer.name || 'Client Inconnu'}</h2>
                    <p className="text-sm text-slate-400">Client depuis {new Date(selectedCustomer.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)} 
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                
                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                    </div>
                    <p className="text-sm font-bold text-white">{selectedCustomer.email || 'Non renseigné'}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">phone</span>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Téléphone</p>
                    </div>
                    <p className="text-sm font-bold text-white">{selectedCustomer.phone || 'Non renseigné'}</p>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                    <p className="text-2xl font-bold text-white">{cs.paymentCount}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Paiements</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                    <p className="text-2xl font-bold text-green-400">{cs.successfulCount}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Réussis</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                    <p className="text-lg font-bold text-white">{cs.totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Volume (HTG)</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                    <p className="text-lg font-bold text-slate-300">{cs.totalFees.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Frais (HTG)</p>
                  </div>
                </div>

                {/* Payment History */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-orange-400">receipt_long</span>
                      Historique des paiements
                    </h3>
                    <span className="text-xs text-slate-500 font-bold">{payments.length} transaction(s)</span>
                  </div>
                  
                  {sortedPayments.length > 0 ? (
                    <div className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Méthode</th>
                            <th className="py-2.5 px-4 text-right">Montant</th>
                            <th className="py-2.5 px-4 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                          {sortedPayments.map((payment: any) => {
                            const sc = statusConfig[payment.status] || { label: payment.status, color: 'bg-white/10 text-slate-400 border-white/20' };
                            return (
                              <tr key={payment.id} className="hover:bg-white/[0.03] transition-colors">
                                <td className="py-2.5 px-4">
                                  <div className="font-bold text-white text-xs">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</div>
                                  <div className="text-[10px] text-slate-500">{new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className="capitalize font-bold text-white text-xs">
                                    {payment.payment_method?.toLowerCase() === 'natcash' || payment.provider?.toLowerCase() === 'natcash' ? 'NatCash' : 'MonCash'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <span className="font-bold text-white text-xs">{Number(payment.amount || 0).toLocaleString('fr-FR')} {payment.currency || 'HTG'}</span>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.color}`}>
                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                    {sc.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] rounded-2xl border border-white/5 py-10 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-600 mb-2">receipt_long</span>
                      <p className="text-sm text-slate-500 font-bold">Aucune transaction</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#131B2C] w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nouveau Client</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg border border-red-500/20">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-white mb-1">Nom Complet</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-white"
                  placeholder="Jean Exemple"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-1">Téléphone</label>
                <input 
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-white"
                  placeholder="+509 XXXX XXXX"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl font-bold text-sm text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  Ajouter le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
