import type { GenSettings } from '../types';

const BASE = 'https://openrouter.ai/api/v1';

/** Header opsional yang dipakai OpenRouter untuk atribusi aplikasi. */
const APP_HEADERS = {
  'HTTP-Referer': 'https://github.com/reinyako/AI',
  'X-Title': 'Pesan',
};

export type WireMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ORModel = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number;
  completionPrice: number;
  free: boolean;
  vendor: string;
};

export type ORKeyInfo = {
  label: string | null;
  usage: number;
  limit: number | null;
};

/** Pesan error yang enak dibaca untuk tiap kode HTTP OpenRouter. */
function describe(status: number, body: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message ?? '';
  } catch {
    detail = body.slice(0, 200);
  }
  switch (status) {
    case 401:
      return 'API key ditolak (401). Cek lagi key OpenRouter kamu di Pengaturan.';
    case 402:
      return 'Kredit OpenRouter habis (402). Isi ulang atau pilih model gratis.';
    case 403:
      return detail || 'Permintaan ditolak (403). Model ini mungkin butuh izin tambahan.';
    case 404:
      return 'Model itu tidak ada di OpenRouter (404). Pilih model lain lewat Pengaturan → Model.';
    case 429:
      return 'Terlalu sering (429). Tunggu sebentar lalu coba lagi.';
    default:
      return detail || `Gagal menghubungi OpenRouter (${status}).`;
  }
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...APP_HEADERS,
  };
}

export async function listModels(apiKey: string): Promise<ORModel[]> {
  const response = await fetch(`${BASE}/models`, { headers: authHeaders(apiKey) });
  const body = await response.text();
  if (!response.ok) throw new Error(describe(response.status, body));

  const data = JSON.parse(body)?.data ?? [];
  return data
    .map((item: any): ORModel => {
      const promptPrice = Number(item?.pricing?.prompt ?? 0) || 0;
      const completionPrice = Number(item?.pricing?.completion ?? 0) || 0;
      return {
        id: String(item.id),
        name: String(item.name ?? item.id),
        contextLength: item.context_length ?? null,
        promptPrice,
        completionPrice,
        free: promptPrice === 0 && completionPrice === 0,
        vendor: String(item.id).split('/')[0] ?? 'lain',
      };
    })
    .sort((a: ORModel, b: ORModel) => a.id.localeCompare(b.id));
}

export async function fetchKeyInfo(apiKey: string): Promise<ORKeyInfo> {
  const response = await fetch(`${BASE}/key`, { headers: authHeaders(apiKey) });
  const body = await response.text();
  if (!response.ok) throw new Error(describe(response.status, body));
  const data = JSON.parse(body)?.data ?? {};
  return {
    label: data.label ?? null,
    usage: Number(data.usage ?? 0),
    limit: data.limit === null || data.limit === undefined ? null : Number(data.limit),
  };
}

/** Harga per satu juta token, siap ditampilkan di daftar model. */
export function priceLabel(model: ORModel): string {
  if (model.free) return 'Gratis';
  const input = model.promptPrice * 1_000_000;
  const output = model.completionPrice * 1_000_000;
  return `$${input.toFixed(2)} in · $${output.toFixed(2)} out /1J token`;
}

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

/**
 * Streaming balasan dari OpenRouter.
 *
 * React Native belum mendukung `fetch` streaming (tidak ada ReadableStream), jadi di sini
 * dipakai XMLHttpRequest: `responseText` bertambah panjang sambil data datang, dan
 * setiap kali `onprogress` dipanggil kita ambil potongan barunya lalu parse sebagai SSE.
 *
 * Mengembalikan fungsi untuk membatalkan permintaan.
 */
export function streamChat(
  apiKey: string,
  messages: WireMessage[],
  settings: GenSettings,
  handlers: StreamHandlers
): () => void {
  const xhr = new XMLHttpRequest();
  let consumed = 0;
  let buffer = '';
  let finished = false;

  const finish = (error?: string) => {
    if (finished) return;
    finished = true;
    if (error) handlers.onError(error);
    else handlers.onDone();
  };

  const handleFrame = (frame: string) => {
    const line = frame
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part.startsWith('data:'));
    if (!line) return; // baris ": OPENROUTER PROCESSING" hanya keep-alive
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') {
      finish();
      return;
    }
    try {
      const parsed = JSON.parse(payload);
      if (parsed?.error?.message) {
        finish(String(parsed.error.message));
        return;
      }
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) handlers.onDelta(delta);
    } catch {
      // potongan JSON belum lengkap — abaikan, frame berikutnya yang menyusul
    }
  };

  const drain = () => {
    const fresh = xhr.responseText.slice(consumed);
    consumed = xhr.responseText.length;
    buffer += fresh;
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    frames.forEach(handleFrame);
  };

  xhr.open('POST', `${BASE}/chat/completions`);
  Object.entries(authHeaders(apiKey)).forEach(([key, value]) => xhr.setRequestHeader(key, value));

  xhr.onprogress = () => {
    if (xhr.status === 200) drain();
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      drain();
      if (buffer.trim()) handleFrame(buffer);
      finish();
    } else {
      finish(describe(xhr.status, xhr.responseText));
    }
  };

  xhr.onerror = () => finish('Tidak bisa terhubung ke OpenRouter. Cek koneksi internet.');
  xhr.ontimeout = () => finish('Permintaan kelamaan, dibatalkan.');
  xhr.timeout = 120_000;

  xhr.send(
    JSON.stringify({
      model: settings.model,
      messages,
      stream: true,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
    })
  );

  return () => {
    if (finished) return;
    finished = true;
    xhr.abort();
  };
}
