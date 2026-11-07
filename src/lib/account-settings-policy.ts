type SecurityRow = { merchant_id: string; security_json?: any };

// A persisted account marker wins even after MFA is disabled. Legacy accounts
// retain their strongest existing setup instead of adopting an empty business.
export function selectAccountSecurityRow(rows: SecurityRow[], merchantIds: string[], userId: string) {
  const owned = merchantIds.flatMap(id => rows.filter(row => row.merchant_id === id));
  return owned.find(row => row.security_json?.account_user_id === userId)
    || owned.find(row => row.security_json?.two_factor_method === 'totp')
    || owned.find(row => row.security_json?.two_factor_method === 'email')
    || owned.find(row => row.security_json?.passkeys?.length > 0)
    || owned.find(row => row.merchant_id === merchantIds[0]);
}

export function publicAccountSecurity(security: any) {
  return {
    two_factor_method: security?.two_factor_method || 'none',
    passkeys: (security?.passkeys || []).map((key: any) => ({
      id: key.id, deviceType: key.deviceType, backedUp: key.backedUp, created_at: key.created_at,
    })),
  };
}
