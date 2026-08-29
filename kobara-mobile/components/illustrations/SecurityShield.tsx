import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';

export default function SecurityShield({ width = 300, height = 300 }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const reverseRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 1000, useNativeDriver: true }).start();

    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(reverseRotation, {
        toValue: 1,
        duration: 6667,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseSpin = reverseRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.glow} />

      {/* Outer Ring */}
      <Animated.View style={[styles.outerRing, { transform: [{ rotate: spin }] }]}>
        <View style={[styles.ringDot, styles.ringDotTop]} />
        <View style={[styles.ringDotSm, styles.ringDotBottom]} />
      </Animated.View>

      {/* Inner Ring */}
      <Animated.View style={[styles.innerRing, { transform: [{ rotate: reverseSpin }] }]}>
        <View style={[styles.ringDotSuccess, styles.ringDotLeft]} />
        <View style={[styles.ringDotSm, styles.ringDotRight]} />
      </Animated.View>

      {/* Central Shield */}
      <Animated.View style={[styles.shield, { opacity: fadeIn }]}>
        <Lock size={48} color="#FF6B35" strokeWidth={1.5} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glow: { position: 'absolute', width: 192, height: 192, backgroundColor: 'rgba(255,107,53,0.15)', borderRadius: 999 },
  outerRing: { position: 'absolute', width: 256, height: 256, borderRadius: 128, borderWidth: 1, borderColor: 'rgba(55,65,81,0.5)', alignItems: 'center', justifyContent: 'center' },
  innerRing: { position: 'absolute', width: 192, height: 192, borderRadius: 96, borderWidth: 1, borderColor: 'rgba(75,85,99,0.5)', alignItems: 'center', justifyContent: 'center' },
  ringDot: { position: 'absolute', width: 12, height: 12, backgroundColor: '#FF6B35', borderRadius: 999 },
  ringDotSm: { position: 'absolute', width: 8, height: 8, backgroundColor: '#6B7280', borderRadius: 999 },
  ringDotSuccess: { position: 'absolute', width: 8, height: 8, backgroundColor: '#10B981', borderRadius: 999 },
  ringDotTop: { top: -6 },
  ringDotBottom: { bottom: -4 },
  ringDotLeft: { left: -4 },
  ringDotRight: { right: -4 },
  shield: { width: 112, height: 112, backgroundColor: '#0F172A', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)', borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 12 },
});
