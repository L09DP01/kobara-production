import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Shield, Trash2, Users } from 'lucide-react-native';
import { apiClient } from '@/api/client';

export default function DeveloperAccessScreen() {
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevelopers = async () => {
    try {
      const res = await apiClient.get('/mobile/developers');
      if (res.data.success) {
        setDevelopers(res.data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevelopers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevelopers();
  };

  const handleRevoke = (id: string) => {
    Alert.alert(
      "Révoquer l'accès",
      "Êtes-vous sûr de vouloir révoquer l'accès de ce développeur ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Révoquer", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiClient.delete(`/mobile/developers?id=${id}`);
              if (res.data.success) {
                setDevelopers(prev => prev.filter(d => d.id !== id));
              }
            } catch (error) {
              Alert.alert("Erreur", "Impossible de révoquer l'accès.");
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView 
      className="flex-1 bg-[#0A0F1C] px-6 pt-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
    >
      <Text className="text-slate-400 mb-6">
        Gérez les développeurs qui ont accès à votre intégration API.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F97316" className="mt-10" />
      ) : developers.length === 0 ? (
        <View className="items-center justify-center py-20">
          <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
            <Users size={32} color="#6B7280" />
          </View>
          <Text className="text-white font-medium text-lg mb-2">Aucun développeur invité</Text>
          <Text className="text-slate-400 text-center">
            Vous n'avez pas encore invité de développeur à gérer votre intégration.
          </Text>
        </View>
      ) : (
        <View className="bg-[#121A2F] rounded-2xl">
          {developers.map((dev, index) => (
            <View key={dev.id} className={`p-4 ${index !== developers.length - 1 ? 'border-b border-white/5' : ''}`}>
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-orange-500/10 items-center justify-center">
                    <Shield size={20} color="#F97316" />
                  </View>
                  <View className="ml-3 flex-1 pr-2">
                    <Text className="text-white font-medium">{dev.role}</Text>
                    <Text className="text-slate-400 text-xs">Membre ID: {dev.id.substring(0, 8)}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => handleRevoke(dev.id)}
                  className="p-2 bg-red-500/10 rounded-full"
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
