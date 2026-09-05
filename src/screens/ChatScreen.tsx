import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
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
import { GlassView } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { connectionFor, streamChat, validate, type WireMessage } from '../api/chat';
import { Avatar } from '../components/Avatar';
import { Bubble } from '../components/Bubble';
import { DayMark } from '../components/DayMark';
import { ErrorNotice } from '../components/Form';
import { TypingDots } from '../components/TypingDots';
import { showActions } from '../lib/actions';
import { uid } from '../lib/format';
import { useKeyboardVisible } from '../lib/keyboard';
import { buildSystemPrompt, resolveGen } from '../lib/gen';
import { successFeedback, tapFeedback } from '../lib/haptics';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store/StoreProvider';
import { SHAPE, useTheme } from '../theme';
import type { Message } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Row =
  | { kind: 'day'; key: string; at: number }
  | { kind: 'msg'; key: string; message: Message; tail: boolean; groupStart: boolean; fresh: boolean };

/** Padding kiri-kanan panel pengetik; dipakai juga di bawah saat papan ketik terbuka. */
const COMPOSER_PAD = 10;

const GROUP_GAP = 60_000; // jeda yang memutus satu rentetan gelembung
const DAY_GAP = 30 * 60_000; // jeda yang memunculkan penanda waktu

export function ChatScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const store = useStore();
  const contact = store.contactById(id);
  const keyboardUp = useKeyboardVisible();

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<FlatList<Row>>(null);
  const bufferRef = useRef('');
  const cancelRef = useRef<(() => void) | null>(null);
  const seededRef = useRef(false);
  /** Riwayat yang dipakai permintaan terakhir, supaya "Coba lagi" bisa mengulanginya. */
  const lastRunRef = useRef<Message[] | null>(null);
  /** Balasan lengkap yang menunggu jeda mengetik habis sebelum ditampilkan. */
  const revealRef = useRef<{ timer: ReturnType<typeof setTimeout>; run: () => void } | null>(null);
  /** Id pesan yang baru muncul, supaya gelembungnya dianimasikan sekali saja. */
  const freshRef = useRef<string | null>(null);

  // Batalkan permintaan dan jeda yang masih jalan kalau layar ditutup.
  useEffect(
    () => () => {
      cancelRef.current?.();
      if (revealRef.current) clearTimeout(revealRef.current.timer);
    },
    []
  );

  /**
   * Pengaman tambahan saat papan ketik muncul. Daftar yang dibalik seharusnya sudah
   * tetap di pesan terbaru dengan sendirinya; ini hanya menegaskannya setelah tinggi
   * daftar selesai berubah.
   */
  useEffect(() => {
    if (!keyboardUp) return;
    const timer = setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 80);
    return () => clearTimeout(timer);
  }, [keyboardUp]);

  // Sapaan pembuka hanya ditanam sekali, saat percakapan masih kosong.
  useEffect(() => {
    if (!contact || seededRef.current) return;
    seededRef.current = true;
    if (contact.kind === 'character' && contact.messages.length === 0 && contact.greeting.trim()) {
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
          <Avatar name={contact.name} color={contact.color} size={30} agent={contact.kind === 'agent'} />
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

  /**
   * Karena daftarnya `inverted`, pesan terbaru ada di offset 0 — jadi "turun ke
   * paling bawah" cukup menggulir ke 0. Ini jauh lebih andal daripada `scrollToEnd`,
   * yang harus menghitung tinggi seluruh isi daftar dan gagal kalau ada baris yang
   * belum pernah diukur.
   *
   * Tanpa animasi, sama seperti iMessage saat mengirim: langsung ada di bawah, dan
   * tidak bergantung pada animasi gulir yang bisa tidak jalan.
   */
  const scrollToBottom = () => listRef.current?.scrollToOffset({ offset: 0, animated: false });

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
        fresh: freshRef.current === message.id,
      });
    });
    // Daftar digambar `inverted`, jadi urutannya dibalik: indeks 0 duduk di bawah.
    // Isi tiap baris tetap dihitung dari urutan waktu, jadi penanda hari dan
    // pengelompokan gelembung tidak berubah.
    return output.reverse();
  }, [contact]);

  if (!contact) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  const gen = resolveGen(contact.settings, store.state.defaults, store.activeProvider);
  const provider = store.activeProvider;
  const connection = connectionFor(provider, store.apiKeyFor(provider.id));

  const buildWire = (history: Message[]): WireMessage[] => {
    const system = buildSystemPrompt(contact, store.state);
    const trimmed = history.slice(-gen.historyLimit);
    return [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...trimmed.map((message) => ({ role: message.role, content: message.text })),
    ];
  };

  /**
   * Menutup satu permintaan. Balasan tidak pernah muncul sepotong-sepotong: teksnya
   * dikumpulkan diam-diam di `bufferRef`, indikator mengetik terus berjalan, dan
   * gelembungnya baru muncul sekali jadi — seperti iMessage.
   *
   * `silent` dipakai saat pengguna sendiri yang menekan stop — itu bukan kegagalan.
   */
  const settle = (history: Message[], failure?: string, silent?: boolean) => {
    cancelRef.current = null;
    const text = bufferRef.current.trim();
    bufferRef.current = '';

    const reveal = () => {
      revealRef.current = null;
      setBusy(false);

      if (text) {
        const arrived: Message = {
          id: uid(),
          role: 'assistant',
          text,
          at: Date.now(),
          failed: Boolean(failure),
        };
        freshRef.current = arrived.id;
        store.setMessages(contact.id, [...history, arrived]);
        successFeedback();
      }

      if (failure) setError(failure);
      else if (!text && !silent) {
        setError(
          `${provider.name} tidak mengirim balasan apa pun untuk model "${gen.model}". Coba model lain atau naikkan panjang balasan.`
        );
      }
    };

    // Jeda mengetik: indikator dibiarkan sebentar lagi, lamanya ikut panjang balasan,
    // supaya terasa seperti orang yang benar-benar sedang menulis. Tidak berlaku untuk
    // agent — menahan jawaban asisten tanpa alasan hanya membuatnya terasa lambat.
    if (text && !failure && !silent && gen.humanize && contact.kind === 'character') {
      const typing = Math.min(2400, 400 + text.length * 16);
      revealRef.current = { timer: setTimeout(reveal, typing), run: reveal };
      return;
    }
    reveal();
  };

  /** Tampilkan balasan yang sedang menunggu jeda sekarang, tanpa menunggu timer habis. */
  const flushReveal = () => {
    const waiting = revealRef.current;
    if (!waiting) return false;
    clearTimeout(waiting.timer);
    waiting.run();
    return true;
  };

  const run = (history: Message[]) => {
    const guard = validate(connection, gen.model);
    if (guard) {
      setError(guard);
      return;
    }

    setError(null);
    lastRunRef.current = history;
    bufferRef.current = '';
    setBusy(true);

    cancelRef.current = streamChat(connection, buildWire(history), gen, {
      // Potongan teks hanya ditumpuk di buffer — tidak ada state yang berubah, jadi
      // layar tidak pernah menampilkan balasan yang masih setengah jadi.
      onDelta: (text) => {
        bufferRef.current += text;
      },
      onDone: () => settle(history),
      onError: (message) => settle(history, message),
    });
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    const mine: Message = { id: uid(), role: 'user', text, at: Date.now() };
    const history: Message[] = [...contact.messages, mine];
    freshRef.current = mine.id;
    setDraft('');
    store.setMessages(contact.id, history);
    tapFeedback();
    scrollToBottom();
    run(history);
  };

  const stop = () => {
    // Kalau balasannya sudah lengkap dan cuma menunggu jeda, langsung tampilkan saja.
    if (flushReveal()) return;
    cancelRef.current?.();
    settle(contact.messages, undefined, true);
  };

  const retry = () => {
    if (busy) return;
    freshRef.current = null;
    const history = lastRunRef.current ?? contact.messages;
    setError(null);
    run(history);
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
        fresh={item.fresh}
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
        style={styles.list}
        /**
         * Daftar dibalik seperti aplikasi chat pada umumnya: pesan terbaru ada di
         * offset 0. Dengan begitu "berada di paling bawah" jadi posisi diamnya —
         * saat papan ketik membuka dan daftarnya menyusut, offset 0 tetap offset 0,
         * jadi tidak perlu lagi menghitung ulang tinggi isi daftar seperti
         * `scrollToEnd`, yang gagal kalau ada baris yang belum pernah diukur.
         */
        inverted
        /**
         * Pada daftar inverted, `flex-end` mendorong isi ke ujung wadah — yang secara
         * visual berarti ke atas. Tanpa ini percakapan yang masih pendek menggumpal di
         * bawah dekat panel pengetik, bukan mengalir dari atas seperti sebelumnya.
         */
        contentContainerStyle={styles.listContent}
        data={rows}
        // FlatList hanya menggambar ulang barisnya kalau `data` atau `extraData` berubah.
        // Tanpa ini, mengganti mode gelap/terang saat aplikasi terbuka meninggalkan
        // gelembung dengan warna tema yang lama.
        extraData={theme}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        keyboardDismissMode="interactive"
        // Pada daftar inverted, header digambar di bawah dan footer di atas.
        ListHeaderComponent={
          <View style={styles.footer}>
            {busy ? (
              <View style={styles.footerRow}>
                <TypingDots />
              </View>
            ) : null}
            {showReceipt ? (
              <Text style={[styles.receipt, { color: theme.label2 }]}>Terkirim</Text>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.intro}>
            <Avatar name={contact.name} color={contact.color} size={64} agent={contact.kind === 'agent'} />
            <Text style={[styles.introName, { color: theme.label }]}>{contact.name}</Text>
            {contact.persona.trim() ? (
              <Text style={[styles.introPersona, { color: theme.label2 }]} numberOfLines={3}>
                {contact.persona.trim()}
              </Text>
            ) : null}
          </View>
        }
      />

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorNotice
            message={error}
            onDismiss={() => setError(null)}
            actions={[
              { label: 'Coba lagi', run: retry },
              { label: 'Buka Pengaturan', run: () => navigation.navigate('Settings') },
            ]}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          SHAPE.glass
            ? {
                // Panel mengambang: latarnya diisi GlassView di bawah, jadi di sini
                // hanya bentuk dan jaraknya yang diatur. Saat papan ketik terbuka,
                // jarak aman bawah tidak berlaku lagi, jadi jarak bawahnya disamakan
                // dengan jarak kiri-kanan supaya panelnya terlihat pas.
                marginHorizontal: SHAPE.composerInset,
                marginBottom: keyboardUp ? SHAPE.composerInset : insets.bottom > 0 ? insets.bottom : 8,
                borderRadius: SHAPE.composerRadius,
                paddingBottom: 7,
              }
            : {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
                backgroundColor: theme.nav,
                // Sama seperti versi glass: disamakan dengan padding kiri-kanan.
                paddingBottom: keyboardUp ? COMPOSER_PAD : 8 + insets.bottom,
              },
        ]}
      >
        {SHAPE.glass ? (
          <GlassView
            style={[StyleSheet.absoluteFill, { borderRadius: SHAPE.composerRadius }]}
            glassEffectStyle="regular"
          />
        ) : null}

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

        <View
          style={[
            styles.field,
            { borderRadius: SHAPE.fieldRadius },
            SHAPE.glass
              ? { borderColor: 'transparent', backgroundColor: theme.fill }
              : { borderColor: theme.separator, backgroundColor: theme.bg },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.label }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="iMessage"
            placeholderTextColor={theme.label3}
            multiline
            onFocus={() => scrollToBottom()}
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

  errorWrap: { paddingHorizontal: 10, paddingBottom: 6 },

  list: { flex: 1 },
  listContent: { flexGrow: 1, justifyContent: 'flex-end' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: COMPOSER_PAD,
    paddingTop: 7,
    overflow: 'hidden',
  },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 3,
    paddingVertical: 3,
  },
  input: { flex: 1, fontSize: 17, lineHeight: 22, paddingTop: 4, paddingBottom: 5, maxHeight: 120 },
  send: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
