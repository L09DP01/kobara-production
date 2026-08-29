import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, ScanFace } from 'lucide-react-native';
import { useAuthStore, getSavedEmail, saveEmail, clearSavedEmail, getSavedPassword } from '@/store/useAuthStore';
import LoginIllustration from '@/components/illustrations/LoginIllustration';
import ENV from '@/config/env';
import { storage as SecureStore } from '@/utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { canUseDeviceBiometrics } from '@/services/security';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithCredentials } = useAuthStore();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  
  // Biometrics
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);

  // Refs
  const passwordRef = useRef<TextInput>(null);

  // Animations
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(-20)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorFade = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(footerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    const saved = await getSavedEmail();
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
    
    const bioEnabled = await SecureStore.getItemAsync('kobara_biometrics_enabled');
    const pwd = await getSavedPassword();
    if (bioEnabled === 'true' && saved && pwd) {
      if (await canUseDeviceBiometrics()) {
        setCanUseBiometrics(true);
        setSavedPassword(pwd);
        // On pourrait auto-lancer handleBiometricLogin ici, mais c'est mieux de laisser l'utilisateur cliquer
      }
    }
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showError = (message: string) => {
    setError(message);
    errorFade.setValue(0);
    Animated.timing(errorFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    triggerShake();
  };

  const handleBiometricLogin = async () => {
    if (!savedPassword || !email) return;
    
    try {
      (global as any).isAuthenticatingBiometrics = true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Connectez-vous avec Passkey',
        fallbackLabel: "Utiliser le code de l'appareil",
        disableDeviceFallback: false,
      });
      (global as any).isAuthenticatingBiometrics = false;
      
      if (result.success) {
        setIsLoading(true);
        try {
          await loginWithCredentials(email, savedPassword);
          // Navigation gérée par le _layout.tsx
        } catch (err: any) {
          const message = err?.message || 'Une erreur est survenue. Veuillez réessayer.';
          showError(message);
          setIsLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    setError('');

    if (!isValidEmail(email)) {
      showError('Veuillez entrer une adresse email valide.');
      return;
    }
    if (password.length < 6) {
      showError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsLoading(true);

    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      await loginWithCredentials(email, password);

      if (rememberMe) {
        await saveEmail(email);
      } else {
        await clearSavedEmail();
      }
      // Navigation gérée par le _layout.tsx
    } catch (err: any) {
      const message = err?.message || 'Une erreur est survenue. Veuillez réessayer.';
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Linking.openURL(`${ENV.WEB_URL}/forgot-password`);
  };

  const handleCreateAccount = () => {
    Linking.openURL(`${ENV.WEB_URL}/register`);
  };

  const isFormValid = isValidEmail(email) && password.length >= 6;
  const showEmailError = emailTouched && email.length > 0 && !isValidEmail(email);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* ========== LOGO ========== */}
        <Animated.View style={[styles.logoContainer, { opacity: logoFade, transform: [{ translateY: logoSlide }] }]}>
          <Image
            source={require('@/assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>KOBARA</Text>
        </Animated.View>

        {/* ========== HEADER + ILLUSTRATION ========== */}
        <Animated.View style={[styles.headerRow, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>
              Connectez-vous à votre compte pour accéder à votre dashboard.
            </Text>
          </View>
          <View style={styles.illustrationWrapper}>
            <LoginIllustration size={120} />
          </View>
        </Animated.View>

        {/* ========== ERROR MESSAGE ========== */}
        {error ? (
          <Animated.View style={[styles.errorContainer, { opacity: errorFade, transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {/* ========== FORM ========== */}
        <Animated.View style={[styles.formContainer, { opacity: formFade, transform: [{ translateY: formSlide }] }]}>
          {/* Email */}
          <Text style={styles.label}>Adresse e-mail</Text>
          <View style={[styles.inputWrapper, showEmailError && styles.inputError]}>
            <Mail size={18} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="exemple@email.com"
              placeholderTextColor="#4B5563"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              onBlur={() => setEmailTouched(true)}
              onSubmitEditing={() => passwordRef.current?.focus()}
              returnKeyType="next"
              accessibilityLabel="Adresse email"
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Mot de passe</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#4B5563"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              accessibilityLabel="Mot de passe"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? (
                <EyeOff size={18} color="#6B7280" />
              ) : (
                <Eye size={18} color="#6B7280" />
              )}
            </TouchableOpacity>
          </View>

          {/* Row: Remember Me + Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.rememberRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Se souvenir de moi</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.85}
              style={[styles.loginButton, (!isFormValid || isLoading) && styles.loginButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Biometric Login Button */}
          {canUseBiometrics && (
            <TouchableOpacity
              onPress={handleBiometricLogin}
              disabled={isLoading}
              style={[styles.bioButton, isLoading && styles.loginButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Se connecter avec Passkey"
            >
              <ScanFace size={20} color="#F97316" />
              <Text style={styles.bioButtonText}>Se connecter avec Passkey</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ========== FOOTER (spacer + create account) ========== */}
        <Animated.View style={[styles.footer, { opacity: footerFade }]}>
          <View style={styles.createAccountRow}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={handleCreateAccount}>
              <Text style={styles.createAccountLink}>Créer un compte</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginLeft: 10,
    letterSpacing: 2,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  illustrationWrapper: {
    width: 120,
    height: 120,
  },

  // Error
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },

  // Form
  formContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    height: '100%',
  },
  eyeButton: {
    padding: 8,
    marginRight: -8,
  },

  // Options Row (Remember + Forgot)
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  forgotButton: {
    paddingVertical: 4,
  },
  forgotText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '500',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  rememberText: {
    color: '#CBD5E1',
    fontSize: 13,
  },

  // Login Button
  loginButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  bioButtonText: {
    color: '#F97316',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 10,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 16,
  },
  createAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  createAccountLink: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});
