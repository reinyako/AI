import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';

import { LIQUID_GLASS } from './lib/platform';

export const AVATAR_COLORS = ['#0A84FF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#A2845E'];

export type Theme = ReturnType<typeof useTheme>;

const light = {
  dark: false,
  bg: '#FFFFFF',
  /** `bg` dengan alpha nol — ujung gradien harus warna yang sama, bukan `transparent`. */
  bgFade: 'rgba(255,255,255,0)',
  groupedBg: '#F2F2F7',
  nav: '#F7F7F7',
  label: '#000000',
  label2: 'rgba(60,60,67,0.6)',
  label3: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.18)',
  fill: 'rgba(118,118,128,0.12)',
  incoming: '#E9E9EB',
  incomingText: '#000000',
  outgoing: '#0A7CFF',
  outgoingText: '#FFFFFF',
  blue: '#007AFF',
  danger: '#FF3B30',
  dangerBg: '#FFF0EF',
  dangerBorder: 'rgba(255,59,48,0.35)',
  card: '#FFFFFF',
};

const dark: typeof light = {
  dark: true,
  bg: '#000000',
  bgFade: 'rgba(0,0,0,0)',
  groupedBg: '#000000',
  nav: '#1C1C1E',
  label: '#FFFFFF',
  label2: 'rgba(235,235,245,0.6)',
  label3: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.65)',
  fill: 'rgba(118,118,128,0.24)',
  incoming: '#26262A',
  incomingText: '#FFFFFF',
  outgoing: '#0A7CFF',
  outgoingText: '#FFFFFF',
  blue: '#0A84FF',
  danger: '#FF453A',
  dangerBg: '#2A1615',
  dangerBorder: 'rgba(255,69,58,0.45)',
  card: '#1C1C1E',
};

/**
 * Bentuk yang ikut versi iOS. Liquid Glass (iOS 26) memakai sudut yang jauh lebih
 * membulat, sedangkan iOS 18 memakai kartu rapat dengan garis pemisah setipis mungkin.
 *
 * - `cardRadius`     sudut kartu daftar di layar pengaturan
 * - `composerInset`  jarak bawah panel pengetik saat papan ketik terbuka
 * - `fieldRadius`    sudut kolom teks dan tombol + di panel pengetik
 * - `gutter`         jarak ke tepi layar; dipakai bersama oleh gelembung pesan dan
 *                    panel pengetik supaya keduanya selalu segaris
 */
export const SHAPE = LIQUID_GLASS
  ? { glass: true, cardRadius: 20, composerInset: 8, fieldRadius: 20, gutter: 16 }
  : { glass: false, cardRadius: 12, composerInset: 0, fieldRadius: 18, gutter: 10 };

const ThemeContext = createContext<typeof light | null>(null);

/**
 * Palet disebarkan lewat context dari satu langganan di root, bukan dengan
 * memanggil `useColorScheme()` di tiap komponen. Alasannya: komponen yang duduk
 * di dalam sel FlatList tidak ikut menggambar ulang saat mode gelap/terang diganti
 * selagi aplikasi terbuka, sedangkan perubahan context menembus bailout itu.
 */
export function ThemeProvider({
  mode = 'system',
  children,
}: {
  /** `system` mengikuti setelan perangkat; selain itu temanya dikunci. */
  mode?: 'system' | 'light' | 'dark';
  children: React.ReactNode;
}) {
  const [scheme, setScheme] = useState(() => Appearance.getColorScheme());

  useEffect(() => {
    /**
     * Saat aplikasi ditinggalkan, iOS memotretnya untuk kartu app switcher dalam
     * tema terang DAN gelap. Pemotretan itu mengirim perubahan skema warna yang
     * bukan kemauan pengguna; kalau diikuti, aplikasi kembali dengan tema yang
     * salah — dan navigation bar bisa tersangkut putih karena React Navigation
     * melihat nilainya kembali sama dan tidak mengirim pembaruan ke sisi native.
     *
     * Karena itu perubahan hanya diterima selagi aplikasi benar-benar aktif, dan
     * skemanya dibaca ulang setiap kali aplikasi kembali ke depan.
     */
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      if (AppState.currentState === 'active') setScheme(colorScheme);
    });
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') setScheme(Appearance.getColorScheme());
    });
    return () => {
      appearance.remove();
      app.remove();
    };
  }, []);

  const resolved = mode === 'system' ? scheme : mode;
  const value = resolved === 'dark' ? dark : light;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const fromContext = useContext(ThemeContext);
  const scheme = useColorScheme();
  return fromContext ?? (scheme === 'dark' ? dark : light);
}
