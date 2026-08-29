import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CalendarClock, CreditCard } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { storage as SecureStore } from '@/utils/storage';

import { paymentsService, MobileSubscription } from '../../services/payments';
import { balanceService } from '../../services/balance';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { apiClient } from '../../api/client';
import ENV from '../../config/env';

export default function SubscriptionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [subscription, setSubscription] = useState<MobileSubscription | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [subRes, balRes] = await Promise.all([
        paymentsService.getSubscriptionDetails(id as string),
        balanceService.getBalance()
      ]);
      setSubscription(subRes.subscription);
      setBalance(balRes.success ? balRes.balance : 0);
    } catch (err) {
      console.error("Error fetching subscription details:", err);
      Alert.alert("Erreur", "Impossible de charger l'abonnement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handlePayWithBalance = async () => {
    try {
      setIsRenewing(true);
      const res = await apiClient.post(`/mobile/subscriptions/${id}/renew-balance`);
      if (res.data.success) {
        Alert.alert("Succès", "Votre abonnement a été renouvelé avec succès !");
        fetchData();
      } else {
        Alert.alert("Erreur", res.data.error || "Une erreur est survenue.");
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handlePayWithMonCash = async () => {
    try {
      setIsRenewing(true);
      // Return to this app screen when MonCash is done
      const returnUrl = "kobara://payments/success"; 
      
      const res = await apiClient.post(`/mobile/subscriptions/${id}/renew-moncash`, {
        returnUrl
      });
      
      if (res.data.success && res.data.paymentUrl) {
        await WebBrowser.openBrowserAsync(res.data.paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
        });
        // Refresh data when returning from browser
        fetchData();
      } else {
        Alert.alert("Erreur", res.data.error || "Impossible d'initier le paiement.");
      }
    } catch (e: any) {
      console.error("Error opening MonCash:", e);
      Alert.alert("Erreur", e.response?.data?.error || "Une erreur est survenue lors de l'initialisation du paiement.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handlePayWithNatCash = async () => {
    try {
      setIsRenewing(true);
      setShowPaymentModal(false);
      const res = await apiClient.post(`/mobile/subscriptions/${subscription?.id}/renew-natcash`);
      if (res.data.success && res.data.referenceCode) {
        router.push({
          pathname: '/subscription/natcash-waiting',
          params: { referenceCode: res.data.referenceCode, amount: subscription?.amount, paymentId: res.data.paymentId }
        });
      } else {
        throw new Error(res.data.error || "Erreur NatCash");
      }
    } catch (e: any) {
      console.error("Error NatCash:", e);
      Alert.alert("Erreur", e.response?.data?.error || "Une erreur est survenue lors de l'initialisation du paiement.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleRenew = () => {
    if (!subscription) return;
    setShowPaymentModal(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0F1C] justify-center items-center">
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    );
  }

  if (!subscription) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0F1C]">
        <View className="p-4 flex-row items-center border-b border-white/10">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-[#121A2F] rounded-full items-center justify-center border border-white/5">
            <ChevronLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg ml-4">Retour</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <Text className="text-white font-medium">Abonnement introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = subscription.next_billing_date 
    ? new Date(subscription.next_billing_date).toLocaleDateString('fr-FR')
    : 'Non défini';

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1C]">
      {/* Header */}
      <View className="p-4 flex-row items-center justify-between border-b border-white/10">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-[#121A2F] rounded-full items-center justify-center border border-white/5"
        >
          <ChevronLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Détails de l'abonnement</Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView className="flex-1 p-5">
        {subscription.entitlement?.isGracePeriod && (
          <View className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <Text className="font-bold text-amber-300">Plan expiré - délai exceptionnel</Text>
            <Text className="mt-1 text-sm leading-5 text-amber-100">
              Expiré depuis le {subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('fr-FR') : 'date inconnue'}. Renouvelez avant le {subscription.grace_period_end ? new Date(subscription.grace_period_end).toLocaleDateString('fr-FR') : 'date limite'}.
            </Text>
          </View>
        )}
        <View className="items-center mb-8 mt-4">
          <View className="w-20 h-20 rounded-full bg-purple-500/10 items-center justify-center mb-4">
            <CalendarClock size={40} color="#A855F7" />
          </View>
          <Text className="text-white font-black text-3xl mb-2 text-center">
            {subscription.plans?.name || 'Abonnement'}
          </Text>
          <StatusBadge status={subscription.status} />
        </View>

        <View className="bg-[#121A2F] rounded-2xl border border-white/5 p-5 mb-6">
          <View className="flex-row justify-between mb-4 pb-4 border-b border-white/5">
            <Text className="text-slate-400 font-medium">Montant</Text>
            <Text className="text-white font-bold">
              {Number(subscription.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {subscription.currency} / {subscription.billing_interval}
            </Text>
          </View>
          <View className="flex-row justify-between mb-4 pb-4 border-b border-white/5">
            <Text className="text-slate-400 font-medium">Date de création</Text>
            <Text className="text-white font-bold">{new Date(subscription.created_at).toLocaleDateString('fr-FR')}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-slate-400 font-medium">Prochain prélèvement</Text>
            <Text className="text-white font-bold">{formattedDate}</Text>
          </View>
        </View>

        <Text className="text-slate-400 font-medium mb-3 ml-2 uppercase text-xs tracking-wider">Actions</Text>
        <View className="bg-[#121A2F] rounded-2xl border border-white/5 overflow-hidden mb-8">
          <TouchableOpacity 
            onPress={handleRenew}
            disabled={isRenewing}
            className="flex-row items-center p-4 active:bg-white/5"
          >
            <View className="w-10 h-10 rounded-full bg-orange-500/10 items-center justify-center mr-4">
              {isRenewing ? <ActivityIndicator size="small" color="#F97316" /> : <CreditCard size={20} color="#F97316" />}
            </View>
            <View className="flex-1">
              <Text className="text-orange-500 font-medium text-base">Renouveler l'abonnement</Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                {balance !== null && balance >= subscription.amount 
                  ? 'Payer avec votre solde'
                  : 'Payer via le site web'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de sélection de paiement */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#121A2F] rounded-t-3xl p-6 border-t border-white/10">
            <View className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <Text className="text-white font-bold text-xl mb-2 text-center">Moyen de paiement</Text>
            <Text className="text-slate-400 text-center mb-6">
              Sélectionnez comment vous souhaitez payer ({subscription?.amount?.toLocaleString('fr-FR')} HTG)
            </Text>

            <View className="space-y-3">
              <TouchableOpacity
                onPress={() => {
                  setShowPaymentModal(false);
                  if (balance !== null && balance >= (subscription?.amount || 0)) {
                    handlePayWithBalance();
                  } else {
                    Alert.alert("Solde insuffisant", "Votre solde actuel n'est pas suffisant.");
                  }
                }}
                className="w-full flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/5 active:bg-white/10"
              >
                <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-4">
                  <CreditCard size={20} color="#22C55E" />
                </View>
                <View>
                  <Text className="text-white font-bold text-base">Solde Kobara</Text>
                  <Text className="text-slate-400 text-xs">
                    {balance !== null ? `${balance.toLocaleString('fr-FR')} HTG disponible` : 'Chargement...'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowPaymentModal(false);
                  handlePayWithMonCash();
                }}
                className="w-full flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/5 active:bg-white/10"
              >
                <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center mr-4">
                  <Text className="text-red-500 font-black text-xs">MC</Text>
                </View>
                <View>
                  <Text className="text-white font-bold text-base">MonCash</Text>
                  <Text className="text-slate-400 text-xs">Paiement mobile instantané</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowPaymentModal(false);
                  handlePayWithNatCash();
                }}
                className="w-full flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/5 active:bg-white/10"
              >
                <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-4">
                  <Text className="text-blue-500 font-black text-xs">NC</Text>
                </View>
                <View>
                  <Text className="text-white font-bold text-base">NatCash</Text>
                  <Text className="text-slate-400 text-xs">Paiement par transfert</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={() => setShowPaymentModal(false)}
              className="mt-6 p-4 rounded-2xl bg-white/5 active:bg-white/10 items-center"
            >
              <Text className="text-white font-bold">Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
