import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Check, X, CreditCard, CalendarClock } from 'lucide-react-native';
import { apiClient } from '@/api/client';
import { useRouter } from 'expo-router';

interface BillingPlansSheetProps {
  onSuccess?: () => void;
}

export interface BillingPlansSheetRef {
  expand: () => void;
  close: () => void;
}

export const BillingPlansSheet = forwardRef<BillingPlansSheetRef, BillingPlansSheetProps>(
  ({ onSuccess }, ref) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [merchantPlan, setMerchantPlan] = useState<any>(null);
    const [usage, setUsage] = useState<any>(null);
    const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
    const router = useRouter();

    useImperativeHandle(ref, () => ({
      expand: () => {
        setVisible(true);
        fetchData();
      },
      close: () => setVisible(false)
    }));

    const fetchData = async () => {
      setLoading(true);
      try {
        const [plansRes, billingRes] = await Promise.all([
          apiClient.get('/plans'), // Public API for plans
          apiClient.get('/mobile/billing') // The API we just created
        ]);
        
        setPlans(plansRes.data.data || []);
        setMerchantPlan(billingRes.data.data?.plan || null);
        setUsage(billingRes.data.data?.usage || null);
      } catch (err) {
        console.error("Error fetching billing data:", err);
      } finally {
        setLoading(false);
      }
    };

    const handleUpgrade = async (plan: any) => {
      if (merchantPlan && merchantPlan.id === plan.id) return;
      
      Alert.alert(
        "Changer de forfait",
        `Voulez-vous passer au forfait ${plan.name} (${plan.price_htg} HTG/mois) ?`,
        [
          { text: "Annuler", style: "cancel" },
          { 
            text: "Continuer", 
            onPress: async () => {
              setUpgradingPlanId(plan.id);
              try {
                // To upgrade, we call the API to get a payment intent or checkout URL
                // We'll use NatCash directly for the mobile app or the mobile upgrade route
                // Wait, does an upgrade route exist for mobile?
                // Let's check if there is an upgrade route or if we should call the web upgrade route.
                // We'll call the web one for now since it returns the paymentUrl/referenceCode
                const res = await apiClient.post('/dashboard/billing/upgrade', {
                  planSlug: plan.slug,
                  billingCycle: 'monthly',
                  method: 'natcash'
                });

                if (res.data.success && !res.data.requiresPayment) {
                  Alert.alert("Succès", res.data.message);
                  fetchData();
                  if (onSuccess) onSuccess();
                } else if (res.data.success && res.data.requiresPayment) {
                  setVisible(false);
                  router.push({
                    pathname: '/subscription/natcash-waiting',
                    params: { 
                      referenceCode: res.data.referenceCode, 
                      amount: plan.price_htg,
                      paymentId: res.data.paymentId 
                    }
                  });
                } else {
                  throw new Error(res.data.error || "Erreur inconnue");
                }
              } catch (e: any) {
                Alert.alert("Erreur", e.response?.data?.error || e.message || "Erreur lors du changement de plan");
              } finally {
                setUpgradingPlanId(null);
              }
            }
          }
        ]
      );
    };

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />
              
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white font-bold text-xl">Mon Forfait Kobara</Text>
                <TouchableOpacity onPress={() => setVisible(false)} className="p-2 bg-white/10 rounded-full">
                  <X size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="large" color="#F97316" />
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} className="max-h-[70vh]">
                  {/* Current Plan Summary */}
                  {merchantPlan && (
                    <View className="bg-[#1A233A] p-4 rounded-xl mb-6 border border-white/10">
                      <Text className="text-slate-400 font-medium mb-1">Forfait actuel</Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-orange-500 font-bold text-lg">{merchantPlan.name}</Text>
                        <Text className="text-white font-bold">{merchantPlan.price_htg} HTG / mois</Text>
                      </View>
                      {usage && merchantPlan.monthly_payment_limit && (
                        <View className="mt-4">
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-slate-400 text-xs">Paiements ce mois</Text>
                            <Text className="text-white text-xs font-bold">{usage.monthly_payments} / {merchantPlan.monthly_payment_limit}</Text>
                          </View>
                          <View className="h-1.5 w-full bg-[#0A0F1C] rounded-full overflow-hidden">
                            <View 
                              className="h-full bg-orange-500" 
                              style={{ width: `${Math.min(100, (usage.monthly_payments / merchantPlan.monthly_payment_limit) * 100)}%` }} 
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <Text className="text-white font-semibold text-lg mb-4">Forfaits disponibles</Text>
                  
                  {plans.map((p) => {
                    const isCurrent = merchantPlan?.id === p.id;
                    const isUpgrading = upgradingPlanId === p.id;
                    
                    return (
                      <View 
                        key={p.id} 
                        className={`p-4 rounded-2xl mb-4 border ${isCurrent ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}
                      >
                        <View className="flex-row justify-between items-center mb-3">
                          <Text className="text-white font-bold text-lg">{p.name}</Text>
                          <Text className="text-orange-400 font-bold">{p.price_htg} HTG</Text>
                        </View>
                        
                        <Text className="text-slate-400 text-sm mb-4">{p.description}</Text>
                        
                        <View className="space-y-2 mb-4">
                          <View className="flex-row items-center gap-2 mb-2">
                            <Check size={16} color="#4ADE80" />
                            <Text className="text-slate-300 text-sm">{p.transaction_fee_percent}% par transaction</Text>
                          </View>
                          <View className="flex-row items-center gap-2 mb-2">
                            <Check size={16} color="#4ADE80" />
                            <Text className="text-slate-300 text-sm">{p.monthly_payment_limit || '∞'} paiements / mois</Text>
                          </View>
                          <View className="flex-row items-center gap-2 mb-2">
                            <Check size={16} color="#4ADE80" />
                            <Text className="text-slate-300 text-sm">Retrait max: {p.daily_withdrawal_limit || '∞'} HTG</Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          disabled={isCurrent || isUpgrading}
                          onPress={() => handleUpgrade(p)}
                          className={`py-3 rounded-xl items-center flex-row justify-center gap-2 ${
                            isCurrent ? 'bg-white/10' : 'bg-orange-500'
                          } ${isUpgrading ? 'opacity-70' : ''}`}
                        >
                          {isUpgrading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text className={`font-bold ${isCurrent ? 'text-white' : 'text-white'}`}>
                              {isCurrent ? 'Forfait Actuel' : 'Choisir ce forfait'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121A2F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  }
});
