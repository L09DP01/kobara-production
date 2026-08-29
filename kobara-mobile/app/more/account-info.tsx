import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Lock, Mail, Phone, MapPin, Building2, ChevronRight, ShieldCheck, Activity } from 'lucide-react-native';
import { apiClient } from '@/api/client';
import { EditProfileSheet } from '@/components/settings/EditProfileSheet';
import { ChangePasswordSheet } from '@/components/settings/ChangePasswordSheet';

export default function AccountInfoScreen() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isChangePasswordVisible, setIsChangePasswordVisible] = useState(false);

  const fetchMerchant = async () => {
    try {
      const res = await apiClient.get('/mobile/merchants/me');
      if (res?.data?.success) {
        setMerchant(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching merchant me:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchant();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMerchant();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'active':
      case 'approved': return 'text-green-500 bg-green-500/20';
      case 'pending': return 'text-orange-500 bg-orange-500/20';
      case 'rejected':
      case 'suspended': return 'text-red-500 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'active': return 'Actif';
      case 'approved': return 'Approuvé';
      case 'pending': return 'En attente';
      case 'rejected': return 'Rejeté';
      case 'suspended': return 'Suspendu';
      default: return status || 'Inconnu';
    }
  };

  const SettingRow = ({ icon: Icon, label, value, onPress, badge }: any) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center py-4 border-b border-white/5" disabled={!onPress}>
      <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
        <Icon size={20} color="#6B7280" />
      </View>
      <View className="ml-3 flex-1 pr-4">
        <Text className="text-slate-400 text-xs mb-1">{label}</Text>
        {badge ? (
          <View className={`self-start px-2 py-1 rounded-md ${getStatusColor(value)}`}>
            <Text className={`text-xs font-bold ${getStatusColor(value).split(' ')[0]}`}>{getStatusLabel(value)}</Text>
          </View>
        ) : (
          <Text className="text-white text-base font-medium">{value}</Text>
        )}
      </View>
      {onPress && <ChevronRight size={20} color="#6B7280" />}
    </TouchableOpacity>
  );

  const formatAddress = (addrStr: any) => {
    if (!addrStr) return 'Aucune adresse renseignée';
    if (typeof addrStr === 'object') {
      const parts = [addrStr.address, addrStr.city, addrStr.state, addrStr.country, addrStr.zipcode].filter(Boolean);
      return parts.join(', ') || 'Aucune adresse renseignée';
    }
    if (typeof addrStr !== 'string') return 'Aucune adresse renseignée';
    if (!addrStr.startsWith('{')) return addrStr;
    try {
      const parsed = JSON.parse(addrStr);
      const lines = [];
      if (parsed.address) lines.push(parsed.address);
      const cityState = [parsed.city, parsed.state].filter(Boolean).join(', ');
      if (cityState) lines.push(cityState);
      const countryZip = [parsed.country, parsed.zipcode].filter(Boolean).join(' ');
      if (countryZip) lines.push(countryZip);
      return lines.join('\n') || addrStr;
    } catch(e) {
      return addrStr;
    }
  };

  return (
    <ScrollView 
      className="flex-1 bg-[#0A0F1C] px-6 pt-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
    >
      <Text className="text-slate-400 mb-6 text-sm">
        Gérez les informations de votre profil, votre adresse et vos paramètres de sécurité.
      </Text>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#F97316" className="mt-10" />
      ) : merchant ? (
        <>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Profil Entreprise</Text>
            <TouchableOpacity onPress={() => setIsEditProfileVisible(true)}>
              <Text className="text-orange-500 font-bold text-sm">Modifier</Text>
            </TouchableOpacity>
          </View>
          
          <View className="bg-[#121A2F] rounded-2xl px-4 mb-6">
            <SettingRow icon={Building2} label="Nom de l'entreprise" value={merchant.business_name || 'Non défini'} />
            <SettingRow icon={Mail} label="Adresse Email" value={merchant.email || 'Non défini'} />
            <SettingRow icon={Phone} label="Téléphone" value={merchant.phone || 'Non défini'} />
            <SettingRow icon={MapPin} label="Adresse physique" value={formatAddress(merchant.address)} />
          </View>

          <Text className="text-slate-500 text-sm font-semibold mb-2 uppercase tracking-wider">État du Compte</Text>
          <View className="bg-[#121A2F] rounded-2xl px-4 mb-6">
            <SettingRow icon={Activity} label="Statut du marchand" value={merchant.status || 'pending'} badge />
            <SettingRow icon={ShieldCheck} label="Statut KYC (Vérification)" value={merchant.kyc_status || 'pending'} badge />
          </View>

          <Text className="text-slate-500 text-sm font-semibold mb-2 uppercase tracking-wider">Sécurité</Text>
          <View className="bg-[#121A2F] rounded-2xl px-4 mb-10">
            <TouchableOpacity onPress={() => setIsChangePasswordVisible(true)} className="flex-row items-center py-4">
              <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
                <Lock size={20} color="#F97316" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white text-base font-medium">Changer le mot de passe</Text>
                <Text className="text-slate-400 text-xs mt-1">Créez un mot de passe sécurisé</Text>
              </View>
              <ChevronRight size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <EditProfileSheet 
            visible={isEditProfileVisible} 
            onClose={() => setIsEditProfileVisible(false)} 
            merchant={merchant}
            onSuccess={() => {
              setIsEditProfileVisible(false);
              fetchMerchant();
            }}
          />

          <ChangePasswordSheet 
            visible={isChangePasswordVisible} 
            onClose={() => setIsChangePasswordVisible(false)} 
          />
        </>
      ) : (
        <Text className="text-white text-center mt-10">Impossible de charger les informations.</Text>
      )}
    </ScrollView>
  );
}
