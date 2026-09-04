import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AVATAR_COLORS, useTheme } from '../theme';

export function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: theme.label2 }]}>{title.toUpperCase()}</Text> : null}
      <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
      {footer ? <Text style={[styles.sectionFooter, { color: theme.label2 }]}>{footer}</Text> : null}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.separator }]} />;
}

export function TextRow({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.label2 }]}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, { color: theme.label }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.label3}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={!secureTextEntry}
      />
    </View>
  );
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.sliderTop}>
        <Text style={[styles.rowLabel, { color: theme.label }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.label2 }]}>{format ? format(value) : String(value)}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={theme.blue}
        maximumTrackTintColor={theme.separator}
      />
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.rowInline]}>
      <Text style={[styles.rowLabel, { color: theme.label }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function LinkRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.row, styles.rowInline, pressed && { backgroundColor: theme.fill }]} onPress={onPress}>
      <Text style={[styles.rowLabel, { color: destructive ? theme.danger : theme.label }]}>{label}</Text>
      <View style={styles.linkRight}>
        {value ? (
          <Text style={[styles.value, { color: theme.label2 }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {destructive ? null : <Ionicons name="chevron-forward" size={16} color={theme.label3} />}
      </View>
    </Pressable>
  );
}

export function ColorPicker({ value, onChange }: { value: number; onChange: (index: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.label2 }]}>Warna avatar</Text>
      <View style={styles.swatches}>
        {AVATAR_COLORS.map((color, index) => (
          <Pressable
            key={color}
            onPress={() => onChange(index)}
            style={[
              styles.swatch,
              { backgroundColor: color },
              index === value && { borderColor: theme.label, borderWidth: 3 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, letterSpacing: 0.4, marginBottom: 7, marginLeft: 32 },
  sectionFooter: { fontSize: 12, lineHeight: 17, marginTop: 7, marginHorizontal: 32 },
  card: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { paddingHorizontal: 16, paddingVertical: 11 },
  rowInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 17 },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 15, flexShrink: 1 },
  input: { fontSize: 17, padding: 0 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', lineHeight: 22 },
  sliderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  swatches: { flexDirection: 'row', gap: 12, marginTop: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderColor: 'transparent', borderWidth: 3 },
});
