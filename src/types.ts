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

/** Parameter generasi — ada versi global (default) dan versi per kontak. */
export type GenSettings = {
  /** Slug model OpenRouter, mis. "anthropic/claude-3.5-sonnet". */
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  /** Berapa pesan terakhir yang ikut dikirim sebagai konteks. */
  historyLimit: number;
  /** Jeda "sedang mengetik" biar terasa seperti orang sungguhan. */
  humanize: boolean;
};

export type Contact = {
  id: string;
  name: string;
  /** Indeks ke palet warna avatar. */
  color: number;
  /** Karakter/instruksi yang jadi system prompt. */
  persona: string;
  /** Pesan pembuka yang muncul saat percakapan dibuka pertama kali. */
  greeting: string;
  messages: Message[];
  settings: GenSettings;
};

export type AppState = {
  contacts: Contact[];
  defaults: GenSettings;
  /** Instruksi global yang selalu ditempel di depan persona. */
  globalPrompt: string;
};
