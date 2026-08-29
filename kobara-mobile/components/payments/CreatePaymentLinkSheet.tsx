import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Share } from 'react-native';
import { X, Link, CheckCircle, Share2, Copy } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { apiClient } from '@/api/client';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

interface CreatePaymentLinkSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const { height } = Dimensions.get('window');

export function CreatePaymentLinkSheet({ visible, onClose, onSuccess }: CreatePaymentLinkSheetProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [imageType, setImageType] = useState<'url' | 'upload'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [collectAddress, setCollectAddress] = useState(false);
  const [shippingFee, setShippingFee] = useState('');
  const [passFeesToCustomer, setPassFeesToCustomer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for the created link
  const [createdLink, setCreatedLink] = useState<{ id: string, slug: string, title: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        // Reset state after animation completes
        setTitle('');
        setAmount('');
        setDescription('');
        setProductName('');
        setProductImage('');
        setImageType('url');
        setCollectAddress(false);
        setShippingFee('');
        setPassFeesToCustomer(false);
        setIsLoading(false);
        setError(null);
        setCreatedLink(null);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Le titre est requis");
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Veuillez entrer un montant valide");
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/mobile/payment-links', {
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        currency: 'HTG',
        product_name: productName.trim() || undefined,
        product_image: productImage.trim() || undefined,
        collect_address: collectAddress,
        shipping_fee: shippingFee || undefined,
        pass_fees_to_customer: passFeesToCustomer
      });

      if (response.data && response.data.success) {
        setCreatedLink(response.data.link);
        onSuccess?.();
      } else {
        setError(response.data?.error || "Une erreur est survenue");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Impossible de se connecter au serveur");
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setUploadingImage(true);
        setError(null);
        
        const uri = result.assets[0].uri;
        const fileType = uri.substring(uri.lastIndexOf(".") + 1);
        
        const formData = new FormData();
        formData.append("file", {
          uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        } as any);

        const response = await apiClient.post('/mobile/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (response.data && response.data.success) {
          setProductImage(response.data.url);
        } else {
          setError("Erreur lors de l'upload de l'image");
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Erreur lors de l'upload");
    } finally {
      setUploadingImage(false);
    }
  };

  const getFullUrl = () => {
    // Determine base URL, you might want to use EXPO_PUBLIC_APP_URL
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://kobara.app';
    return `${baseUrl}/pay/${createdLink?.slug}`;
  };

  const handleShare = async () => {
    if (!createdLink) return;
    try {
      await Share.share({
        message: `Payer pour "${createdLink.title}" sur Kobara : ${getFullUrl()}`,
        url: getFullUrl(), // iOS only
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopy = async () => {
    if (!createdLink) return;
    await Clipboard.setStringAsync(getFullUrl());
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
          </Animated.View>
          
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">
                {createdLink ? 'Lien créé !' : 'Créer un lien'}
              </Text>
              <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {createdLink ? (
              // Success / Share View
              <View className="items-center py-4">
                <View className="bg-white p-3 rounded-2xl mb-6 border border-white/10">
                  <QRCode
                    value={getFullUrl()}
                    size={150}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>
                <Text className="text-white font-bold text-xl mb-2 text-center">
                  Votre lien de paiement est prêt
                </Text>
                <Text className="text-slate-400 text-center mb-8 px-4">
                  Vous pouvez maintenant partager ce lien avec votre client pour recevoir le paiement de {amount} HTG.
                </Text>

                <View className="w-full flex-row gap-4">
                  <TouchableOpacity 
                    onPress={handleCopy}
                    className="flex-1 bg-white/10 p-4 rounded-xl items-center flex-row justify-center"
                  >
                    <Copy size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text className="text-white font-semibold">Copier</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleShare}
                    className="flex-1 bg-orange-500 p-4 rounded-xl items-center flex-row justify-center"
                  >
                    <Share2 size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text className="text-white font-semibold">Partager</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  onPress={onClose}
                  className="mt-6 w-full p-4 items-center"
                >
                  <Text className="text-slate-400 font-medium">Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Form View
              <>
                {error && (
                  <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">
                    <Text className="text-red-400 text-sm text-center">{error}</Text>
                  </View>
                )}

                <Text className="text-slate-400 text-sm font-medium mb-2">Nom du produit ou service *</Text>
                <TextInput
                  className="bg-[#0A0F1C] border border-white/10 rounded-xl text-white p-4 mb-4 text-base"
                  placeholder="Ex: T-shirt noir, Consultation..."
                  placeholderTextColor="#475569"
                  value={title}
                  onChangeText={setTitle}
                  editable={!isLoading}
                />

                <Text className="text-slate-400 text-sm font-medium mb-2">Montant (HTG)</Text>
                <TextInput
                  className="bg-[#0A0F1C] border border-white/10 rounded-xl text-white p-4 mb-4 text-base"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  editable={!isLoading}
                />

                <Text className="text-slate-400 text-sm font-medium mb-2">Description (Optionnelle)</Text>
                <TextInput
                  className="bg-[#0A0F1C] border border-white/10 rounded-xl text-white p-4 mb-4 text-base"
                  placeholder="Détails supplémentaires..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                  editable={!isLoading}
                />



                <Text className="text-slate-400 text-sm font-medium mb-2">Image du produit</Text>
                <View className="flex-row gap-2 mb-2">
                  <TouchableOpacity 
                    onPress={() => setImageType('url')}
                    className={`flex-1 py-2 rounded-lg items-center ${imageType === 'url' ? 'bg-orange-500' : 'bg-white/5'}`}
                  >
                    <Text className={`text-sm font-medium ${imageType === 'url' ? 'text-white' : 'text-slate-400'}`}>Lien (URL)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setImageType('upload')}
                    className={`flex-1 py-2 rounded-lg items-center ${imageType === 'upload' ? 'bg-orange-500' : 'bg-white/5'}`}
                  >
                    <Text className={`text-sm font-medium ${imageType === 'upload' ? 'text-white' : 'text-slate-400'}`}>Importer</Text>
                  </TouchableOpacity>
                </View>

                {imageType === 'url' ? (
                  <TextInput
                    className="bg-[#0A0F1C] border border-white/10 rounded-xl text-white p-4 mb-4 text-base"
                    placeholder="Ex: https://site.com/image.jpg"
                    placeholderTextColor="#475569"
                    value={productImage}
                    onChangeText={setProductImage}
                    editable={!isLoading && !uploadingImage}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                ) : (
                  <View className="mb-4">
                    <TouchableOpacity 
                      onPress={pickImage}
                      disabled={uploadingImage}
                      className="bg-[#0A0F1C] border border-white/10 rounded-xl p-4 items-center justify-center h-[56px]"
                    >
                      {uploadingImage ? (
                        <ActivityIndicator color="#F97316" />
                      ) : productImage ? (
                        <Text className="text-green-400 font-medium">Image prête</Text>
                      ) : (
                        <Text className="text-slate-400">Choisir une image...</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={() => setCollectAddress(!collectAddress)}
                  className="flex-row items-center gap-3 mb-4 bg-white/5 p-4 rounded-xl border border-white/10"
                >
                  <View className={`w-6 h-6 rounded border flex items-center justify-center ${collectAddress ? 'bg-orange-500 border-orange-500' : 'border-slate-500'}`}>
                    {collectAddress && <CheckCircle size={16} color="#FFF" />}
                  </View>
                  <Text className="text-white font-medium flex-1">Demander l'adresse de livraison au client</Text>
                </TouchableOpacity>

                {collectAddress && (
                  <View className="mb-4 pl-4 border-l-2 border-white/10">
                    <Text className="text-slate-400 text-sm font-medium mb-2">Frais de livraison (HTG)</Text>
                    <TextInput
                      className="bg-[#0A0F1C] border border-white/10 rounded-xl text-white p-4 text-base"
                      placeholder="Ex: 250.00"
                      placeholderTextColor="#475569"
                      keyboardType="numeric"
                      value={shippingFee}
                      onChangeText={setShippingFee}
                      editable={!isLoading}
                    />
                  </View>
                )}

                <TouchableOpacity 
                  onPress={() => setPassFeesToCustomer(!passFeesToCustomer)}
                  className="flex-row items-center gap-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/10"
                >
                  <View className={`w-6 h-6 rounded border flex items-center justify-center ${passFeesToCustomer ? 'bg-orange-500 border-orange-500' : 'border-slate-500'}`}>
                    {passFeesToCustomer && <CheckCircle size={16} color="#FFF" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium">Frais à la charge du client</Text>
                    <Text className="text-slate-400 text-xs mt-1">Le client paiera les frais de transaction (+2.9%)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleCreate}
                  disabled={isLoading || !title || !amount}
                  className={`bg-orange-500 p-4 rounded-xl flex-row justify-center items-center ${
                    (isLoading || !title || !amount) ? 'opacity-50' : ''
                  }`}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Link size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text className="text-white font-bold text-lg">Générer le lien</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { 
    backgroundColor: '#121A2F', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, 
    maxHeight: height * 0.9 
  },
});
