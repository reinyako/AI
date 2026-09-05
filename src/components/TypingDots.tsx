import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

/**
 * Indikator "sedang mengetik" ala iMessage: gelembung abu berekor di kiri dengan
 * tiga titik yang mengembang bergantian. Gelembungnya sendiri muncul dengan pantulan
 * kecil, seperti gelembung pesan biasa.
 */
export function TypingDots() {
  const theme = useTheme();
  const enter = useRef(new Animated.Value(0)).current;
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const entrance = Animated.spring(enter, {
      toValue: 1,
      damping: 13,
      stiffness: 190,
      mass: 0.7,
      useNativeDriver: true,
    });
    entrance.start();

    // Tiap titik naik lalu turun, digeser 180ms satu sama lain supaya jalan seperti gelombang.
    const pulses = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(value, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 340,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(540 - index * 180),
        ])
      )
    );
    pulses.forEach((pulse) => pulse.start());

    return () => {
      entrance.stop();
      pulses.forEach((pulse) => pulse.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: theme.incoming }]}>
        {/* Ekor dibentuk sama seperti di Bubble: satu blok menyembul, lalu ditutup warna latar. */}
        <View style={[styles.tail, { backgroundColor: theme.incoming }]} />
        <View style={[styles.tailCover, { backgroundColor: theme.bg }]} />
        {dots.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: theme.label2,
                opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                transform: [
                  { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.12] }) },
                  { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Jarak ke tepi layar diatur wadahnya di ChatScreen, bukan di sini.
  wrap: { alignSelf: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 19,
  },
  tail: { position: 'absolute', bottom: 0, left: -7, width: 20, height: 21, borderBottomRightRadius: 15 },
  tailCover: { position: 'absolute', bottom: 0, left: -25, width: 25, height: 22, borderBottomRightRadius: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
