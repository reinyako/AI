import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React, { useLayoutEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { connectionFor, fetchKeyInfo, normalizeBaseUrl, testConnection } from '../api/chat';
import { Divider, ErrorNotice, LinkRow, Section, TextRow } from '../components/Form';
import type { RootStackParamList } from '../navigation';
import { OPENROUTER_URL, useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Provider'>;

export function ProviderScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const existing = route.params?.id ? store.providerById(route.params.id) : undefined;
  const builtin = Boolean(existing?.builtin);

  const [name, setName] = useState(existing?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [key, setKey] = useState(existing ? store.apiKeyFor(existing.id) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Model bisa diubah dari layar pemilih model; selalu ambil nilai terbarunya.
  const [draftModel, setDraftModel] = useState(existing?.model ?? '');
  const liveModel = existing ? store.providerById(existing.id)?.model : undefined;
  const model = existing ? (liveModel ?? draftModel) : draftModel;
  const setModel = (value: string) => {
    setDraftModel(value);
    if (existing) store.updateProvider(existing.id, { model: value });
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama konfigurasi belum diisi.');
      return;
    }
    const url = normalizeBaseUrl(baseUrl);
    if (!url) {
      setError('Proxy URL belum diisi. Contoh: https://api.deepseek.com/v1');
      return;
    }
    if (!model.trim()) {
      setError('Nama model belum diisi. Contoh: deepseek-chat');
      return;
    }

    if (existing) {
      store.updateProvider(existing.id, { name: trimmedName, baseUrl: url, model: model.trim() });
      store.saveApiKey(existing.id, key);
      navigation.goBack();
    } else {
      const created = store.addProvider({ name: trimmedName, baseUrl: url, model: model.trim() });
      store.saveApiKey(created.id, key);
      navigation.goBack();
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? existing.name : 'Konfigurasi baru',
      headerRight: () => (
        <Pressable hitSlop={12} onPress={save}>
          <Text style={[styles.save, { color: theme.blue }]}>Simpan</Text>
        </Pressable>
      ),
    });
  });

  const pasteKey = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      setError('Clipboard kosong — salin dulu API key-nya.');
      return;
    }
    setKey(text);
    if (existing) store.saveApiKey(existing.id, text);
  };

  /** Tes pakai nilai yang sedang diketik, bukan yang tersimpan, supaya bisa dicoba dulu. */
  const draftConnection = () =>
    connectionFor(
      {
        id: existing?.id ?? 'draft',
        name: name.trim() || 'Konfigurasi ini',
        baseUrl: normalizeBaseUrl(baseUrl),
        model: model.trim(),
        ...(builtin ? { builtin: true } : {}),
      },
      key.trim()
    );

  const runTest = async () => {
    setError(null);
    setBusy(true);
    try {
      const report = await testConnection(draftConnection(), model.trim());
      Alert.alert('Koneksi berhasil', report);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Gagal menghubungi server.');
    } finally {
      setBusy(false);
    }
  };

  const checkCredit = async () => {
    setError(null);
    setBusy(true);
    try {
      const info = await fetchKeyInfo(draftConnection());
      const limit = info.limit === null ? 'tanpa limit' : `limit $${info.limit.toFixed(2)}`;
      Alert.alert('Key aktif', `${info.label ?? 'Tanpa label'}\nTerpakai $${info.usage.toFixed(3)} · ${limit}`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Gagal mengecek key.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing || builtin) return;
    Alert.alert('Hapus konfigurasi?', `${existing.name} dan API key-nya akan dihapus dari perangkat ini.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await store.removeProvider(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const pickModel = () => {
    if (!existing) {
      setError('Simpan konfigurasinya dulu, baru daftar modelnya bisa dibuka.');
      return;
    }
    navigation.navigate('ModelPicker', { providerId: existing.id });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.groupedBg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {error ? (
        <View style={styles.notice}>
          <ErrorNotice message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <Section
        title="Konfigurasi"
        footer={
          builtin
            ? 'Ini konfigurasi OpenRouter bawaan. Proxy URL-nya boleh diganti kalau kamu memakai mirror sendiri.'
            : 'Proxy URL harus endpoint yang meniru API OpenAI. Yang ditembak aplikasi adalah {Proxy URL}/chat/completions — jadi tulis sampai bagian /v1 saja.'
        }
      >
        <TextRow
          label="Nama konfigurasi"
          value={name}
          onChangeText={setName}
          placeholder="mis. DeepSeek langsung"
        />
        <Divider />
        <TextRow
          label="Proxy URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={OPENROUTER_URL}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Divider />
        <TextRow
          label="Nama model"
          value={model}
          onChangeText={setModel}
          placeholder="mis. deepseek-chat"
          autoCapitalize="none"
        />
        <Divider />
        <LinkRow label="Pilih dari daftar model" onPress={pickModel} />
      </Section>

      <Section
        title="API key"
        footer="Key disimpan di penyimpanan aman perangkat (Keychain) dan hanya dikirim ke Proxy URL di atas."
      >
        <TextRow
          label="API key"
          value={key}
          onChangeText={(value) => {
            setKey(value);
            if (existing) store.saveApiKey(existing.id, value);
          }}
          placeholder={builtin ? 'sk-or-v1-...' : 'sk-...'}
          secureTextEntry
          autoCapitalize="none"
        />
        <Divider />
        <LinkRow label="Tempel dari clipboard" onPress={pasteKey} />
        {builtin ? (
          <>
            <Divider />
            <LinkRow label={busy ? 'Mengecek…' : 'Cek key & kredit'} onPress={checkCredit} />
            <Divider />
            <LinkRow
              label="Buka openrouter.ai/keys"
              onPress={() => Linking.openURL('https://openrouter.ai/keys')}
            />
          </>
        ) : null}
      </Section>

      <Section footer="Tes koneksi mencoba mengambil daftar model, lalu satu permintaan chat sependek mungkin kalau daftarnya tidak tersedia.">
        <LinkRow label={busy ? 'Mencoba…' : 'Tes koneksi'} onPress={runTest} />
      </Section>

      {existing && !builtin ? (
        <Section>
          <LinkRow label="Hapus konfigurasi" destructive onPress={remove} />
        </Section>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  notice: { marginTop: 22, marginHorizontal: 16 },
  save: { fontSize: 17, fontWeight: '600' },
});
