import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { Link2, Receipt, CalendarClock } from 'lucide-react-native';

interface QuickActionSheetProps {
  onActionSelect: (action: string) => void;
}

export interface QuickActionSheetRef {
  expand: () => void;
  close: () => void;
}

export const QuickActionSheet = forwardRef<QuickActionSheetRef, QuickActionSheetProps>(
  ({ onActionSelect }, ref) => {
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
      expand: () => setVisible(true),
      close: () => setVisible(false)
    }));

    const handlePress = (action: string) => {
      onActionSelect(action);
      setVisible(false);
    };

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />
              <Text className="text-white font-bold text-xl mb-6">Créer un nouveau</Text>
              
              <View className="flex-col gap-4">
                <TouchableOpacity
                  onPress={() => handlePress('link')}
                  className="flex-row items-center p-4 rounded-2xl bg-white/5 active:bg-white/10"
                >
                  <View className="w-12 h-12 rounded-full bg-orange-500/10 items-center justify-center mr-4">
                    <Link2 size={24} color="#F97316" />
                  </View>
                  <View>
                    <Text className="text-white font-semibold text-base mb-1">Lien de paiement</Text>
                    <Text className="text-slate-400 text-xs">Créer un lien réutilisable</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePress('upgrade_plan')}
                  className="flex-row items-center p-4 rounded-2xl bg-white/5 active:bg-white/10"
                >
                  <View className="w-12 h-12 rounded-full bg-purple-500/10 items-center justify-center mr-4">
                    <CalendarClock size={24} color="#A855F7" />
                  </View>
                  <View>
                    <Text className="text-white font-semibold text-base mb-1">Plan d'abonnement</Text>
                    <Text className="text-slate-400 text-xs">Gérer mon forfait Kobara</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121A2F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  }
});
