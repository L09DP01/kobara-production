'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  AudienceMember,
  createScheduledCampaignAction,
  processCampaignTodayBatchAction,
  retryFailedRecipientsAction,
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
  getCampaignDetailsAction,
  getAdminCampaigns,
  sendBulkAdminMessage,
} from './actions';
import {
  Send,
  CheckCircle,
  AlertCircle,
  Search,
  Users,
  CheckSquare,
  Square,
  XCircle,
  Calendar,
  Clock,
  Zap,
  Layers,
  RotateCcw,
  Pause,
  Play,
  Eye,
  ChevronRight,
  RefreshCw,
  Mail,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Sliders,
} from 'lucide-react';

interface Props {
  initialAudiences: {
    merchants: AudienceMember[];
    customers: AudienceMember[];
    users: AudienceMember[];
  };
  initialCampaigns: any[];
}

export default function MessagingClient({ initialAudiences, initialCampaigns }: Props) {
  const [activeTab, setActiveTab] = useState<'composer' | 'campaigns' | 'direct'>('composer');

  // Audiences State
  const [audiences] = useState(initialAudiences);
  const [selectedAudienceCategory, setSelectedAudienceCategory] = useState<'all' | 'merchants' | 'customers' | 'users'>('merchants');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Composer Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [ratePerSecond, setRatePerSecond] = useState(7);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [broadcastTelegramChannel, setBroadcastTelegramChannel] = useState(true);
  const [broadcastTelegramMerchants, setBroadcastTelegramMerchants] = useState(true);

  // Campaigns Monitor State
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<any | null>(null);
  const [recipientFilterStatus, setRecipientFilterStatus] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientPage, setRecipientPage] = useState(1);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Operation State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Combine members according to active category
  const visibleAudienceMembers = useMemo(() => {
    let pool: AudienceMember[] = [];
    if (selectedAudienceCategory === 'all') {
      pool = [...audiences.merchants, ...audiences.customers, ...audiences.users];
    } else if (selectedAudienceCategory === 'merchants') {
      pool = audiences.merchants;
    } else if (selectedAudienceCategory === 'customers') {
      pool = audiences.customers;
    } else if (selectedAudienceCategory === 'users') {
      pool = audiences.users;
    }

    if (!searchQuery.trim()) return pool;
    const q = searchQuery.toLowerCase().trim();
    return pool.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.details?.toLowerCase().includes(q)
    );
  }, [audiences, selectedAudienceCategory, searchQuery]);

  // Handle Quick Audience Selection
  const selectAllCategory = (category: 'all' | 'merchants' | 'customers' | 'users') => {
    setSelectedAudienceCategory(category);
    let pool: AudienceMember[] = [];
    if (category === 'all') pool = [...audiences.merchants, ...audiences.customers, ...audiences.users];
    else if (category === 'merchants') pool = audiences.merchants;
    else if (category === 'customers') pool = audiences.customers;
    else if (category === 'users') pool = audiences.users;

    setSelectedIds(new Set(pool.map((m) => m.id)));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleAudienceMembers.map((m) => m.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Map of all audience members for fast lookup
  const allAudienceMap = useMemo(() => {
    const map = new Map<string, AudienceMember>();
    [...audiences.merchants, ...audiences.customers, ...audiences.users].forEach((m) => {
      map.set(m.id, m);
    });
    return map;
  }, [audiences]);

  const selectedRecipientsList = useMemo(() => {
    const list: AudienceMember[] = [];
    selectedIds.forEach((id) => {
      const m = allAudienceMap.get(id);
      if (m) list.push(m);
    });
    return list;
  }, [selectedIds, allAudienceMap]);

  // Batch calculations
  const totalSelected = selectedRecipientsList.length;
  const calculatedBatchesCount = Math.ceil(totalSelected / (dailyLimit || 50));
  const estSecondsPerBatch = Math.ceil(Math.min(totalSelected, dailyLimit) / (ratePerSecond || 7));

  // Refresh campaigns list
  const refreshCampaigns = async () => {
    try {
      const fresh = await getAdminCampaigns();
      setCampaigns(fresh);
    } catch (err: any) {
      console.error('Refresh campaigns error:', err);
    }
  };

  // Submit Campaign Creation
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSelected === 0) {
      setFeedback({ type: 'error', message: 'Veuillez sélectionner au moins un destinataire.' });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const res = await createScheduledCampaignAction({
        title: title || subject || 'Campagne Globale',
        subject,
        content,
        audienceType: selectedAudienceCategory,
        recipients: selectedRecipientsList.map((r) => ({
          email: r.email,
          name: r.name,
          type: r.type,
          id: r.id,
        })),
        dailyLimit,
        ratePerSecond,
        scheduledAt: isScheduled && scheduledAt ? scheduledAt : null,
        broadcastTelegramChannel,
        broadcastTelegramMerchants,
      });

      if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: `Campagne créée avec succès ! ${totalSelected} destinataires répartis en ${calculatedBatchesCount} lot(s) quotidien(s).`,
        });
        setTitle('');
        setSubject('');
        setContent('');
        setSelectedIds(new Set());
        await refreshCampaigns();
        setActiveTab('campaigns');
      }
    });
  };

  // Trigger manual batch
  const handleProcessTodayBatch = (campaignId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await processCampaignTodayBatchAction(campaignId);
      if ('error' in res && res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else if ('success' in res && !res.success) {
        setFeedback({ type: 'error', message: res.message || 'Erreur lors de l\'envoi du lot.' });
      } else {
        setFeedback({
          type: 'success',
          message: ('message' in res && res.message) || 'Lot du jour exécuté.',
        });
        await refreshCampaigns();
        if (selectedCampaignId === campaignId) {
          await loadCampaignDetails(campaignId, recipientFilterStatus, recipientPage);
        }
      }
    });
  };

  // Retry failed
  const handleRetryFailed = (campaignId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await retryFailedRecipientsAction(campaignId);
      if ('error' in res && res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({ type: 'success', message: ('message' in res && res.message) || 'Échecs réinitialisés.' });
        await refreshCampaigns();
        if (selectedCampaignId === campaignId) {
          await loadCampaignDetails(campaignId, recipientFilterStatus, recipientPage);
        }
      }
    });
  };

  // Pause / Resume / Cancel
  const handleTogglePause = (campaign: any) => {
    startTransition(async () => {
      if (campaign.status === 'paused') {
        await resumeCampaignAction(campaign.id);
      } else {
        await pauseCampaignAction(campaign.id);
      }
      await refreshCampaigns();
    });
  };

  const handleCancelCampaign = (campaignId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette campagne ? Les envois en attente seront définitivement stoppés.')) {
      return;
    }
    startTransition(async () => {
      await cancelCampaignAction(campaignId);
      await refreshCampaigns();
      if (selectedCampaignId === campaignId) {
        await loadCampaignDetails(campaignId, recipientFilterStatus, recipientPage);
      }
    });
  };

  // Load Campaign Details & Recipients
  const loadCampaignDetails = async (
    campaignId: string,
    status: 'all' | 'pending' | 'sent' | 'failed' = 'all',
    page = 1,
    search = ''
  ) => {
    setSelectedCampaignId(campaignId);
    setIsDetailsLoading(true);
    try {
      const data = await getCampaignDetailsAction(campaignId, {
        status,
        page,
        pageSize: 30,
        search,
      });
      setCampaignDetails(data);
      setRecipientFilterStatus(status);
      setRecipientPage(page);
    } catch (err: any) {
      console.error('Failed to load campaign details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <Mail className="w-6 h-6 text-red-500" />
            CENTRE DE MESSAGERIE & DRIP CAMPAIGNS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Programmation automatisée, découpage en lots quotidiens (50/jour) et régulation de débit (7/sec).
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('composer')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'composer'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            NOUVELLE CAMPAGNE
          </button>
          <button
            onClick={() => {
              setActiveTab('campaigns');
              refreshCampaigns();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'campaigns'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            SUIVI DES LOTS ({campaigns.length})
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSER */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Audience Selection */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-500" />
                  SÉLECTION DES DESTINATAIRES
                </span>
                <span className="text-xs text-red-400 font-mono bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                  {totalSelected} sélectionné{totalSelected > 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                Choisissez l&apos;audience cible du système.
              </p>
            </div>

            {/* Quick Audience Category Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectAllCategory('merchants')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  selectedAudienceCategory === 'merchants' && selectedIds.size === audiences.merchants.length
                    ? 'bg-red-950/60 border-red-500/50 text-red-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>Tous les Marchands</span>
                <span className="font-mono text-[10px] text-slate-500">({audiences.merchants.length})</span>
              </button>

              <button
                type="button"
                onClick={() => selectAllCategory('customers')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  selectedAudienceCategory === 'customers' && selectedIds.size === audiences.customers.length
                    ? 'bg-red-950/60 border-red-500/50 text-red-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>Tous les Clients</span>
                <span className="font-mono text-[10px] text-slate-500">({audiences.customers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => selectAllCategory('users')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  selectedAudienceCategory === 'users' && selectedIds.size === audiences.users.length
                    ? 'bg-red-950/60 border-red-500/50 text-red-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>Tous les Utilisateurs</span>
                <span className="font-mono text-[10px] text-slate-500">({audiences.users.length})</span>
              </button>

              <button
                type="button"
                onClick={() => selectAllCategory('all')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  selectedAudienceCategory === 'all' && selectedIds.size === audiences.merchants.length + audiences.customers.length + audiences.users.length
                    ? 'bg-red-950/60 border-red-500/50 text-red-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>Tout le Système</span>
                <span className="font-mono text-[10px] text-slate-500">
                  ({audiences.merchants.length + audiences.customers.length + audiences.users.length})
                </span>
              </button>
            </div>

            {/* Filter / Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par nom, e-mail ou téléphone..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Select All Visible Toggle */}
            <div className="flex items-center justify-between px-1 text-xs">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="text-slate-400 hover:text-red-400 flex items-center gap-1.5 font-medium transition-colors"
              >
                {visibleAudienceMembers.length > 0 &&
                visibleAudienceMembers.every((m) => selectedIds.has(m.id)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-red-400" /> Tout désélectionner ({visibleAudienceMembers.length})
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-600" /> Tout sélectionner visibles ({visibleAudienceMembers.length})
                  </>
                )}
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-500 hover:text-slate-300 text-[11px] underline"
                >
                  Effacer la sélection
                </button>
              )}
            </div>

            {/* Recipient List with Checkboxes */}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {visibleAudienceMembers.map((m) => {
                const isSelected = selectedIds.has(m.id);
                return (
                  <button
                    key={`${m.type}_${m.id}`}
                    type="button"
                    onClick={() => toggleRecipient(m.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-xs flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-red-950/40 border-red-500/40 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-red-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold truncate">{m.name}</span>
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold ${
                            m.type === 'merchant'
                              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                              : m.type === 'customer'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {m.type === 'merchant' ? 'Marchand' : m.type === 'customer' ? 'Client' : 'User'}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono truncate">{m.email}</div>
                      {m.details && <div className="text-slate-500 text-[10px] truncate">{m.details}</div>}
                    </div>
                  </button>
                );
              })}

              {visibleAudienceMembers.length === 0 && (
                <div className="text-center text-slate-500 py-10 text-xs">
                  Aucun destinataire correspondant à votre recherche.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Campaign Composer & Batch Configuration */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <form onSubmit={handleCreateCampaign} className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  CONFIGURATION & CONTENU DE LA CAMPAGNE
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Définissez l&apos;objet, le message et les règles de cadencement quotidien.
                </p>
              </div>

              {/* Campaign Title & Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">
                    Titre interne de la campagne
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Annonce Nouvelle Fonctionnalité"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">
                    Objet de l&apos;e-mail (Reçu par les clients) *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Information Importante — Kobara"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">
                  Contenu du message *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Bonjour,\n\nNous avons le plaisir de vous informer..."
                  required
                  rows={9}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 font-sans resize-none leading-relaxed"
                />
              </div>

              {/* Automation & Batching Parameters */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-red-400" />
                    PARAMÈTRES DE DRIP BATCHING & DÉBIT
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Anti-Spam / Anti-Burst Protection</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Daily Limit */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      QUOTA QUOTIDIEN (MAX / JOUR)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value) || 50)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold focus:border-red-500"
                      />
                      <span className="text-[11px] text-slate-500">e-mails / jour (Défaut : 50)</span>
                    </div>
                  </div>

                  {/* Rate Limit Per Second */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      RÉGULATION DU DÉBIT (MAX / SEC)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={ratePerSecond}
                        onChange={(e) => setRatePerSecond(Number(e.target.value) || 7)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold focus:border-red-500"
                      />
                      <span className="text-[11px] text-slate-500">e-mails / sec (Défaut : 7)</span>
                    </div>
                  </div>
                </div>

                {/* Scheduling Option */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-red-500"
                      />
                      Programmer à une date ultérieure
                    </label>
                    {isScheduled && (
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-red-500"
                      />
                    )}
                  </div>
                </div>

                {/* Telegram Multi-channel Broadcast Option */}
                <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 uppercase font-mono">
                    <Send className="w-3 h-3" /> Diffusion Telegram Simultanée
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <input
                        type="checkbox"
                        checked={broadcastTelegramChannel}
                        onChange={(e) => setBroadcastTelegramChannel(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Canal / Forum (@KobaraCommunity)</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <input
                        type="checkbox"
                        checked={broadcastTelegramMerchants}
                        onChange={(e) => setBroadcastTelegramMerchants(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-blue-500"
                      />
                      <span>DM Privés aux Marchands Liés</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic Batch Breakdown Preview */}
              {totalSelected > 0 && (
                <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-red-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-red-400" />
                      RÉPARTITION AUTOMATIQUE DE LA CAMPAGNE
                    </span>
                    <span className="bg-red-500/20 px-2 py-0.5 rounded font-mono">
                      {totalSelected} destinataires
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1 font-mono">
                    <div>
                      • <strong>{calculatedBatchesCount} lot(s)</strong> de {dailyLimit} e-mails par jour.
                    </div>
                    <div>
                      • <strong>Jour 1 {isScheduled ? '(Programmé)' : '(Aujourd\'hui)'} :</strong> {Math.min(totalSelected, dailyLimit)} e-mails
                      {totalSelected > dailyLimit && (
                        <span> | <strong>Jour 2 :</strong> {Math.min(totalSelected - dailyLimit, dailyLimit)} e-mails</span>
                      )}
                      {totalSelected > dailyLimit * 2 && (
                        <span> | <strong>Jour 3 :</strong> {Math.min(totalSelected - dailyLimit * 2, dailyLimit)} e-mails...</span>
                      )}
                    </div>
                    <div>
                      • <strong>Débit d&apos;envoi :</strong> {ratePerSecond} e-mails / seconde (~{estSecondsPerBatch} secondes par lot).
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || totalSelected === 0 || !subject.trim() || !content.trim()}
                className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-600 text-white py-3 rounded-xl font-bold transition-all text-xs tracking-wider shadow-lg shadow-red-600/20"
              >
                <Send className="w-4 h-4" />
                {isPending ? (
                  'ENREGISTREMENT & INITIALISATION...'
                ) : isScheduled ? (
                  `PROGRAMMER LA CAMPAGNE POUR ${totalSelected} DESTINATAIRE${totalSelected > 1 ? 'S' : ''}`
                ) : (
                  `LANCER LA CAMPAGNE (${totalSelected} DESTINATAIRE${totalSelected > 1 ? 'S' : ''} — 1ER LOT DE ${Math.min(totalSelected, dailyLimit)})`
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGNS MONITOR & RECIPIENT INSPECTOR */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Header Action */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                HISTORIQUE & LOTS EN COURS
              </h2>
              <p className="text-xs text-slate-400">
                Suivi en direct de l&apos;avancement des envois par jour et des statuts individuels.
              </p>
            </div>
            <button
              onClick={refreshCampaigns}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-bold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
          </div>

          {/* Campaigns Grid */}
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((camp) => {
              const progressPct = camp.total_recipients > 0
                ? Math.round((camp.sent_count / camp.total_recipients) * 100)
                : 0;

              const isCompleted = camp.status === 'completed';
              const isPaused = camp.status === 'paused';
              const isCancelled = camp.status === 'cancelled';
              const isScheduledCamp = camp.status === 'scheduled';
              const todayDateStr = new Date().toISOString().split('T')[0];
              const quotaReachedToday = camp.last_sent_date === todayDateStr && camp.sent_today_count >= camp.daily_limit;

              return (
                <div
                  key={camp.id}
                  className={`bg-slate-900 border rounded-xl p-5 transition-all ${
                    selectedCampaignId === camp.id
                      ? 'border-red-500/60 ring-1 ring-red-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Campaign Info */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">
                          {camp.title || camp.subject}
                        </span>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase ${
                            isCompleted
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : isPaused
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isCancelled
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : isScheduledCamp
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
                          }`}
                        >
                          {isCompleted
                            ? 'Terminé'
                            : isPaused
                            ? 'En Pause'
                            : isCancelled
                            ? 'Annulé'
                            : isScheduledCamp
                            ? 'Programmé'
                            : 'En cours (Drip)'}
                        </span>

                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          Audience : {camp.audience_type}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 font-mono truncate">
                        Sujet : &quot;{camp.subject}&quot;
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                        <span>Créée le {new Date(camp.created_at).toLocaleDateString('fr-HT')}</span>
                        {camp.scheduled_at && (
                          <span>• Programmée pour le {new Date(camp.scheduled_at).toLocaleString('fr-HT')}</span>
                        )}
                        <span>• Quota : {camp.daily_limit}/jour ({camp.rate_per_second}/sec)</span>
                      </div>
                    </div>

                    {/* Progress Stats */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6">
                      <div className="w-full sm:w-48 space-y-1.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Progression</span>
                          <span className="text-white font-bold">{camp.sent_count}/{camp.total_recipients} ({progressPct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all ${
                              isCompleted ? 'bg-green-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span className="text-amber-400">{camp.pending_count} en attente</span>
                          {camp.failed_count > 0 && (
                            <span className="text-red-400 font-bold">{camp.failed_count} échec(s)</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Process Today Batch Button */}
                        {!isCompleted && !isCancelled && (
                          <button
                            onClick={() => handleProcessTodayBatch(camp.id)}
                            disabled={isPending || quotaReachedToday || isPaused}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              quotaReachedToday
                                ? 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'
                            }`}
                            title={quotaReachedToday ? 'Quota de 50 e-mails déjà atteint aujourd\'hui' : 'Envoyer le lot du jour'}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            {quotaReachedToday ? 'Quota du jour atteint (50/50)' : 'Envoyer lot du jour'}
                          </button>
                        )}

                        {/* Retry Failed Button */}
                        {camp.failed_count > 0 && (
                          <button
                            onClick={() => handleRetryFailed(camp.id)}
                            disabled={isPending}
                            className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Relancer échecs ({camp.failed_count})
                          </button>
                        )}

                        {/* Pause / Resume */}
                        {!isCompleted && !isCancelled && (
                          <button
                            onClick={() => handleTogglePause(camp)}
                            disabled={isPending}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            title={isPaused ? 'Reprendre' : 'Mettre en pause'}
                          >
                            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {/* View Details / Recipients Button */}
                        <button
                          onClick={() => loadCampaignDetails(camp.id)}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Détails
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {campaigns.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 space-y-3">
                <Mail className="w-8 h-8 mx-auto text-slate-600" />
                <div className="font-bold text-sm text-slate-400">AUCUNE CAMPAGNE ENREGISTRÉE</div>
                <p className="text-xs">Créez votre première campagne avec l&apos;onglet &quot;Nouvelle Campagne&quot;.</p>
              </div>
            )}
          </div>

          {/* RECIPIENT INSPECTOR DRAWER / MODAL */}
          {selectedCampaignId && campaignDetails && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-500" />
                    TRAÇABILITÉ DES DESTINATAIRES — {campaignDetails.campaign.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visualisez qui a reçu l&apos;e-mail, qui est en attente du prochain lot, et les éventuelles erreurs de distribution.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setCampaignDetails(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg self-start sm:self-auto"
                >
                  Fermer l&apos;inspecteur
                </button>
              </div>

              {/* Status Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 gap-1 w-full sm:w-auto">
                  <button
                    onClick={() => loadCampaignDetails(selectedCampaignId, 'all', 1, recipientSearch)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      recipientFilterStatus === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tous ({campaignDetails.campaign.total_recipients})
                  </button>
                  <button
                    onClick={() => loadCampaignDetails(selectedCampaignId, 'sent', 1, recipientSearch)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      recipientFilterStatus === 'sent'
                        ? 'bg-green-600 text-white'
                        : 'text-slate-400 hover:text-green-400'
                    }`}
                  >
                    Envoyés ({campaignDetails.campaign.sent_count})
                  </button>
                  <button
                    onClick={() => loadCampaignDetails(selectedCampaignId, 'pending', 1, recipientSearch)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      recipientFilterStatus === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    En Attente ({campaignDetails.campaign.pending_count})
                  </button>
                  <button
                    onClick={() => loadCampaignDetails(selectedCampaignId, 'failed', 1, recipientSearch)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      recipientFilterStatus === 'failed'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-red-400'
                    }`}
                  >
                    Échoués ({campaignDetails.campaign.failed_count})
                  </button>
                </div>

                {/* Recipient Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => {
                      setRecipientSearch(e.target.value);
                      loadCampaignDetails(selectedCampaignId, recipientFilterStatus, 1, e.target.value);
                    }}
                    placeholder="Chercher un destinataire..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Recipients Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <tr>
                      <th className="py-3 px-4">DESTINATAIRE</th>
                      <th className="py-3 px-4">TYPE</th>
                      <th className="py-3 px-4">LOT PRÉVU</th>
                      <th className="py-3 px-4">STATUT</th>
                      <th className="py-3 px-4">DATE D&apos;ENVOI / ERREUR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {campaignDetails.recipients.map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{rec.recipient_name || 'Sans nom'}</div>
                          <div className="text-slate-400 text-[11px]">{rec.recipient_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                            {rec.recipient_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-300">Lot #{rec.batch_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              rec.status === 'sent'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : rec.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : rec.status === 'sending'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {rec.status === 'sent'
                              ? 'Délivré'
                              : rec.status === 'pending'
                              ? 'En attente'
                              : rec.status === 'sending'
                              ? 'En cours'
                              : 'Échec'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {rec.sent_at ? (
                            <span className="text-slate-400">
                              {new Date(rec.sent_at).toLocaleString('fr-HT')}
                            </span>
                          ) : rec.error_message ? (
                            <span className="text-red-400 max-w-xs truncate block" title={rec.error_message}>
                              {rec.error_message}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {campaignDetails.recipients.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Aucun destinataire dans cette vue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {campaignDetails.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Page {campaignDetails.page} sur {campaignDetails.totalPages} ({campaignDetails.totalRecipients} résultats)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={campaignDetails.page <= 1}
                      onClick={() => loadCampaignDetails(selectedCampaignId, recipientFilterStatus, campaignDetails.page - 1, recipientSearch)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-white rounded font-bold"
                    >
                      Précédent
                    </button>
                    <button
                      disabled={campaignDetails.page >= campaignDetails.totalPages}
                      onClick={() => loadCampaignDetails(selectedCampaignId, recipientFilterStatus, campaignDetails.page + 1, recipientSearch)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-white rounded font-bold"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
