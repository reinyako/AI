import type { Provider, ResolvedGen } from '../types';

/** Header opsional yang dipakai OpenRouter untuk atribusi aplikasi. */
const APP_HEADERS = {
  'HTTP-Referer': 'https://github.com/reinyako/AI',
  'X-Title': 'Pesan',
};

export type Connection = {
  name: string;
  baseUrl: string;
  apiKey: string;
  builtin?: boolean;
};

export function connectionFor(provider: Provider, apiKey: string): Connection {
  return {
    name: provider.name,
    baseUrl: normalizeBaseUrl(provider.baseUrl),
    apiKey,
    builtin: provider.builtin,
  };
}

/**
 * Merapikan URL yang ditempel orang. Yang biasa terjadi: menempel URL lengkap
 * sampai `/chat/completions`, menambah garis miring di ujung, atau lupa protokol.
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/(chat\/completions|completions)$/i, '');
  return url;
}

export type WireMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatModel = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number;
  completionPrice: number;
  free: boolean;
  vendor: string;
};

export type KeyInfo = {
  label: string | null;
  usage: number;
  limit: number | null;
};

/** Detail error dari body respons, kalau servernya mengirim JSON yang wajar. */
function detailOf(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.error;
    return typeof message === 'string' ? message.trim() : '';
  } catch {
    return '';
  }
}

/** Respons HTML biasanya berarti URL-nya bukan endpoint API. */
function looksLikeHtml(body: string): boolean {
  return /^\s*<(!doctype|html)/i.test(body);
}

/** Pesan error yang enak dibaca, disesuaikan dengan nama konfigurasi yang dipakai. */
export function describeError(connection: Connection, status: number, body: string, model?: string): string {
  const detail = detailOf(body);
  const where = connection.name;

  if (looksLikeHtml(body)) {
    return `${where} membalas halaman HTML, bukan data API (${status}). Proxy URL-nya kemungkinan salah — yang benar biasanya berakhiran /v1, bukan alamat halaman web.`;
  }

  switch (status) {
    case 400:
      return (
        detail ||
        `Permintaan ditolak (400) oleh ${where}.${model ? ` Nama model "${model}" mungkin tidak dikenali.` : ''}`
      );
    case 401:
      return `API key ${where} ditolak (401). Cek lagi key-nya di Pengaturan → ${where}.`;
    case 402:
      return `Kredit ${where} habis (402). Isi ulang saldo atau pilih model yang gratis.`;
    case 403:
      return detail || `Permintaan ditolak ${where} (403). Key-mu mungkin tidak punya izin untuk model ini.`;
    case 404:
      return `Tidak ditemukan (404).${model ? ` Model "${model}" tidak ada di ${where},` : ''} atau Proxy URL-nya salah. Cek Pengaturan → ${where}.`;
    case 408:
    case 504:
      return `${where} kelamaan menjawab (${status}). Coba lagi sebentar.`;
    case 429:
      return detail || `Terlalu sering minta ke ${where} (429). Tunggu sebentar lalu coba lagi.`;
    case 500:
    case 502:
    case 503:
      return detail || `Server ${where} sedang bermasalah (${status}). Coba lagi nanti.`;
    default:
      if (status === 0) return `Tidak bisa menghubungi ${where}. Cek koneksi internet dan Proxy URL-nya.`;
      return detail || `Gagal menghubungi ${where} (${status}).`;
  }
}

function authHeaders(connection: Connection): Record<string, string> {
  return {
    Authorization: `Bearer ${connection.apiKey}`,
    'Content-Type': 'application/json',
    ...(connection.builtin ? APP_HEADERS : {}),
  };
}

/** Cek yang harus lolos sebelum permintaan apa pun dikirim. */
export function validate(connection: Connection, model?: string): string | null {
  if (!connection.baseUrl) return `Proxy URL untuk ${connection.name} belum diisi. Buka Pengaturan → ${connection.name}.`;
  if (!connection.apiKey) return `API key untuk ${connection.name} belum diisi. Buka Pengaturan → ${connection.name}.`;
  if (model !== undefined && !model) return `Nama model belum diisi untuk ${connection.name}.`;
  return null;
}

