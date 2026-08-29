import React from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { MobilePayment } from '@/services/payments';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { TransactionSkeleton } from '../ui/SkeletonLoader';

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} • ${hours}:${minutes}`;
};

interface PaymentsListProps {
  payments: MobilePayment[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onPaymentPress: (payment: MobilePayment) => void;
}

export function PaymentsList({ payments, isLoading, onRefresh, isRefreshing, onPaymentPress }: PaymentsListProps) {
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 mt-4">
        {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={payments}
      keyExtractor={item => item.id}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#F97316" colors={['#F97316']} />
      }
      ListEmptyComponent={<EmptyState message="Aucun paiement trouvé." />}
      renderItem={({ item }) => {
        const initial = item.customers?.name ? item.customers.name.substring(0, 2).toUpperCase() : '??';
        const formattedDate = formatDate(item.created_at);
        
        return (
          <TouchableOpacity 
            onPress={() => onPaymentPress(item)}
            className="flex-row items-center justify-between p-4 mb-2 bg-[#121A2F] rounded-2xl mx-4 active:bg-white/5"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-full bg-green-500/10 items-center justify-center">
                <Text className="text-green-500 font-bold">{initial}</Text>
              </View>
              <View>
                <Text className="text-white font-semibold text-base">{item.customers?.name || 'Client Inconnu'}</Text>
                <Text className="text-slate-400 text-xs mt-0.5 capitalize">{item.provider || item.payment_method}</Text>
                <Text className="text-slate-500 text-xs mt-0.5">{formattedDate}</Text>
              </View>
            </View>
            <View className="items-end gap-2">
              <Text className={`font-bold ${item.status === 'succeeded' ? 'text-green-500' : item.status === 'failed' ? 'text-red-500' : 'text-orange-500'}`}>
                {item.currency} {Number(item.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
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
