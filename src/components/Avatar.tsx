import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AVATAR_COLORS } from '../theme';
import { initials } from '../lib/format';

type Props = { name: string; color: number; size?: number; agent?: boolean };

export function Avatar({ name, color, size = 50, agent }: Props) {
  const background = AVATAR_COLORS[color % AVATAR_COLORS.length];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
    >
      {agent ? (
        // Agent dibedakan dari karakter lewat ikon, bukan inisial nama.
        <Ionicons name="sparkles" size={size * 0.44} color="#FFFFFF" />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4 }]} numberOfLines={1}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '500' },
});
