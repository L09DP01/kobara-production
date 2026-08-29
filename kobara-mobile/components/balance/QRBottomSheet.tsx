import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet } from 'react-native';
import { QrCode, Scan, X } from 'lucide-react-native';

interface QRBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onMyQrPress?: () => void;
  onScanQrPress?: () => void;
}

const { height } = Dimensions.get('window');

export function QRBottomSheet({ visible, onClose, onMyQrPress, onScanQrPress }: QRBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={styles.overlay}>
        <Animated.View 
          style={[styles.backdrop, { opacity: fadeAnim }]} 
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.sheet, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">QR Code</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            onPress={onMyQrPress}
            className="flex-row items-center p-4 bg-[#101827] border border-white/5 rounded-2xl mb-3 active:bg-white/5"
          >
            <View className="w-12 h-12 rounded-full bg-[#FF7A00]/10 items-center justify-center mr-4">
              <QrCode size={24} color="#FF7A00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base mb-0.5">Mon QR</Text>
              <Text className="text-[#9CA3AF] text-xs">Afficher mon code pour recevoir</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={onScanQrPress}
            className="flex-row items-center p-4 bg-[#101827] border border-white/5 rounded-2xl mb-6 active:bg-white/5"
          >
            <View className="w-12 h-12 rounded-full bg-[#FF7A00]/10 items-center justify-center mr-4">
              <Scan size={24} color="#FF7A00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base mb-0.5">Scanner un QR</Text>
              <Text className="text-[#9CA3AF] text-xs">Scanner pour payer ou transférer</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#050B18',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  }
});
