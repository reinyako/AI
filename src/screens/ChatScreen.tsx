import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { streamChat, type WireMessage } from '../api/openrouter';
import { Avatar } from '../components/Avatar';
import { Bubble } from '../components/Bubble';
import { DayMark } from '../components/DayMark';
import { TypingDots } from '../components/TypingDots';
import { showActions } from '../lib/actions';
import { uid } from '../lib/format';
import { successFeedback, tapFeedback } from '../lib/haptics';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../theme';
import type { Message } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Row =
  | { kind: 'day'; key: string; at: number }
  | { kind: 'msg'; key: string; message: Message; tail: boolean; groupStart: boolean };

const GROUP_GAP = 60_000; // jeda yang memutus satu rentetan gelembung
const DAY_GAP = 30 * 60_000; // jeda yang memunculkan penanda waktu

export function ChatScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const store = useStore();
  const contact = store.contactById(id);

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listRef = useRef<FlatList<Row>>(null);
  const bufferRef = useRef('');
  const cancelRef = useRef<(() => void) | null>(null);
  const seededRef = useRef(false);

  // Batalkan permintaan yang masih jalan kalau layar ditutup.
  useEffect(() => () => cancelRef.current?.(), []);

  // Sapaan pembuka hanya ditanam sekali, saat percakapan masih kosong.
  useEffect(() => {
    if (!contact || seededRef.current) return;
    seededRef.current = true;
    if (contact.messages.length === 0 && contact.greeting.trim()) {
      store.setMessages(contact.id, [
        { id: uid(), role: 'assistant', text: contact.greeting.trim(), at: Date.now() },
      ]);
    }
  }, [contact, store]);

  useLayoutEffect(() => {
    if (!contact) return;
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.peer}>
          <Avatar name={contact.name} color={contact.color} size={30} />
          <Text style={[styles.peerName, { color: theme.label }]} numberOfLines={1}>
            {contact.name}
          </Text>
        </View>
      ),
      headerRight: () => (
        <Pressable hitSlop={12} onPress={() => navigation.navigate('Contact', { id: contact.id })}>
          <Ionicons name="information-circle-outline" size={24} color={theme.blue} />
        </Pressable>
      ),
    });
  }, [navigation, contact, theme.label, theme.blue]);

  const rows = useMemo<Row[]>(() => {
    if (!contact) return [];
    const output: Row[] = [];
    contact.messages.forEach((message, index) => {
      const prev = contact.messages[index - 1];
      const next = contact.messages[index + 1];
      const gap = prev ? message.at - prev.at : Infinity;
      if (!prev || gap > DAY_GAP) output.push({ kind: 'day', key: `day-${message.id}`, at: message.at });
      output.push({
        kind: 'msg',
        key: message.id,
        message,
        groupStart: !prev || prev.role !== message.role || gap > GROUP_GAP,
        tail: !next || next.role !== message.role || next.at - message.at > GROUP_GAP,
      });
    });
    return output;
  }, [contact]);

  if (!contact) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  const settings = contact.settings;

  const buildWire = (history: Message[]): WireMessage[] => {
    const persona = contact.persona.trim();
    const system = [
      store.state.globalPrompt.trim(),
      persona ? `Karakter yang kamu perankan:\n${persona}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const trimmed = history.slice(-settings.historyLimit);
    return [
      { role: 'system', content: system },
      ...trimmed.map((message) => ({ role: message.role, content: message.text })),
    ];
  };

  const settle = (history: Message[], error?: string) => {
    cancelRef.current = null;
    setBusy(false);
    setPending(null);
    const text = bufferRef.current.trim();
    bufferRef.current = '';

    if (text) {
      store.setMessages(contact.id, [
        ...history,
        { id: uid(), role: 'assistant', text, at: Date.now(), failed: Boolean(error) },
      ]);
      successFeedback();
    }
    if (error) Alert.alert('Gagal membalas', error);
  };

  const run = (history: Message[]) => {
    if (!store.apiKey) {
      Alert.alert('API key belum diisi', 'Tempelkan API key OpenRouter dulu di Pengaturan.', [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Buka Pengaturan', onPress: () => navigation.navigate('Settings') },
      ]);
      return;
    }

    bufferRef.current = '';
    setBusy(true);
    setPending(null);

    // Tahan sebentar sebelum teks pertama muncul, supaya terasa seperti orang yang lagi mengetik.
    let revealed = !settings.humanize;
    const hold = settings.humanize ? 600 + Math.random() * 900 : 0;
    const timer = setTimeout(() => {
      revealed = true;
      if (bufferRef.current) setPending(bufferRef.current);
    }, hold);

    cancelRef.current = streamChat(store.apiKey, buildWire(history), settings, {
      onDelta: (text) => {
        bufferRef.current += text;
        if (revealed) setPending(bufferRef.current);
      },
      onDone: () => {
        clearTimeout(timer);
        settle(history);
      },
      onError: (message) => {
        clearTimeout(timer);
        settle(history, message);
      },
    });
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    const history: Message[] = [
      ...contact.messages,
      { id: uid(), role: 'user', text, at: Date.now() },
    ];
    setDraft('');
    store.setMessages(contact.id, history);
    tapFeedback();
    run(history);
  };

  const stop = () => {
    cancelRef.current?.();
    settle(contact.messages);
  };

  const regenerate = () => {
    if (busy) return;
    let history = [...contact.messages];
    while (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (!history.length) return;
    store.setMessages(contact.id, history);
    run(history);
  };

  const truncateFrom = (messageId: string) => {
    const index = contact.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return contact.messages;
    const history = contact.messages.slice(0, index);
    store.setMessages(contact.id, history);
    return history;
  };

  const toggleReaction = (messageId: string) => {
    tapFeedback();
    store.setMessages(
      contact.id,
      contact.messages.map((message) =>
        message.id === messageId ? { ...message, reaction: message.reaction ? null : '❤️' } : message
      )
    );
  };

  const openMessageMenu = (message: Message) => {
    const isLast = contact.messages.at(-1)?.id === message.id;
    showActions(message.text.slice(0, 80), [
      { label: 'Salin', run: () => Clipboard.setStringAsync(message.text) },
      {
        label: message.reaction ? 'Hapus reaksi' : 'Beri reaksi ❤️',
        run: () => toggleReaction(message.id),
      },
      ...(message.role === 'assistant' && isLast && !busy
        ? [{ label: 'Ulangi balasan', run: regenerate }]
        : []),
      ...(message.role === 'user'
        ? [
            {
              label: 'Edit & kirim ulang',
              run: () => {
                setDraft(message.text);
                truncateFrom(message.id);
              },
            },
          ]
        : []),
      {
        label: 'Hapus dari sini ke bawah',
        destructive: true,
        run: () => truncateFrom(message.id),
      },
    ]);
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') return <DayMark at={item.at} />;
    return (
      <Bubble
        message={item.message}
        tail={item.tail}
        groupStart={item.groupStart}
        onLongPress={() => openMessageMenu(item.message)}
        onDoubleTap={() => toggleReaction(item.message.id)}
      />
    );
  };

  const lastMessage = contact.messages.at(-1);
  const showReceipt = !busy && lastMessage?.role === 'user';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Avatar name={contact.name} color={contact.color} size={64} />
            <Text style={[styles.introName, { color: theme.label }]}>{contact.name}</Text>
            {contact.persona.trim() ? (
              <Text style={[styles.introPersona, { color: theme.label2 }]} numberOfLines={3}>
                {contact.persona.trim()}
              </Text>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {busy && pending === null ? (
              <View style={styles.footerRow}>
                <TypingDots />
              </View>
            ) : null}
            {pending !== null ? (
              <Bubble
                message={{ id: 'pending', role: 'assistant', text: pending, at: Date.now() }}
                tail
                groupStart
              />
            ) : null}
            {showReceipt ? (
              <Text style={[styles.receipt, { color: theme.label2 }]}>Terkirim</Text>
            ) : null}
          </View>
        }
      />

      <View
        style={[
          styles.composer,
          { borderTopColor: theme.separator, backgroundColor: theme.nav, paddingBottom: 8 + insets.bottom },
        ]}
      >
        <Pressable
          style={[styles.plus, { backgroundColor: theme.fill }]}
          onPress={() =>
            showActions(contact.name, [
              { label: 'Ulangi balasan terakhir', run: regenerate },
              {
                label: 'Bersihkan percakapan',
                destructive: true,
                run: () => store.setMessages(contact.id, []),
              },
            ])
          }
        >
          <Ionicons name="add" size={22} color={theme.label2} />
        </Pressable>

        <View style={[styles.field, { borderColor: theme.separator, backgroundColor: theme.bg }]}>
          <TextInput
            style={[styles.input, { color: theme.label }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="iMessage"
            placeholderTextColor={theme.label3}
            multiline
          />
          {busy ? (
            <Pressable style={[styles.send, { backgroundColor: theme.label3 }]} onPress={stop}>
              <Ionicons name="stop" size={16} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.send, { backgroundColor: draft.trim() ? theme.outgoing : 'transparent' }]}
              onPress={send}
              disabled={!draft.trim()}
            >
              {draft.trim() ? <Ionicons name="arrow-up" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  peer: { alignItems: 'center', gap: 2 },
  peerName: { fontSize: 12, fontWeight: '500', maxWidth: 180 },

  intro: { alignItems: 'center', paddingTop: 22, paddingBottom: 6, paddingHorizontal: 40, gap: 8 },
  introName: { fontSize: 17, fontWeight: '600' },
  introPersona: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  footer: { paddingBottom: 10 },
  footerRow: { paddingHorizontal: 12, marginTop: 10 },
  receipt: { textAlign: 'right', fontSize: 11, paddingRight: 16, paddingTop: 3 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 3,
    paddingVertical: 3,
  },
  input: { flex: 1, fontSize: 17, lineHeight: 22, paddingTop: 4, paddingBottom: 5, maxHeight: 120 },
  send: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
