import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet } from 'react-native';
import { X, QrCode, Share2 } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface MyQRSheetProps {
  visible: boolean;
  onClose: () => void;
  merchant: any;
}

const { height } = Dimensions.get('window');

export function MyQRSheet({ visible, onClose, merchant }: MyQRSheetProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const qrRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleShareQR = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL((data: string) => {
      const filename = FileSystem.cacheDirectory + 'mon-qr-kobara.png';
      FileSystem.writeAsStringAsync(filename, data, {
        encoding: 'base64',
      }).then(() => {
        Sharing.shareAsync(filename, {
          mimeType: 'image/png',
          dialogTitle: 'Partager mon QR Code',
        });
      }).catch(err => {
        console.error("Error sharing QR", err);
      });
    });
  };

  if (!visible) return null;

  // Si on n'a pas encore le merchant, on ne montre pas le QR
  if (!merchant) return null;

  // L'URL de paiement générique pour ce marchand
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://kobara.app';
  const qrValue = `${baseUrl}/m/${merchant.id}`;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>
        
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">Mon QR Code</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View className="items-center py-6">
            <View className="bg-white p-4 rounded-3xl mb-6 border-4 border-orange-500/20">
              <QRCode
                getRef={(c) => (qrRef.current = c)}
                value={qrValue}
                size={200}
                color="#000"
                backgroundColor="#fff"
              />
            </View>
            <Text className="text-white font-bold text-2xl mb-2 text-center">
              {merchant.business_name || 'Mon Entreprise'}
            </Text>
            <Text className="text-slate-400 text-center mb-8 px-4">
              Faites scanner ce code par vos clients pour qu'ils vous paient directement avec MonCash.
            </Text>

            <TouchableOpacity 
              onPress={handleShareQR}
              className="w-full bg-[#F97316] py-4 rounded-xl flex-row justify-center items-center active:bg-[#EA580C]"
            >
              <Share2 size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold text-lg">Partager mon QR Code</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { 
    backgroundColor: '#121A2F', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: 40,
  },
});
