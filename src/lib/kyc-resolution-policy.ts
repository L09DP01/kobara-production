export type ResolvedIdentityContext = {
  caseId: string;
  otherMerchantId: string;
  fingerprints: string[];
  sessionIds: string[];
};

export function getKycResolutionTimestamp(row: any): number {
  // reviewed_* are the KYC schema fields; resolved_* support historical records only.
  const reviewer = row.reviewed_by ?? row.resolved_by;
  const reviewedAt = row.reviewed_at ?? row.resolved_at;
  return reviewer && reviewedAt ? Date.parse(reviewedAt) : Number.NaN;
}

export function getResolvedIdentityContexts(merchantId: string, cases: any[], fingerprints: any[], profiles: any[] = []): ResolvedIdentityContext[] {
  return cases.flatMap(row => {
    const resolvedTime = getKycResolutionTimestamp(row);
    if (!['resolved', 'false_positive'].includes(row.status) || !Number.isFinite(resolvedTime)) return [];
    const primary = row.primary_merchant_id === merchantId;
    if (!primary && row.related_merchant_id !== merchantId) return [];
    const verdict = primary ? row.primary_verdict : row.related_verdict;
    const otherVerdict = primary ? row.related_verdict : row.primary_verdict;
    const otherMerchantId = primary ? row.related_merchant_id : row.primary_merchant_id;
    if (verdict !== 'legitimate' || !otherMerchantId || otherMerchantId === merchantId
      || !['fraudulent', 'confirmed_duplicate'].includes(otherVerdict)) return [];
    const archived = row.evidence?.resolved_identity;
    // Old dossiers are recoverable only when their identity evidence is unambiguous.
    const oldFingerprints = [...new Set(fingerprints.filter(item =>
      [merchantId, otherMerchantId].includes(item.merchant_id)
      && Number.isFinite(Date.parse(item.created_at)) && Date.parse(item.created_at) <= resolvedTime,
    ).map(item => item.document_fingerprint as string))];
    const document = row.evidence?.document_fingerprint;
    const known = Array.isArray(archived?.fingerprints) ? archived.fingerprints
      : typeof document === 'string' ? [document] : row.document_match && oldFingerprints.length === 1 ? oldFingerprints : [];
    const sessionIds = [row.primary_session_id, row.related_session_id,
      ...(Array.isArray(archived?.session_ids) ? archived.session_ids : []),
      ...profiles.filter(profile => [merchantId, otherMerchantId].includes(profile.merchant_id)
        && Number.isFinite(Date.parse(profile.updated_at)) && Date.parse(profile.updated_at) <= resolvedTime)
        .map(profile => profile.gemini_review?.didit_session_id || profile.metadata?.didit_session_id),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    return [{ caseId: row.id, otherMerchantId, fingerprints: known.filter((value: unknown): value is string => typeof value === 'string'), sessionIds }];
  });
}

export function isResolvedDocumentMatch(contexts: ResolvedIdentityContext[], otherMerchantId: string, fingerprint: string): boolean {
  return contexts.some(context => context.otherMerchantId === otherMerchantId && context.fingerprints.includes(fingerprint));
}

export function isResolvedSessionMatch(contexts: ResolvedIdentityContext[], sessionId: unknown): boolean {
  return typeof sessionId === 'string' && contexts.some(context => context.sessionIds.includes(sessionId));
}

export function isKycAccountBlocked(merchant: { status?: string; account_access?: string; kyc_status?: string }): boolean {
  return merchant.status === 'suspended' || merchant.kyc_status === 'suspended'
    || ['suspended', 'closure_pending', 'closure_pending_payout', 'closed', 'permanently_closed'].includes(merchant.account_access || '');
}

export function canApplyKycSession(merchant: { status?: string; account_access?: string; kyc_status?: string }, profile: any, sessionId: unknown): boolean {
  if (isKycAccountBlocked(merchant) || typeof sessionId !== 'string' || !sessionId) return false;
  if (merchant.kyc_status === 'pending_reverification') return false;
  const expected = profile?.gemini_review?.didit_session_id || profile?.metadata?.didit_session_id;
  if (expected) return expected === sessionId;
  return !['reverify_required', 'restricted'].includes(merchant.account_access || '');
}
