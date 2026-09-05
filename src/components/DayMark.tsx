import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { dayMark } from '../lib/format';
import { useTheme } from '../theme';

export function DayMark({ at }: { at: number }) {
  const theme = useTheme();
  const { strong, rest } = dayMark(at);
  return (
    <Text style={[styles.text, { color: theme.label2 }]}>
      <Text style={styles.strong}>{strong}</Text> {rest}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center', fontSize: 11, marginTop: 16, marginBottom: 6 },
  strong: { fontWeight: '600' },
});
