import React from 'react';
import { View, Text } from 'react-native';
import { FileSearch } from 'lucide-react-native';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <View className="flex-1 justify-center items-center py-12 px-6">
      <View className="w-16 h-16 rounded-full bg-white/5 items-center justify-center mb-4">
        {icon || <FileSearch size={32} color="#64748B" strokeWidth={1.5} />}
      </View>
      <Text className="text-slate-400 font-medium text-center text-base">
        {message}
      </Text>
    </View>
  );
}
