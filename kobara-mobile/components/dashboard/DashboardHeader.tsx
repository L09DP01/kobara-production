import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Bell, Scan } from 'lucide-react-native';
import { DashboardMerchant } from '../../services/dashboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface DashboardHeaderProps {
  merchant?: DashboardMerchant;
  unreadCount?: number;
  onNotificationPress: () => void;
  onScanPress?: () => void;
}

export const DashboardHeader = ({ merchant, unreadCount = 0, onNotificationPress, onScanPress }: DashboardHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const getInitials = (name?: string) => {
    if (!name) return 'K';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View 
      className="flex-row items-center justify-between px-6 pb-4"
      style={{ paddingTop: Math.max(insets.top + 16, 48) }}
    >
      {/* Avatar */}
      <TouchableOpacity onPress={() => router.push('/(modals)/profile')} className="w-10 h-10 rounded-full bg-[#1A233A] border border-white/10 items-center justify-center overflow-hidden">
        {merchant?.logo_url ? (
          <Image source={{ uri: merchant.logo_url }} className="w-full h-full" />
        ) : (
          <Text className="text-white font-bold text-sm">
            {getInitials(merchant?.business_name)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Logo */}
      <View className="flex-1 items-center">
        <Text className="text-white font-black text-xl tracking-widest">KOBARA</Text>
      </View>

      {/* Right Icons */}
      <View className="flex-row items-center gap-3">
        {onScanPress && (
          <TouchableOpacity 
            onPress={onScanPress}
            className="w-10 h-10 rounded-full bg-[#1A233A] border border-white/10 items-center justify-center"
          >
            <Scan size={20} color="#F97316" strokeWidth={2} />
          </TouchableOpacity>
        )}
        
        {/* Notification Bell */}
        <TouchableOpacity 
          onPress={onNotificationPress}
          className="w-10 h-10 rounded-full bg-[#1A233A] border border-white/10 items-center justify-center relative"
        >
          <Bell size={20} color="#FFFFFF" strokeWidth={2} />
          {unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 bg-[#F97316] min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 border border-[#0A0F1C]">
              <Text className="text-white text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
