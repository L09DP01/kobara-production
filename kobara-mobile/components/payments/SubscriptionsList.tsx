import React from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { ChevronRight, CalendarClock } from 'lucide-react-native';
import { MobileSubscription } from '@/services/payments';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { TransactionSkeleton } from '../ui/SkeletonLoader';

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

interface SubscriptionsListProps {
  subscriptions: MobileSubscription[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSubscriptionPress: (sub: MobileSubscription) => void;
}

export function SubscriptionsList({ subscriptions, isLoading, onRefresh, isRefreshing, onSubscriptionPress }: SubscriptionsListProps) {
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 mt-4">
        {[1, 2, 3].map(i => <TransactionSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={subscriptions}
      keyExtractor={item => item.id}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#F97316" colors={['#F97316']} />
      }
      ListEmptyComponent={<EmptyState message="Aucun abonnement actif." icon={<CalendarClock size={32} color="#64748B" />} />}
      renderItem={({ item }) => {
        const initial = item.customers?.name ? item.customers.name.substring(0, 2).toUpperCase() : '??';
        const formattedNextBilling = item.next_billing_date ? formatDate(item.next_billing_date) : 'Non défini';
        
        return (
          <TouchableOpacity 
            onPress={() => onSubscriptionPress(item)}
            className="flex-row items-center justify-between p-4 mb-2 bg-[#121A2F] rounded-2xl mx-4 active:bg-white/5"
          >
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-12 h-12 rounded-full bg-purple-500/10 items-center justify-center">
                <Text className="text-purple-500 font-bold">{initial}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base mb-0.5" numberOfLines={1}>{item.customers?.name || 'Client Inconnu'}</Text>
                <Text className="text-slate-400 text-xs mb-1" numberOfLines={1}>{item.plans?.name || 'Plan standard'}</Text>
                <Text className="text-slate-500 text-xs" numberOfLines={1}>Prochain prélèvement: {formattedNextBilling}</Text>
              </View>
            </View>
            <View className="items-end gap-1 shrink-0 max-w-[120px]">
              <Text className="font-bold text-white">
                {item.currency} {Number(item.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                <Text className="text-slate-400 text-xs font-normal"> / {item.billing_interval}</Text>
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <ChevronRight size={20} color="#64748B" className="ml-2" />
          </TouchableOpacity>
        );
      }}
    />
  );
}
