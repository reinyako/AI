export type RichStyle = { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean };
export type RichSegment = RichStyle & { text: string };
export type RichLine = { bullet: boolean; segments: RichSegment[] };

/**
 * Penanda yang dikenali, diurutkan dari yang paling panjang. Urutan ini penting:
 * `**tebal**` harus dicoba sebelum `*miring*`, kalau tidak bintang pertamanya
 * keburu dimakan aturan miring.
 *
 * `_miring_` sengaja tidak didukung karena garis bawah tunggal terlalu sering
 * muncul di nama_variabel dan alamat, sedangkan `__tebal__` cukup aman.
 */
const INLINE: { re: RegExp; style: RichStyle }[] = [
  { re: /\*\*\*([^*]+?)\*\*\*/, style: { bold: true, italic: true } },
  { re: /\*\*([\s\S]+?)\*\*/, style: { bold: true } },
  { re: /__([\s\S]+?)__/, style: { bold: true } },
  { re: /~~([\s\S]+?)~~/, style: { strike: true } },
  { re: /`([^`\n]+?)`/, style: { code: true } },
  { re: /\*([^*\n]+?)\*/, style: { italic: true } },
];

/** Menandai bagian bergaya di dalam satu baris, termasuk yang bersarang. */
function parseInline(input: string, inherited: RichStyle, out: RichSegment[]): void {
  let best: { index: number; length: number; inner: string; style: RichStyle } | null = null;

  for (const { re, style } of INLINE) {
    const match = re.exec(input);
    // Yang paling kiri menang; kalau seri, yang lebih dulu di daftar — itulah
    // sebabnya penanda yang lebih panjang ditaruh di atas.
    if (match && (!best || match.index < best.index)) {
      best = { index: match.index, length: match[0].length, inner: match[1], style };
    }
  }

  if (!best) {
    if (input) out.push({ ...inherited, text: input });
    return;
  }

  if (best.index > 0) out.push({ ...inherited, text: input.slice(0, best.index) });

  const merged = { ...inherited, ...best.style };
  // Isi kode dibiarkan apa adanya: bintang di dalamnya memang harus terlihat.
  if (merged.code) out.push({ ...merged, text: best.inner });
  else parseInline(best.inner, merged, out);

  parseInline(input.slice(best.index + best.length), inherited, out);
}

/**
 * Mengubah teks balasan model menjadi baris-baris bergaya.
 *
 * Cakupannya sengaja hanya penanda yang benar-benar muncul di percakapan: tebal,
 * miring, coret, kode sebaris, butir daftar, dan heading. Blok kode, tabel, dan
 * tautan dibiarkan apa adanya supaya gelembung pesan tetap ringkas.
 */
export function parseRich(input: string): RichLine[] {
  return input.split('\n').map((raw) => {
    let line = raw;
    let bullet = false;
    let base: RichStyle = {};

    // Butir daftar. `\s+` setelah penanda mencegah `*miring*` ikut terbaca sebagai butir.
    const bulletMark = /^\s*[-*•]\s+/.exec(line);
    if (bulletMark) {
      bullet = true;
      line = line.slice(bulletMark[0].length);
    }

    // Heading tidak punya ukuran sendiri di gelembung pesan — cukup ditebalkan.
    const headingMark = /^\s*#{1,6}\s+/.exec(line);
    if (headingMark) {
      line = line.slice(headingMark[0].length);
      base = { bold: true };
    }

    const segments: RichSegment[] = [];
    parseInline(line, base, segments);
    return { bullet, segments };
  });
}

/** Ada sesuatu yang perlu digambar bergaya, atau teksnya polos saja? */
export function hasRichMarkup(input: string): boolean {
  return /(\*\*|__|~~|`|\*[^*\n]+\*)/.test(input) || /^\s*([-*•]\s+|#{1,6}\s+)/m.test(input);
}
