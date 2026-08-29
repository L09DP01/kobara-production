import React, { useEffect, useRef } from 'react';
import { View, Text, useWindowDimensions, Animated } from 'react-native';

interface SlideProps {
  item: {
    id: string;
    title: string;
    description: string;
    titleHighlight?: string;
    Illustration: React.FC<any>;
  };
}

export default function OnboardingSlide({ item }: SlideProps) {
  const { width, height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const titleParts = item.titleHighlight 
    ? item.title.split(item.titleHighlight) 
    : [item.title];

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [item.id]);

  return (
    <View style={{ width, height: height * 0.7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 48 }}>
      {/* Illustration Area */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <item.Illustration width={width * 0.8} height={width * 0.8} />
      </View>

      {/* Text Content */}
      <Animated.View style={{ width: '100%', marginTop: 32, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#F8FAFC', textAlign: 'center', marginBottom: 16, lineHeight: 40 }}>
          {titleParts.length > 1 ? (
            <>
              {titleParts[0]}
              <Text style={{ color: '#FF6B35' }}>{item.titleHighlight}</Text>
              {titleParts[1]}
            </>
          ) : (
            item.title
          )}
        </Text>
        <Text style={{ fontSize: 16, color: '#94A3B8', textAlign: 'center', lineHeight: 24 }}>
          {item.description}
        </Text>
      </Animated.View>
    </View>
  );
}
