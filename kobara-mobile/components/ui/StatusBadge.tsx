import React from 'react';
import { View, Text } from 'react-native';

export type StatusType = 
  | 'succeeded' | 'active' | 'paid' 
  | 'pending' 
  | 'failed' | 'late' | 'canceled' | 'inactive' 
  | 'refunded' | 'expired' | 'paused';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  let bgColor = 'bg-slate-500/10';
  let textColor = 'text-slate-400';
  let defaultLabel = 'Inconnu';

  switch (status) {
    case 'succeeded':
    case 'active':
    case 'paid':
      bgColor = 'bg-green-500/10';
      textColor = 'text-green-500';
      defaultLabel = status === 'succeeded' ? 'Réussi' : status === 'active' ? 'Actif' : 'Payée';
      break;
    case 'pending':
      bgColor = 'bg-orange-500/10';
      textColor = 'text-orange-500';
      defaultLabel = 'En attente';
      break;
    case 'failed':
    case 'late':
    case 'canceled':
    case 'inactive':
      bgColor = 'bg-red-500/10';
      textColor = 'text-red-500';
      defaultLabel = status === 'failed' ? 'Échoué' : status === 'late' ? 'En retard' : status === 'canceled' ? 'Annulé' : 'Inactif';
      break;
    case 'refunded':
    case 'expired':
    case 'paused':
      bgColor = 'bg-slate-500/10';
      textColor = 'text-slate-400';
      defaultLabel = status === 'refunded' ? 'Remboursé' : status === 'expired' ? 'Expiré' : 'En pause';
      break;
  }

  return (
    <View className={`px-2 py-1 rounded-md border ${bgColor.replace('/10', '/20')} ${bgColor} self-start`}>
      <Text className={`text-[11px] font-medium ${textColor}`}>
        {label || defaultLabel}
      </Text>
    </View>
  );
}
