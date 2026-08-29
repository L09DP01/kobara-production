import '../global.css'; // NativeWind v4 initialization
import React, { useEffect, useState, useRef } from 'react';
import { AppState, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Stack, useSegments, useRouter, useRootNavigationState } from 'expo-router';
import { AppProvider } from '@/providers/AppProvider';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/useAuthStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { storage } from '@/utils/storage';
import * as ScreenCapture from 'expo-screen-capture';
import { isBiometricProtectionEnabled, requireBiometricAuthentication } from '@/services/security';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { hydrate, isLoading, hasSeenOnboarding, isAuthenticated, isMerchantProfileComplete } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Screen Capture & App Preview Hiding logic
    const protectScreen = async () => {
      const hidePreview = await storage.getItemAsync('kobara_hide_preview');
      if (hidePreview === 'true') {
        await ScreenCapture.preventScreenCaptureAsync();
      } else {
        await ScreenCapture.allowScreenCaptureAsync();
      }
    };
    protectScreen();

    // App State logic for biometric locking
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (!(global as any).isAuthenticatingBiometrics) {
          checkBiometrics();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as any).standalone);
      
      if (isIos && !isStandalone) {
        setShowIosInstall(true);
      }
    }
  }, []);

  const checkBiometrics = async () => {
    if ((global as any).isAuthenticatingBiometrics) return;

    if (!useAuthStore.getState().isAuthenticated || !(await isBiometricProtectionEnabled())) {
      setIsUnlocked(true);
      return;
    }

    setIsUnlocked(false);
    const success = await requireBiometricAuthentication('Deverrouillez Kobara avec Passkey');
    setIsUnlocked(success);
  };

  useEffect(() => {
    async function prepare() {
      try {
        await hydrate();
        await checkBiometrics();
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!navigationState?.key) return; // Wait for navigation to be ready

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!hasSeenOnboarding && !inOnboardingGroup) {
      // Scénario 1 : Premier lancement → Onboarding
      router.replace('/(onboarding)');
    } else if (hasSeenOnboarding && !isAuthenticated && !inAuthGroup) {
      // Scénario 2 : Pas authentifié → Login
      router.replace('/(auth)/login');
    } else if (hasSeenOnboarding && isAuthenticated && (inAuthGroup || inOnboardingGroup)) {
      // Scénario 3 : Authentifié → Dashboard
      // TODO: Si !isMerchantProfileComplete → Complete Account Wizard
      router.replace('/(tabs)');
    }
  }, [isLoading, hasSeenOnboarding, isAuthenticated, segments, navigationState?.key]);

  if (isLoading) {
    return null; // Splash screen visible pendant le chargement
  }

  if (!isUnlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0F1C', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Kobara est verrouillé</Text>
        <TouchableOpacity 
          onPress={checkBiometrics}
          style={{ backgroundColor: '#F97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Déverrouiller</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>

        {showIosInstall && Platform.OS === 'web' && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1E293B', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 20 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Installez l'App Kobara</Text>
            <Text style={{ color: '#94A3B8', fontSize: 15, marginBottom: 20, lineHeight: 22 }}>
              Pour utiliser l'application sur votre iPhone, veuillez l'ajouter à votre écran d'accueil.
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <Text style={{ color: 'white', fontSize: 15 }}>1. Appuyez sur le bouton </Text>
              <Text style={{ color: '#38BDF8', fontWeight: 'bold', fontSize: 15 }}>Partager</Text>
              <Text style={{ color: 'white', fontSize: 15 }}> en bas.</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              <Text style={{ color: 'white', fontSize: 15 }}>2. Choisissez </Text>
              <Text style={{ color: '#38BDF8', fontWeight: 'bold', fontSize: 15 }}>"Sur l'écran d'accueil"</Text>
              <Text style={{ color: 'white', fontSize: 15 }}>.</Text>
            </View>
            
            <TouchableOpacity onPress={() => setShowIosInstall(false)} style={{ backgroundColor: '#334155', padding: 16, borderRadius: 16, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>J'ai compris</Text>
            </TouchableOpacity>
          </View>
        )}
      </AppProvider>
    </GestureHandlerRootView>
  );
}
