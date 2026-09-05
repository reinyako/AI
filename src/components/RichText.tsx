import React, { useMemo } from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';

import { parseRich, type RichSegment } from '../lib/markdown';
import { useTheme } from '../theme';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Warna teks gelembungnya; kode sebaris memakai warna ini juga. */
  color: string;
};

/**
 * Teks balasan model dengan penanda markdown-nya digambar, bukan ditampilkan
 * mentah. Semuanya disusun sebagai `Text` bersarang di dalam satu `Text` induk,
 * jadi baris tetap mengalir dan teksnya tetap bisa disalin seperti biasa.
 */
export function RichText({ text, style, color }: Props) {
  const lines = useMemo(() => parseRich(text), [text]);
  const theme = useTheme();

  const styleFor = (segment: RichSegment): TextStyle => ({
    ...(segment.bold ? { fontWeight: '700' } : null),
    ...(segment.italic ? { fontStyle: 'italic' } : null),
    ...(segment.strike ? { textDecorationLine: 'line-through' } : null),
    ...(segment.code
      ? {
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 15,
          backgroundColor: theme.fill,
          color,
        }
      : null),
  });

  return (
    <Text style={style} selectable>
      {lines.map((line, index) => (
        <Text key={index}>
          {index > 0 ? '\n' : ''}
          {line.bullet ? '•  ' : ''}
          {line.segments.map((segment, position) => (
            <Text key={position} style={styleFor(segment)}>
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </Text>
  );
}
