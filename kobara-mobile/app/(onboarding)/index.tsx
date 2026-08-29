import React, { useRef, useState } from 'react';
import { View, Text, FlatList, useWindowDimensions, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import EcosystemHero from '@/components/illustrations/EcosystemHero';
import PaymentFlow from '@/components/illustrations/PaymentFlow';
import DashboardChart from '@/components/illustrations/DashboardChart';
import SecurityShield from '@/components/illustrations/SecurityShield';

import OnboardingSlide from '@/components/onboarding/OnboardingSlide';
import AnimatedDots from '@/components/onboarding/AnimatedDots';
import { useAuthStore } from '@/store/useAuthStore';

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Acceptez les paiements MonCash, simplement',
    titleHighlight: 'simplement',
    description: 'Kobara est la passerelle de paiement tout-en-un pour les entreprises haïtiennes. Sécurisé. Rapide. Fiable.',
    Illustration: EcosystemHero,
  },
  {
    id: '2',
    title: 'Des outils puissants pour votre business',
    titleHighlight: 'puissants',
    description: 'Liens de paiement, boutons, API, webhooks... Tout ce qu\'il vous faut pour développer votre activité.',
    Illustration: PaymentFlow,
  },
  {
    id: '3',
    title: 'Suivez votre activité en temps réel',
    titleHighlight: 'activité',
    description: 'Tableaux de bord intuitifs pour suivre vos paiements, revenus et retraits en un coup d\'œil.',
    Illustration: DashboardChart,
  },
  {
    id: '4',
    title: 'Bienvenue sur Kobara 👋',
    titleHighlight: 'Kobara 👋',
    description: 'Rejoignez des milliers d\'entreprises qui font confiance à Kobara.',
    Illustration: SecurityShield,
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToOffset({ offset: (currentIndex + 1) * width, animated: true });
    } else {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToOffset({ offset: (currentIndex - 1) * width, animated: true });
    }
  };

  const finishOnboarding = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {currentIndex > 0 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeft color="#F8FAFC" size={24} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40, height: 40 }} />
        )}
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* FlatList / Swiper */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_DATA}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfig}
          renderItem={({ item }) => <OnboardingSlide item={item} />}
        />
      </View>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <View style={{ marginBottom: 32 }}>
          <AnimatedDots data={ONBOARDING_DATA} scrollX={scrollX} />
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleNext}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === ONBOARDING_DATA.length - 1 ? 'Commencer' : 'Suivant'}
          </Text>
          {currentIndex < ONBOARDING_DATA.length - 1 && (
            <ChevronRight color="#FFFFFF" size={20} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A192F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 999,
  },
  skipButton: {
    padding: 8,
    borderRadius: 999,
  },
  skipText: {
    color: '#94A3B8',
    fontWeight: '500',
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  nextButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.39,
    shadowRadius: 14,
    elevation: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});
