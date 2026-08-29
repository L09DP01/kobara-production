import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { PieChart, TrendingUp } from 'lucide-react-native';

export default function DashboardChart({ width = 300, height = 300 }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const slideUpPie = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.timing(slideUp, { toValue: 0, duration: 1000, delay: 400, useNativeDriver: true }).start();
    Animated.timing(slideUpPie, { toValue: 0, duration: 800, delay: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.glow} />

      <Animated.View style={[styles.card, { opacity: fadeIn }]}>
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.labelLine} />
            <View style={styles.valueLine} />
            <View style={styles.trendRow}>
              <TrendingUp size={14} color="#10B981" />
              <View style={styles.trendLine} />
            </View>
          </View>
        </View>

        {/* Mock Chart */}
        <Animated.View style={[styles.chartArea, { transform: [{ translateY: slideUp }], opacity: fadeIn }]}>
          <View style={styles.chartBox}>
            <View style={[styles.dot, { bottom: 8, left: 8 }]} />
            <View style={[styles.dot, { bottom: 24, left: 48 }]} />
            <View style={[styles.dot, { bottom: 16, left: 96 }]} />
            <View style={[styles.dot, { bottom: 48, left: 144 }]} />
            <View style={[styles.dot, { bottom: 40, left: 192 }]} />
            <View style={[styles.dotGlow, { bottom: 80, right: 8 }]} />
          </View>
        </Animated.View>

        {/* Floating Pie Chart icon */}
        <Animated.View style={[styles.pieCard, { transform: [{ translateY: slideUpPie }], opacity: fadeIn }]}>
          <PieChart size={28} color="#FF6B35" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glow: { position: 'absolute', width: 224, height: 224, backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 999 },
  card: { width: 288, height: 224, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#374151', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12, position: 'relative' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  labelLine: { width: 80, height: 8, backgroundColor: '#6B7280', borderRadius: 999, marginBottom: 12 },
  valueLine: { width: 128, height: 20, backgroundColor: '#FFFFFF', borderRadius: 999, marginBottom: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'center' },
  trendLine: { width: 64, height: 8, backgroundColor: '#10B981', borderRadius: 999, marginLeft: 8 },
  chartArea: { flex: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  chartBox: { width: '100%', height: 96, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#374151', position: 'relative' },
  dot: { position: 'absolute', width: 16, height: 16, backgroundColor: '#FF6B35', borderRadius: 999 },
  dotGlow: { position: 'absolute', width: 16, height: 16, backgroundColor: '#FF6B35', borderRadius: 999, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  pieCard: { position: 'absolute', right: -16, top: 40, width: 64, height: 64, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#374151', borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
