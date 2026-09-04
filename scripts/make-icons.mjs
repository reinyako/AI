/**
 * Membuat ikon PNG aplikasi (gelembung chat putih di atas gradien hijau iMessage)
 * tanpa dependensi tambahan — encoder PNG minimal memakai zlib bawaan Node.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../public/icons", import.meta.url));

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
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
      raw[offset++] = r; raw[offset++] = g; raw[offset++] = b; raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Jarak titik ke rounded-rect (untuk anti-aliasing halus). */
function roundedRectDist(x, y, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(x - cx) - (halfW - radius);
  const dy = Math.abs(y - cy) - (halfH - radius);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function makeIcon(size) {
  const s = size / 1024; // skala relatif desain 1024px
  const cx = size / 2;

  return encodePng(size, (x, y) => {
    // Latar: gradien hijau khas ikon Messages.
    const t = y / size;
    const r = Math.round(90 + (60 - 90) * t);
    const g = Math.round(224 + (196 - 224) * t);
    const b = Math.round(96 + (60 - 96) * t);

    // Badan gelembung.
    let d = roundedRectDist(x, y, cx, size * 0.47, size * 0.30, size * 0.245, size * 0.115);

    // Ekor gelembung di kiri bawah.
    const tail = Math.hypot(x - size * 0.315, y - size * 0.735) - size * 0.11;
    const tailCut = Math.hypot(x - size * 0.245, y - size * 0.80) - size * 0.10;
    d = Math.min(d, Math.max(tail, -tailCut));

    const alpha = Math.max(0, Math.min(1, 0.5 - d / (2 * s)));
    if (alpha <= 0) return [r, g, b, 255];
    const mix = (base) => Math.round(base + (255 - base) * alpha);
    return [mix(r), mix(g), mix(b), 255];
  });
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png`);
}
