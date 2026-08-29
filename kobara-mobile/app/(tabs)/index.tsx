import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { RevenueCard } from '../../components/dashboard/RevenueCard';
import { KPIGrid } from '../../components/dashboard/KPIGrid';
import { RecentPayments } from '../../components/dashboard/RecentPayments';
import { QRBottomSheet } from '@/components/balance/QRBottomSheet';
import { MyQRSheet } from '@/components/balance/MyQRSheet';
import { CreatePaymentLinkSheet } from '@/components/payments/CreatePaymentLinkSheet';

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useDashboardSummary();
  const [refreshing, setRefreshing] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isMyQrModalVisible, setIsMyQrModalVisible] = useState(false);
  const [isCreateLinkModalVisible, setIsCreateLinkModalVisible] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleNotificationPress = () => {
    router.push('/notifications' as any); // Assuming notifications screen exists or will be created
  };

  const handleViewAllPayments = () => {
    router.push('/(tabs)/payments' as any);
  };

  const handlePaymentPress = (id: string) => {
    router.push(`/payment/${id}` as any);
  };

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-[#0A0F1C] justify-center items-center">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-white mt-4 font-medium">Chargement du tableau de bord...</Text>
      </View>
    );
  }

  if (isError && !data) {
    const errorMessage = error instanceof Error ? error.message : "Erreur de connexion";
    return (
      <View className="flex-1 bg-[#0A0F1C] justify-center items-center px-6">
        <Text className="text-white font-bold text-lg mb-2">Oups, une erreur est survenue.</Text>
        <Text className="text-slate-400 text-center mb-6">Nous n'avons pas pu charger vos données. Veuillez vérifier votre connexion.</Text>
        <Text className="text-red-400 text-center mb-6 font-mono text-xs">{String(errorMessage)}</Text>
        <View className="flex-row gap-4">
          <TouchableOpacity 
            onPress={() => refetch()}
            className="bg-[#F97316] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              // Quick way to clear session
              import('../../store/useAuthStore').then(({ useAuthStore }) => {
                useAuthStore.getState().logout();
              });
            }}
            className="bg-white/10 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0A0F1C]">
      <DashboardHeader 
        merchant={data?.merchant} 
        unreadCount={data?.unreadNotifications} 
        onNotificationPress={handleNotificationPress} 
        onScanPress={() => setIsQrModalVisible(true)}
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={['#F97316']}
          />
        }
      >
        <RevenueCard stats={data?.stats} />
        <KPIGrid stats={data?.stats} />
        <RecentPayments 
          payments={data?.recentPayments} 
          onViewAll={handleViewAllPayments}
          onPaymentPress={handlePaymentPress}
        />
      </ScrollView>

      <QRBottomSheet 
        visible={isQrModalVisible} 
        onClose={() => setIsQrModalVisible(false)}
        onMyQrPress={() => { 
          setIsQrModalVisible(false); 
          setIsMyQrModalVisible(true);
        }}
        onScanQrPress={() => { 
          setIsQrModalVisible(false); 
          router.push('/(modals)/scanner');
        }}
      />

      <MyQRSheet
        visible={isMyQrModalVisible}
        onClose={() => setIsMyQrModalVisible(false)}
        merchant={data?.merchant}
      />

      <CreatePaymentLinkSheet 
        visible={isCreateLinkModalVisible}
        onClose={() => setIsCreateLinkModalVisible(false)}
        onSuccess={() => {
          // You could show a toast or refresh
          refetch();
        }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#F97316] rounded-full items-center justify-center shadow-lg"
        style={{
          shadowColor: '#F97316',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5
        }}
        onPress={() => setIsCreateLinkModalVisible(true)}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );
}
