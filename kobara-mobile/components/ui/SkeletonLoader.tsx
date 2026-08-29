import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export function SkeletonLoader({ className = '' }: { className?: string }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)'],
  });

  return (
    <Animated.View className={`rounded-xl ${className}`} style={{ backgroundColor }} />
  );
}

export function TransactionSkeleton() {
  return (
    <View className="flex-row items-center justify-between p-4 mb-2 bg-[#121A2F] rounded-2xl mx-4">
      <View className="flex-row items-center gap-3">
        <SkeletonLoader className="w-12 h-12 rounded-full" />
        <View className="gap-2">
          <SkeletonLoader className="w-32 h-4" />
          <SkeletonLoader className="w-24 h-3" />
        </View>
      </View>
      <View className="items-end gap-2">
        <SkeletonLoader className="w-20 h-4" />
        <SkeletonLoader className="w-16 h-6 rounded-md" />
      </View>
    </View>
  );
}
