import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { showActions } from '../lib/actions';
import { listTime } from '../lib/format';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';
import type { Contact } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chats'>;

export function ChatsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { state, removeContact } = useStore();
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable hitSlop={12} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={22} color={theme.blue} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable hitSlop={12} onPress={() => navigation.navigate('Contact', {})}>
          <Ionicons name="create-outline" size={24} color={theme.blue} />
        </Pressable>
      ),
      headerSearchBarOptions: {
        placeholder: 'Cari',
        // Warna search bar iOS tidak ikut tema navigasi, jadi diisi sendiri —
        // kalau dibiarkan, kolomnya tetap terang saat aplikasi dalam mode gelap.
        barTintColor: theme.fill,
        textColor: theme.label,
        hintTextColor: theme.label2,
        headerIconColor: theme.label2,
        tintColor: theme.blue,
        onChangeText: (event: { nativeEvent: { text: string } }) => setQuery(event.nativeEvent.text),
        onCancelButtonPress: () => setQuery(''),
      },
    });
  }, [navigation, theme]);

  const contacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...state.contacts]
      .filter((contact) => {
        if (!needle) return true;
        if (contact.name.toLowerCase().includes(needle)) return true;
        return contact.messages.some((message) => message.text.toLowerCase().includes(needle));
      })
      .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));
  }, [state.contacts, query]);

  const openMenu = (contact: Contact) => {
    showActions(contact.name, [
      {
        label: contact.kind === 'agent' ? 'Edit agent' : 'Edit kontak',
        run: () => navigation.navigate('Contact', { id: contact.id }),
      },
      { label: 'Hapus percakapan', destructive: true, run: () => removeContact(contact.id) },
    ]);
  };

  const renderRow = ({ item }: { item: Contact }) => {
    const last = item.messages.at(-1);
    const preview = last ? (last.role === 'user' ? `Kamu: ${last.text}` : last.text) : 'Belum ada pesan';

    return (
      <Pressable
        onPress={() => navigation.navigate('Chat', { id: item.id })}
        onLongPress={() => openMenu(item)}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}
      >
        <Avatar name={item.name} color={item.color} agent={item.kind === 'agent'} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, { color: theme.label }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.time, { color: theme.label2 }]}>{last ? listTime(last.at) : ''}</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.label3} />
          </View>
          <Text style={[styles.preview, { color: theme.label2 }]} numberOfLines={2}>
            {preview}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      contentInsetAdjustmentBehavior="automatic"
      data={contacts}
      extraData={theme}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: theme.label2 }]}>
          {query ? 'Tidak ada yang cocok.' : 'Belum ada kontak. Ketuk ikon pensil untuk membuat satu.'}
        </Text>
      }
      ListFooterComponent={
        contacts.length ? (
          <Text style={[styles.footer, { color: theme.label3 }]}>
            Tahan sebuah percakapan untuk mengedit atau menghapusnya.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 9 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 17, fontWeight: '600' },
  time: { fontSize: 15 },
  preview: { fontSize: 15, lineHeight: 19, marginTop: 1, paddingRight: 20 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  empty: { textAlign: 'center', fontSize: 15, marginTop: 60, paddingHorizontal: 40, lineHeight: 21 },
  footer: { textAlign: 'center', fontSize: 12, paddingVertical: 24, paddingHorizontal: 40 },
});
