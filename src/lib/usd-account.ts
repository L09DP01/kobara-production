export interface UsdAccountStateInput {
  merchantEnabled?: boolean | null;
  settingsEnabled?: boolean | null;
  merchantHasAccount?: boolean | null;
  settingsHasAccount?: boolean | null;
  globalEnabled?: boolean | null;
}

export interface UsdAccountState {
  adminEnabled: boolean;
  globalEnabled: boolean;
  isEnabled: boolean;
  hasAccount: boolean;
  canCreate: boolean;
  isActive: boolean;
  status: 'hidden' | 'available' | 'active' | 'suspended';
}

export function resolveUsdAccountState(input: UsdAccountStateInput): UsdAccountState {
  const adminEnabled = input.merchantEnabled == null
    ? input.settingsEnabled === true
    : input.merchantEnabled === true;
  const globalEnabled = input.globalEnabled === true;
  const hasAccount = input.merchantHasAccount == null
    ? input.settingsHasAccount === true
    : input.merchantHasAccount === true;
  const featureEnabled = adminEnabled || globalEnabled;

  return {
    adminEnabled,
    globalEnabled,
    isEnabled: featureEnabled,
    hasAccount,
    canCreate: featureEnabled && !hasAccount,
    isActive: featureEnabled && hasAccount,
    status: hasAccount
      ? (featureEnabled ? 'active' : 'suspended')
      : (featureEnabled ? 'available' : 'hidden'),
  };
}
