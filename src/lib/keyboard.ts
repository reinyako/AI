import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * `true` selama papan ketik terlihat.
 *
 * iOS memakai event `will*` supaya perubahan tata letak berjalan bersamaan dengan
 * animasi papan ketiknya, sementara Android hanya punya `did*`.
 *
 * `onShow` dipanggil langsung di dalam listener-nya, sebelum state React diperbarui.
 * Pekerjaan yang harus seirama dengan animasi papan ketik — seperti menurunkan
 * daftar chat — tidak boleh menunggu satu putaran render dulu, karena itulah yang
 * membuatnya terasa menyusul, bukan menyatu dengan animasinya.
 */
export function useKeyboardVisible(onShow?: () => void): boolean {
  const [visible, setVisible] = useState(false);
  const handler = useRef(onShow);
  handler.current = onShow;

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      handler.current?.();
      setVisible(true);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
