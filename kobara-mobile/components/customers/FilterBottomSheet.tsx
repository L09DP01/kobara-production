import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet } from 'react-native';
import { X, Check } from 'lucide-react-native';

export type CustomerFilterOption = 
  | 'ALL' 
  | 'ACTIVE' 
  | 'NEW' 
  | 'HIGHEST_VOLUME' 
  | 'MOST_RECENT' 
  | 'OLDEST' 
  | 'HAS_EMAIL' 
  | 'HAS_PHONE';

interface FilterBottomSheetProps {
  visible: boolean;
  selectedFilter: CustomerFilterOption;
  onSelect: (filter: CustomerFilterOption) => void;
  onClose: () => void;
}

const { height } = Dimensions.get('window');

const FILTER_OPTIONS: { id: CustomerFilterOption; label: string }[] = [
  { id: 'ALL', label: 'Tous les clients' },
  { id: 'ACTIVE', label: 'Clients actifs' },
  { id: 'NEW', label: 'Nouveaux clients (30j)' },
  { id: 'HIGHEST_VOLUME', label: 'Volume le plus élevé' },
  { id: 'MOST_RECENT', label: 'Les plus récents' },
  { id: 'OLDEST', label: 'Les plus anciens' },
  { id: 'HAS_EMAIL', label: 'Avec adresse email' },
  { id: 'HAS_PHONE', label: 'Avec numéro de téléphone' },
];

export function FilterBottomSheet({ visible, selectedFilter, onSelect, onClose }: FilterBottomSheetProps) {
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
            <Text className="text-white text-xl font-bold">Trier & Filtrer</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          
          <View>
            {FILTER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-2 ${
                  selectedFilter === option.id ? 'bg-[#FF7A00]/10 border border-[#FF7A00]/20' : 'bg-[#1A233A]'
                }`}
              >
                <Text className={`font-medium ${selectedFilter === option.id ? 'text-[#FF7A00]' : 'text-white'}`}>
                  {option.label}
                </Text>
                {selectedFilter === option.id && <Check size={20} color="#FF7A00" />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            onPress={() => {
              onSelect('ALL');
              onClose();
            }}
            className="mt-4 p-4 items-center justify-center rounded-xl"
          >
            <Text className="text-[#9CA3AF] font-medium">Réinitialiser les filtres</Text>
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
