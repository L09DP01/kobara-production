import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { apiClient } from '@/api/client';

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  merchant: any;
  onSuccess: () => void;
}

export function EditProfileSheet({ visible, onClose, merchant, onSuccess }: EditProfileSheetProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    email: '',
    phone: '',
    address: '',
    addressData: {
      address: '',
      city: '',
      state: '',
      country: '',
      zipcode: ''
    }
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (merchant) {
      let parsedAddress = {
        address: merchant.address || '',
        city: '',
        state: '',
        country: '',
        zipcode: ''
      };
      if (merchant.address) {
        if (typeof merchant.address === 'object') {
          parsedAddress = {
            address: merchant.address.address || '',
            city: merchant.address.city || '',
            state: merchant.address.state || '',
            country: merchant.address.country || '',
            zipcode: merchant.address.zipcode || ''
          };
        } else if (typeof merchant.address === 'string' && merchant.address.startsWith('{')) {
          try {
            const parsed = JSON.parse(merchant.address);
            parsedAddress = {
              address: parsed.address || '',
              city: parsed.city || '',
              state: parsed.state || '',
              country: parsed.country || '',
              zipcode: parsed.zipcode || ''
            };
          } catch(e) {}
        } else if (typeof merchant.address === 'string') {
          parsedAddress.address = merchant.address;
        }
      }

      setForm({
        business_name: merchant.business_name || '',
        email: merchant.email || '',
        phone: merchant.phone || '',
        address: merchant.address || '',
        addressData: parsedAddress
      });
      setError('');
    }
  }, [merchant, visible]);

  const handleSubmit = async () => {
    if (!form.business_name || !form.email) {
      setError("Le nom de l'entreprise et l'email sont requis.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        business_name: form.business_name,
        email: form.email,
        phone: form.phone,
        address: JSON.stringify(form.addressData)
      };

      const res = await apiClient.patch('/mobile/merchants/me', payload);
      if (res.data.success) {
        onSuccess();
      } else {
        setError(res.data.error || "Une erreur est survenue.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Erreur de connexion.");
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
            <View className="bg-[#121A2F] rounded-t-3xl h-[85%]">
              <View className="items-center py-3">
                <View className="w-12 h-1.5 bg-slate-700 rounded-full" />
              </View>

              <View className="flex-row items-center justify-between px-6 pb-4 border-b border-white/10">
                <Text className="text-xl font-bold text-white">Modifier le profil</Text>
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

                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Nom de l'entreprise</Text>
                    <TextInput
                      value={form.business_name}
                      onChangeText={(t) => setForm({ ...form, business_name: t })}
                      className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium text-base"
                      placeholder="Nom de votre entreprise"
                      placeholderTextColor="#6B7280"
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Email de contact</Text>
                    <TextInput
                      value={form.email}
                      onChangeText={(t) => setForm({ ...form, email: t })}
                      className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium text-base"
                      placeholder="email@entreprise.com"
                      placeholderTextColor="#6B7280"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Téléphone</Text>
                    <TextInput
                      value={form.phone}
                      onChangeText={(t) => setForm({ ...form, phone: t })}
                      className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium text-base"
                      placeholder="+509 XXXX XXXX"
                      placeholderTextColor="#6B7280"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Adresse</Text>
                    <TextInput
                      value={form.addressData?.address || ''}
                      onChangeText={(t) => setForm({ ...form, addressData: { ...form.addressData, address: t } })}
                      className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium text-base"
                      placeholder="Adresse (ex: 50, Rue Roberce)"
                      placeholderTextColor="#6B7280"
                    />
                  </View>

                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                      <Text className="text-slate-400 text-sm mb-2 font-medium">Ville</Text>
                      <TextInput
                        value={form.addressData?.city || ''}
                        onChangeText={(t) => setForm({ ...form, addressData: { ...form.addressData, city: t } })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium"
                        placeholder="Port-au-Prince"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-400 text-sm mb-2 font-medium">Code postal</Text>
                      <TextInput
                        value={form.addressData?.zipcode || ''}
                        onChangeText={(t) => setForm({ ...form, addressData: { ...form.addressData, zipcode: t } })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium"
                        placeholder="HT6110"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-4 mb-8">
                    <View className="flex-1">
                      <Text className="text-slate-400 text-sm mb-2 font-medium">État / Province</Text>
                      <TextInput
                        value={form.addressData?.state || ''}
                        onChangeText={(t) => setForm({ ...form, addressData: { ...form.addressData, state: t } })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium"
                        placeholder="Ouest"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-400 text-sm mb-2 font-medium">Pays</Text>
                      <TextInput
                        value={form.addressData?.country || ''}
                        onChangeText={(t) => setForm({ ...form, addressData: { ...form.addressData, country: t } })}
                        className="bg-[#0A0F1C] text-white px-4 py-4 rounded-xl border border-slate-700 font-medium"
                        placeholder="Haïti"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                  </View>
                </ScrollView>

                <View className="p-6 border-t border-white/5 bg-[#121A2F]">
                  <TouchableOpacity
                    className={`bg-[#F97316] py-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-bold text-lg">Enregistrer les modifications</Text>
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
