import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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

import { listModels, priceLabel, type ORModel } from '../api/openrouter';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ModelPicker'>;

export function ModelPickerScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const store = useStore();
  const contactId = route.params?.contactId;
  const contact = contactId ? store.contactById(contactId) : undefined;
  const current = contact ? contact.settings.model : store.state.defaults.model;

  const [models, setModels] = useState<ORModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: contact ? `Model · ${contact.name}` : 'Model default' });
  }, [navigation, contact]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!store.apiKey) {
        setError('Isi API key OpenRouter dulu di Pengaturan untuk melihat daftar model.');
        setLoading(false);
        return;
      }
      try {
        const data = await listModels(store.apiKey);
        if (alive) setModels(data);
      } catch (issue) {
        if (alive) setError(issue instanceof Error ? issue.message : 'Gagal mengambil daftar model.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [store.apiKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      if (freeOnly && !model.free) return false;
      if (!needle) return true;
      return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle);
    });
  }, [models, query, freeOnly]);

  const choose = (id: string) => {
    if (contact) store.updateContact(contact.id, { settings: { ...contact.settings, model: id } });
    else store.setDefaults({ model: id });
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.tools, { borderBottomColor: theme.separator }]}>
        <TextInput
          style={[styles.search, { backgroundColor: theme.fill, color: theme.label }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Cari model, mis. claude atau llama"
          placeholderTextColor={theme.label3}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.freeRow}>
          <Text style={[styles.freeLabel, { color: theme.label }]}>Hanya model gratis</Text>
          <Switch value={freeOnly} onValueChange={setFreeOnly} />
        </View>
      </View>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.error, { color: theme.label2 }]}>{error}</Text>
          <Pressable onPress={() => choose(current)}>
            <Text style={[styles.manual, { color: theme.blue }]}>Tetap pakai {current}</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const active = item.id === current;
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
          filtered.length ? (
            <Text style={[styles.footer, { color: theme.label3 }]}>{filtered.length} model tersedia</Text>
          ) : null
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
  errorBox: { padding: 20, gap: 10 },
  error: { fontSize: 15, lineHeight: 21 },
  manual: { fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 1 },
  name: { fontSize: 17 },
  id: { fontSize: 13 },
  meta: { fontSize: 12 },
  check: { fontSize: 18, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  footer: { textAlign: 'center', fontSize: 12, paddingVertical: 20 },
});
