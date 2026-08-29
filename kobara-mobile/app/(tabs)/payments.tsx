import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Filter, Plus } from 'lucide-react-native';

import { usePayments, usePaymentLinks, useSubscriptions } from '../../hooks/usePayments';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { PaymentsList } from '../../components/payments/PaymentsList';
import { LinksList } from '../../components/payments/LinksList';
import { SubscriptionsList } from '../../components/payments/SubscriptionsList';
import { PaymentFilterSheet, PaymentFilterSheetRef } from '../../components/payments/PaymentFilterSheet';
import { QuickActionSheet, QuickActionSheetRef } from '../../components/payments/QuickActionSheet';
import { CreatePaymentLinkSheet } from '../../components/payments/CreatePaymentLinkSheet';
import { BillingPlansSheet, BillingPlansSheetRef } from '../../components/billing/BillingPlansSheet';

type Tab = 'paiements' | 'liens' | 'abonnements';

const TAB_FILTERS = {
  paiements: [
    { id: 'all', label: 'Tous', color: '#64748B' },
    { id: 'succeeded', label: 'Réussis', color: '#22C55E' },
    { id: 'pending', label: 'En attente', color: '#F97316' },
    { id: 'failed', label: 'Échecs', color: '#EF4444' },
    { id: 'refunded', label: 'Remboursés', color: '#64748B' }
  ],
  liens: [
    { id: 'all', label: 'Tous', color: '#64748B' },
    { id: 'active', label: 'Actifs', color: '#22C55E' },
    { id: 'inactive', label: 'Désactivés', color: '#EF4444' },
    { id: 'expired', label: 'Expirés', color: '#64748B' }
  ],
  abonnements: [
    { id: 'all', label: 'Tous', color: '#64748B' },
    { id: 'active', label: 'Actifs', color: '#22C55E' },
    { id: 'paused', label: 'En pause', color: '#F97316' },
    { id: 'canceled', label: 'Annulés', color: '#EF4444' }
  ]
};

