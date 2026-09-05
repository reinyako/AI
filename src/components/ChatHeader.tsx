import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from './Avatar';
import { GlassPressable } from './GlassPressable';
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
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.nav,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.separator,
            },
          ]}
        />
      )}

      <View style={styles.row}>
        <GlassPressable onPress={onBack} style={styles.back} radius={CAPSULE / 2}>
          <Ionicons name="chevron-back" size={ICON} color={theme.blue} />
          <Text style={[styles.backLabel, { color: theme.blue }]}>Pesan</Text>
        </GlassPressable>

        <GlassPressable onPress={onInfo} style={styles.info} radius={CAPSULE / 2}>
          <Ionicons name="information-circle-outline" size={ICON + 4} color={theme.blue} />
        </GlassPressable>

        {/* Judul dipusatkan lepas dari lebar tombol kiri/kanan. */}
        <View style={styles.title} pointerEvents="box-none">
          <Avatar name={contact.name} color={contact.color} size={AVATAR} agent={agent} />
          {SHAPE.glass ? (
            <GlassPressable onPress={onInfo} style={styles.peerPill} radius={PILL / 2} hitSlop={6}>
              <Text style={[styles.peerName, { color: theme.label }]} numberOfLines={1}>
                {contact.name}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={theme.label2} />
            </GlassPressable>
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

/** Tinggi kapsul back dan lingkaran info. */
const CAPSULE = SHAPE.glass ? 44 : 36;
const ICON = SHAPE.glass ? 24 : 22;
const AVATAR = SHAPE.glass ? 44 : 30;
/** Tinggi kapsul nama di bawah avatar. */
const PILL = SHAPE.glass ? 22 : 14;
const TITLE_GAP = 3;
/**
 * Tinggi blok judul. Barisnya harus setinggi ini, kalau tidak judulnya menyembul
 * keluar dan bertabrakan dengan pesan yang lewat di belakangnya.
 */
const TITLE_HEIGHT = AVATAR + TITLE_GAP + PILL;

const styles = StyleSheet.create({
  header: { paddingBottom: SHAPE.glass ? 10 : 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SHAPE.gutter,
    minHeight: TITLE_HEIGHT,
  },

  back: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CAPSULE,
    paddingLeft: 10,
    paddingRight: 16,
    zIndex: 1,
  },
  backLabel: { fontSize: 17, fontWeight: '600', marginLeft: 2 },
  info: {
    width: CAPSULE,
    height: CAPSULE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

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
    gap: TITLE_GAP,
  },
  peerName: { fontSize: 14, lineHeight: 16, fontWeight: '600', maxWidth: 170 },
  peerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    height: PILL,
    paddingLeft: 10,
    paddingRight: 7,
  },
});
