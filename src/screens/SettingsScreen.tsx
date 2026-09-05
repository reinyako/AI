import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import {
  ChoiceRow,
  Divider,
  InfoRow,
  LinkRow,
  Section,
  SegmentRow,
  SliderRow,
  SwitchRow,
  TextRow,
} from '../components/Form';
import { UI_MODE_LABEL } from '../lib/platform';
import type { RootStackParamList } from '../navigation';
import { DEFAULT_AGENT_PROMPT, DEFAULT_GLOBAL_PROMPT, useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const defaults = store.state.defaults;
  const active = store.activeProvider;

  return (
    <ScrollView
      style={{ backgroundColor: theme.groupedBg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section
        title="Koneksi"
        footer="Ketuk sebuah konfigurasi untuk memakainya, ketuk ikon ⓘ untuk mengubah URL, model, dan API key-nya. Selain OpenRouter, alamat mana pun yang meniru API OpenAI bisa dipakai — seperti mengisi proxy sendiri di Janitor AI."
      >
        {store.state.providers.map((provider, index) => (
          <React.Fragment key={provider.id}>
            {index > 0 ? <Divider /> : null}
            <ChoiceRow
              label={provider.name}
              detail={
                store.apiKeyFor(provider.id)
                  ? provider.model || 'model belum diisi'
                  : `${provider.model || 'model belum diisi'} · API key belum diisi`
              }
              active={provider.id === active.id}
              onSelect={() => store.setActiveProvider(provider.id)}
              onEdit={() => navigation.navigate('Provider', { id: provider.id })}
            />
          </React.Fragment>
        ))}
        <Divider />
        <LinkRow label="Tambah konfigurasi" onPress={() => navigation.navigate('Provider', {})} />
      </Section>

      <Section
        title="Model & generasi"
        footer={`Berlaku untuk semua percakapan yang tidak punya setelan sendiri. Model diambil dari konfigurasi "${active.name}". Jeda mengetik hanya berlaku untuk kontak jenis Karakter.`}
      >
        <LinkRow
          label="Model"
          value={active.model || 'belum diisi'}
          onPress={() => navigation.navigate('ModelPicker', { providerId: active.id })}
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
          label="Top P"
          value={defaults.topP}
          min={0.1}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(topP) => store.setDefaults({ topP })}
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
        <SliderRow
          label="Ingatan percakapan"
          value={defaults.historyLimit}
          min={6}
          max={120}
          step={2}
          format={(value) => `${Math.round(value)} pesan`}
          onChange={(historyLimit) => store.setDefaults({ historyLimit: Math.round(historyLimit) })}
        />
        <Divider />
        <SwitchRow
          label="Jeda mengetik"
          value={defaults.humanize}
          onValueChange={(humanize) => store.setDefaults({ humanize })}
        />
      </Section>

      <Section
        title="Instruksi karakter"
        footer="Selalu ditempel di depan persona kontak jenis Karakter. Ini yang bikin balasannya terasa seperti orang biasa, bukan asisten."
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

      <Section
        title="Instruksi AI agent"
        footer="Dipakai percakapan jenis AI agent, yang tidak punya persona maupun sapaan pembuka."
      >
        <TextRow
          label="Prompt"
          value={store.state.agentPrompt}
          onChangeText={store.setAgentPrompt}
          multiline
        />
        <Divider />
        <LinkRow label="Kembalikan ke bawaan" onPress={() => store.setAgentPrompt(DEFAULT_AGENT_PROMPT)} />
      </Section>

      <Section
        title="Tampilan"
        footer="“Sistem” mengikuti setelan terang/gelap perangkat. Mode tampilan di bawahnya ditentukan versi iOS: di iOS 26 panel pengetik dan kartu memakai Liquid Glass dengan sudut lebih membulat."
      >
        <SegmentRow
          label="Tema"
          value={store.state.themeMode}
          onChange={store.setThemeMode}
          options={[
            { value: 'system', label: 'Sistem' },
            { value: 'light', label: 'Terang' },
            { value: 'dark', label: 'Gelap' },
          ]}
        />
        <Divider />
        <InfoRow label="Mode tampilan" value={UI_MODE_LABEL} />
      </Section>

      <Section footer="Menghapus semua kontak dan riwayat chat di perangkat ini. Konfigurasi koneksi dan API key tidak ikut terhapus.">
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
