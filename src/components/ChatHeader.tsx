import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from './Avatar';
import { SHAPE, useTheme } from '../theme';
import type { Contact } from '../types';

type Props = {
  contact: Contact;
  onBack: () => void;
  onInfo: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Header layar chat, digambar sendiri alih-alih memakai navigation bar bawaan.
 *
 * Navigation bar native menyimpan masalah yang tidak bisa dikendalikan dari sini:
 * tampilannya dikembalikan iOS ke bawaan sistem saat aplikasi kembali dari latar
 * belakang (sehingga tersangkut putih), dan iOS 26 memasang scroll edge effect yang
 * menyelubungi seluruh percakapan begitu isinya lewat di bawah bar. Dengan header
 * sendiri, keduanya tidak pernah ada — dan tampilannya bisa diuji seperti komponen
 * biasa.
 */
export function ChatHeader({ contact, onBack, onInfo, onLayout }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const agent = contact.kind === 'agent';

  return (
    <View style={[styles.header, { paddingTop: insets.top }]} onLayout={onLayout}>
      {SHAPE.glass ? (
        // Pekat di ujung atas lalu memudar habis, supaya isi header tetap terbaca
        // di atas pesan yang lewat di belakangnya.
        <LinearGradient
          colors={[theme.bg, theme.bg, theme.bgFade]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.nav, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
          ]}
          pointerEvents="none"
        />
      )}

      <View style={styles.row}>
        <Pressable style={[styles.side, styles.back]} onPress={onBack} hitSlop={8}>
          {SHAPE.glass ? (
            <GlassView
              style={[StyleSheet.absoluteFill, styles.capsuleFill]}
              glassEffectStyle="regular"
              isInteractive
            />
          ) : null}
          <Ionicons name="chevron-back" size={22} color={theme.blue} />
          <Text style={[styles.backLabel, { color: theme.blue }]}>Pesan</Text>
        </Pressable>

        <Pressable style={[styles.side, styles.info]} onPress={onInfo} hitSlop={8}>
          {SHAPE.glass ? (
            <GlassView
              style={[StyleSheet.absoluteFill, styles.circleFill]}
              glassEffectStyle="regular"
              isInteractive
            />
          ) : null}
          <Ionicons name="information-circle-outline" size={24} color={theme.blue} />
        </Pressable>

        {/* Judul dipusatkan lepas dari lebar tombol kiri/kanan. */}
        <View style={styles.title} pointerEvents="box-none">
          <Avatar name={contact.name} color={contact.color} size={SHAPE.glass ? 34 : 30} agent={agent} />
          {SHAPE.glass ? (
            <Pressable style={styles.peerPill} onPress={onInfo} hitSlop={6}>
              <GlassView
                style={[StyleSheet.absoluteFill, styles.peerPillFill]}
                glassEffectStyle="regular"
                isInteractive
              />
              <Text style={[styles.peerName, { color: theme.label }]} numberOfLines={1}>
                {contact.name}
              </Text>
              <Ionicons name="chevron-forward" size={10} color={theme.label2} />
            </Pressable>
          ) : (
            <Text style={[styles.peerName, { color: theme.label }]} numberOfLines={1}>
              {contact.name}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const CAPSULE_HEIGHT = 36;
/**
 * Tinggi blok judul: avatar + jarak 2 + nama. Barisnya harus setinggi ini, kalau
 * tidak judulnya menyembul keluar dan bertabrakan dengan isi di baliknya.
 */
const TITLE_HEIGHT = SHAPE.glass ? 34 + 2 + 16 : 30 + 2 + 14;

const styles = StyleSheet.create({
  header: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SHAPE.gutter,
    minHeight: TITLE_HEIGHT,
  },

  side: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  back: {
    height: CAPSULE_HEIGHT,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: CAPSULE_HEIGHT / 2,
    overflow: 'hidden',
  },
  capsuleFill: { borderRadius: CAPSULE_HEIGHT / 2 },
  backLabel: { fontSize: 17, fontWeight: '600', marginLeft: 2 },
  info: {
    width: CAPSULE_HEIGHT,
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_HEIGHT / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  circleFill: { borderRadius: CAPSULE_HEIGHT / 2 },

  // Dipusatkan dengan menutupi seluruh baris, jadi posisinya tidak ikut bergeser
  // saat label tombol kiri berubah panjang.
  title: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  peerName: { fontSize: 12, lineHeight: 14, fontWeight: '500', maxWidth: 160 },
  peerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingLeft: 9,
    paddingRight: 6,
    paddingVertical: 1,
    borderRadius: 9,
    overflow: 'hidden',
  },
  peerPillFill: { borderRadius: 9 },
});
