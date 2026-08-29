import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Shield, Smartphone, CreditCard } from 'lucide-react-native';

export default function QuickPaymentScreen() {
  const [allowWithoutAuth, setAllowWithoutAuth] = useState(false);
  const [saveCustomerDetails, setSaveCustomerDetails] = useState(true);

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Configurez vos préférences pour la création rapide de liens de paiement depuis l'application.
      </Text>

      <View className="bg-[#121A2F] rounded-2xl px-4 py-2">
        <View className="py-3 flex-row items-center justify-between border-b border-white/5">
          <View className="flex-row items-center flex-1">
            <Smartphone size={20} color="#F97316" />
            <View className="ml-3 flex-1 pr-4">
              <Text className="text-white font-medium">Création en 1 clic</Text>
              <Text className="text-slate-400 text-xs mt-1">Autoriser la création sans confirmation supplémentaire</Text>
            </View>
          </View>
          <Switch 
            value={allowWithoutAuth} 
            onValueChange={setAllowWithoutAuth}
            trackColor={{ false: "#374151", true: "#F97316" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View className="py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <CreditCard size={20} color="#F97316" />
            <View className="ml-3 flex-1 pr-4">
              <Text className="text-white font-medium">Mémoriser les clients</Text>
              <Text className="text-slate-400 text-xs mt-1">Enregistrer automatiquement les nouveaux clients</Text>
            </View>
          </View>
          <Switch 
            value={saveCustomerDetails} 
            onValueChange={setSaveCustomerDetails}
            trackColor={{ false: "#374151", true: "#F97316" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </ScrollView>
  );
}
