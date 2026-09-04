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

function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Jarak bertanda ke rounded-rect, dipakai untuk tepi yang halus. */
function roundedRect(x, y, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(x - cx) - (halfW - radius);
  const dy = Math.abs(y - cy) - (halfH - radius);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
}

function bubbleIcon(size, { transparent = false, scale = 1 } = {}) {
  const unit = size / 1024;
  const cx = size / 2;

  return encodePng(size, (x, y) => {
    const t = y / size;
    const r = Math.round(90 + (60 - 90) * t);
    const g = Math.round(224 + (196 - 224) * t);
    const b = Math.round(96 + (60 - 96) * t);

    let d = roundedRect(x, y, cx, size * 0.47, size * 0.3 * scale, size * 0.245 * scale, size * 0.115 * scale);
    const tail = Math.hypot(x - size * 0.315, y - size * 0.735) - size * 0.11 * scale;
    const tailCut = Math.hypot(x - size * 0.245, y - size * 0.8) - size * 0.1 * scale;
    d = Math.min(d, Math.max(tail, -tailCut));

    const alpha = Math.max(0, Math.min(1, 0.5 - d / (2 * unit)));
    if (transparent) return [255, 255, 255, Math.round(alpha * 255)];
    if (alpha <= 0) return [r, g, b, 255];
    const mix = (base) => Math.round(base + (255 - base) * alpha);
    return [mix(r), mix(g), mix(b), 255];
  });
}

writeFileSync(join(ASSETS, 'icon.png'), bubbleIcon(1024));
writeFileSync(join(ASSETS, 'splash-icon.png'), bubbleIcon(512));
writeFileSync(join(ASSETS, 'favicon.png'), bubbleIcon(64));
writeFileSync(join(ASSETS, 'android-icon-foreground.png'), bubbleIcon(432, { transparent: true, scale: 0.72 }));
console.log('Ikon dibuat ulang di assets/');
