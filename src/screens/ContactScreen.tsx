import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import {
  ColorPicker,
  Divider,
  LinkRow,
  Section,
  SegmentRow,
  SliderRow,
  SwitchRow,
  TextRow,
} from '../components/Form';
import { hasOverrides, resolveGen } from '../lib/gen';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';
import type { ContactKind, GenOverrides } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

export function ContactScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const existing = route.params?.id ? store.contactById(route.params.id) : undefined;

  const [kind, setKind] = useState<ContactKind>(existing?.kind ?? 'character');
  const [name, setName] = useState(existing?.name ?? '');
  const [greeting, setGreeting] = useState(existing?.greeting ?? '');
  const [persona, setPersona] = useState(existing?.persona ?? '');
  const [color, setColor] = useState(existing?.color ?? Math.floor(Math.random() * 6));
  const [draftOverrides, setDraftOverrides] = useState<GenOverrides>({});

  /**
   * Untuk kontak yang sudah ada, setelan generasi ditulis langsung ke store supaya
   * nilainya tidak pernah basi setelah kembali dari layar pemilih model.
   */
  const overrides = existing ? existing.settings : draftOverrides;
  const patch = (change: GenOverrides) => {
    if (existing) store.updateContact(existing.id, { settings: { ...existing.settings, ...change } });
    else setDraftOverrides((prev) => ({ ...prev, ...change }));
  };

  const gen = resolveGen(overrides, store.state.defaults, store.activeProvider);
  const custom = hasOverrides(overrides);
  const isAgent = kind === 'agent';

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nama belum diisi', 'Beri nama dulu untuk kontak ini.');
      return;
    }
    const payload = {
      kind,
      name: trimmed,
      // Agent tidak punya persona maupun sapaan pembuka, jadi keduanya dikosongkan
      // supaya tidak ada sisa data dari saat kontaknya masih berjenis karakter.
      greeting: isAgent ? '' : greeting.trim(),
      persona: isAgent ? '' : persona.trim(),
      color,
    };

    if (existing) {
      store.updateContact(existing.id, payload);
      navigation.goBack();
    } else {
      const created = store.addContact({ ...payload, settings: draftOverrides });
      navigation.replace('Chat', { id: created.id });
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Info' : isAgent ? 'AI agent baru' : 'Kontak baru',
      headerRight: () => (
        <Pressable hitSlop={12} onPress={save}>
          <Text style={[styles.save, { color: theme.blue }]}>Simpan</Text>
        </Pressable>
      ),
    });
  });

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      isAgent ? 'Hapus agent?' : 'Hapus percakapan?',
      `Semua pesan dengan ${existing.name} ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            store.removeContact(existing.id);
            navigation.navigate('Chats');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.groupedBg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section
        title="Jenis"
        footer={
          isAgent
            ? 'AI agent menjawab sebagai asisten biasa: tanpa persona dan tanpa sapaan pembuka. Instruksinya diatur di Pengaturan → Instruksi AI agent.'
            : 'Karakter diperankan seperti orang sungguhan, memakai persona dan sapaan pembuka di bawah.'
        }
      >
        <SegmentRow
          value={kind}
          onChange={setKind}
          options={[
            { value: 'character', label: 'Karakter' },
            { value: 'agent', label: 'AI agent' },
          ]}
        />
      </Section>

      <Section
        title={isAgent ? 'Agent' : 'Kontak'}
        footer={
          isAgent
            ? undefined
            : 'Sapaan dikirim otomatis sebagai pesan pertama saat percakapan masih kosong.'
        }
      >
        <TextRow
          label="Nama"
          value={name}
          onChangeText={setName}
          placeholder={isAgent ? 'mis. Asisten Kerja' : 'mis. Sarah'}
        />
        {isAgent ? null : (
          <>
            <Divider />
            <TextRow
              label="Sapaan pertama"
              value={greeting}
              onChangeText={setGreeting}
              placeholder="mis. eh udah bangun?"
            />
          </>
        )}
        <Divider />
        <ColorPicker value={color} onChange={setColor} />
      </Section>

      {isAgent ? null : (
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
      )}

      <Section
        title="Model & generasi"
        footer="Setelan di sini menimpa setelan global hanya untuk kontak ini. Yang belum diubah otomatis ikut Pengaturan."
      >
        <LinkRow
          label="Model"
          value={overrides.model ?? `${gen.model || 'belum diisi'} · global`}
          onPress={() =>
            existing
              ? navigation.navigate('ModelPicker', { contactId: existing.id })
              : Alert.alert('Simpan dulu', 'Simpan kontaknya dulu, baru modelnya bisa diganti.')
          }
        />
        <Divider />
        <SliderRow
          label="Temperature"
          value={gen.temperature}
          min={0}
          max={2}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(temperature) => patch({ temperature })}
        />
        <Divider />
        <SliderRow
          label="Top P"
          value={gen.topP}
          min={0.1}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(topP) => patch({ topP })}
        />
        <Divider />
        <SliderRow
          label="Panjang balasan"
          value={gen.maxTokens}
          min={128}
          max={4096}
          step={64}
          format={(value) => `${Math.round(value)} token`}
          onChange={(maxTokens) => patch({ maxTokens: Math.round(maxTokens) })}
        />
        <Divider />
        <SliderRow
          label="Ingatan percakapan"
          value={gen.historyLimit}
          min={6}
          max={120}
          step={2}
          format={(value) => `${Math.round(value)} pesan`}
          onChange={(historyLimit) => patch({ historyLimit: Math.round(historyLimit) })}
        />
        {isAgent ? null : (
          <>
            <Divider />
            <SwitchRow
              label="Jeda mengetik"
              value={gen.humanize}
              onValueChange={(humanize) => patch({ humanize })}
            />
          </>
        )}
      </Section>

      <Section
        footer={
          custom
            ? 'Kontak ini punya setelan sendiri, jadi tidak ikut berubah saat kamu mengganti setelan global.'
            : 'Kontak ini mengikuti setelan global sepenuhnya.'
        }
      >
        <LinkRow
          label="Ikuti setelan global"
          onPress={() => {
            if (existing) store.updateContact(existing.id, { settings: {} });
            else setDraftOverrides({});
          }}
        />
      </Section>

      {existing ? (
        <Section>
          <LinkRow label={isAgent ? 'Hapus agent' : 'Hapus percakapan'} destructive onPress={remove} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  save: { fontSize: 17, fontWeight: '600' },
});
