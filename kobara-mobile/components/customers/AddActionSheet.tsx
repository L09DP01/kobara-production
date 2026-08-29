import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet } from 'react-native';
import { X, UserPlus, Link, Send } from 'lucide-react-native';

interface AddActionSheetProps {
  visible: boolean;
  onClose: () => void;
}

const { height } = Dimensions.get('window');

export function AddActionSheet({ visible, onClose }: AddActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>
        
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">Nouvelle action</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            disabled={true}
            className="flex-row items-center p-4 bg-[#101827] border border-white/5 rounded-2xl mb-3 opacity-50"
          >
            <View className="w-12 h-12 rounded-full bg-[#FF7A00]/10 items-center justify-center mr-4">
              <UserPlus size={24} color="#FF7A00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base mb-0.5">Ajouter un client</Text>
              <Text className="text-[#FF7A00] text-xs font-bold">Bientôt disponible</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            disabled={true}
            className="flex-row items-center p-4 bg-[#101827] border border-white/5 rounded-2xl mb-3 opacity-50"
          >
            <View className="w-12 h-12 rounded-full bg-[#FF7A00]/10 items-center justify-center mr-4">
              <Link size={24} color="#FF7A00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base mb-0.5">Créer un lien de paiement</Text>
              <Text className="text-[#FF7A00] text-xs font-bold">Bientôt disponible</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            disabled={true}
            className="flex-row items-center p-4 bg-[#101827] border border-white/5 rounded-2xl mb-6 opacity-50"
          >
            <View className="w-12 h-12 rounded-full bg-[#FF7A00]/10 items-center justify-center mr-4">
              <Send size={24} color="#FF7A00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base mb-0.5">Demander un paiement</Text>
              <Text className="text-[#FF7A00] text-xs font-bold">Bientôt disponible</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
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
