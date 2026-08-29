import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { apiClient } from '@/api/client';

export default function AccountStatusScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/mobile/billing');
        if (res?.data?.data) {
          setData(res.data.data);
        }
      } catch (error) {
        console.error("Error fetching status:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const StatusCard = ({ title, status, type }: { title: string, status: string, type: 'success' | 'warning' | 'error' }) => {
    const colors = {
      success: { bg: 'bg-green-500/10', text: 'text-green-500', icon: ShieldCheck },
      warning: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: AlertTriangle },
      error: { bg: 'bg-red-500/10', text: 'text-red-500', icon: AlertTriangle }
    };
    const Icon = colors[type].icon;

    return (
      <View className="flex-row items-center justify-between p-4 border-b border-white/5">
        <Text className="text-white font-medium">{title}</Text>
        <View className={`flex-row items-center px-3 py-1.5 rounded-full ${colors[type].bg}`}>
          <Icon size={14} color={type === 'success' ? '#22C55E' : type === 'warning' ? '#F97316' : '#EF4444'} />
          <Text className={`ml-2 text-xs font-bold ${colors[type].text}`}>{status}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Consultez l'état de vérification de votre compte et vos limites actuelles.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F97316" className="mt-10" />
      ) : data ? (
        <>
          <Text className="text-slate-500 text-sm font-semibold mb-2 uppercase tracking-wider">Statut global</Text>
          <View className="bg-[#121A2F] rounded-2xl mb-6">
            <StatusCard 
              title="État du compte" 
              status={data.merchant?.status === 'active' ? 'Actif' : 'En attente'} 
              type={data.merchant?.status === 'active' ? 'success' : 'warning'} 
            />
            <StatusCard 
              title="Vérification KYC" 
              status={data.merchant?.kyc_status === 'approved' ? 'Vérifié' : 'Non vérifié'} 
              type={data.merchant?.kyc_status === 'approved' ? 'success' : 'warning'} 
            />
            <View className="p-4 border-b border-white/5">
              <Text className="text-white font-medium mb-1">Forfait actuel</Text>
              <Text className="text-orange-500 font-bold">{data.plan?.name || 'Inconnu'}</Text>
            </View>
          </View>

          <Text className="text-slate-500 text-sm font-semibold mb-2 uppercase tracking-wider">Limites du forfait ({data.plan?.name || 'Free'})</Text>
          <View className="bg-[#121A2F] rounded-2xl mb-10">
            <View className="p-4 border-b border-white/5">
              <View className="flex-row justify-between mb-2">
                <Text className="text-white font-medium">Retraits journaliers (HTG)</Text>
                <Text className="text-slate-400">
                  {data.usage?.daily_withdrawals || 0} / {data.plan?.daily_withdrawal_limit || '∞'}
                </Text>
              </View>
              {data.plan?.daily_withdrawal_limit && (
                <View className="h-1.5 w-full bg-[#0A0F1C] rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-orange-500" 
                    style={{ width: `${Math.min(100, ((data.usage?.daily_withdrawals || 0) / data.plan.daily_withdrawal_limit) * 100)}%` }} 
                  />
                </View>
              )}
            </View>

            {data.subscription && data.subscription.current_period_end && (
              <View className="p-4 border-b border-white/5">
                <View className="flex-row justify-between">
                  <Text className="text-white font-medium">Prochain renouvellement</Text>
                  <Text className="text-slate-400">
                    {new Date(data.subscription.current_period_end).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      ) : (
        <Text className="text-white text-center mt-10">Données indisponibles.</Text>
      )}
    </ScrollView>
  );
}
