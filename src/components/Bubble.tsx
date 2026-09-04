import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import type { Message } from '../types';

type Props = {
  message: Message;
  /** Gelembung terakhir dalam satu rentetan — hanya yang ini punya ekor. */
  tail: boolean;
  /** Awal rentetan baru, dikasih jarak lebih ke atas. */
  groupStart: boolean;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
};

const DOUBLE_TAP_MS = 280;

export function Bubble({ message, tail, groupStart, onLongPress, onDoubleTap }: Props) {
  const theme = useTheme();
  const lastTap = useRef(0);
  const outgoing = message.role === 'user';

  const background = outgoing ? theme.outgoing : theme.incoming;
  const foreground = outgoing ? theme.outgoingText : theme.incomingText;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View
      style={[
        styles.row,
        { justifyContent: outgoing ? 'flex-end' : 'flex-start' },
        groupStart && styles.groupStart,
      ]}
    >
      <Pressable onPress={handlePress} onLongPress={onLongPress} delayLongPress={280} style={styles.press}>
        <View style={[styles.bubble, { backgroundColor: background }]}>
          {tail && (
            <>
              <View
                style={[
                  styles.tail,
                  outgoing ? styles.tailOut : styles.tailIn,
                  { backgroundColor: background },
                ]}
              />
              <View
                style={[
                  styles.tailCover,
                  outgoing ? styles.tailCoverOut : styles.tailCoverIn,
                  { backgroundColor: theme.bg },
                ]}
              />
            </>
          )}
          <Text style={[styles.text, { color: foreground }]} selectable>
            {message.text}
          </Text>
        </View>

        {message.reaction ? (
          <View
            style={[
              styles.tapback,
              outgoing ? styles.tapbackOut : styles.tapbackIn,
              { backgroundColor: theme.incoming, borderColor: theme.bg },
            ]}
          >
            <Text style={styles.tapbackText}>{message.reaction}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 2, paddingHorizontal: 12 },
  groupStart: { marginTop: 10 },
  press: { maxWidth: '78%' },
  bubble: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 9,
    borderRadius: 19,
    overflow: 'visible',
  },
  text: { fontSize: 17, lineHeight: 22 },

  // Ekor gelembung: satu kotak berwarna sama yang menyembul keluar,
  // lalu ditutup sebagian oleh kotak berwarna latar supaya lengkung.
  tail: { position: 'absolute', bottom: 0, width: 20, height: 21 },
  tailIn: { left: -7, borderBottomRightRadius: 15 },
  tailOut: { right: -7, borderBottomLeftRadius: 15 },
  tailCover: { position: 'absolute', bottom: 0, width: 25, height: 22 },
  tailCoverIn: { left: -25, borderBottomRightRadius: 11 },
  tailCoverOut: { right: -25, borderBottomLeftRadius: 11 },

  tapback: {
    position: 'absolute',
    top: -14,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 2,
  },
  tapbackIn: { right: -10 },
  tapbackOut: { left: -10 },
  tapbackText: { fontSize: 13 },
});
