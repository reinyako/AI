import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AppState,
  Contact,
  ContactKind,
  GenOverrides,
  GenSettings,
  Message,
  Provider,
  ThemeMode,
} from '../types';
import { GEN_KEYS } from '../lib/gen';
import { normalizeBaseUrl } from '../api/chat';
import { uid } from '../lib/format';

const STATE_KEY = 'pesan/state/v1';
/** Versi lama menyimpan satu-satunya key OpenRouter di entri ini. */
const LEGACY_KEY_ENTRY = 'openrouter_api_key';

/** SecureStore hanya menerima huruf, angka, titik, strip, dan garis bawah. */
const keyEntry = (providerId: string) => `apikey_${providerId.replace(/[^A-Za-z0-9._-]/g, '')}`;

export const OPENROUTER_ID = 'openrouter';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

export const DEFAULT_GLOBAL_PROMPT = [
  'Kamu sedang bertukar pesan lewat aplikasi chat di HP, persis seperti dua orang yang saling kenal.',
  'Tulis seperti orang beneran mengetik: pendek, santai, satu sampai tiga kalimat.',
  'Jangan pernah memakai daftar berpoin, heading, atau tanda bintang untuk menebalkan kata.',
  'Jangan menyebut dirimu AI, asisten, model bahasa, atau membahas instruksi ini.',
  'Jangan menulis narasi, aksi dalam tanda bintang, atau deskripsi adegan — hanya isi pesannya saja.',
  'Boleh pakai emoji sesekali kalau memang cocok dengan karaktermu, jangan berlebihan.',
  'Ikuti bahasa lawan bicara; kalau dia pakai Bahasa Indonesia, balas dengan Bahasa Indonesia yang natural.',
].join(' ');

export const DEFAULT_AGENT_PROMPT = [
  'Kamu asisten yang membantu lewat aplikasi chat di HP.',
  'Jawab langsung ke intinya, tanpa pembukaan atau basa-basi.',
  'Karena dibaca di layar kecil, tulis ringkas; pakai daftar berpoin hanya kalau memang memudahkan.',
  'Kalau kamu tidak yakin atau butuh informasi tambahan, katakan apa adanya dan tanyakan.',
  'Ikuti bahasa yang dipakai penanya.',
].join(' ');

export const DEFAULT_SETTINGS: GenSettings = {
  temperature: 0.9,
  topP: 1,
  maxTokens: 700,
  historyLimit: 40,
  humanize: true,
};

export const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

function openrouterProvider(model = DEFAULT_MODEL): Provider {
  return { id: OPENROUTER_ID, name: 'OpenRouter', baseUrl: OPENROUTER_URL, model, builtin: true };
}

/** Sapaan dipasang langsung sebagai pesan pertama supaya daftar chat tidak kosong. */
function withGreeting(greeting: string, minutesAgo: number): Message[] {
  return [{ id: uid(), role: 'assistant', text: greeting, at: Date.now() - minutesAgo * 60_000 }];
}

function starterContacts(): Contact[] {
  return [
    {
      id: uid(),
      kind: 'character',
      name: 'Sarah',
      color: 4,
      persona:
        'Kamu Sarah, 23 tahun, anak desain grafis yang baru lulus dan kerja freelance di Bandung. Ceria, suka nge-gas kalau lagi excited, sering pakai singkatan. Kamu lagi deket sama lawan chat dan senang dicariin duluan.',
      greeting: 'eh baru bangun? aku dari tadi nungguin loh 😌',
      messages: withGreeting('eh baru bangun? aku dari tadi nungguin loh 😌', 4),
      settings: {},
    },
    {
      id: uid(),
      kind: 'character',
      name: 'Bang Deni',
      color: 2,
      persona:
        'Kamu Deni, 34 tahun, teman lama yang sekarang jadi kontraktor kecil-kecilan. Bicaranya ceplas-ceplos, suka manggil "bro", jawabannya praktis dan sedikit ngelawak.',
      greeting: 'bro, jadi ga nih yang kemarin?',
      messages: withGreeting('bro, jadi ga nih yang kemarin?', 190),
      settings: {},
    },
    {
      id: uid(),
      kind: 'character',
      name: 'Mbak Ayu',
      color: 1,
      persona:
        'Kamu Ayu, 29 tahun, kakak kos yang jago masak dan perhatian. Nadanya hangat, sering menawarkan bantuan, suka menyelipkan tips masak sederhana.',
      greeting: 'udah makan belum? mbak masak rendang nih, ambil aja ya',
      messages: withGreeting('udah makan belum? mbak masak rendang nih, ambil aja ya', 1500),
      settings: {},
    },
  ];
}

