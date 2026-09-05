import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * `true` selama papan ketik terlihat.
 *
 * iOS memakai event `will*` supaya perubahan tata letak berjalan bersamaan dengan
 * animasi papan ketiknya, sementara Android hanya punya `did*`.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
