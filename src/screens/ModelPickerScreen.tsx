import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { connectionFor, listModels, priceLabel, type ChatModel } from '../api/chat';
import { ErrorNotice } from '../components/Form';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ModelPicker'>;

export function ModelPickerScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const store = useStore();

  const contactId = route.params?.contactId;
  const contact = contactId ? store.contactById(contactId) : undefined;
  const targetProvider = route.params?.providerId ? store.providerById(route.params.providerId) : undefined;

  // Daftar model diambil dari provider yang sedang diedit, atau provider aktif kalau
  // yang diubah adalah override sebuah kontak.
  const provider = targetProvider ?? store.activeProvider;
  const apiKey = store.apiKeyFor(provider.id);
  const current = contact ? (contact.settings.model ?? provider.model) : provider.model;
  const inherited = Boolean(contact && contact.settings.model === undefined);

  const [models, setModels] = useState<ChatModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: contact ? `Model · ${contact.name}` : `Model · ${provider.name}` });
  }, [navigation, contact, provider.name]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setModels(await listModels(connectionFor(provider, apiKey)));
    } catch (issue) {
      setModels([]);
      setError(issue instanceof Error ? issue.message : 'Gagal mengambil daftar model.');
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      if (freeOnly && !model.free) return false;
      if (!needle) return true;
      return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle);
    });
  }, [models, query, freeOnly]);

  const choose = (id: string) => {
    const slug = id.trim();
    if (!slug) return;
    if (contact) store.updateContact(contact.id, { settings: { ...contact.settings, model: slug } });
    else store.updateProvider(provider.id, { model: slug });
    navigation.goBack();
  };

  const followGlobal = () => {
    if (!contact) return;
    const { model: _dropped, ...rest } = contact.settings;
    store.updateContact(contact.id, { settings: rest });
    navigation.goBack();
  };

  const typed = query.trim();
  const exactMatch = models.some((model) => model.id === typed);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.tools, { borderBottomColor: theme.separator }]}>
        <TextInput
          style={[styles.search, { backgroundColor: theme.fill, color: theme.label }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Cari atau tulis nama model"
          placeholderTextColor={theme.label3}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.freeRow}>
          <Text style={[styles.freeLabel, { color: theme.label }]}>Hanya model gratis</Text>
          <Switch value={freeOnly} onValueChange={setFreeOnly} />
        </View>
      </View>

      {error ? (
        <View style={styles.notice}>
          <ErrorNotice
            message={error}
            actions={[
              { label: 'Coba lagi', run: load },
              ...(contact || provider.builtin
                ? []
                : [
                    {
                      label: 'Ubah konfigurasi',
                      run: () => navigation.navigate('Provider', { id: provider.id }),
                    },
                  ]),
            ]}
          />
          <Text style={[styles.hint, { color: theme.label2 }]}>
            Nama model tetap bisa ditulis manual di kolom atas, lalu ketuk baris hijau di bawahnya.
          </Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={filtered}
        extraData={theme}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {typed && !exactMatch ? (
              <Pressable
                onPress={() => choose(typed)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.name, { color: theme.blue }]} numberOfLines={1}>
                    Pakai "{typed}"
                  </Text>
                  <Text style={[styles.meta, { color: theme.label3 }]}>
                    Simpan apa adanya, tanpa dicek ke daftar model
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {contact ? (
              <Pressable
                onPress={followGlobal}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.name, { color: theme.label }]} numberOfLines={1}>
                    Ikuti setelan global
                  </Text>
                  <Text style={[styles.id, { color: theme.label2 }]} numberOfLines={1}>
                    {provider.model || 'model global belum diisi'}
                  </Text>
                </View>
                {inherited ? <Text style={[styles.check, { color: theme.blue }]}>✓</Text> : null}
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const active = !inherited && item.id === current;
          return (
            <Pressable
              onPress={() => choose(item.id)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}
            >
              <View style={styles.rowBody}>
                <Text style={[styles.name, { color: theme.label }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.id, { color: theme.label2 }]} numberOfLines={1}>
                  {item.id}
                </Text>
                <Text style={[styles.meta, { color: theme.label3 }]} numberOfLines={1}>
                  {priceLabel(item)}
                  {item.contextLength ? ` · ${Math.round(item.contextLength / 1000)}K konteks` : ''}
                </Text>
              </View>
              {active ? <Text style={[styles.check, { color: theme.blue }]}>✓</Text> : null}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        )}
        ListFooterComponent={
          <Text style={[styles.footer, { color: theme.label3 }]}>
            {filtered.length
              ? `${filtered.length} model tersedia di ${provider.name}`
              : loading
                ? ''
                : `Tidak ada model yang cocok. Model yang sedang dipakai: ${current || 'belum diisi'}.`}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tools: { padding: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  search: { height: 36, borderRadius: 10, paddingHorizontal: 10, fontSize: 17 },
  freeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freeLabel: { fontSize: 15 },
  loader: { marginTop: 24 },
  notice: { padding: 16, gap: 10 },
  hint: { fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 1 },
  name: { fontSize: 17 },
  id: { fontSize: 13 },
  meta: { fontSize: 12 },
  check: { fontSize: 18, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  footer: { textAlign: 'center', fontSize: 12, paddingVertical: 20, paddingHorizontal: 32, lineHeight: 17 },
});