export default function PaymentsScreen() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<Tab>('paiements');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [isCreateLinkModalVisible, setIsCreateLinkModalVisible] = useState(false);

  const filterSheetRef = useRef<PaymentFilterSheetRef>(null);
  const actionSheetRef = useRef<QuickActionSheetRef>(null);
  const billingPlansSheetRef = useRef<BillingPlansSheetRef>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset filter and search on tab change
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
  };

  // Queries
  const { data: dashboardData } = useDashboardSummary();
  const queryParams = { 
    status: currentFilter, 
    search: debouncedSearch,
    limit: 50 
  };
  
  const paymentsQuery = usePayments(queryParams);
  const linksQuery = usePaymentLinks(queryParams);
  const subscriptionsQuery = useSubscriptions(queryParams);

  const getActiveQuery = () => {
    switch (activeTab) {
      case 'paiements': return paymentsQuery;
      case 'liens': return linksQuery;
      case 'abonnements': return subscriptionsQuery;
    }
  };

  const activeQuery = getActiveQuery();
  const isRefreshing = activeQuery.isRefetching && !activeQuery.isLoading;

  useEffect(() => {
    if (activeQuery.isError) {
      console.log(`[Query Error ${activeTab}]:`, activeQuery.error);
    }
    if (activeQuery.data) {
      console.log(`[Query Data ${activeTab}]:`, activeQuery.data);
    }
  }, [activeQuery.isError, activeQuery.error, activeQuery.data, activeTab]);

  const handleNotificationPress = () => {
    router.push('/notifications');
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'paiements': return 'Rechercher un paiement...';
      case 'liens': return 'Rechercher un lien...';
      case 'abonnements': return 'Rechercher un abonnement...';
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 bg-[#0A0F1C]">
        <DashboardHeader 
          merchant={dashboardData?.merchant} 
          unreadCount={dashboardData?.unreadNotifications} 
          onNotificationPress={handleNotificationPress} 
        />
        
        <View className="px-6 mb-2">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-black text-3xl">Paiements</Text>
            <TouchableOpacity 
              onPress={() => {
                if (activeTab === 'liens') {
                  setIsCreateLinkModalVisible(true);
                } else {
                  actionSheetRef.current?.expand();
                }
              }}
              className="w-10 h-10 bg-[#1A233A] rounded-full items-center justify-center border border-white/10"
            >
              <Plus size={20} color="#F97316" strokeWidth={3} />
            </TouchableOpacity>
          </View>
          
          {/* Main Tabs */}
          <View className="flex-row border-b border-white/10 mb-4">
            <TouchableOpacity 
              onPress={() => handleTabChange('paiements')}
              className={`pb-3 mr-6 ${activeTab === 'paiements' ? 'border-b-2 border-orange-500' : ''}`}
            >
              <Text className={`font-semibold ${activeTab === 'paiements' ? 'text-white' : 'text-slate-400'}`}>Paiements</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTabChange('liens')}
              className={`pb-3 mr-6 ${activeTab === 'liens' ? 'border-b-2 border-orange-500' : ''}`}
            >
              <Text className={`font-semibold ${activeTab === 'liens' ? 'text-white' : 'text-slate-400'}`}>Liens</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTabChange('abonnements')}
              className={`pb-3 ${activeTab === 'abonnements' ? 'border-b-2 border-orange-500' : ''}`}
            >
              <Text className={`font-semibold ${activeTab === 'abonnements' ? 'text-white' : 'text-slate-400'}`}>Abonnements</Text>
            </TouchableOpacity>
          </View>

          {/* Status Filter Chips */}
          <View className="flex-row gap-2 mb-4">
            {TAB_FILTERS[activeTab].map((filter) => {
              const isSelected = currentFilter === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  onPress={() => setCurrentFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg flex-row items-center gap-2 border ${
                    isSelected ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-[#121A2F]'
                  }`}
                >
                  <View 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: filter.color }} 
                  />
                  <Text className={`text-xs font-medium ${isSelected ? 'text-orange-500' : 'text-slate-300'}`}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center gap-3 mb-2">
            <View className="flex-1 flex-row items-center bg-[#121A2F] rounded-xl px-4 py-3 border border-white/5">
              <Search size={18} color="#64748B" />
              <TextInput 
                placeholder={getSearchPlaceholder()}
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 ml-2 text-white font-medium"
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity 
              onPress={() => filterSheetRef.current?.expand()}
              className="w-12 h-12 bg-[#121A2F] rounded-xl items-center justify-center border border-white/5"
            >
              <Filter size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* List Content */}
        {activeTab === 'paiements' && (
          <PaymentsList 
            payments={paymentsQuery.data?.payments || []}
            isLoading={paymentsQuery.isLoading}
            isRefreshing={isRefreshing}
            onRefresh={() => paymentsQuery.refetch()}
            onPaymentPress={(p) => router.push(`/payment/${p.id}`)}
          />
        )}
        
        {activeTab === 'liens' && (
          <View className="flex-1">
            <LinksList 
              links={linksQuery.data?.paymentLinks || []}
              isLoading={linksQuery.isLoading}
              isRefreshing={isRefreshing}
              onRefresh={() => linksQuery.refetch()}
              onLinkPress={(l) => {
                router.push(`/link/${l.id}`);
              }}
              onSharePress={async (l) => {
                try {
                  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://kobara.app';
                  const shareUrl = `${baseUrl}/pay/${l.slug}`;
                  await Share.share({
                    message: `Payer pour "${l.title}" sur Kobara : ${shareUrl}`,
                    url: shareUrl,
                  });
                } catch (e) {
                  console.error("Error sharing", e);
                }
              }}
            />
          </View>
        )}
        
        {activeTab === 'abonnements' && (
          <View className="flex-1">
            <SubscriptionsList 
              subscriptions={subscriptionsQuery.data?.subscriptions || []}
              isLoading={subscriptionsQuery.isLoading}
              isRefreshing={isRefreshing}
              onRefresh={() => subscriptionsQuery.refetch()}
              onSubscriptionPress={(s) => router.push(`/subscription/${s.id}`)}
            />
          </View>
        )}

        <PaymentFilterSheet 
          ref={filterSheetRef} 
          currentFilter={currentFilter}
          onSelectFilter={setCurrentFilter}
          options={TAB_FILTERS[activeTab]} 
        />
        
        <QuickActionSheet 
          ref={actionSheetRef}
          onActionSelect={(action) => {
            if (action === 'link') {
              setIsCreateLinkModalVisible(true);
            } else if (action === 'upgrade_plan') {
              billingPlansSheetRef.current?.expand();
            } else {
              console.log("Action selected:", action);
            }
          }}
        />

        <CreatePaymentLinkSheet 
          visible={isCreateLinkModalVisible}
          onClose={() => setIsCreateLinkModalVisible(false)}
          onSuccess={() => {
            linksQuery.refetch();
          }}
        />

        <BillingPlansSheet 
          ref={billingPlansSheetRef}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fabShadow: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  }
});
