import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ColorPicker, Divider, LinkRow, Section, SliderRow, SwitchRow, TextRow } from '../components/Form';
import type { RootStackParamList } from '../navigation';
import { DEFAULT_SETTINGS, useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';
import type { GenSettings } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

export function ContactScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const existing = route.params?.id ? store.contactById(route.params.id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [greeting, setGreeting] = useState(existing?.greeting ?? '');
  const [persona, setPersona] = useState(existing?.persona ?? '');
  const [color, setColor] = useState(existing?.color ?? Math.floor(Math.random() * 6));
  const [settings, setSettings] = useState<GenSettings>(existing?.settings ?? { ...store.state.defaults });

  const patch = (change: Partial<GenSettings>) => setSettings((prev) => ({ ...prev, ...change }));

  // Model bisa diubah dari layar pemilih model; ambil nilai terbarunya saat kembali ke sini.
  const liveModel = existing ? store.contactById(existing.id)?.settings.model : undefined;
  const model = liveModel ?? settings.model;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nama belum diisi', 'Beri nama dulu untuk kontak ini.');
      return;
    }
    const payload = {
      name: trimmed,
      greeting: greeting.trim(),
      persona: persona.trim(),
      color,
      settings: { ...settings, model },
    };

    if (existing) {
      store.updateContact(existing.id, payload);
      navigation.goBack();
    } else {
      const created = store.addContact(payload);
      navigation.replace('Chat', { id: created.id });
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Info' : 'Kontak baru',
      headerRight: () => (
        <Pressable hitSlop={12} onPress={save}>
          <Text style={[styles.save, { color: theme.blue }]}>Simpan</Text>
        </Pressable>
      ),
    });
  });

  const remove = () => {
    if (!existing) return;
    Alert.alert('Hapus percakapan?', `Semua pesan dengan ${existing.name} ikut terhapus.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          store.removeContact(existing.id);
          navigation.navigate('Chats');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.groupedBg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section title="Kontak" footer="Sapaan dikirim otomatis sebagai pesan pertama saat percakapan masih kosong.">
        <TextRow label="Nama" value={name} onChangeText={setName} placeholder="mis. Sarah" />
        <Divider />
        <TextRow label="Sapaan pertama" value={greeting} onChangeText={setGreeting} placeholder="mis. eh udah bangun?" />
        <Divider />
        <ColorPicker value={color} onChange={setColor} />
      </Section>

      <Section
        title="Karakter"
        footer="Ini yang dikirim sebagai system prompt. Makin jelas karakternya, makin konsisten gaya balasannya."
      >
        <TextRow
          label="Persona"
          value={persona}
          onChangeText={setPersona}
          multiline
          placeholder="Siapa dia, umurnya berapa, gaya bicaranya bagaimana, hubungannya denganmu apa..."
        />
      </Section>

      <Section title="Model & generasi" footer="Setelan ini hanya berlaku untuk kontak ini.">
        <LinkRow
          label="Model"
          value={model}
          onPress={() =>
            existing
              ? navigation.navigate('ModelPicker', { contactId: existing.id })
              : Alert.alert('Simpan dulu', 'Simpan kontaknya dulu, baru modelnya bisa diganti.')
          }
        />
        <Divider />
        <SliderRow
          label="Temperature"
          value={settings.temperature}
          min={0}
          max={2}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(temperature) => patch({ temperature })}
        />
        <Divider />
        <SliderRow
          label="Top P"
          value={settings.topP}
          min={0.1}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(topP) => patch({ topP })}
        />
        <Divider />
        <SliderRow
          label="Panjang balasan"
          value={settings.maxTokens}
          min={128}
          max={4096}
          step={64}
          format={(value) => `${Math.round(value)} token`}
          onChange={(maxTokens) => patch({ maxTokens: Math.round(maxTokens) })}
        />
        <Divider />
        <SliderRow
          label="Ingatan percakapan"
          value={settings.historyLimit}
          min={6}
          max={120}
          step={2}
          format={(value) => `${Math.round(value)} pesan`}
          onChange={(historyLimit) => patch({ historyLimit: Math.round(historyLimit) })}
        />
        <Divider />
        <SwitchRow
          label="Jeda mengetik"
          value={settings.humanize}
          onValueChange={(humanize) => patch({ humanize })}
        />
      </Section>

      <Section footer={`Bawaan: ${DEFAULT_SETTINGS.temperature} temperature, ${DEFAULT_SETTINGS.maxTokens} token.`}>
        <LinkRow label="Pakai setelan default" onPress={() => setSettings({ ...store.state.defaults })} />
      </Section>

      {existing ? (
        <Section>
          <LinkRow label="Hapus percakapan" destructive onPress={remove} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  save: { fontSize: 17, fontWeight: '600' },
});
