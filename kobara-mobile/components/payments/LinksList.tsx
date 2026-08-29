import React from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { ChevronRight, Link as LinkIcon, Copy, Share2 } from 'lucide-react-native';
import { MobilePaymentLink } from '@/services/payments';
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

interface LinksListProps {
  links: MobilePaymentLink[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onLinkPress: (link: MobilePaymentLink) => void;
  onSharePress: (link: MobilePaymentLink) => void;
}

export function LinksList({ links, isLoading, onRefresh, isRefreshing, onLinkPress, onSharePress }: LinksListProps) {
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 mt-4">
        {[1, 2, 3].map(i => <TransactionSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      data={links}
      keyExtractor={item => item.id}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#F97316" colors={['#F97316']} />
      }
      ListEmptyComponent={<EmptyState message="Aucun lien de paiement créé." icon={<LinkIcon size={32} color="#64748B" />} />}
      renderItem={({ item }) => {
        const formattedDate = formatDate(item.created_at);
        
        return (
          <TouchableOpacity 
            onPress={() => onLinkPress(item)}
            className="p-4 mb-3 bg-[#121A2F] rounded-2xl mx-4 active:bg-white/5 border border-white/5"
          >
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1 pr-4">
                <Text className="text-white font-semibold text-base mb-1">{item.title || 'Lien sans titre'}</Text>
                <Text className="text-slate-400 text-xs mb-2">Créé le {formattedDate}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View className="items-end">
                <Text className="font-bold text-white mb-1">
                  {item.currency} {Number(item.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </Text>
                <View className="flex-row items-center bg-blue-500/10 px-2 py-1 rounded-md mt-1">
                  <Text className="text-blue-400 text-xs font-medium">{item.payment_count} paiement{item.payment_count > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </View>
            
            <View className="flex-row items-center justify-end gap-3 pt-3 border-t border-white/5">
              <TouchableOpacity onPress={() => onSharePress(item)} className="w-10 h-10 rounded-full bg-white/5 items-center justify-center">
                <Share2 size={18} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onLinkPress(item)} className="w-10 h-10 rounded-full bg-white/5 items-center justify-center">
                <ChevronRight size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
