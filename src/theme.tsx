import * as SystemUI from 'expo-system-ui';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, Platform, useColorScheme } from 'react-native';

import { LIQUID_GLASS } from './lib/platform';

export const AVATAR_COLORS = ['#0A84FF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#A2845E'];

/**
 * DEBUG - sementara, untuk memburu bug "semuanya jadi putih setelah keluar lalu
 * masuk lagi ke aplikasi". Saat menyala, tema terang tidak lagi putih melainkan
 * magenta menyala; warna itu tidak dipakai di mana pun, jadi tidak mungkin
 * tertukar dengan warna lain.
 *
 * Gunanya memisahkan dua penyebab yang gejalanya sama-sama "berubah terang":
 *
 *   magenta -> palet aplikasi sendiri yang berpindah ke tema terang. Bugnya di
 *              sisi JS, di state ThemeProvider.
 *   putih   -> palet kita tetap gelap; yang berubah terang adalah permukaan yang
 *              digambar UIKit sendiri - latar navigation bar dan latar window di
 *              belakang semuanya. Bugnya di trait native, bukan di state kita.
 *
 * Kembalikan ke `false` setelah pengujian selesai.
 */
const DEBUG_LOUD_LIGHT = false;

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

/**
 * Palet terang yang benar-benar dipakai. Sama dengan `light`, kecuali saat
 * penanda debug di atas menyala - lalu setiap bidang yang tadinya putih diganti
 * magenta. `bgFade` harus ikut berubah karena ujung gradien wajib warna yang sama
 * dengan `bg`, cuma beralpha nol.
 */
const lightPalette: typeof light = DEBUG_LOUD_LIGHT
  ? {
      ...light,
      bg: '#FF00AA',
      bgFade: 'rgba(255,0,170,0)',
      groupedBg: '#C4008A',
      nav: '#FF4FC3',
      card: '#FF4FC3',
      incoming: '#8E0063',
      incomingText: '#FFFFFF',
      label: '#FFFFFF',
      label2: 'rgba(255,255,255,0.7)',
      label3: 'rgba(255,255,255,0.4)',
    }
  : light;

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
     * Tema dikunci. Override dipasang sampai ke sisi native, bukan cuma palet JS:
     * `Appearance.setColorScheme` menyetel `overrideUserInterfaceStyle` ke seluruh
     * window aplikasi, sehingga permukaan yang digambar UIKit sendiri - latar
     * navigation bar, latar window, papan ketik - ikut terkunci dan iOS tidak bisa
     * lagi menggesernya ke terang.
     *
     * (react-native-web tidak punya fungsi ini sama sekali, jadi dipanggil opsional.)
     */
    if (mode !== 'system') {
      Appearance.setColorScheme?.(mode);
      return;
    }

    // Ikut sistem, jadi override sisa dari mode sebelumnya harus dilepas dulu.
    Appearance.setColorScheme?.('unspecified');

    let timer: ReturnType<typeof setTimeout> | undefined;

    /**
     * Perubahan skema hanya dipercaya selagi aplikasi benar-benar aktif.
     *
     * Saat aplikasi ditinggalkan, iOS memotretnya untuk kartu app switcher dalam tema
     * terang DAN gelap. Pemotretan itu menggeser trait aplikasi, dan React Native
     * meneruskannya sebagai perubahan skema yang tampak sah padahal bukan kemauan
     * pengguna.
     *
     * Percobaan sebelumnya menunda nilainya lalu "membaca ulang" lewat
     * `Appearance.getColorScheme()`. Itu tidak pernah bisa bekerja, dan inilah
     * sebabnya: fungsi tersebut menghubungi sisi native HANYA SATU KALI, lalu
     * seterusnya mengembalikan nilai simpanan dari event terakhir yang diterima
     * (Libraries/Utilities/Appearance.js - sisi native dipanggil hanya selagi
     * simpanannya masih kosong). Jadi yang "dibaca ulang" justru nilai potretan itu
     * sendiri. Nilainya tersangkut, dan tidak ada event susulan yang mengoreksinya.
     *
     * Penyaringnya dibatasi ke iOS karena `AppState` berarti lain di platform lain -
     * di web ia memetakan ke document.visibilityState.
     */
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      if (Platform.OS === 'ios' && AppState.currentState !== 'active') return;
      setScheme(colorScheme);
    });

    /**
     * Penyaring di atas ikut menolak pergantian tema sungguhan yang dilakukan selagi
     * aplikasi di latar belakang, jadi setiap kali aplikasi kembali aktif nilainya
     * diambil ulang dari sumber yang segar. `setColorScheme('unspecified')` dipakai
     * justru karena efek sampingnya: fungsi itu memperbarui simpanan di dalam modul
     * Appearance dari sisi native - satu-satunya jalan yang tersisa untuk melewati
     * simpanan basi tadi.
     */
    const app = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        Appearance.setColorScheme?.('unspecified');
        setScheme(Appearance.getColorScheme());
      }, 500);
    });

    return () => {
      clearTimeout(timer);
      appearance.remove();
      app.remove();
    };
  }, [mode]);

  const resolved = mode === 'system' ? scheme : mode;
  const value = resolved === 'dark' ? dark : lightPalette;

  /**
   * Root view — lapisan paling belakang, di belakang seluruh pohon React.
   *
   * Lapisan ini bukan bagian dari pohon komponen, jadi tidak ada `style` yang bisa
   * menjangkaunya, dan warnanya bawaan Expo adalah PUTIH. Biasanya tidak kelihatan
   * karena tertutup layar, tapi begitu layarnya digeser — swipe back, kartu app
   * switcher, modal — lapisan putih itu menyembul di belakangnya.
   *
   * `setBackgroundColorAsync` menyetel `UIWindow.backgroundColor` sekaligus latar
   * view milik root view controller, jadi keduanya ikut tema.
   *
   * Sengaja lewat runtime, bukan lewat `backgroundColor` di app.json: nilai di
   * app.json dipasang saat build sehingga tidak bisa ikut berganti terang/gelap, dan
   * di Expo Go config plugin memang tidak dijalankan sama sekali.
   *
   * Yang penting: warnanya dipasang ULANG setiap aplikasi kembali aktif, bukan hanya
   * saat temanya berganti. Saat aplikasi ditinggalkan, sisi sistem mengembalikan latar
   * itu ke bawaannya, sedangkan dari sisi JS tidak ada satu nilai pun yang berubah —
   * jadi tidak ada yang memicu pengecatan ulang dan putihnya menetap.
   *
   * Gejalanya sempat menyesatkan: dengan tema magenta lapisan ini terlihat "sudah
   * benar", padahal itu cuma efek samping temanya kebetulan BERGANTI saat resume
   * sehingga effect-nya ikut jalan lagi. Pada tema yang tidak berganti — gelap ke
   * gelap — tidak ada yang jalan, dan putihnya tetap.
   */
  const rootBg = value.bg;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      SystemUI.setBackgroundColorAsync(rootBg).catch(() => {});
    };

    apply();

    const app = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      apply();
      // Sekali lagi setelah animasi kembali selesai, kalau-kalau sistem baru
      // mengembalikan warnanya sesaat setelah aplikasi dinyatakan aktif.
      clearTimeout(timer);
      timer = setTimeout(apply, 300);
    });

    return () => {
      clearTimeout(timer);
      app.remove();
    };
  }, [rootBg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const fromContext = useContext(ThemeContext);
  const scheme = useColorScheme();
  return fromContext ?? (scheme === 'dark' ? dark : lightPalette);
}
