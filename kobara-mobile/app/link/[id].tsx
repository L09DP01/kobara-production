import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Link as LinkIcon, Share2, Trash2, Power, PowerOff, QrCode } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';

export default function LinkDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [link, setLink] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrRef = useRef<any>(null);

  const fetchLinkDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get(`/mobile/payment-links/${id}`);
      if (response.data?.success) {
        setLink(response.data.link);
        setPayments(response.data.payments || []);
      } else {
        setError(response.data?.error || "Lien introuvable.");
      }
    } catch (e: any) {
      setError(e.response?.data?.error || "Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkDetails();
  }, [id]);

  const handleShareLink = async () => {
    if (!link) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://kobara.app';
      const shareUrl = `${baseUrl}/pay/${link.slug}`;
      await Share.share({
        message: `Payer pour "${link.title}" sur Kobara : ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleShareQR = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL((data: string) => {
      const filename = FileSystem.cacheDirectory + 'kobara-qr.png';
      FileSystem.writeAsStringAsync(filename, data, {
        encoding: 'base64',
      }).then(() => {
        Sharing.shareAsync(filename, {
          mimeType: 'image/png',
          dialogTitle: 'Partager le QR Code',
        });
      }).catch(err => {
        console.error("Error sharing QR", err);
      });
    });
  };

  const handleToggleStatus = async () => {
    if (!link) return;
    const newStatus = link.status === 'active' ? 'inactive' : 'active';
    
    Alert.alert(
      newStatus === 'active' ? 'Activer le lien' : 'Désactiver le lien',
      newStatus === 'active' 
        ? "Les clients pourront à nouveau utiliser ce lien pour payer."
        : "Les clients ne pourront plus payer avec ce lien.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Confirmer", 
          style: newStatus === 'active' ? "default" : "destructive",
          onPress: async () => {
            try {
              setIsUpdating(true);
              const res = await apiClient.patch(`/mobile/payment-links/${id}`, { status: newStatus });
              if (res.data?.success) {
                setLink(res.data.link);
              } else {
                Alert.alert("Erreur", res.data?.error || "Une erreur est survenue");
              }
            } catch (e: any) {
              Alert.alert("Erreur", e.response?.data?.error || "Une erreur est survenue");
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      "Supprimer le lien",
      "Êtes-vous sûr de vouloir supprimer définitivement ce lien de paiement ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsUpdating(true);
              const res = await apiClient.delete(`/mobile/payment-links/${id}`);
              if (res.data?.success) {
                router.back();
              } else {
                Alert.alert("Erreur", res.data?.error || "Une erreur est survenue");
              }
            } catch (e: any) {
              Alert.alert("Erreur", e.response?.data?.error || "Une erreur est survenue");
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0F1C', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    );
  }

  if (error || !link) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0F1C' }}>
        <View className="flex-row items-center p-4 border-b border-white/5">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold ml-4">Erreur</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-400">{error || "Lien introuvable."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0F1C' }} edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-white/5">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-white/5">
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Détails du lien</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={handleShareLink} className="w-10 h-10 items-center justify-center rounded-full bg-white/5">
            <Share2 size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Main Info */}
        <View className="items-center mb-8 mt-4">
          <View className="bg-white p-3 rounded-2xl mb-4 border border-white/10 relative">
            <QRCode
              getRef={(c) => (qrRef.current = c)}
              value={`${process.env.EXPO_PUBLIC_APP_URL || 'https://kobara.app'}/pay/${link.slug}`}
              size={120}
              color="#000"
              backgroundColor="#fff"
            />
            <TouchableOpacity 
              onPress={handleShareQR}
              className="absolute -bottom-4 -right-4 w-10 h-10 rounded-full bg-orange-500 items-center justify-center border-2 border-[#0A0F1C]"
            >
              <QrCode size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text className="text-white text-2xl font-bold mb-2 text-center mt-2">
            {link.title}
          </Text>
          <Text className="text-orange-500 text-3xl font-black mb-4">
            {link.currency} {Number(link.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </Text>
          <StatusBadge status={link.status} />
        </View>

        {/* Details Card */}
        <View className="bg-[#121A2F] rounded-2xl p-4 border border-white/5 mb-6">
          <View className="flex-row items-center py-4 border-b border-white/5">
            <Text className="flex-1 text-slate-400">Date de création</Text>
            <Text className="text-white font-medium">
              {new Date(link.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>

          <View className="flex-row items-center py-4 border-b border-white/5">
            <Text className="flex-1 text-slate-400">Paiements reçus</Text>
            <Text className="text-white font-medium">
              {link.payment_count || 0}
            </Text>
          </View>

          {link.description && (
            <View className="py-4">
              <Text className="text-slate-400 mb-2">Description</Text>
              <Text className="text-white leading-relaxed">{link.description}</Text>
            </View>
          )}
        </View>

        {/* Payments List */}
        {payments.length > 0 && (
          <>
            <Text className="text-slate-400 font-medium mb-3 ml-2 uppercase text-xs tracking-wider">Paiements Récents</Text>
            <View className="bg-[#121A2F] rounded-2xl border border-white/5 overflow-hidden mb-6">
              {payments.map((payment, index) => {
                const customerName = payment.customers?.name || 'Client Anonyme';
                
                // Determine payment method label
                let paymentMethodLabel = payment.payment_method || 'Moyen de paiement inconnu';
                if (paymentMethodLabel.toLowerCase() === 'moncash') paymentMethodLabel = 'MonCash';
                if (paymentMethodLabel.toLowerCase() === 'card') paymentMethodLabel = 'Carte Bancaire';
                
                return (
                  <View 
                    key={payment.id} 
                    className={`p-4 flex-row items-center justify-between ${index !== payments.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <View className="flex-1 mr-4">
                      <Text className="text-white font-medium text-base mb-1" numberOfLines={1}>{customerName}</Text>
                      <Text className="text-slate-400 text-xs">{new Date(payment.created_at).toLocaleDateString('fr-FR')} • {paymentMethodLabel}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-bold mb-1">
                        + {Number(payment.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {link.currency}
                      </Text>
                      <StatusBadge status={payment.status} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Actions */}
        <Text className="text-slate-400 font-medium mb-3 ml-2 uppercase text-xs tracking-wider">Actions</Text>
        <View className="bg-[#121A2F] rounded-2xl border border-white/5 overflow-hidden mb-8">
          
          <TouchableOpacity 
            onPress={handleToggleStatus}
            disabled={isUpdating}
            className="flex-row items-center p-4 border-b border-white/5 active:bg-white/5"
          >
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${link.status === 'active' ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
              {link.status === 'active' ? (
                <PowerOff size={20} color="#F59E0B" />
              ) : (
                <Power size={20} color="#22C55E" />
              )}
            </View>
            <View className="flex-1">
              <Text className={`font-medium ${link.status === 'active' ? 'text-amber-500' : 'text-green-500'}`}>
                {link.status === 'active' ? 'Désactiver le lien' : 'Réactiver le lien'}
              </Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                {link.status === 'active' ? 'Empêcher de nouveaux paiements' : 'Autoriser à nouveau les paiements'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleDelete}
            disabled={isUpdating}
            className="flex-row items-center p-4 active:bg-white/5"
          >
            <View className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center mr-4">
              <Trash2 size={20} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-red-500 font-medium">Supprimer le lien</Text>
              <Text className="text-red-500/60 text-xs mt-0.5">Cette action est irréversible</Text>
            </View>
          </TouchableOpacity>

        </View>
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