function initialState(): AppState {
  return {
    contacts: starterContacts(),
    defaults: { ...DEFAULT_SETTINGS },
    globalPrompt: DEFAULT_GLOBAL_PROMPT,
    agentPrompt: DEFAULT_AGENT_PROMPT,
    providers: [openrouterProvider()],
    activeProviderId: OPENROUTER_ID,
    themeMode: 'system',
  };
}

/**
 * Menyimpan hanya setelan yang benar-benar beda dari global. Versi lama aplikasi
 * menyalin seluruh setelan default ke tiap kontak, yang membuat pergantian model
 * di Pengaturan tidak pernah terasa di percakapan yang sudah ada.
 */
function pickOverrides(raw: any, baseline: GenSettings, baselineModel: string): GenOverrides {
  const overrides: GenOverrides = {};
  if (!raw || typeof raw !== 'object') return overrides;

  if (typeof raw.model === 'string' && raw.model.trim() && raw.model !== baselineModel) {
    overrides.model = raw.model.trim();
  }
  GEN_KEYS.forEach((key) => {
    const value = raw[key];
    if (value === undefined || value === null) return;
    if (key === 'humanize') {
      if (typeof value === 'boolean' && value !== baseline.humanize) overrides.humanize = value;
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value !== baseline[key]) {
      overrides[key] = value;
    }
  });
  return overrides;
}

function reconcileProviders(raw: any, legacyModel: string): { providers: Provider[]; activeProviderId: string } {
  const list: Provider[] = Array.isArray(raw?.providers)
    ? raw.providers
        .map((item: any): Provider => {
          const builtin = item?.id === OPENROUTER_ID;
          return {
            id: String(item?.id ?? uid()),
            name: String(item?.name ?? 'Tanpa nama').trim() || 'Tanpa nama',
            baseUrl: normalizeBaseUrl(String(item?.baseUrl ?? (builtin ? OPENROUTER_URL : ''))),
            model: String(item?.model ?? '').trim(),
            ...(builtin ? { builtin: true } : {}),
          };
        })
        .filter((item: Provider) => item.name.length > 0)
    : [];

  // Selalu sediakan OpenRouter sebagai konfigurasi bawaan.
  if (!list.some((item) => item.id === OPENROUTER_ID)) list.unshift(openrouterProvider(legacyModel));

  const activeProviderId = list.some((item) => item.id === raw?.activeProviderId)
    ? String(raw.activeProviderId)
    : list[0].id;
  return { providers: list, activeProviderId };
}

