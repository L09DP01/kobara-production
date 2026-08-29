'use client';

import { useState } from 'react';
import { addWebhookEndpoint, deleteWebhookEndpoint, resendWebhookEvent, testWebhookEndpoint } from './actions';
import { toast } from "sonner";

export function WebhooksClient({ endpoints, events = [] }: { endpoints: any[], events?: any[] }) {
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleTest = async (endpointId: string) => {
    try {
      setTestingId(endpointId);
      toast.loading("Envoi d'un webhook de test...", { id: endpointId });
      const result = await testWebhookEndpoint(endpointId);
      if (result.success) {
        toast.success(`Webhook test délivré avec succès (${result.statusCode || 200} OK en ${result.latencyMs || 0}ms) !`, { id: endpointId });
      } else {
        toast.error(`Échec du webhook test : ${result.error || 'Erreur inconnue'}`, { id: endpointId });
      }
    } catch (err: any) {
      toast.error(`Erreur : ${err?.message || 'Échec du test'}`, { id: endpointId });
    } finally {
      setTestingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    try {
      setLoading(true);
      await addWebhookEndpoint(url);
      setIsModalOpen(false);
      setUrl('');
      toast.success("Webhook ajouté avec succès !");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'ajout du webhook");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookEndpoint(id);
      setConfirmDeleteId(null);
      toast.success("Webhook supprimé avec succès !");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleResend = async (eventId: string) => {
    try {
      toast.loading("Renvoi en cours...", { id: eventId });
      const result = await resendWebhookEvent(eventId);
      if (result.success) {
        toast.success("Webhook renvoyé avec succès !", { id: eventId });
      } else {
        toast.error(`Échec du renvoi : ${result.error || 'endpoint indisponible'}`, { id: eventId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du renvoi", { id: eventId });
    }
  };

  const webhookEvents = ['payment.succeeded', 'payment.failed', 'payment.pending', 'withdrawal.paid'];

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Webhooks</h1>
          <p className="text-slate-400 text-sm mt-1">Configurez des endpoints pour recevoir des événements en temps réel.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Ajouter un endpoint
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[20px] text-blue-400">info</span>
        </div>
        <div>
          <p className="text-sm font-medium text-blue-400">Comment fonctionnent les webhooks ?</p>
          <p className="text-xs text-blue-500 mt-0.5">Kobara envoie des requêtes HTTP POST à vos endpoints lorsqu'un événement se produit (paiement réussi, échoué, etc.). Chaque requête est signée avec votre clé secrète.</p>
        </div>
      </div>

      {/* Endpoints as Cards */}
      {endpoints.length > 0 ? (
        <div className="space-y-4">
          {endpoints.map(endpoint => (
            <div key={endpoint.id} className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10">
                      <span className="material-symbols-outlined text-[24px] text-slate-500">language</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-white truncate">{endpoint.url}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Ajouté le {new Date(endpoint.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                    endpoint.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${endpoint.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    {endpoint.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* Secret */}
                <div className="bg-transparent rounded-xl p-3 flex items-center justify-between mb-4 border border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">key</span>
                    <code className="text-xs font-mono text-slate-400 truncate">{endpoint.secret?.substring(0, 20)}••••••</code>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(endpoint.secret || '')}
                    className="text-slate-400 hover:text-white transition-colors flex-shrink-0 p-1"
                    title="Copier le secret"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {webhookEvents.map(event => (
                    <span key={event} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                      event.includes('succeeded') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      event.includes('failed') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      event.includes('pending') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {event}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 border-t border-white/10 bg-transparent flex justify-end items-center gap-2">
                <button 
                  onClick={() => handleTest(endpoint.id)}
                  disabled={testingId === endpoint.id}
                  className="px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/10 border border-orange-500/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Envoyer un événement de test"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  {testingId === endpoint.id ? 'Test en cours...' : 'Tester'}
                </button>
                <button 
                  onClick={() => setConfirmDeleteId(endpoint.id)}
                  className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/5 rounded-3xl border border-white/10 p-14 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center mb-4 border border-white/10">
            <span className="material-symbols-outlined text-4xl text-slate-500">webhook</span>
          </div>
          <p className="text-sm text-white font-bold">Aucun webhook configuré</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Configurez votre premier webhook pour recevoir des notifications en temps réel</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-5 bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-sm inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Ajouter un endpoint
          </button>
        </div>
      )}

      {/* Delivery Logs */}
      {events.length > 0 && (
        <div className="mt-12 space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight mb-6">Logs de livraison</h2>
          <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-transparent border-b border-white/10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-4">Événement</th>
                    <th className="px-5 py-4">Statut HTTP</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-sm">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-5 py-4 font-mono text-xs text-white">
                        <span className="bg-white/5 border border-white/10 shadow-sm px-2 py-1 rounded-md">{event.event_type}</span>
                      </td>
                      <td className="px-5 py-4">
                        {event.delivery_status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400">
                            En attente
                          </span>
                        ) : event.response_status && event.response_status >= 200 && event.response_status < 300 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-400">
                            {event.response_status} OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400" title={event.response_body}>
                            {event.response_status || 'Erreur'} Échoué
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        {new Date(event.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button 
                          onClick={() => handleResend(event.id)}
                          disabled={!event.webhook_endpoint_id}
                          title={!event.webhook_endpoint_id ? "Ancien événement sans endpoint associé" : "Renvoyer vers le même endpoint"}
                          className="text-xs font-bold text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 justify-end w-full"
                        >
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          Renvoyer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131b2f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Ajouter un endpoint</h2>
              <p className="text-xs text-slate-400 mt-1">Kobara enverra des requêtes POST à cette URL</p>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1.5">URL de l'endpoint</label>
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://votre-site.com/api/webhooks"
                  className="w-full px-4 py-3 bg-[#0F1626] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  required
                />
                <p className="text-xs text-slate-500 mt-1.5">L'URL doit être publiquement accessible et supporter les requêtes POST</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-400 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium border border-transparent hover:border-white/10"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all text-sm font-semibold shadow-sm"
                >
                  {loading ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131b2f] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl text-red-500">delete_forever</span>
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Supprimer ce webhook ?</h3>
            <p className="text-sm text-slate-400 text-center mb-6">Cette action est irréversible. Vous ne recevrez plus de notifications sur cet endpoint.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
