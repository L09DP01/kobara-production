import { Alert, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '@/utils/storage';

const BIOMETRICS_KEY = 'kobara_biometrics_enabled';

export async function isBiometricProtectionEnabled() {
  return (await storage.getItemAsync(BIOMETRICS_KEY)) === 'true';
}

export async function setBiometricProtectionEnabled(enabled: boolean) {
  await storage.setItemAsync(BIOMETRICS_KEY, enabled.toString());
}

export async function canUseDeviceBiometrics() {
  if (Platform.OS === 'web') return false;

  const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

  return enrolledLevel !== LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticateWithDeviceBiometrics(promptMessage: string) {
  const available = await canUseDeviceBiometrics();
  if (!available) {
    Alert.alert(
      'Passkey indisponible',
      "Configurez Face ID, une empreinte digitale ou un code de deverrouillage sur cet appareil."
    );
    return false;
  }

  try {
    (global as any).isAuthenticatingBiometrics = true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Utiliser le code de l’appareil',
      disableDeviceFallback: false,
    });

    return result.success;
  } finally {
    (global as any).isAuthenticatingBiometrics = false;
  }
}

export async function requireBiometricAuthentication(promptMessage: string) {
  const enabled = await isBiometricProtectionEnabled();
  if (!enabled) return true;

  return authenticateWithDeviceBiometrics(promptMessage);
}
