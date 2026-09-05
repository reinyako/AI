/**
 * Membuat ikon aplikasi (gelembung chat putih di atas gradien hijau) tanpa dependensi:
 * encoder PNG minimal memakai zlib bawaan Node.
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../assets', import.meta.url));

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * `alpha: false` menulis PNG RGB tanpa kanal alpha — ikon iOS tidak boleh transparan,
 * dan App Store menolak ikon yang punya alpha meskipun isinya opak semua.
 */
function encodePng(size, pixel, alpha) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc(size * (size * channels + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      if (alpha) raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // RGBA / RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Jarak bertanda ke rounded-rect dengan radius per sudut [kiri-atas, kanan-atas, kanan-bawah, kiri-bawah]. */
function box(x, y, left, top, right, bottom, [tl, tr, br, bl]) {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const halfW = (right - left) / 2;
  const halfH = (bottom - top) / 2;
  // Radius di-clamp seperti CSS: tidak boleh lebih dari setengah sisi kotak,
  // kalau tidak SDF-nya menghasilkan bentuk rusak.
  const corner = x < cx ? (y < cy ? tl : bl) : (y < cy ? tr : br);
  const radius = Math.min(corner, halfW, halfH);
  const dx = Math.abs(x - cx) - (halfW - radius);
  const dy = Math.abs(y - cy) - (halfH - radius);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
}

// Gelembung dalam koordinat 0..1. Ekornya dibentuk seperti di components/Bubble.tsx:
// satu blok yang menyembul ke kiri-bawah, lalu dipotong blok kedua supaya ujungnya melengkung.
const L = 0.2;
const R = 0.8;
const T = 0.25;
const B = 0.7;
const RADIUS = 0.105;
const TAIL = 0.0075; // satuan ekor; makin besar makin panjang ekornya
const CENTER_Y = (T + B) / 2;

function bubbleDistance(x, y) {
  const body = box(x, y, L, T, R, B, [RADIUS, RADIUS, RADIUS, RADIUS]);
  const block = box(x, y, L - 7 * TAIL, B - 21 * TAIL, L + 13 * TAIL, B, [0, 0, 15 * TAIL, 0]);
  const cover = box(x, y, L - 25 * TAIL, B - 22 * TAIL, L, B, [0, 0, 11 * TAIL, 0]);
  return Math.min(body, Math.max(block, -cover));
}

/**
 * @param size    sisi PNG dalam piksel
 * @param options `transparent` menghasilkan gelembung putih di atas latar tembus pandang
 *                (untuk ikon adaptif Android dan splash screen), `scale` mengecilkan
 *                gelembungnya terhadap pusat kanvas.
 */
function bubbleIcon(size, { transparent = false, scale = 1 } = {}) {
  const unit = 1 / size;

  return encodePng(
    size,
    (px, py) => {
      const x = 0.5 + (px / size - 0.5) / scale;
      const y = CENTER_Y + (py / size - CENTER_Y) / scale;
      const distance = bubbleDistance(x, y) * scale;

      // Anti-alias: satu piksel transisi di sekitar tepi bentuk.
      const alpha = Math.max(0, Math.min(1, 0.5 - distance / (2 * unit)));
      if (transparent) return [255, 255, 255, Math.round(alpha * 255)];

      const t = py / size;
      const r = Math.round(90 + (60 - 90) * t);
      const g = Math.round(224 + (196 - 224) * t);
      const b = Math.round(96 + (60 - 96) * t);
      const mix = (base) => Math.round(base + (255 - base) * alpha);
      return [mix(r), mix(g), mix(b), 255];
    },
    transparent
  );
}

// Ikon utama iOS/Android: 1024×1024 opak, tanpa kanal alpha.
writeFileSync(join(ASSETS, 'icon.png'), bubbleIcon(1024, { scale: 1.05 }));
// Splash: gelembung putih saja, latarnya diisi backgroundColor dari plugin expo-splash-screen.
writeFileSync(join(ASSETS, 'splash-icon.png'), bubbleIcon(512, { transparent: true, scale: 1.15 }));
writeFileSync(join(ASSETS, 'favicon.png'), bubbleIcon(64, { scale: 1.05 }));
// Ikon adaptif Android: isi harus muat di lingkaran aman 66% dari kanvas, jadi dikecilkan.
writeFileSync(join(ASSETS, 'android-icon-foreground.png'), bubbleIcon(432, { transparent: true, scale: 0.82 }));
// Ikon monokrom untuk themed icon Android 13+.
writeFileSync(join(ASSETS, 'android-icon-monochrome.png'), bubbleIcon(432, { transparent: true, scale: 0.82 }));
console.log('Ikon dibuat ulang di assets/');
