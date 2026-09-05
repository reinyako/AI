import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { connectionFor, streamChat, validate, type WireMessage } from '../api/chat';
import { Bubble } from '../components/Bubble';
import { ChatHeader } from '../components/ChatHeader';
import { GlassPressable } from '../components/GlassPressable';
import { DayMark } from '../components/DayMark';
import { ErrorNotice } from '../components/Form';
import { TypingDots } from '../components/TypingDots';
import { showActions } from '../lib/actions';
import { uid } from '../lib/format';
import { useKeyboardOffset } from '../lib/keyboard';
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


/** Tinggi tombol + dan kolom teks di panel pengetik iOS 26. */
const CONTROL_SIZE = 40;
/** Jarak tombol kirim ke tepi dalam kolom teks di iOS 26. */
const SEND_INSET = 5;
/** Jarak atas panel pengetik; ikut dipakai untuk menaksir tingginya sebelum diukur. */
const COMPOSER_TOP = 7;

const GROUP_GAP = 60_000; // jeda yang memutus satu rentetan gelembung
const DAY_GAP = 30 * 60_000; // jeda yang memunculkan penanda waktu

export function ChatScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const contact = store.contactById(id);
  /**
   * Daftar diturunkan langsung di dalam listener papan ketik, bukan lewat efek yang
   * menunggu state berubah dulu — satu putaran render itu yang membuat gerakannya
   * terasa menyusul di belakang animasi papan ketik.
   */
  const { visible: keyboardUp, offset: keyboardOffset } = useKeyboardOffset(() =>
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  );

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Tinggi panel bawah yang melayang. Dipakai sebagai ruang kosong di ujung daftar
   * supaya pesan terakhir tidak tertutup panel pengetik.
   */
  const [bottomHeight, setBottomHeight] = useState(0);
  /** Tinggi header yang melayang, dipakai sebagai ruang di ujung atas daftar. */
  const [headerHeight, setHeaderHeight] = useState(0);

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
    /**
     * Layar ini memakai header buatan sendiri (lihat components/ChatHeader).
     * Navigation bar native dimatikan karena tampilannya di-reset iOS saat aplikasi
     * kembali dari latar belakang, dan iOS 26 memasang scroll edge effect yang
     * menyelubungi seluruh percakapan begitu isinya lewat di bawah bar itu.
     * Gestur geser-untuk-kembali tidak ikut hilang: itu datang dari native-stack,
     * bukan dari headernya.
     */
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  const composerBottomPad = keyboardUp ? SHAPE.composerInset : insets.bottom > 0 ? insets.bottom : 8;
  /**
   * Ruang di ujung daftar supaya pesan terakhir tidak tertutup panel pengetik yang
   * melayang. Hasil pengukuran `onLayout` dipakai begitu ada; sebelum itu tingginya
   * ditaksir dari ukuran panelnya sendiri, jadi tidak ada bingkai pertama yang
   * menyembunyikan pesan.
   */
  const bottomSpace = bottomHeight || COMPOSER_TOP + CONTROL_SIZE + composerBottomPad;

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
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/*
        Seluruh isi layar digeser ke atas setinggi papan ketik. Geserannya berjalan
        di thread UI dengan durasi dari iOS, jadi daftar dan panel pengetik naik
        seirama dengan papan ketiknya — bukan menyusul seperti waktu memakai
        KeyboardAvoidingView, yang menata ulang seluruh pohon tiap animasi.
      */}
      <Animated.View
        style={[styles.stage, { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] }]}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          /**
           * Daftarnya inverted, jadi `paddingTop` muncul di bawah. Ruang ini yang
           * membuat pesan terakhir tetap bisa digulir keluar dari balik panel pengetik
           * yang melayang di atasnya.
           */
          /**
           * Daftarnya inverted, jadi `paddingTop` muncul di bawah dan `paddingBottom`
           * di atas. Keduanya memberi ruang supaya pesan pertama dan terakhir bisa
           * digulir keluar dari balik header dan panel pengetik yang melayang.
           */
          contentContainerStyle={{ paddingTop: bottomSpace, paddingBottom: headerHeight }}
          /**
           * Daftar dibalik seperti aplikasi chat pada umumnya: pesan terbaru ada di
           * offset 0. Dengan begitu "berada di paling bawah" jadi posisi diamnya —
           * saat papan ketik membuka dan daftarnya menyusut, offset 0 tetap offset 0,
           * jadi tidak perlu lagi menghitung ulang tinggi isi daftar seperti
           * `scrollToEnd`, yang gagal kalau ada baris yang belum pernah diukur.
           */
          inverted
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
        />

        <View
          style={SHAPE.glass ? styles.bottomOverlay : undefined}
          onLayout={(event) => setBottomHeight(event.nativeEvent.layout.height)}
        >
          {SHAPE.glass ? (
            <LinearGradient
              colors={[theme.bgFade, theme.bg, theme.bg]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}

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
                ? [
                    // Di iOS 26 tidak ada kartu pembungkus: tombol + dan kolom teks
                    // masing-masing berdiri sebagai gelembung Liquid Glass sendiri,
                    // seperti panel pengetik iMessage. Wadah ini hanya mengatur jarak.
                    styles.composerGlass,
                    { paddingBottom: composerBottomPad },
                  ]
                : {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.separator,
                    backgroundColor: theme.nav,
                    // Saat papan ketik terbuka, jarak bawahnya disamakan dengan kiri-kanan.
                    paddingBottom: keyboardUp ? SHAPE.gutter : 8 + insets.bottom,
                  },
            ]}
          >
            <GlassPressable
              style={[styles.plus, SHAPE.glass ? styles.plusGlass : styles.plusPlain]}
              radius={SHAPE.glass ? SHAPE.fieldRadius : 16}
              fallbackColor={theme.fill}
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
              <Ionicons name="add" size={SHAPE.glass ? 24 : 22} color={SHAPE.glass ? theme.label : theme.label2} />
            </GlassPressable>

            <View
              style={[
                styles.field,
                { borderRadius: SHAPE.fieldRadius },
                SHAPE.glass
                  ? styles.fieldGlass
                  : { borderColor: theme.separator, backgroundColor: theme.bg },
              ]}
            >
              {SHAPE.glass ? (
                <GlassView
                  style={[StyleSheet.absoluteFill, { borderRadius: SHAPE.fieldRadius }]}
                  glassEffectStyle="regular"
                />
              ) : null}
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
                <GlassPressable
                  style={[styles.send, SHAPE.glass && styles.sendGlass]}
                  radius={SHAPE.glass ? (CONTROL_SIZE - SEND_INSET * 2) / 2 : 15}
                  glass={false}
                  fallbackColor={theme.label3}
                  onPress={stop}
                >
                  <Ionicons name="stop" size={SHAPE.glass ? 17 : 16} color="#FFFFFF" />
                </GlassPressable>
              ) : draft.trim() ? (
                <GlassPressable
                  style={[styles.send, SHAPE.glass && styles.sendGlass]}
                  radius={SHAPE.glass ? (CONTROL_SIZE - SEND_INSET * 2) / 2 : 15}
                  glass={false}
                  fallbackColor={theme.outgoing}
                  onPress={send}
                >
                  <Ionicons name="arrow-up" size={SHAPE.glass ? 22 : 18} color="#FFFFFF" />
                </GlassPressable>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>

      {/*
        Header sengaja di luar lapisan yang digeser: kalau ikut di dalamnya, ia
        terangkat bersama isi layar saat papan ketik membuka dan hilang ke atas.
      */}
      <View style={styles.topOverlay}>
        <ChatHeader
          contact={contact}
          onBack={() => navigation.goBack()}
          onInfo={() => navigation.navigate('Contact', { id: contact.id })}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingBottom: 10 },
  footerRow: { paddingHorizontal: SHAPE.gutter, marginTop: 10 },
  receipt: { textAlign: 'right', fontSize: 11, paddingRight: SHAPE.gutter, paddingTop: 3 },

  errorWrap: { paddingHorizontal: SHAPE.gutter, paddingBottom: 6 },

  // `overflow: hidden` supaya isi yang tergeser ke atas tidak menyembul keluar layar.
  screen: { flex: 1, overflow: 'hidden' },
  stage: { flex: 1 },
  list: { flex: 1 },
  // Panel bawah melayang di atas daftar supaya pesan bisa lewat di belakangnya.
  // Ia ikut tergeser bersama seluruh isi layar saat papan ketik membuka.
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Header ikut melayang, supaya pesan lewat memudar di belakangnya.
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: SHAPE.gutter,
    paddingTop: COMPOSER_TOP,
  },
  // Panel pengetik iOS 26 lebih lega: jarak ke tepi layar dan antar-kontrolnya
  // mengikuti iMessage, dan kontrolnya sama-sama setinggi CONTROL_SIZE.
  composerGlass: { gap: 12 },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  plusPlain: { marginBottom: 2 },
  // Tombol + setinggi kolom teks supaya dasarnya sejajar, dan `overflow` memotong
  // lapisan glass mengikuti bentuk bulatnya.
  plusGlass: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: SHAPE.fieldRadius,
    overflow: 'hidden',
  },
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
  fieldGlass: {
    borderColor: 'transparent',
    overflow: 'hidden',
    minHeight: CONTROL_SIZE,
    paddingLeft: 16,
    paddingRight: SEND_INSET,
    paddingVertical: SEND_INSET,
  },
  input: { flex: 1, fontSize: 17, lineHeight: 22, paddingTop: 4, paddingBottom: 5, maxHeight: 120 },
  send: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  // Kapsul memanjang, bukan lingkaran. Tingginya diturunkan dari tinggi kolom teks
  // dikurangi jarak atas-bawahnya, jadi selalu duduk pas di dalam pil.
  sendGlass: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE - SEND_INSET * 2,
    borderRadius: (CONTROL_SIZE - SEND_INSET * 2) / 2,
  },
});
