import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform } from 'react-native';

/**
 * Pendekatan kurva animasi papan ketik iOS. UIKit memakai kurva khusus yang tidak
 * punya padanan langsung di `Easing`, dan bezier inilah yang paling mendekatinya.
 */
const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.25, 1);

export type KeyboardState = {
  /** `true` selama papan ketik terlihat. */
  visible: boolean;
  /**
   * Tinggi papan ketik sebagai nilai teranimasi, digerakkan native.
   *
   * Dipakai untuk menggeser isi layar ke atas alih-alih memakai
   * `KeyboardAvoidingView`. Komponen itu menata ulang seluruh pohon di bawahnya
   * setiap animasi — termasuk daftar pesan — sehingga panel pengetik terlihat
   * tertinggal di belakang papan ketiknya. Geseran ini berjalan di thread UI dan
   * memakai durasi yang dikirim iOS lewat event, jadi keduanya bergerak bersamaan.
   *
   * Di Android nilainya dibiarkan nol: jendelanya sudah diperkecil sendiri oleh
   * `adjustResize`, jadi menggeser lagi malah dobel.
   */
  offset: Animated.Value;
};

export function useKeyboardOffset(onShow?: () => void): KeyboardState {
  const [visible, setVisible] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;
  const handler = useRef(onShow);
  handler.current = onShow;

  useEffect(() => {
    const ios = Platform.OS === 'ios';

    const animate = (toValue: number, duration?: number) => {
      if (!ios) return;
      Animated.timing(offset, {
        toValue,
        duration: duration || 250,
        easing: KEYBOARD_EASING,
        useNativeDriver: true,
      }).start();
    };

    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      // Dipanggil lebih dulu supaya daftarnya sudah di posisi benar sebelum bergerak.
      handler.current?.();
      setVisible(true);
      animate(event.endCoordinates.height, event.duration);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) => {
      setVisible(false);
      animate(0, event.duration);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [offset]);

  return { visible, offset };
}
