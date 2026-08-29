import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native';

interface FilterOption {
  id: string;
  label: string;
}

interface PaymentFilterSheetProps {
  currentFilter: string;
  onSelectFilter: (filterId: string) => void;
  options: FilterOption[];
  title?: string;
}

export interface PaymentFilterSheetRef {
  expand: () => void;
  close: () => void;
}

export const PaymentFilterSheet = forwardRef<PaymentFilterSheetRef, PaymentFilterSheetProps>(
  ({ currentFilter, onSelectFilter, options, title = "Filtrer par statut" }, ref) => {
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
      expand: () => setVisible(true),
      close: () => setVisible(false)
    }));

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6" />
              <Text className="text-white font-bold text-xl mb-6">{title}</Text>
              
              <View className="flex-col gap-3">
                {options.map((option) => {
                  const isSelected = currentFilter === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => {
                        onSelectFilter(option.id);
                        setVisible(false);
                      }}
                      className={`flex-row items-center justify-between p-4 rounded-xl border ${
                        isSelected ? 'bg-orange-500/10 border-orange-500' : 'bg-white/5 border-transparent'
                      }`}
                    >
                      <Text className={`font-medium ${isSelected ? 'text-orange-500' : 'text-slate-300'}`}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <View className="w-4 h-4 rounded-full bg-orange-500 items-center justify-center">
                          <View className="w-1.5 h-1.5 rounded-full bg-white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
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
