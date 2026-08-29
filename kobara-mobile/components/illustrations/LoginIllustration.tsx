import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Lock, ShieldCheck, CheckCircle } from 'lucide-react-native';

/**
 * Illustration animée pour l'écran de connexion.
 * Cadenas stylisé avec particules orange et bouclier de sécurité.
 * Utilise uniquement l'API Animated de React Native (pas Reanimated).
 */
export default function LoginIllustration({ size = 180 }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0.8)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  const particle3 = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Entrée principale
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleIn, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();

    // Check mark pop
    Animated.spring(checkScale, {
      toValue: 1,
      delay: 600,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Orbite lente
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Particules flottantes
    Animated.loop(
      Animated.sequence([
        Animated.timing(particle1, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(particle1, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(particle2, { toValue: 6, duration: 2500, useNativeDriver: true }),
        Animated.timing(particle2, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(particle3, { toValue: -10, duration: 3000, useNativeDriver: true }),
        Animated.timing(particle3, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulsation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Glow background */}
      <Animated.View style={[styles.glow, { opacity: glowPulse }]} />

      {/* Orbiting ring */}
      <Animated.View style={[styles.orbitRing, { transform: [{ rotate: spin }] }]}>
        <View style={styles.orbitDot} />
        <View style={styles.orbitDotSm} />
      </Animated.View>

      {/* Main lock card */}
      <Animated.View style={[styles.lockCard, { opacity: fadeIn, transform: [{ scale: scaleIn }] }]}>
        {/* Inner glow */}
        <View style={styles.innerGlow} />
        <Lock size={42} color="#FF6B35" strokeWidth={1.8} />
      </Animated.View>

      {/* Floating shield (top-left) */}
      <Animated.View style={[styles.floatingElement, styles.shieldPos, { transform: [{ translateY: particle1 }], opacity: fadeIn }]}>
        <ShieldCheck size={18} color="#FF6B35" />
      </Animated.View>

      {/* Floating particle (top-right) */}
      <Animated.View style={[styles.particle, styles.particleTopRight, { transform: [{ translateY: particle2 }], opacity: fadeIn }]} />

      {/* Floating particle (bottom-left) */}
      <Animated.View style={[styles.particle, styles.particleBottomLeft, { transform: [{ translateY: particle3 }], opacity: fadeIn }]} />

      {/* Small lock card (bottom-right) */}
      <Animated.View style={[styles.smallCard, styles.smallCardPos, { transform: [{ translateY: particle2 }], opacity: fadeIn }]}>
        <Lock size={14} color="#94A3B8" strokeWidth={2} />
      </Animated.View>

      {/* Check mark (bottom-right of main) */}
      <Animated.View style={[styles.checkBadge, { transform: [{ scale: checkScale }] }]}>
        <CheckCircle size={22} color="#FF6B35" fill="#FF6B35" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderRadius: 60,
  },
  orbitRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  orbitDotSm: {
    position: 'absolute',
    bottom: -3,
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.4)',
    borderRadius: 3,
  },
  lockCard: {
    width: 80,
    height: 80,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  innerGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 30,
  },
  floatingElement: {
    position: 'absolute',
    width: 36,
    height: 36,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldPos: {
    top: 8,
    left: 8,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  particleTopRight: {
    top: 20,
    right: 16,
  },
  particleBottomLeft: {
    bottom: 24,
    left: 20,
  },
  smallCard: {
    position: 'absolute',
    width: 32,
    height: 32,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCardPos: {
    bottom: 12,
    right: 12,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    width: 28,
    height: 28,
    backgroundColor: '#0A0E1A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
