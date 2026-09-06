/** Tinggi satu petak emoji di baris tapback. */
export const SLOT = 34;
const BAR_PAD = 7;
/** Tinggi baris tapback seluruhnya. */
export const BAR_HEIGHT = SLOT + BAR_PAD * 2;
/** Tinggi satu baris aksi di kartu menu. */
export const ROW_HEIGHT = 46;
/** Jarak antara baris tapback, gelembung, dan kartu menu. */
export const GAP = 10;
/** Jarak paling sedikit ke tepi layar yang aman. */
export const MARGIN = 12;
/** Sisa ruang paling sedikit yang tetap disediakan untuk gelembungnya. */
export const MIN_BUBBLE = 56;

export type MenuLayout = {
  /** Letak atas gelembung yang diangkat, dalam koordinat layar. */
  bubbleTop: number;
  /** Tinggi gelembung setelah dipangkas seperlunya. */
  bubbleHeight: number;
  /** Letak atas baris tapback. */
  barTop: number;
  /** Letak atas kartu aksi. */
  cardTop: number;
};

type Input = {
  /** Letak dan tinggi gelembung aslinya di layar. */
  frameTop: number;
  frameHeight: number;
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  menuHeight: number;
};

/**
 * Menghitung letak ketiga bagian menu tekan-tahan.
 *
 * Gelembungnya diusahakan tetap di tempat asalnya supaya tidak terasa melompat saat
 * menu terbuka. Kalau baris tapback di atasnya atau kartu aksi di bawahnya jadi
 * keluar layar, posisinya digeser seperlunya. Kalau ketiganya tetap tidak muat —
 * pesan model bisa sangat panjang — yang dipangkas adalah tinggi gelembungnya,
 * bukan tapback atau menunya, karena dua itu yang bisa ditekan.
 */
export function layoutMenu({
  frameTop,
  frameHeight,
  screenHeight,
  insetTop,
  insetBottom,
  menuHeight,
}: Input): MenuLayout {
  const top = insetTop + MARGIN;
  const bottom = screenHeight - insetBottom - MARGIN;

  const room = bottom - top - BAR_HEIGHT - GAP * 2 - menuHeight;
  const bubbleHeight = Math.min(frameHeight, Math.max(MIN_BUBBLE, room));

  // Batas terendah dihitung dari ruang yang dibutuhkan kartu menu, batas tertinggi
  // dari ruang yang dibutuhkan baris tapback. Karena tinggi gelembung sudah dipangkas
  // ke `room` di atas, kedua batas ini tidak pernah saling menyilang selama layarnya
  // masih cukup untuk tapback + menu + gelembung sependek MIN_BUBBLE.
  const highest = top + BAR_HEIGHT + GAP;
  const lowest = bottom - menuHeight - GAP - bubbleHeight;
  const bubbleTop = Math.max(highest, Math.min(frameTop, lowest));

  return {
    bubbleTop,
    bubbleHeight,
    barTop: bubbleTop - GAP - BAR_HEIGHT,
    cardTop: bubbleTop + bubbleHeight + GAP,
  };
}
