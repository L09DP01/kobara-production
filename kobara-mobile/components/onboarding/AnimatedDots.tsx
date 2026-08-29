import React from 'react';
import { View, useWindowDimensions, Animated } from 'react-native';

interface Props {
  data: any[];
  scrollX: Animated.Value;
}

export default function AnimatedDots({ data, scrollX }: Props) {
  const { width } = useWindowDimensions();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 16 }}>
      {data.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });

        const backgroundColor = scrollX.interpolate({
          inputRange,
          outputRange: ['#1E293B', '#FF6B35', '#1E293B'],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index.toString()}
            style={{
              width: dotWidth,
              height: 8,
              borderRadius: 4,
              marginHorizontal: 4,
              backgroundColor,
            }}
          />
        );
      })}
    </View>
  );
}
