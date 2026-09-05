import { Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * iOS 26 atau lebih baru, yang tampilannya memakai Liquid Glass.
 * Dihitung sekali saat modul dimuat — versi OS tidak berubah selama aplikasi jalan.
 */
export const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Mode tampilan yang sedang dipakai, ditampilkan di Pengaturan supaya bisa dipastikan
 * langsung di perangkat — tanpa ini tidak ada cara melihat jalur mana yang aktif.
 */
export const UI_MODE_LABEL =
  Platform.OS !== 'ios'
    ? `Standar (${Platform.OS})`
    : LIQUID_GLASS
      ? `Liquid Glass · iOS ${Platform.Version}`
      : `Klasik · iOS ${Platform.Version}`;
