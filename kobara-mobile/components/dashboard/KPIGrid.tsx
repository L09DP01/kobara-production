import React from 'react';
import { View, Text } from 'react-native';
import { Wallet, CheckCircle2, Clock, XCircle, ArrowUp, ArrowDown } from 'lucide-react-native';
import { DashboardStats } from '../../services/dashboard';

interface KPIGridProps {
  stats?: DashboardStats;
}

const formatCurrency = (amount: number) => {
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const KPIGrid = ({ stats }: KPIGridProps) => {
  return (
    <View className="flex-row flex-wrap justify-between px-6 mb-4">
      
      {/* Solde Disponible */}
      <View className="w-[48%] bg-[#131A2B] rounded-3xl p-5 border border-white/5 mb-4">
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-8 h-8 rounded-full border border-white/10 items-center justify-center bg-transparent">
            <Wallet size={16} color="#FFFFFF" />
          </View>
          <Text className="text-slate-400 text-xs font-medium">Solde disponible</Text>
        </View>
        <View className="flex-row items-baseline gap-1">
          <Text className="text-slate-400 text-sm font-bold">{stats?.currency || 'HTG'}</Text>
          <Text className="text-white text-lg font-bold">
            {stats ? formatCurrency(stats.available_balance) : '0,00'}
          </Text>
        </View>
      </View>

      {/* Paiements réussis */}
      <View className="w-[48%] bg-[#131A2B] rounded-3xl p-5 border border-white/5 mb-4">
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-8 h-8 rounded-full border border-white/10 items-center justify-center bg-transparent">
            <CheckCircle2 size={16} color="#FFFFFF" />
          </View>
          <Text className="text-slate-400 text-xs font-medium">Paiements réussis</Text>
        </View>
        <Text className="text-white text-xl font-bold mb-1">
          {stats ? stats.success_rate.toFixed(1).replace('.', ',') : '0,0'}%
        </Text>
        <View className="flex-row items-center gap-1">
          {(stats?.success_rate_growth || 0) >= 0 ? (
            <ArrowUp size={12} color="#22C55E" />
          ) : (
            <ArrowDown size={12} color="#EF4444" />
          )}
          <Text className={`text-xs font-bold ${(stats?.success_rate_growth || 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {Math.abs(stats?.success_rate_growth || 0).toFixed(1).replace('.', ',')}%
          </Text>
        </View>
      </View>

      {/* En attente */}
      <View className="w-[48%] bg-[#131A2B] rounded-3xl p-5 border border-white/5">
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-8 h-8 rounded-full border border-white/10 items-center justify-center bg-transparent">
            <Clock size={16} color="#FFFFFF" />
          </View>
          <Text className="text-slate-400 text-xs font-medium">En attente</Text>
        </View>
        <View className="flex-row items-baseline gap-1">
          <Text className="text-slate-400 text-sm font-bold">{stats?.currency || 'HTG'}</Text>
          <Text className="text-white text-lg font-bold">
            {stats ? formatCurrency(stats.pending_amount) : '0,00'}
          </Text>
        </View>
      </View>

      {/* Échecs */}
      <View className="w-[48%] bg-[#131A2B] rounded-3xl p-5 border border-white/5">
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-8 h-8 rounded-full border border-white/10 items-center justify-center bg-transparent">
            <XCircle size={16} color="#FFFFFF" />
          </View>
          <Text className="text-slate-400 text-xs font-medium">Échecs</Text>
        </View>
        <Text className="text-white text-xl font-bold mb-1">
          {stats ? stats.failed_rate.toFixed(1).replace('.', ',') : '0,0'}%
        </Text>
        <View className="flex-row items-center gap-1">
          {(() => {
            const growth = stats?.failed_rate_growth || 0;
            const isIncrease = growth > 0;
            const isDecrease = growth < 0;
            
            // Si le taux d'échec augmente, c'est négatif (Rouge Haut)
            // S'il diminue, c'est positif (Vert Bas)
            const color = isIncrease ? '#EF4444' : isDecrease ? '#22C55E' : '#94A3B8';
            
            return (
              <>
                {isIncrease && <ArrowUp size={12} color={color} />}
                {isDecrease && <ArrowDown size={12} color={color} />}
                {!isIncrease && !isDecrease && <ArrowDown size={12} color={color} />}
                <Text className="text-xs font-bold" style={{ color }}>
                  {Math.abs(growth).toFixed(1).replace('.', ',')}%
                </Text>
              </>
            );
          })()}
        </View>
      </View>

    </View>
  );
};
