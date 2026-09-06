import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RichText } from './RichText';
import { tapFeedback } from '../lib/haptics';
import { BAR_HEIGHT, MARGIN, ROW_HEIGHT, SLOT, layoutMenu } from '../lib/menuLayout';
import { useTheme } from '../theme';
import type { Message } from '../types';

/** Letak dan ukuran gelembung aslinya di layar, hasil `measureInWindow`. */
export type BubbleFrame = { x: number; y: number; width: number; height: number };

export type MenuAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Gambar garis pemisah tepat di atas aksi ini. */
  separated?: boolean;
  run: () => void;
};

export type MenuTarget = {
  message: Message;
  frame: BubbleFrame;
  actions: MenuAction[];
};

/** Tapback iMessage, urutannya mengikuti bar aslinya. */
export const TAPBACKS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

/** Jarak emoji ke tepi baris tapback; ukuran lainnya ada di lib/menuLayout. */
const BAR_PAD = 7;
const CARD_WIDTH = 250;

type Props = {
  target: MenuTarget;
  onClose: () => void;
  onReact: (emoji: string) => void;
};

/**
 * Menu tekan-tahan ala iMessage: latar belakangnya diburamkan, gelembung yang
 * ditekan diangkat ke depan, baris tapback muncul di atasnya dan kartu aksi di
 * bawahnya.
 *
 * Gelembungnya digambar ulang di sini, bukan dipindahkan dari daftar. Memindahkan
 * yang asli berarti melubangi daftar di belakangnya, sedangkan menggambar ulang
 * cukup bermodal hasil ukur `measureInWindow` dan daftarnya tetap utuh.
 *
 * Ekornya sengaja tidak ikut digambar. Ekor di Bubble dibentuk dengan menutup
 * sebagian kotak memakai warna latar layar — di atas lapisan buram penutup itu akan
 * terlihat sebagai bercak pekat, jadi lebih rapi tanpa ekor.
 */
export function MessageMenu({ target, onClose, onReact }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const { message, frame, actions } = target;

  const outgoing = message.role === 'user';
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      damping: 18,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const close = () => onClose();

  // Tata letaknya dihitung terpisah di lib/menuLayout supaya bisa diuji sendiri.
  const separators = actions.filter((action) => action.separated).length;
  const menuHeight = actions.length * ROW_HEIGHT + separators * StyleSheet.hairlineWidth + 8;

  const { bubbleTop, bubbleHeight, barTop, cardTop } = layoutMenu({
    frameTop: frame.y,
    frameHeight: frame.height,
    screenHeight: screen.height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    menuHeight,
  });

  const side = outgoing
    ? { right: Math.max(MARGIN, screen.width - (frame.x + frame.width)) }
    : { left: Math.max(MARGIN, frame.x) };

  const grow = enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const material = theme.dark ? 'systemThickMaterialDark' : 'systemThickMaterialLight';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: enter }]}>
        <BlurView
          intensity={60}
          tint={theme.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Animated.View>

      {/* Menyentuh di mana pun di luar isi menu akan menutupnya. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      {/* ------------------------------------------------------- baris tapback */}
      <Animated.View
        style={[
          styles.bar,
          side,
          { top: barTop, opacity: enter, transform: [{ scale: grow }] },
        ]}
      >
        <BlurView intensity={70} tint={material} style={StyleSheet.absoluteFill} />
        {TAPBACKS.map((emoji) => {
          const picked = message.reaction === emoji;
          return (
            <Pressable
              key={emoji}
              style={[styles.slot, picked && { backgroundColor: theme.blue }]}
              onPress={() => {
                tapFeedback();
                onReact(emoji);
              }}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* --------------------------------------------------- gelembung diangkat */}
      <Animated.View
        style={[
          styles.bubble,
          side,
          {
            top: bubbleTop,
            maxWidth: screen.width * 0.78,
            maxHeight: bubbleHeight,
            backgroundColor: outgoing ? theme.outgoing : theme.incoming,
            opacity: enter,
            transform: [{ scale: grow }],
          },
        ]}
      >
        {outgoing ? (
          <Text style={[styles.text, { color: theme.outgoingText }]}>{message.text}</Text>
        ) : (
          <RichText
            text={message.text}
            style={[styles.text, { color: theme.incomingText }]}
            color={theme.incomingText}
          />
        )}
      </Animated.View>

      {/* ----------------------------------------------------------- kartu aksi */}
      <Animated.View
        style={[
          styles.card,
          side,
          { top: cardTop, opacity: enter, transform: [{ scale: grow }] },
        ]}
      >
        <BlurView intensity={70} tint={material} style={StyleSheet.absoluteFill} />
        {actions.map((action) => (
          <View key={action.label}>
            {action.separated ? (
              <View style={[styles.rule, { backgroundColor: theme.separator }]} />
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: theme.fill },
              ]}
              onPress={() => {
                tapFeedback();
                onClose();
                action.run();
              }}
            >
              <Text
                style={[
                  styles.label,
                  { color: action.destructive ? theme.danger : theme.label },
                ]}
                numberOfLines={1}
              >
                {action.label}
              </Text>
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? theme.danger : theme.label}
              />
            </Pressable>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Lapisan buram saja belum cukup memisahkan menu dari percakapan di belakangnya.
  dim: { backgroundColor: 'rgba(0,0,0,0.28)' },

  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: BAR_HEIGHT,
    paddingHorizontal: BAR_PAD,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  slot: {
    width: SLOT,
    height: SLOT,
    borderRadius: SLOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22, lineHeight: 27 },

  bubble: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 9,
    borderRadius: 19,
    overflow: 'hidden',
  },
  text: { fontSize: 17, lineHeight: 22 },

  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  label: { fontSize: 17, flexShrink: 1, paddingRight: 12 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
