import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Moon, Sun, Smartphone } from 'lucide-react-native';

export default function AppearanceScreen() {
  const [theme, setTheme] = useState('dark');

  const ThemeOption = ({ id, icon: Icon, title, description }: any) => (
    <TouchableOpacity 
      onPress={() => setTheme(id)}
      className={`p-4 rounded-2xl mb-4 border ${theme === id ? 'border-orange-500 bg-orange-500/10' : 'border-white/5 bg-[#121A2F]'}`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Icon size={20} color={theme === id ? "#F97316" : "#94A3B8"} />
          <Text className={`ml-3 font-medium text-lg ${theme === id ? 'text-white' : 'text-slate-300'}`}>
            {title}
          </Text>
        </View>
        <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${theme === id ? 'border-orange-500' : 'border-slate-500'}`}>
          {theme === id && <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
        </View>
      </View>
      <Text className="text-slate-400 text-sm ml-8">{description}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Personnalisez l'apparence visuelle de l'application. (Actuellement seul le mode sombre est recommandé).
      </Text>

      <ThemeOption 
        id="dark" 
        icon={Moon} 
        title="Mode Sombre" 
        description="Thème sombre par défaut pour une meilleure visibilité et économie d'énergie." 
      />
      
      <ThemeOption 
        id="light" 
        icon={Sun} 
        title="Mode Clair" 
        description="Thème clair classique. (Bientôt disponible)" 
      />
      
      <ThemeOption 
        id="system" 
        icon={Smartphone} 
        title="Paramètres du système" 
        description="S'adapte automatiquement au thème de votre appareil." 
      />
    </ScrollView>
  );
}
