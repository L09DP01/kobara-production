import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ChangePasswordSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ChangePasswordSheet({ visible, onClose }: ChangePasswordSheetProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!form.password || !form.confirmPassword) {
      setError("Tous les champs sont requis.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: form.password
      });

      if (updateError) {
        setError(updateError.message || "Impossible de changer le mot de passe.");
      } else {
        setSuccess("Votre mot de passe a été modifié avec succès.");
        setTimeout(() => {
          onClose();
          setForm({ password: '', confirmPassword: '' });
          setSuccess('');
        }, 2000);
      }
    } catch (e: any) {
      setError("Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/60">
          <TouchableWithoutFeedback>
            <View className="bg-[#121A2F] rounded-t-3xl h-[80%]">
              <View className="items-center py-3">
                <View className="w-12 h-1.5 bg-slate-700 rounded-full" />
              </View>

              <View className="flex-row items-center justify-between px-6 pb-4 border-b border-white/10">
                <Text className="text-xl font-bold text-white">Sécurité</Text>
                <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                  <X size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                className="flex-1"
              >
                <ScrollView className="px-6 pt-6" showsVerticalScrollIndicator={false}>
                  {error ? (
                    <View className="bg-red-500/20 p-4 rounded-xl mb-4 border border-red-500/30">
                      <Text className="text-red-400 text-sm text-center">{error}</Text>
                    </View>
                  ) : null}

                  {success ? (
                    <View className="bg-green-500/20 p-4 rounded-xl mb-4 border border-green-500/30">
                      <Text className="text-green-400 text-sm text-center font-medium">{success}</Text>
                    </View>
                  ) : null}

                  <Text className="text-slate-400 text-sm mb-6">
                    Créez un nouveau mot de passe fort pour sécuriser votre compte. Il doit contenir au moins 8 caractères.
                  </Text>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Nouveau mot de passe</Text>
                    <View className="relative justify-center">
                      <TextInput
                        value={form.password}
                        onChangeText={(t) => setForm({ ...form, password: t })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium pr-12 text-base"
                        placeholder="Nouveau mot de passe"
                        placeholderTextColor="#6B7280"
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity 
                        className="absolute right-4"
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="mb-8">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Confirmer le mot de passe</Text>
                    <View className="relative justify-center">
                      <TextInput
                        value={form.confirmPassword}
                        onChangeText={(t) => setForm({ ...form, confirmPassword: t })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium pr-12 text-base"
                        placeholder="Répétez le mot de passe"
                        placeholderTextColor="#6B7280"
                        secureTextEntry={!showPassword}
                      />
                    </View>
                  </View>
                </ScrollView>

                <View className="p-6 border-t border-white/5 bg-[#121A2F]">
                  <TouchableOpacity
                    className={`bg-[#F97316] py-4 rounded-xl items-center ${loading || success ? 'opacity-70' : ''}`}
                    onPress={handleSubmit}
                    disabled={loading || !!success}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-bold text-lg">Changer le mot de passe</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