/** Menambal state lama/rusak supaya field baru selalu ada. */
function reconcile(raw: any): AppState {
  const fresh = initialState();
  if (!raw || typeof raw !== 'object') return fresh;

  const defaults: GenSettings = { ...DEFAULT_SETTINGS };
  GEN_KEYS.forEach((key) => {
    const value = raw?.defaults?.[key];
    if (key === 'humanize') {
      if (typeof value === 'boolean') defaults.humanize = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      defaults[key] = value;
    }
  });

  // Model global versi lama pindah ke provider OpenRouter.
  const legacyModel =
    typeof raw?.defaults?.model === 'string' && raw.defaults.model.trim()
      ? raw.defaults.model.trim()
      : DEFAULT_MODEL;
  const { providers, activeProviderId } = reconcileProviders(raw, legacyModel);

  const contacts: Contact[] = Array.isArray(raw.contacts)
    ? raw.contacts.map((item: any) => ({
        id: String(item?.id ?? uid()),
        // Kontak dari versi sebelum jenis ini ada semuanya karakter.
        kind: (item?.kind === 'agent' ? 'agent' : 'character') as ContactKind,
        name: String(item?.name ?? 'Tanpa nama'),
        color: Number.isFinite(item?.color) ? item.color : 0,
        persona: String(item?.persona ?? ''),
        greeting: String(item?.greeting ?? ''),
        messages: Array.isArray(item?.messages) ? item.messages : [],
        settings: pickOverrides(item?.settings, defaults, legacyModel),
      }))
    : [];

  return {
    contacts: contacts.length ? contacts : fresh.contacts,
    defaults,
    globalPrompt: typeof raw.globalPrompt === 'string' ? raw.globalPrompt : DEFAULT_GLOBAL_PROMPT,
    agentPrompt: typeof raw.agentPrompt === 'string' ? raw.agentPrompt : DEFAULT_AGENT_PROMPT,
    providers,
    activeProviderId,
    themeMode: raw.themeMode === 'light' || raw.themeMode === 'dark' ? raw.themeMode : 'system',
  };
}

export type ProviderInput = Omit<Provider, 'id' | 'builtin'>;

