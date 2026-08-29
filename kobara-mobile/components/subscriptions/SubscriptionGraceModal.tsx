import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Clock3, X } from 'lucide-react-native';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'une date inconnue';
}

export function SubscriptionGraceModal() {
  const router = useRouter();
  const { data } = useDashboardSummary();
  const entitlement = data?.merchant.subscription_entitlement;
  const subscriptionId = data?.merchant.subscription_id;
  const statusKey = entitlement
    ? `${entitlement.reason}:${entitlement.currentPeriodEnd}:${entitlement.gracePeriodEnd}`
    : null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const requiresAttention = Boolean(
    entitlement?.isGracePeriod
    || entitlement?.isExpired
    || entitlement?.reason === 'invalid_period'
    || entitlement?.reason === 'payment_unconfirmed',
  );
  const visible = requiresAttention && statusKey !== dismissedKey;
  if (!entitlement) return null;

  const handleRenew = () => {
    setDismissedKey(statusKey);
    if (subscriptionId) {
      router.push({ pathname: '/subscription/[id]', params: { id: subscriptionId } });
    } else {
      router.push('/(tabs)/payments');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setDismissedKey(statusKey)}>
      <View className="flex-1 items-center justify-center bg-black/70 px-5">
        <View className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#121A2F] p-6">
          <View className="flex-row items-start justify-between">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              {entitlement.isGracePeriod
                ? <Clock3 size={24} color="#F59E0B" />
                : <AlertTriangle size={24} color="#F87171" />}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={() => setDismissedKey(statusKey)}
              className="h-10 w-10 items-center justify-center rounded-lg active:bg-white/10"
            >
              <X size={22} color="#94A3B8" />
            </Pressable>
          </View>

          <Text className="mt-5 text-xl font-bold text-white">Votre plan a expiré</Text>
          <Text className="mt-2 text-sm leading-6 text-slate-300">
            Le plan {entitlement.subscriptionPlan || 'Premium'} a expiré depuis le {formatDate(entitlement.currentPeriodEnd)}.
          </Text>

          <View className={`mt-4 rounded-lg border p-4 ${entitlement.isGracePeriod ? 'border-amber-500/20 bg-amber-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
            <Text className={`text-sm leading-6 ${entitlement.isGracePeriod ? 'text-amber-100' : 'text-red-100'}`}>
              {entitlement.isGracePeriod
                ? `Kobara vous accorde exceptionnellement cinq jours. Vos droits restent actifs jusqu’au ${formatDate(entitlement.gracePeriodEnd)}.`
                : 'Le délai est terminé. Votre compte utilise maintenant le plan gratuit.'}
            </Text>
          </View>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setDismissedKey(statusKey)}
              className="h-12 flex-1 items-center justify-center rounded-lg border border-white/10 active:bg-white/5"
            >
              <Text className="font-semibold text-slate-200">Plus tard</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleRenew}
              className="h-12 flex-1 items-center justify-center rounded-lg bg-orange-500 active:bg-orange-600"
            >
              <Text className="font-bold text-white">Renouveler</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
