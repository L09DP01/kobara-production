import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { FileCode2 } from 'lucide-react-native';

export default function LicensesScreen() {
  const packages = [
    { name: 'expo', version: '~54.0.35', license: 'MIT' },
    { name: 'react-native', version: '0.81.5', license: 'MIT' },
    { name: 'expo-router', version: '~6.0.24', license: 'MIT' },
    { name: 'zustand', version: '^5.0.14', license: 'MIT' },
    { name: '@tanstack/react-query', version: '^5.101.1', license: 'MIT' },
    { name: 'lucide-react-native', version: '^1.21.0', license: 'ISC' },
    { name: 'nativewind', version: '^4.2.6', license: 'MIT' },
  ];

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Bibliothèques open-source tierces utilisées dans l'application Kobara.
      </Text>

      <View className="bg-[#121A2F] rounded-2xl">
        {packages.map((pkg, index) => (
          <View key={pkg.name} className={`p-4 flex-row items-center justify-between ${index !== packages.length - 1 ? 'border-b border-white/5' : ''}`}>
            <View className="flex-row items-center flex-1">
              <FileCode2 size={20} color="#94A3B8" />
              <View className="ml-3">
                <Text className="text-white font-medium">{pkg.name}</Text>
                <Text className="text-slate-400 text-xs mt-1">Licence: {pkg.license}</Text>
              </View>
            </View>
            <Text className="text-slate-500 font-mono text-xs">{pkg.version}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
