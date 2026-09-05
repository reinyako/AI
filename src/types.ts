export type Role = 'user' | 'assistant';

export type Message = {
  id: string;
  role: Role;
  text: string;
  at: number;
  /** Tapback ala iMessage, mis. "❤️". */
  reaction?: string | null;
  /** Ditandai kalau balasan gagal, supaya bisa diulang. */
  failed?: boolean;
};

/** Parameter generasi selain model — ada versi global (default) dan versi per kontak. */
export type GenSettings = {
  temperature: number;
  topP: number;
  maxTokens: number;
  /** Berapa pesan terakhir yang ikut dikirim sebagai konteks. */
  historyLimit: number;
  /** Jeda "sedang mengetik" biar terasa seperti orang sungguhan. */
  humanize: boolean;
};

/**
 * Setelan khusus satu kontak. Field yang tidak ada di sini ikut setelan global —
 * jadi mengganti model atau temperature di Pengaturan langsung berlaku di semua
 * percakapan yang belum pernah dioprek sendiri.
 */
export type GenOverrides = Partial<GenSettings> & {
  /** Kalau kosong, model diambil dari provider yang aktif. */
  model?: string;
};

/** Semua parameter yang benar-benar dipakai untuk satu permintaan. */
export type ResolvedGen = GenSettings & { model: string };

/**
 * Satu konfigurasi koneksi. Selain OpenRouter, alamat mana pun yang meniru API
 * OpenAI (`POST {baseUrl}/chat/completions`) bisa dipakai — persis seperti mengisi
 * proxy sendiri di Janitor AI.
 */
export type Provider = {
  id: string;
  /** Nama konfigurasi, mis. "DeepSeek langsung" atau "Proxy kantor". */
  name: string;
  /** Base URL kompatibel OpenAI, mis. "https://openrouter.ai/api/v1". */
  baseUrl: string;
  /** Model yang dipakai kalau kontaknya tidak menentukan sendiri. */
  model: string;
  /** OpenRouter bawaan: punya endpoint /key dan daftar harga model. */
  builtin?: boolean;
};

/** Pilihan tema: ikut sistem, atau dikunci terang/gelap. */
export type ThemeMode = 'system' | 'light' | 'dark';

export type AppState = {
  contacts: Contact[];
  defaults: GenSettings;
  /** Instruksi global yang selalu ditempel di depan persona kontak jenis `character`. */
  globalPrompt: string;
  /** Instruksi yang dipakai percakapan jenis `agent`. */
  agentPrompt: string;
  providers: Provider[];
  activeProviderId: string;
  themeMode: ThemeMode;
};

/**
 * Dua jenis percakapan. `character` diperankan seperti orang sungguhan lengkap
 * dengan persona dan sapaan pembuka; `agent` dipakai sebagai asisten biasa, jadi
 * persona dan sapaan tidak berlaku untuknya.
 */
export type ContactKind = 'character' | 'agent';

export type Contact = {
  id: string;
  kind: ContactKind;
  name: string;
  /** Indeks ke palet warna avatar. */
  color: number;
  /** Karakter/instruksi yang jadi system prompt. */
  persona: string;
  /** Pesan pembuka yang muncul saat percakapan dibuka pertama kali. */
  greeting: string;
  messages: Message[];
  settings: GenOverrides;
};
