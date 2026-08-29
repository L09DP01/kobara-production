import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Globe, HardDrive, Shield, Info, ChevronRight, Trash2 } from 'lucide-react-native';

export default function SystemSettingsScreen() {
  const MenuItem = ({ icon: Icon, title, value, onPress, isAction = false }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row items-center justify-between py-4 border-b border-white/5"
    >
      <View className="flex-row items-center flex-1">
        <Icon size={20} color={isAction ? "#EF4444" : "#94A3B8"} />
        <Text className={`ml-3 font-medium text-base ${isAction ? 'text-red-500' : 'text-white'}`}>
          {title}
        </Text>
      </View>
      <View className="flex-row items-center">
        {value && <Text className="text-slate-400 mr-2">{value}</Text>}
        {!isAction && <ChevronRight size={20} color="#6B7280" />}
      </View>
    </TouchableOpacity>
  );

  const clearCache = () => {
    Alert.alert(
      "Vider le cache", 
      "Voulez-vous vraiment vider le cache de l'application ? Cela n'effacera pas vos données de compte.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Vider", style: "destructive", onPress: () => {
          // Add cache clearing logic if needed
          Alert.alert("Succès", "Le cache a été vidé.");
        }}
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Gérez les paramètres système de l'application.
      </Text>

      <View className="bg-[#121A2F] rounded-2xl px-4 mb-6">
        <MenuItem 
          icon={Globe} 
          title="Langue" 
          value="Français" 
          onPress={() => {}} 
        />
        <MenuItem 
          icon={Shield} 
          title="Autorisations" 
          onPress={() => {}} 
        />
        <View className="border-b-0">
          <MenuItem 
            icon={Info} 
            title="Version de l'application" 
            value="1.0.0 (Build 24)" 
            onPress={() => {}} 
          />
        </View>
      </View>

      <View className="bg-[#121A2F] rounded-2xl px-4">
        <View className="border-b-0">
          <MenuItem 
            icon={Trash2} 
            title="Vider le cache" 
            isAction={true}
            onPress={clearCache} 
          />
        </View>
      </View>
    </ScrollView>
  );
}