async function getJson(connection: Connection, path: string): Promise<any> {
  const guard = validate(connection);
  if (guard) throw new Error(guard);

  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}${path}`, { headers: authHeaders(connection) });
  } catch {
    throw new Error(
      `Tidak bisa menghubungi ${connection.name} di ${connection.baseUrl}. Cek koneksi internet dan Proxy URL-nya.`
    );
  }
  const body = await response.text();
  if (!response.ok) throw new Error(describeError(connection, response.status, body));
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      `Balasan ${connection.name} bukan JSON yang bisa dibaca. Proxy URL-nya kemungkinan bukan endpoint API.`
    );
  }
}

/** Daftar model dari endpoint `/models` (standar API OpenAI, didukung hampir semua proxy). */
export async function listModels(connection: Connection): Promise<ChatModel[]> {
  const data = (await getJson(connection, '/models'))?.data;
  if (!Array.isArray(data)) {
    throw new Error(`${connection.name} tidak mengirim daftar model. Tulis nama modelnya manual saja.`);
  }

  return data
    .map((item: any): ChatModel => {
      const id = String(item?.id ?? '');
      const promptPrice = Number(item?.pricing?.prompt ?? 0) || 0;
      const completionPrice = Number(item?.pricing?.completion ?? 0) || 0;
      const hasPricing = item?.pricing !== undefined;
      return {
        id,
        name: String(item?.name ?? id),
        contextLength: item?.context_length ?? null,
        promptPrice,
        completionPrice,
        free: hasPricing && promptPrice === 0 && completionPrice === 0,
        vendor: id.split('/')[0] ?? 'lain',
      };
    })
    .filter((model: ChatModel) => model.id.length > 0)
    .sort((a: ChatModel, b: ChatModel) => a.id.localeCompare(b.id));
}

/** Sisa pemakaian key — khusus OpenRouter. */
export async function fetchKeyInfo(connection: Connection): Promise<KeyInfo> {
  const data = (await getJson(connection, '/key'))?.data ?? {};
  return {
    label: data.label ?? null,
    usage: Number(data.usage ?? 0),
    limit: data.limit === null || data.limit === undefined ? null : Number(data.limit),
  };
}

/**
 * Tes koneksi untuk layar konfigurasi. Dicoba lewat `/models` dulu karena murah;
 * kalau proxy-nya tidak punya endpoint itu, dicoba satu permintaan chat sependek mungkin.
 */
export async function testConnection(connection: Connection, model: string): Promise<string> {
  const guard = validate(connection, model);
  if (guard) throw new Error(guard);

  try {
    const models = await listModels(connection);
    const known = models.some((item) => item.id === model);
    return known
      ? `Terhubung. ${models.length} model tersedia, dan "${model}" ada di daftar.`
      : `Terhubung, ${models.length} model tersedia — tapi "${model}" tidak ada di daftar. Balasan bisa gagal kalau namanya salah.`;
  } catch (listError) {
    // Banyak proxy hanya membuka /chat/completions. Coba permintaan paling murah.
    let response: Response;
    try {
      response = await fetch(`${connection.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(connection),
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      });
    } catch {
      throw listError instanceof Error ? listError : new Error('Gagal menghubungi server.');
    }
    const body = await response.text();
    if (response.ok) return `Terhubung lewat /chat/completions dengan model "${model}".`;
    throw new Error(describeError(connection, response.status, body, model));
  }
}

/** Harga per satu juta token, siap ditampilkan di daftar model. */
export function priceLabel(model: ChatModel): string {
  if (model.free) return 'Gratis';
  if (!model.promptPrice && !model.completionPrice) return 'Harga tidak diketahui';
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
 * Streaming balasan dari endpoint chat completions.
 *
 * React Native belum mendukung `fetch` streaming (tidak ada ReadableStream), jadi di sini
 * dipakai XMLHttpRequest: `responseText` bertambah panjang sambil data datang, dan
 * setiap kali `onprogress` dipanggil kita ambil potongan barunya lalu parse sebagai SSE.
 *
 * Mengembalikan fungsi untuk membatalkan permintaan.
 */
export function streamChat(
  connection: Connection,
  messages: WireMessage[],
  gen: ResolvedGen,
  handlers: StreamHandlers
): () => void {
  const guard = validate(connection, gen.model);
  if (guard) {
    handlers.onError(guard);
    return () => {};
  }

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
        finish(`${connection.name}: ${parsed.error.message}`);
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

  xhr.open('POST', `${connection.baseUrl}/chat/completions`);
  Object.entries(authHeaders(connection)).forEach(([key, value]) => xhr.setRequestHeader(key, value));

  xhr.onprogress = () => {
    if (xhr.status === 200) drain();
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      drain();
      if (buffer.trim()) handleFrame(buffer);
      finish();
    } else {
      finish(describeError(connection, xhr.status, xhr.responseText, gen.model));
    }
  };

  xhr.onerror = () =>
    finish(
      `Tidak bisa menghubungi ${connection.name} di ${connection.baseUrl}. Cek koneksi internet dan Proxy URL-nya.`
    );
  xhr.ontimeout = () => finish(`${connection.name} tidak menjawab dalam 2 menit, permintaan dibatalkan.`);
  xhr.timeout = 120_000;

  xhr.send(
    JSON.stringify({
      model: gen.model,
      messages,
      stream: true,
      temperature: gen.temperature,
      top_p: gen.topP,
      max_tokens: gen.maxTokens,
    })
  );

  return () => {
    if (finished) return;
    finished = true;
    xhr.abort();
  };
}
