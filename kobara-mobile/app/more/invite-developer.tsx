import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Mail, ShieldAlert } from 'lucide-react-native';
import { apiClient } from '@/api/client';

export default function InviteDeveloperScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'readonly',
    message: ''
  });

  const roles = [
    { id: 'readonly', label: 'Lecture seule', desc: 'Voir les logs et les statistiques sans rien modifier.' },
    { id: 'integration', label: 'Intégration', desc: 'Créer des clés API et gérer les webhooks.' },
    { id: 'technical', label: 'Gestion technique limitée', desc: 'Accès étendu sans les droits financiers.' }
  ];

  const handleInvite = async () => {
    if (!form.name || !form.email) {
      Alert.alert("Erreur", "Veuillez remplir le nom et l'email du développeur.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/mobile/developers', form);
      if (res.data.success) {
        Alert.alert("Succès", "L'invitation a été envoyée au développeur.", [
          { text: "OK", onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.error || "Erreur lors de l'envoi de l'invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Invitez un développeur à configurer votre intégration API et vos webhooks depuis le tableau de bord Web.
      </Text>

      <View className="mb-6">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Nom du développeur</Text>
        <View className="flex-row items-center bg-[#121A2F] border border-white/10 rounded-xl px-4 h-12">
          <User size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-white"
            placeholder="Ex: Jean Dupont"
            placeholderTextColor="#4B5563"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
          />
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Email du développeur</Text>
        <View className="flex-row items-center bg-[#121A2F] border border-white/10 rounded-xl px-4 h-12">
          <Mail size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-white"
            placeholder="jean@dev.com"
            placeholderTextColor="#4B5563"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
          />
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Rôle d'accès (Dashboard Web)</Text>
        {roles.map((r) => (
          <TouchableOpacity 
            key={r.id}
            onPress={() => setForm({ ...form, role: r.id })}
            className={`p-4 rounded-xl border mb-3 ${form.role === r.id ? 'border-orange-500 bg-orange-500/10' : 'border-white/5 bg-[#121A2F]'}`}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className={`font-medium ${form.role === r.id ? 'text-white' : 'text-slate-300'}`}>{r.label}</Text>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${form.role === r.id ? 'border-orange-500' : 'border-slate-500'}`}>
                {form.role === r.id && <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
              </View>
            </View>
            <Text className="text-slate-500 text-xs pr-8">{r.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mb-8">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Message optionnel</Text>
        <TextInput
          className="bg-[#121A2F] border border-white/10 rounded-xl px-4 py-3 text-white"
          placeholder="Un message pour le développeur..."
          placeholderTextColor="#4B5563"
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
          value={form.message}
          onChangeText={(text) => setForm({ ...form, message: text })}
        />
      </View>

      <View className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-8 flex-row">
        <ShieldAlert size={24} color="#3B82F6" className="mt-1" />
        <View className="ml-3 flex-1">
          <Text className="text-blue-400 font-bold mb-1">Important</Text>
          <Text className="text-slate-300 text-xs">
            Le développeur n'aura accès qu'aux configurations techniques via le Dashboard Web. Il ne pourra pas effectuer de retraits ni voir les informations sensibles des clients.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        disabled={loading}
        onPress={handleInvite}
        className={`bg-orange-500 h-14 rounded-full items-center justify-center mb-10 flex-row gap-2 ${loading ? 'opacity-70' : ''}`}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold text-lg">Envoyer l'invitation</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
