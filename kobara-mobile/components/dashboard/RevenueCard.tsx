import React from 'react';
import { View, Text } from 'react-native';
import { BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import { DashboardStats } from '../../services/dashboard';

interface RevenueCardProps {
  stats?: DashboardStats;
}

export const RevenueCard = ({ stats }: RevenueCardProps) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const isPositiveGrowth = (stats?.monthly_growth || 0) >= 0;

  return (
    <View className="bg-[#131A2B] rounded-3xl p-6 border border-white/5 mx-6 mb-4 mt-2">
      <View className="flex-row justify-between items-start">
        <View className="mb-4">
        <Text className="text-white/60 text-sm font-medium mb-1">Total Encaissé</Text>
        <View className="flex-row items-baseline gap-1">
            <Text className="text-slate-300 font-bold text-lg">{stats?.currency || 'HTG'}</Text>
            <Text className="text-white text-4xl font-bold tracking-tight">
              {stats ? formatCurrency(stats.total_collected) : '0,00'}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-1.5 mt-3">
            {isPositiveGrowth ? (
              <ArrowUpRight size={14} color="#22C55E" />
            ) : (
              <ArrowDownRight size={14} color="#EF4444" />
            )}
            <Text className={`text-sm font-bold ${isPositiveGrowth ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {Math.abs(stats?.monthly_growth || 0).toFixed(1).replace('.', ',')}%
            </Text>
            <Text className="text-slate-500 text-sm">vs le mois dernier</Text>
          </View>
        </View>

        {/* Chart Icon */}
        <View className="w-14 h-14 rounded-2xl bg-[#1A233A] border border-white/5 items-center justify-center">
          <BarChart2 size={24} color="#94A3B8" />
        </View>
      </View>
    </View>
  );
};
