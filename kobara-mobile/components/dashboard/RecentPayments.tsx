import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, FileText } from 'lucide-react-native';
import { DashboardPayment } from '../../services/dashboard';

interface RecentPaymentsProps {
  payments?: DashboardPayment[];
  onViewAll: () => void;
  onPaymentPress: (paymentId: string) => void;
}

export const RecentPayments = ({ payments = [], onViewAll, onPaymentPress }: RecentPaymentsProps) => {
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Aujourd'hui, ${time}`;
    if (isYesterday) return `Hier, ${time}`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <View className="px-6 pb-24">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white font-bold text-lg">Paiements récents</Text>
        <TouchableOpacity onPress={onViewAll} className="flex-row items-center">
          <Text className="text-[#F97316] font-bold text-sm">Voir tout</Text>
          <ChevronRight size={16} color="#F97316" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <View className="bg-transparent">
        {payments.length > 0 ? (
          payments.map((payment, index) => {
            const isSuccess = payment.status === 'succeeded';
            const isFailed = payment.status === 'failed';
            const isPending = payment.status === 'pending';
            
            const circleColor = isSuccess ? 'bg-[#22C55E]/20' : isFailed ? 'bg-[#EF4444]/20' : 'bg-[#F97316]/20';
            const textColor = isSuccess ? 'text-[#22C55E]' : isFailed ? 'text-[#EF4444]' : 'text-[#F97316]';
            const statusText = isSuccess ? 'Succès' : isFailed ? 'Échec' : 'En attente';
            
            return (
              <TouchableOpacity 
                key={payment.id} 
                onPress={() => onPaymentPress(payment.id)}
                className={`flex-row items-center justify-between py-4 ${index !== payments.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <View className="flex-row items-center gap-4">
                  {/* Initials Circle */}
                  <View className={`w-12 h-12 rounded-full items-center justify-center ${circleColor}`}>
                    <Text className={`font-bold text-sm ${textColor}`}>
                      {getInitials(payment.customers?.name || payment.kobara_reference)}
                    </Text>
                  </View>
                  
                  {/* Details */}
                  <View>
                    <Text className="text-white font-bold text-base mb-0.5">
                      {payment.customers?.name || 'Client Inconnu'}
                    </Text>
                    <Text className="text-slate-400 text-xs font-medium">
                      <Text className={textColor}>{statusText}</Text> • {payment.provider === 'moncash' ? 'MonCash' : payment.provider}
                    </Text>
                  </View>
                </View>

                {/* Amount and Date */}
                <View className="items-end gap-1 flex-row">
                  <View className="items-end mr-2">
                    <Text className={`font-bold text-sm ${textColor}`}>
                      HTG {formatCurrency(payment.net_amount || payment.amount)}
                    </Text>
                    <Text className="text-slate-500 text-[11px] font-medium mt-0.5">
                      {formatDate(payment.created_at)}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#475569" />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View className="py-12 items-center justify-center">
            <FileText size={48} color="#334155" />
            <Text className="text-white font-bold mt-4">Aucun paiement récent</Text>
            <Text className="text-slate-500 text-sm mt-1 text-center">Vos prochaines transactions apparaîtront ici.</Text>
          </View>
        )}
      </View>
    </View>
  );
};
