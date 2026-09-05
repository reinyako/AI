import { GlassView } from 'expo-glass-effect';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SHAPE } from '../theme';

type Props = {
  onPress: () => void;
  /** Bentuk kontrolnya: ukuran, jarak dalam, dan tata letak isinya. */
  style?: StyleProp<ViewStyle>;
  /** Sudut kontrol; dipakai juga untuk memotong lapisan kacanya. */
  radius: number;
  /**
   * Pakai lapisan kaca? Bawaannya mengikuti perangkat. Setel `false` untuk kontrol
   * yang memang harus berwarna pekat — tombol kirim, misalnya, yang warnanya justru
   * hilang kalau ditimpa kaca.
   */
  glass?: boolean;
  /** Latar saat lapisan kaca tidak dipakai. */
  fallbackColor?: string;
  hitSlop?: number;
  children: React.ReactNode;
};

/**
 * Kontrol berbahan Liquid Glass yang menanggapi sentuhan.
 *
 * Kaca asli iOS 26 tidak diam saat ditekan: bentuknya sedikit menyusut lalu memantul
 * balik, dan permukaannya menyala sesaat. `GlassView` sendiri tidak melakukan itu,
 * jadi geraknya ditambahkan di sini — memakai transform dan opacity supaya bisa
 * dijalankan di thread UI, bukan di JS.
 */
export function GlassPressable({
  onPress,
  style,
  radius,
  glass = SHAPE.glass,
  fallbackColor,
  hitSlop = 8,
  children,
}: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const hover = useRef(new Animated.Value(0)).current;

  const spring = (value: Animated.Value, toValue: number) =>
    Animated.spring(value, {
      toValue,
      damping: 17,
      stiffness: 340,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => spring(press, 1)}
      onPressOut={() => spring(press, 0)}
      onHoverIn={() => spring(hover, 1)}
      onHoverOut={() => spring(hover, 0)}
      hitSlop={hitSlop}
    >
      <Animated.View
        style={[
          style,
          {
            borderRadius: radius,
            overflow: 'hidden',
            transform: [
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
            ],
          },
        ]}
      >
        {glass ? (
          <GlassView
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            glassEffectStyle="regular"
            isInteractive
          />
        ) : fallbackColor ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackColor }]} />
        ) : null}

        {/* Kilau tipis yang menyala saat ditekan atau disorot penunjuk. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#FFFFFF',
              opacity: Animated.add(
                press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }),
                hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] })
              ),
            },
          ]}
        />

        {children}
      </Animated.View>
    </Pressable>
  );
}
