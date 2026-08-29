import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { ShieldCheck, Wallet, BarChart3 } from 'lucide-react-native';

export default function EcosystemHero({ width = 300, height = 300 }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const floatLeft = useRef(new Animated.Value(-30)).current;
  const floatRight = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float1, { toValue: -10, duration: 2000, useNativeDriver: true }),
        Animated.timing(float1, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float2, { toValue: 10, duration: 2500, useNativeDriver: true }),
        Animated.timing(float2, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(floatLeft, { toValue: 0, duration: 800, delay: 300, useNativeDriver: true }).start();
    Animated.timing(floatRight, { toValue: 0, duration: 800, delay: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Glow effect */}
      <View style={styles.glow} />
      
      {/* Central Phone Outline */}
      <Animated.View style={[styles.phone, { opacity: fadeIn }]}>
        <View style={styles.phoneSpeaker} />
        <View style={styles.checkCircle}>
          <ShieldCheck size={24} color="#10B981" />
        </View>
        <View style={styles.phoneLine1} />
        <View style={styles.phoneLine2} />
      </Animated.View>

      {/* Floating Elements */}
      <Animated.View style={[styles.floatingCard, styles.topLeft, { transform: [{ translateY: float1 }, { translateX: floatLeft }], opacity: fadeIn }]}>
        <ShieldCheck size={28} color="#FF6B35" />
      </Animated.View>

      <Animated.View style={[styles.floatingCard, styles.bottomLeft, { transform: [{ translateY: float2 }], opacity: fadeIn }]}>
        <Wallet size={28} color="#94A3B8" />
      </Animated.View>

      <Animated.View style={[styles.floatingCard, styles.middleRight, { transform: [{ translateY: float1 }, { translateX: floatRight }], opacity: fadeIn }]}>
        <BarChart3 size={28} color="#F59E0B" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glow: { position: 'absolute', width: 192, height: 192, backgroundColor: 'rgba(255,107,53,0.15)', borderRadius: 999 },
  phone: { width: 144, height: 288, borderWidth: 4, borderColor: '#374151', borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.5)', overflow: 'hidden' },
  phoneSpeaker: { width: 64, height: 4, backgroundColor: '#4B5563', borderRadius: 999, position: 'absolute', top: 16 },
  checkCircle: { width: 48, height: 48, backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  phoneLine1: { width: 80, height: 8, backgroundColor: '#4B5563', borderRadius: 999, marginBottom: 8 },
  phoneLine2: { width: 56, height: 8, backgroundColor: '#4B5563', borderRadius: 999 },
  floatingCard: { position: 'absolute', width: 64, height: 64, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#374151', borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  topLeft: { top: 40, left: 10 },
  bottomLeft: { bottom: 64, left: 4 },
  middleRight: { top: '33%' as any, right: -8 },
});
