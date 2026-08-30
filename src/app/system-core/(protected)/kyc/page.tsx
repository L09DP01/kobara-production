import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import { Check, X, ShieldAlert, FileText, Image as ImageIcon } from "lucide-react";
import { revalidatePath } from "next/cache";
import { activateFreePlanAfterKyc } from "@/lib/server/plans";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminKYCPage() {
  const supabase = createAdminClient();

  const { data: rawProfiles } = await supabase
    .from('kyc_profiles')
    .select(`
      *,
      merchants!inner ( id, business_name, email, kyc_status )
    `)
    .eq('merchants.kyc_status', 'in_review')
    .order('created_at', { ascending: false });

  // Generate signed URLs for the images
  const profiles = await Promise.all((rawProfiles || []).map(async (p) => {
    let signed_front_url = null;
    let signed_back_url = null;
    let signed_selfie_url = null;
    
    if (p.document_front_url && !p.document_front_url.startsWith('http')) {
      const { data } = await supabase.storage.from('kyc_documents').createSignedUrl(p.document_front_url, 3600);
      signed_front_url = data?.signedUrl || null;
    } else {
      signed_front_url = p.document_front_url; // It might be a mock https:// url
    }

    if (p.document_back_url && !p.document_back_url.startsWith('http')) {
      const { data } = await supabase.storage.from('kyc_documents').createSignedUrl(p.document_back_url, 3600);
      signed_back_url = data?.signedUrl || null;
    } else {
      signed_back_url = p.document_back_url;
    }

    if (p.selfie_url && !p.selfie_url.startsWith('http')) {
      const { data } = await supabase.storage.from('kyc_documents').createSignedUrl(p.selfie_url, 3600);
      signed_selfie_url = data?.signedUrl || null;
    } else {
      signed_selfie_url = p.selfie_url;
    }

    return { ...p, signed_front_url, signed_back_url, signed_selfie_url };
  }));

  // Récupérer les dossiers de fraude KYC
  const { data: fraudCases } = await supabase
    .from('kyc_fraud_cases')
    .select(`
      *,
      primary_merchant:merchants!primary_merchant_id ( id, business_name, email, account_access, kyc_status ),
      related_merchant:merchants!related_merchant_id ( id, business_name, email, account_access, kyc_status )
    `)
    .order('created_at', { ascending: false })
    .limit(30);

  async function resolveFraudCase(formData: FormData) {
    'use server';
    const fraudCaseId = formData.get('fraud_case_id') as string;
    const primaryVerdict = (formData.get('primary_verdict') as 'legitimate' | 'fraudulent') || 'legitimate';
    const relatedVerdict = (formData.get('related_verdict') as 'confirmed_duplicate' | 'legitimate' | 'fraudulent') || 'confirmed_duplicate';
    const resolutionNote = (formData.get('resolution_note') as string) || 'Décision administrative AML Compliance';
    const session = await requireAdmin(['super_admin', 'compliance']);

    const { KycFraudEngine } = await import('@/lib/server/kyc/fraud-engine');
    await KycFraudEngine.resolveFraudCase({
      fraudCaseId,
      adminUserId: session.user.id,
      primaryVerdict,
      relatedVerdict,
      note: resolutionNote,
    });

    revalidatePath('/system-core/kyc');
    revalidatePath('/system-core/risk-monitoring');
  }

  async function processClosurePayoutAction(formData: FormData) {
    'use server';
    const fraudCaseId = formData.get('fraud_case_id') as string;
    const transactionReference = formData.get('transaction_reference') as string;
    const note = formData.get('note') as string;
    const session = await requireAdmin(['super_admin', 'compliance']);

    const { KycFraudEngine } = await import('@/lib/server/kyc/fraud-engine');
    await KycFraudEngine.processClosurePayout({
      fraudCaseId,
      adminUserId: session.user.id,
      transactionReference,
      note,
    });

    revalidatePath('/system-core/kyc');
    revalidatePath('/system-core/risk-monitoring');
  }

  async function approveKYC(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const merchantId = formData.get('merchant_id') as string;
    const session = await requireAdmin(['super_admin', 'compliance']);
    const adminClient = createAdminClient();
    
    // Update KYC profile
    await adminClient.from('kyc_profiles').update({ 
      status: 'approved',
      rejection_reason: null,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      reviewed_by: session.user.id,
    }).eq('id', id);

    // Update merchant
    await adminClient.from('merchants').update({ 
      kyc_status: 'approved',
      kyc_verified_at: new Date().toISOString(),
      current_environment: 'live',
    }).eq('id', merchantId);

    await adminClient.from('kyc_events').insert({
      merchant_id: merchantId,
      kyc_profile_id: id,
      event_type: 'admin_approved',
      payload: { admin_id: session.user.id },
    });
    await adminClient.from('audit_logs').insert({
      admin_id: session.user.id,
      merchant_id: merchantId,
      action: 'kyc.approved',
      entity_type: 'kyc_profiles',
      entity_id: id,
    });

    // Auto-activate free plan and send notification
    try {
      await activateFreePlanAfterKyc(merchantId);
    } catch (e) {
      console.error("Failed to auto-activate free plan:", e);
    }

    revalidatePath('/system-core/kyc');
  }

  async function rejectKYC(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const merchantId = formData.get('merchant_id') as string;
    const reason = formData.get('reason') as string || 'Document invalide ou illisible (Vérification manuelle)';
    const session = await requireAdmin(['super_admin', 'compliance']);
    const adminClient = createAdminClient();
    
    // Update KYC profile
    await adminClient.from('kyc_profiles').update({ 
      status: 'rejected',
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      approved_at: null,
      reviewed_by: session.user.id,
    }).eq('id', id);

    // Update merchant
    await adminClient.from('merchants').update({ 
      kyc_status: 'rejected' 
    }).eq('id', merchantId);

    await adminClient.from('kyc_events').insert({
      merchant_id: merchantId,
      kyc_profile_id: id,
      event_type: 'admin_rejected',
      payload: { admin_id: session.user.id, reason },
    });
    await adminClient.from('audit_logs').insert({
      admin_id: session.user.id,
      merchant_id: merchantId,
      action: 'kyc.rejected',
      entity_type: 'kyc_profiles',
      entity_id: id,
      metadata: { reason },
    });

    revalidatePath('/system-core/kyc');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
          KYC MANUAL REVIEW
        </h1>
        <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded border border-amber-500/20 text-xs font-bold">
          {profiles?.length || 0} PENDING
        </div>
      </div>

      {(!profiles || profiles.length === 0) ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-12 h-12 text-slate-700 mb-4" />
          <h2 className="text-lg font-bold text-slate-300">QUEUE EMPTY</h2>
          <p className="text-slate-500 mt-2">No KYC profiles currently require manual intervention.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {profiles.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-200">{p.merchants?.business_name || 'Unknown'}</div>
                  <div className="text-xs text-slate-500 font-mono">{p.merchants?.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">SUBMITTED ON</div>
                  <div className="text-sm font-mono text-slate-200">{new Date(p.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> EXTRACTED DATA
                  </h3>
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-sm space-y-2">
                    <div className="grid grid-cols-3">
                      <span className="text-slate-500">FIRST NAME:</span>
                      <span className="col-span-2 text-slate-300">{p.full_name?.split(' ')[0] || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-500">LAST NAME:</span>
                      <span className="col-span-2 text-slate-300">{p.full_name?.split(' ').slice(1).join(' ') || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-500">DOC TYPE:</span>
                      <span className="col-span-2 text-slate-300 uppercase">{p.document_type || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-500">DOC NUMBER:</span>
                      <span className="col-span-2 text-slate-300">{p.document_number_hash ? '***' + p.document_number_hash.slice(-4) : 'N/A'}</span>
                    </div>
                  </div>

                  {p.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-400">
                      <strong>AI WARNING:</strong> {p.rejection_reason}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> DOCUMENTS
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="aspect-[4/3] bg-slate-950 border border-slate-800 rounded flex items-center justify-center relative overflow-hidden group">
                      {p.signed_front_url ? (
                        <Image src={p.signed_front_url} alt="ID Document" fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-cover" />
                      ) : (
                        <span className="text-slate-600 text-xs">NO DOC</span>
                      )}
                      {p.signed_front_url && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={p.signed_front_url} target="_blank" className="text-xs font-bold text-white border border-slate-600 px-3 py-1 rounded hover:bg-slate-800">VIEW FULL</Link>
                        </div>
                      )}
                    </div>
                    <div className="aspect-[4/3] bg-slate-950 border border-slate-800 rounded flex items-center justify-center relative overflow-hidden group">
                      {p.signed_back_url ? (
                        <Image src={p.signed_back_url} alt="Verso du document" fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-cover" />
                      ) : (
                        <span className="text-slate-600 text-xs">NO BACK</span>
                      )}
                      {p.signed_back_url && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={p.signed_back_url} target="_blank" className="text-xs font-bold text-white border border-slate-600 px-3 py-1 rounded hover:bg-slate-800">VIEW FULL</Link>
                        </div>
                      )}
                    </div>
                    <div className="aspect-[4/3] bg-slate-950 border border-slate-800 rounded flex items-center justify-center relative overflow-hidden group">
                      {p.signed_selfie_url ? (
                        <Image src={p.signed_selfie_url} alt="Selfie" fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-cover" />
                      ) : (
                        <span className="text-slate-600 text-xs">NO SELFIE</span>
                      )}
                      {p.signed_selfie_url && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={p.signed_selfie_url} target="_blank" className="text-xs font-bold text-white border border-slate-600 px-3 py-1 rounded hover:bg-slate-800">VIEW FULL</Link>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-400">Liveness <strong className="block text-white mt-1">{Number(p.liveness_score || 0).toFixed(0)}%</strong></div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-400">Face match <strong className="block text-white mt-1">{Number(p.face_match_score || 0).toFixed(0)}%</strong></div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-400">Risque <strong className="block text-white mt-1">{Number(p.risk_score || 0).toFixed(0)}%</strong></div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex justify-end gap-3">
                <form action={rejectKYC} className="flex-1 max-w-xs flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="merchant_id" value={p.merchant_id} />
                  <input type="text" name="reason" placeholder="Reason (optional)" className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 text-xs text-slate-200 focus:outline-none focus:border-red-500" />
                  <button type="submit" className="flex items-center gap-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 px-4 py-2 rounded text-xs font-bold transition-colors">
                    <X className="w-3 h-3" /> REJECT
                  </button>
                </form>

                <form action={approveKYC}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="merchant_id" value={p.merchant_id} />
                  <button type="submit" className="h-full flex items-center gap-1 bg-green-600 text-white px-6 py-2 rounded text-xs font-bold hover:bg-green-700 transition-colors shadow-[0_0_10px_rgba(22,163,74,0.3)]">
                    <Check className="w-3 h-3" /> APPROVE
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION ANTIFRAUDE MULTI-COMPTES (DIDIT KYC) */}
      <div className="mt-12 pt-8 border-t border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Dossiers Antifraude Multi-Comptes ({fraudCases?.length || 0})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Détection automatique des doublons d'identité (1 personne réelle = 1 seul compte Kobara).
            </p>
          </div>
        </div>

        {(!fraudCases || fraudCases.length === 0) ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 text-center">
            <Check className="w-8 h-8 text-green-400 mx-auto mb-2 opacity-80" />
            <p className="text-slate-300 text-sm font-medium">Aucun conflit d'identité détecté</p>
            <p className="text-slate-500 text-xs mt-1">Tous les comptes vérifiés respectent la règle d'identité unique.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fraudCases.map((fc: any) => {
              const isResolved = fc.status === 'resolved' || fc.status === 'false_positive';
              const isConfirmed = fc.status === 'confirmed_fraud';
              return (
                <div key={fc.id} className="bg-slate-900 border border-red-500/30 rounded-xl p-5 space-y-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        fc.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {fc.severity}
                      </span>
                      <span className="text-xs font-mono text-slate-400">Case #{fc.id.substring(0, 8)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isResolved ? 'bg-green-500/10 text-green-400' : isConfirmed ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        Statut: {fc.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(fc.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Compte Principal A */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
                      <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Compte Principal (A)</div>
                      <div className="text-sm font-semibold text-white">{fc.primary_merchant?.business_name || 'Inconnu'}</div>
                      <div className="text-xs text-slate-400">{fc.primary_merchant?.email}</div>
                      <div className="text-xs font-mono text-slate-500">ID: {fc.primary_merchant_id}</div>
                      <div className="text-xs text-red-300 mt-1">Accès: {fc.primary_merchant?.account_access} | KYC: {fc.primary_merchant?.kyc_status}</div>
                    </div>

                    {/* Compte Lié B */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1">
                      <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Compte En Conflit (B)</div>
                      <div className="text-sm font-semibold text-white">{fc.related_merchant?.business_name || 'Non rattaché'}</div>
                      <div className="text-xs text-slate-400">{fc.related_merchant?.email || 'N/A'}</div>
                      <div className="text-xs font-mono text-slate-500">ID: {fc.related_merchant_id || 'N/A'}</div>
                      <div className="text-xs text-red-300 mt-1">Accès: {fc.related_merchant?.account_access || 'N/A'} | KYC: {fc.related_merchant?.kyc_status || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Preuves & Signaux */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {fc.document_match && <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-1 rounded font-semibold">📄 Même Pièce d'Identité</span>}
                    {fc.face_match && <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-1 rounded font-semibold">👤 Même Visage Biométrique</span>}
                    {fc.device_match && <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded">📱 Même Appareil</span>}
                    {fc.ip_match && <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded">🌐 Même IP</span>}
                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded">Score Risque: {fc.risk_score}/100</span>
                  </div>

                  {/* RAPPORT AI COMPLIANCE ANALYST */}
                  {fc.ai_compliance_report && (
                    <div className="p-3 bg-slate-950/80 border border-indigo-500/30 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-indigo-400 font-bold uppercase tracking-wider">
                        <span>🤖 Analyse IA de Conformité (Interne)</span>
                        <span className="text-[10px] text-slate-500">Confiance : {fc.ai_compliance_report.confidence_level || 'Certain'}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{fc.ai_compliance_report.suspension_cause || fc.ai_compliance_report.summary}</p>
                      {fc.ai_compliance_report.support_recommendations?.length > 0 && (
                        <div className="pt-1 text-slate-400">
                          <strong className="text-slate-200">Recommandation Support :</strong> {fc.ai_compliance_report.support_recommendations.join(' • ')}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 italic">{fc.ai_compliance_report.disclaimer || "Analyse générée à partir des événements et décisions déterministes enregistrés par Kobara. L'IA n'a pas pris la décision de suspension."}</p>
                    </div>
                  )}

                  {/* Actions Administratives AML / CFT */}
                  {!isResolved && !isConfirmed ? (
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                      <form action={resolveFraudCase} className="inline-block">
                        <input type="hidden" name="fraud_case_id" value={fc.id} />
                        <input type="hidden" name="primary_verdict" value="legitimate" />
                        <input type="hidden" name="related_verdict" value="confirmed_duplicate" />
                        <input type="hidden" name="resolution_note" value="Compte A déclaré légitime (Re-KYC requis). Compte B déclaré dupliqué (procédure de clôture)." />
                        <button type="submit" className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 text-xs px-3 py-1.5 rounded font-bold transition-all">
                          A Légitime (Re-KYC) • B Dupliqué
                        </button>
                      </form>

                      <form action={resolveFraudCase} className="inline-block">
                        <input type="hidden" name="fraud_case_id" value={fc.id} />
                        <input type="hidden" name="primary_verdict" value="fraudulent" />
                        <input type="hidden" name="related_verdict" value="legitimate" />
                        <input type="hidden" name="resolution_note" value="Compte B déclaré légitime (Re-KYC requis). Compte A déclaré dupliqué (procédure de clôture)." />
                        <button type="submit" className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/40 text-xs px-3 py-1.5 rounded font-bold transition-all">
                          B Légitime (Re-KYC) • A Dupliqué
                        </button>
                      </form>

                      <form action={resolveFraudCase} className="inline-block">
                        <input type="hidden" name="fraud_case_id" value={fc.id} />
                        <input type="hidden" name="primary_verdict" value="fraudulent" />
                        <input type="hidden" name="related_verdict" value="fraudulent" />
                        <input type="hidden" name="resolution_note" value="Fraude d'identité confirmée sur les deux comptes (clôture & séquestre)." />
                        <button type="submit" className="bg-red-600 text-white hover:bg-red-700 text-xs px-3 py-1.5 rounded font-bold transition-all shadow-md">
                          Confirmer Fraude (Clôturer les 2)
                        </button>
                      </form>
                    </div>
                  ) : fc.payout_status === 'instructions_submitted' ? (
                    /* Formulaire de validation du Payout de Clôture */
                    <div className="pt-3 border-t border-slate-800 bg-amber-950/20 border-amber-500/30 p-3 rounded-lg space-y-2">
                      <div className="text-xs font-bold text-amber-400">Demande de Versement de Clôture Reçue (Solde : {fc.payout_amount} HTG)</div>
                      <div className="text-xs text-slate-300">
                        Méthode : {fc.payout_details?.payoutMethod} | Compte : {fc.payout_details?.payoutAccountNumber} ({fc.payout_details?.payoutAccountName})
                      </div>
                      <form action={processClosurePayoutAction} className="flex items-center gap-2 pt-1">
                        <input type="hidden" name="fraud_case_id" value={fc.id} />
                        <input
                          type="text"
                          name="transaction_reference"
                          placeholder="Réf Transaction MonCash / Virement"
                          className="bg-slate-900 border border-slate-700 rounded text-xs px-2.5 py-1.5 text-white focus:outline-none flex-1"
                          required
                        />
                        <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded font-bold transition-all">
                          Valider le Règlement
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