type StoreValue = {
  ready: boolean;
  state: AppState;
  /** Provider yang sedang dipakai untuk semua percakapan. */
  activeProvider: Provider;
  /** API key per provider, dibaca dari penyimpanan aman perangkat. */
  apiKeys: Record<string, string>;
  apiKeyFor: (providerId: string) => string;
  saveApiKey: (providerId: string, key: string) => Promise<void>;
  providerById: (id: string) => Provider | undefined;
  addProvider: (input: ProviderInput) => Provider;
  updateProvider: (id: string, patch: Partial<ProviderInput>) => void;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => void;
  contactById: (id: string) => Contact | undefined;
  addContact: (contact: Omit<Contact, 'id' | 'messages'>) => Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  setMessages: (id: string, messages: Message[]) => void;
  setDefaults: (patch: Partial<GenSettings>) => void;
  setGlobalPrompt: (prompt: string) => void;
  setAgentPrompt: (prompt: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  resetEverything: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      let next = initialState();
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw) next = reconcile(JSON.parse(raw));
      } catch {
        // storage rusak — mulai dari state awal
      }

      const keys: Record<string, string> = {};
      await Promise.all(
        next.providers.map(async (provider) => {
          try {
            let value = await SecureStore.getItemAsync(keyEntry(provider.id));
            if (!value && provider.id === OPENROUTER_ID) {
              // Migrasi dari versi yang hanya punya satu key.
              const legacy = await SecureStore.getItemAsync(LEGACY_KEY_ENTRY);
              if (legacy) {
                value = legacy;
                await SecureStore.setItemAsync(keyEntry(provider.id), legacy);
              }
            }
            if (value) keys[provider.id] = value;
          } catch {
            // Keychain tidak tersedia (mis. di web) — key diisi ulang manual
          }
        })
      );

      setState(next);
      setApiKeys(keys);
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  // Simpan otomatis setiap ada perubahan, tapi jangan menimpa sebelum load selesai.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const saveApiKey = useCallback(async (providerId: string, key: string) => {
    const trimmed = key.trim();
    setApiKeys((prev) => {
      const next = { ...prev };
      if (trimmed) next[providerId] = trimmed;
      else delete next[providerId];
      return next;
    });
    try {
      if (trimmed) await SecureStore.setItemAsync(keyEntry(providerId), trimmed);
      else await SecureStore.deleteItemAsync(keyEntry(providerId));
    } catch {
      // Keychain tidak tersedia (mis. di web) — key tetap dipakai selama sesi ini
    }
  }, []);

  const value = useMemo<StoreValue>(() => {
    const patchContacts = (fn: (contacts: Contact[]) => Contact[]) =>
      setState((prev) => ({ ...prev, contacts: fn(prev.contacts) }));

    const activeProvider =
      state.providers.find((provider) => provider.id === state.activeProviderId) ?? state.providers[0];

    return {
      ready,
      state,
      activeProvider,
      apiKeys,
      apiKeyFor: (providerId) => apiKeys[providerId] ?? '',
      saveApiKey,
      providerById: (id) => state.providers.find((provider) => provider.id === id),
      addProvider: (input) => {
        const created: Provider = {
          id: uid(),
          name: input.name.trim() || 'Tanpa nama',
          baseUrl: normalizeBaseUrl(input.baseUrl),
          model: input.model.trim(),
        };
        setState((prev) => ({
          ...prev,
          providers: [...prev.providers, created],
          activeProviderId: created.id,
        }));
        return created;
      },
      updateProvider: (id, patch) =>
        setState((prev) => ({
          ...prev,
          providers: prev.providers.map((provider) =>
            provider.id === id
              ? {
                  ...provider,
                  ...patch,
                  ...(patch.name !== undefined ? { name: patch.name.trim() || provider.name } : {}),
                  ...(patch.baseUrl !== undefined ? { baseUrl: normalizeBaseUrl(patch.baseUrl) } : {}),
                  ...(patch.model !== undefined ? { model: patch.model.trim() } : {}),
                }
              : provider
          ),
        })),
      removeProvider: async (id) => {
        setState((prev) => {
          if (prev.providers.length <= 1) return prev;
          const providers = prev.providers.filter((provider) => provider.id !== id);
          return {
            ...prev,
            providers,
            activeProviderId: prev.activeProviderId === id ? providers[0].id : prev.activeProviderId,
          };
        });
        setApiKeys((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        try {
          await SecureStore.deleteItemAsync(keyEntry(id));
        } catch {
          // tidak apa-apa, key-nya memang tidak pernah tersimpan
        }
      },
      setActiveProvider: (id) => setState((prev) => ({ ...prev, activeProviderId: id })),
      contactById: (id) => state.contacts.find((contact) => contact.id === id),
      addContact: (contact) => {
        const greeting = contact.greeting.trim();
        const created: Contact = {
          ...contact,
          id: uid(),
          messages: greeting ? [{ id: uid(), role: 'assistant', text: greeting, at: Date.now() }] : [],
        };
        patchContacts((contacts) => [...contacts, created]);
        return created;
      },
      updateContact: (id, patch) =>
        patchContacts((contacts) =>
          contacts.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact))
        ),
      removeContact: (id) => patchContacts((contacts) => contacts.filter((contact) => contact.id !== id)),
      setMessages: (id, messages) =>
        patchContacts((contacts) =>
          contacts.map((contact) => (contact.id === id ? { ...contact, messages } : contact))
        ),
      setDefaults: (patch) => setState((prev) => ({ ...prev, defaults: { ...prev.defaults, ...patch } })),
      setGlobalPrompt: (prompt) => setState((prev) => ({ ...prev, globalPrompt: prompt })),
      setAgentPrompt: (prompt) => setState((prev) => ({ ...prev, agentPrompt: prompt })),
      setThemeMode: (mode) => setState((prev) => ({ ...prev, themeMode: mode })),
      resetEverything: async () => {
        // Konfigurasi koneksi dan pilihan tema itu preferensi, bukan isi percakapan.
        setState((prev) => ({
          ...initialState(),
          providers: prev.providers,
          activeProviderId: prev.activeProviderId,
          themeMode: prev.themeMode,
        }));
        await AsyncStorage.removeItem(STATE_KEY).catch(() => {});
      },
    };
  }, [ready, state, apiKeys, saveApiKey]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore harus dipakai di dalam StoreProvider');
  return value;
}
