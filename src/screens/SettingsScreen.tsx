import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet } from 'react-native';

import { fetchKeyInfo } from '../api/openrouter';
import { Divider, LinkRow, Section, SliderRow, SwitchRow, TextRow } from '../components/Form';
import type { RootStackParamList } from '../navigation';
import { DEFAULT_GLOBAL_PROMPT, useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const [key, setKey] = useState(store.apiKey);
  const [checking, setChecking] = useState(false);

  const commitKey = (value: string) => {
    setKey(value);
    store.saveApiKey(value);
  };

  const pasteKey = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      Alert.alert('Clipboard kosong', 'Salin dulu API key-nya dari openrouter.ai.');
      return;
    }
    commitKey(text);
  };

  const checkCredit = async () => {
    if (!store.apiKey) {
      Alert.alert('Belum ada key', 'Tempelkan API key OpenRouter dulu.');
      return;
    }
    setChecking(true);
    try {
      const info = await fetchKeyInfo(store.apiKey);
      const limit = info.limit === null ? 'tanpa limit' : `limit $${info.limit.toFixed(2)}`;
      Alert.alert('Key aktif', `${info.label ?? 'Tanpa label'}\nTerpakai $${info.usage.toFixed(3)} · ${limit}`);
    } catch (error) {
      Alert.alert('Gagal cek key', error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setChecking(false);
    }
  };

  const defaults = store.state.defaults;

  return (
    <ScrollView
      style={{ backgroundColor: theme.groupedBg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section
        title="OpenRouter"
        footer="Key disimpan di penyimpanan aman perangkat (Keychain), tidak pernah dikirim ke mana pun selain openrouter.ai."
      >
        <TextRow
          label="API key"
          value={key}
          onChangeText={commitKey}
          placeholder="sk-or-v1-..."
          secureTextEntry
          autoCapitalize="none"
        />
        <Divider />
        <LinkRow label="Tempel dari clipboard" onPress={pasteKey} />
        <Divider />
        <LinkRow label={checking ? 'Mengecek…' : 'Cek key & kredit'} onPress={checkCredit} />
        <Divider />
        <LinkRow label="Buka openrouter.ai/keys" onPress={() => Linking.openURL('https://openrouter.ai/keys')} />
      </Section>

      <Section title="Default untuk kontak baru">
        <LinkRow
          label="Model"
          value={defaults.model}
          onPress={() => navigation.navigate('ModelPicker', {})}
        />
        <Divider />
        <SliderRow
          label="Temperature"
          value={defaults.temperature}
          min={0}
          max={2}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(temperature) => store.setDefaults({ temperature })}
        />
        <Divider />
        <SliderRow
          label="Panjang balasan"
          value={defaults.maxTokens}
          min={128}
          max={4096}
          step={64}
          format={(value) => `${Math.round(value)} token`}
          onChange={(maxTokens) => store.setDefaults({ maxTokens: Math.round(maxTokens) })}
        />
        <Divider />
        <SwitchRow
          label="Jeda mengetik"
          value={defaults.humanize}
          onValueChange={(humanize) => store.setDefaults({ humanize })}
        />
      </Section>

      <Section
        title="Instruksi global"
        footer="Selalu ditempel di depan persona tiap kontak. Ini yang bikin balasannya terasa seperti orang biasa, bukan asisten."
      >
        <TextRow
          label="Prompt"
          value={store.state.globalPrompt}
          onChangeText={store.setGlobalPrompt}
          multiline
        />
        <Divider />
        <LinkRow label="Kembalikan ke bawaan" onPress={() => store.setGlobalPrompt(DEFAULT_GLOBAL_PROMPT)} />
      </Section>

      <Section footer="Menghapus semua kontak dan riwayat chat di perangkat ini. API key tidak ikut terhapus.">
        <LinkRow
          label="Reset semua percakapan"
          destructive
          onPress={() =>
            Alert.alert('Reset semua?', 'Semua kontak dan pesan akan hilang.', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => store.resetEverything() },
            ])
          }
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
});
