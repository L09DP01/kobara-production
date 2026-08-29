import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Link, CreditCard, Send } from 'lucide-react-native';

export default function PaymentFlow({ width = 300, height = 300 }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideLeft1 = useRef(new Animated.Value(-40)).current;
  const slideRight = useRef(new Animated.Value(40)).current;
  const slideLeft2 = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.timing(slideLeft1, { toValue: 0, duration: 800, delay: 200, useNativeDriver: true }).start();
    Animated.timing(slideRight, { toValue: 0, duration: 800, delay: 400, useNativeDriver: true }).start();
    Animated.timing(slideLeft2, { toValue: 0, duration: 800, delay: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.glow} />

      <Animated.View style={[styles.innerContainer, { opacity: fadeIn }]}>
        {/* Method 1 */}
        <Animated.View style={[styles.card, { transform: [{ translateX: slideLeft1 }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
            <Send size={20} color="#EF4444" />
          </View>
          <View style={styles.textArea}>
            <View style={[styles.textLine, { width: 96 }]} />
            <View style={[styles.textLineSm, { width: 64 }]} />
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeInner} />
          </View>
        </Animated.View>

        {/* Method 2 */}
        <Animated.View style={[styles.card, { transform: [{ translateX: slideRight }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,107,53,0.2)' }]}>
            <Link size={20} color="#FF6B35" />
          </View>
          <View style={styles.textArea}>
            <View style={[styles.textLine, { width: 80 }]} />
            <View style={[styles.textLineSm, { width: 56 }]} />
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeInner} />
          </View>
        </Animated.View>

        {/* Method 3 */}
        <Animated.View style={[styles.card, { marginBottom: 0, transform: [{ translateX: slideLeft2 }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
            <CreditCard size={20} color="#3B82F6" />
          </View>
          <View style={styles.textArea}>
            <View style={[styles.textLine, { width: 112 }]} />
            <View style={[styles.textLineSm, { width: 80 }]} />
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeInner} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glow: { position: 'absolute', width: 224, height: 224, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 999 },
  innerContainer: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', width: 256, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#374151', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  textArea: { flex: 1 },
  textLine: { height: 12, backgroundColor: '#D1D5DB', borderRadius: 999, marginBottom: 8 },
  textLineSm: { height: 8, backgroundColor: '#6B7280', borderRadius: 999 },
  badge: { width: 48, height: 24, backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeInner: { width: 24, height: 8, backgroundColor: '#10B981', borderRadius: 999 },
});
