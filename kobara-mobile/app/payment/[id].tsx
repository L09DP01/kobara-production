import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Receipt, Calendar, CreditCard, Box, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaymentDetails } from '../../hooks/usePaymentDetails';

export default function PaymentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = usePaymentDetails(id);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050B18', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </SafeAreaView>
    );
  }

  if (isError || !data?.payment) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050B18' }}>
        <View className="flex-row items-center p-4 border-b border-white/5">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold ml-4">Erreur</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-400">Paiement introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const payment = data.payment;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return '#22C55E'; // Green
      case 'pending': return '#F59E0B'; // Yellow
      case 'failed': return '#EF4444'; // Red
      default: return '#9CA3AF'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'succeeded': return 'Réussi';
      case 'pending': return 'En attente';
      case 'failed': return 'Échoué';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050B18' }} edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-white/5">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Détails du Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Amount Header */}
        <View className="items-center mb-8 mt-4">
          <View className="w-16 h-16 rounded-full bg-[#101827] items-center justify-center mb-4 border border-white/5">
            <Receipt size={32} color="#FF7A00" />
          </View>
          <Text className="text-white text-4xl font-bold mb-2">
            {payment.amount} {payment.currency}
          </Text>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: getStatusColor(payment.status) + '20' }}>
            <Text style={{ color: getStatusColor(payment.status), fontWeight: 'bold' }}>
              {getStatusText(payment.status)}
            </Text>
          </View>
        </View>

        {/* Details Card */}
        <View className="bg-[#101827] rounded-2xl p-4 border border-white/5">
          <View className="flex-row items-center py-4 border-b border-white/5">
            <Calendar size={20} color="#9CA3AF" className="mr-3" />
            <Text className="flex-1 text-[#9CA3AF]">Date</Text>
            <Text className="text-white font-medium">
              {new Date(payment.created_at).toLocaleString('fr-HT', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>

          <View className="flex-row items-center py-4 border-b border-white/5">
            <CreditCard size={20} color="#9CA3AF" className="mr-3" />
            <Text className="flex-1 text-[#9CA3AF]">Référence</Text>
            <Text className="text-white font-medium text-xs font-mono">{payment.id.slice(0, 18)}...</Text>
          </View>

          {payment.customers && (
            <View className="flex-row items-center py-4 border-b border-white/5">
              <User size={20} color="#9CA3AF" className="mr-3" />
              <Text className="flex-1 text-[#9CA3AF]">Client</Text>
              <Text className="text-white font-medium">{payment.customers.name || payment.customers.email}</Text>
            </View>
          )}

          {payment.payment_links && (
            <View className="flex-row items-center py-4 border-b border-white/5">
              <Box size={20} color="#9CA3AF" className="mr-3" />
              <Text className="flex-1 text-[#9CA3AF]">Article</Text>
              <Text className="text-white font-medium">{payment.payment_links.title}</Text>
            </View>
          )}

          <View className="flex-row items-center justify-between py-4 mt-2 bg-[#0A0F1C] p-4 rounded-xl">
            <Text className="text-[#9CA3AF]">Montant net reçu</Text>
            <Text className="text-[#22C55E] font-bold text-lg">{payment.net_amount} {payment.currency}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
