import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  Bell, QrCode, Store, User, ArrowUpRight, Zap, Palette, Settings, 
  ScanFace, EyeOff, HeadphonesIcon, Star, MessageSquare, Users, 
  ShieldCheck, Info, LogOut, ChevronRight
} from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/api/client';
import { storage as SecureStore } from '@/utils/storage';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  authenticateWithDeviceBiometrics,
  canUseDeviceBiometrics,
  setBiometricProtectionEnabled,
} from '@/services/security';

export default function MoreScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Settings states
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [hidePreviewEnabled, setHidePreviewEnabled] = useState(false);

  const fetchMerchant = async () => {
    try {
      const res = await apiClient.get('/mobile/dashboard/summary');
      if (res?.data?.success && res?.data?.merchant) {
        setMerchant(res.data.merchant);
      }
      
      // Fetch settings locally
      const bio = await SecureStore.getItemAsync('kobara_biometrics_enabled');
      const hide = await SecureStore.getItemAsync('kobara_hide_preview');
      setBiometricsEnabled(bio === 'true');
      setHidePreviewEnabled(hide === 'true');

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMerchant();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMerchant();
  };

  const handleLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive",
          onPress: async () => {
            // Clear settings if needed, logout clears secure store
            logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const toggleBiometrics = async () => {
    const newValue = !biometricsEnabled;

    if (newValue) {
      if (!(await canUseDeviceBiometrics())) {
        Alert.alert("Erreur", "Configurez Face ID, une empreinte digitale ou un code de deverrouillage sur cet appareil.");
        return;
      }

      const confirmed = await authenticateWithDeviceBiometrics('Confirmez votre identite pour activer Passkey');
      if (!confirmed) return;
    }

    setBiometricsEnabled(newValue);
    await setBiometricProtectionEnabled(newValue);
  };

  const toggleHidePreview = async () => {
    const newValue = !hidePreviewEnabled;
    setHidePreviewEnabled(newValue);
    await SecureStore.setItemAsync('kobara_hide_preview', newValue.toString());
  };

  const MenuItem = ({ icon: Icon, title, subtitle, onPress, showArrow = true, isDestructive = false }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row items-center justify-between py-4"
    >
      <View className="flex-row items-center flex-1">
        <Icon size={20} color={isDestructive ? "#EF4444" : "#F97316"} />
        <View className="ml-3 flex-1 pr-4">
          <Text className={`font-medium text-base ${isDestructive ? 'text-red-500' : 'text-white'}`}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-slate-400 text-xs mt-1" numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {showArrow && !isDestructive && (
        <ChevronRight size={20} color="#6B7280" />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text className="text-slate-500 text-sm font-semibold mt-6 mb-2 uppercase tracking-wider">{title}</Text>
  );

  return (
    <View className="flex-1 bg-[#0A0F1C]">
      <DashboardHeader 
        merchant={merchant} 
        unreadCount={unreadCount} 
        onNotificationPress={() => router.push('/notifications')} 
        onScanPress={() => {/* handle scan later if needed, QR sheet */}}
      />

      <ScrollView 
        className="flex-1 px-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        <View className="mb-6">
          <Text className="text-white text-3xl font-bold mb-2">Plus</Text>
          <Text className="text-slate-400">Gérez votre compte, vos préférences et plus encore.</Text>
        </View>

        {/* Profil Entreprise */}
        <TouchableOpacity 
          className="bg-[#121A2F] rounded-2xl p-4 flex-row items-center justify-between mt-2 mb-2"
          onPress={() => router.push('/more/account-info')}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-14 h-14 rounded-full bg-slate-800 overflow-hidden">
              {merchant?.logo_url ? (
                <Image source={{ uri: merchant.logo_url }} className="w-full h-full" />
              ) : (
                <View className="w-full h-full items-center justify-center bg-orange-500/20">
                  <Text className="text-orange-500 font-bold text-xl">
                    {merchant?.business_name?.substring(0, 2).toUpperCase() || 'K'}
                  </Text>
                </View>
              )}
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-white font-bold text-lg">{merchant?.business_name || 'Mon Entreprise'}</Text>
              <Text className="text-slate-400 text-sm mt-1">Gérer profil, adresse, mot de passe...</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* État du compte */}
        <View className="bg-[#121A2F] rounded-2xl px-4 mt-4">
          <MenuItem 
            icon={ArrowUpRight} 
            title="État du compte" 
            onPress={() => router.push('/more/account-status')} 
          />
        </View>

        {/* Paramètres Globaux */}
        <SectionHeader title="Paramètres globaux" />
        <View className="bg-[#121A2F] rounded-2xl px-4">
          <MenuItem 
            icon={Bell} 
            title="Notifications" 
            onPress={() => router.push('/more/notifications')} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={Palette} 
            title="Apparence" 
            onPress={() => router.push('/more/appearance')} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={Settings} 
            title="Paramètres système" 
            onPress={() => router.push('/more/system-settings')} 
          />
        </View>

        {/* Authentification */}
        <SectionHeader title="Authentification" />
        <View className="bg-[#121A2F] rounded-2xl px-4 py-2">
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1">
              <ScanFace size={20} color="#F97316" />
              <View className="ml-3 flex-1">
                <Text className="text-white font-medium text-base">Passkey</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Face ID, empreinte ou code de l'appareil
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={toggleBiometrics}
              className={`w-12 h-6 rounded-full p-1 ${biometricsEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}
            >
              <View className={`w-4 h-4 bg-white rounded-full ${biometricsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </TouchableOpacity>
          </View>
          <View className="h-[1px] bg-white/5" />
          <View className="py-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1">
                <EyeOff size={20} color="#F97316" />
                <Text className="ml-3 text-white font-medium text-base">Masquer l'aperçu</Text>
              </View>
              <TouchableOpacity 
                onPress={toggleHidePreview}
                className={`w-12 h-6 rounded-full p-1 ${hidePreviewEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}
              >
                <View className={`w-4 h-4 bg-white rounded-full ${hidePreviewEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </TouchableOpacity>
            </View>
            <Text className="text-slate-400 text-xs ml-8">
              Lorsque cette option est activée, les informations de votre compte sont masquées lorsque vous passez d'une application à l'autre.
            </Text>
          </View>
        </View>

        {/* Développeur */}
        <SectionHeader title="Développeur" />
        <View className="bg-[#121A2F] rounded-2xl px-4">
          <MenuItem 
            icon={Users} 
            title="Inviter un développeur" 
            onPress={() => router.push('/more/invite-developer')} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={ShieldCheck} 
            title="Gérer les accès" 
            onPress={() => router.push('/more/developer-access')} 
          />
        </View>

        {/* Assistance */}
        <SectionHeader title="Commentaires et assistance" />
        <View className="bg-[#121A2F] rounded-2xl px-4">
          <MenuItem 
            icon={HeadphonesIcon} 
            title="Obtenir de l'aide" 
            onPress={() => {
              Linking.openURL('mailto:support@kobara.app');
            }} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={Star} 
            title="Évaluez-nous" 
            subtitle="Laissez-nous un avis sur l'App Store / Play Store"
            onPress={() => {/* open app store */}} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={MessageSquare} 
            title="Comment clôturer votre compte" 
            onPress={() => {
              Linking.openURL('https://kobara.app/account-closure');
            }} 
          />
        </View>

        {/* A Propos */}
        <SectionHeader title="À propos" />
        <View className="bg-[#121A2F] rounded-2xl px-4 mb-6">
          <MenuItem 
            icon={Users} 
            title="Bibliothèques collaboratives" 
            onPress={() => router.push('/more/licenses')} 
          />
          <View className="h-[1px] bg-white/5" />
          <MenuItem 
            icon={ShieldCheck} 
            title="Politique de confidentialité" 
            onPress={() => {
              Linking.openURL('https://kobara.app/privacy');
            }} 
          />
          <View className="h-[1px] bg-white/5" />
          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center flex-1">
              <Info size={20} color="#F97316" />
              <Text className="ml-3 text-white font-medium text-base">Version</Text>
            </View>
            <Text className="text-slate-400">v1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <View className="bg-[#121A2F] rounded-2xl px-4 mb-10">
          <MenuItem 
            icon={LogOut} 
            title="Se déconnecter" 
            isDestructive={true}
            onPress={handleLogout} 
          />
        </View>
        {/* Bottom Spacing for Tab Bar */}
        <View className="h-24" />
      </ScrollView>
    </View>
  );
}
