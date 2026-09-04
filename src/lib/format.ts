export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const sameDay = (a: number, b: number) => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.toDateString() === d2.toDateString();
};

const DAY = 86_400_000;

/** Waktu ringkas untuk daftar percakapan: jam, "Kemarin", nama hari, atau tanggal. */
export function listTime(ts: number): string {
  const now = Date.now();
  if (sameDay(now, ts)) return clock(ts);
  if (sameDay(now - DAY, ts)) return 'Kemarin';
  if (now - ts < 7 * DAY) return new Date(ts).toLocaleDateString('id-ID', { weekday: 'long' });
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Penanda waktu di tengah thread, mis. "Hari ini 14.42". */
export function dayMark(ts: number): { strong: string; rest: string } {
  const now = Date.now();
  if (sameDay(now, ts)) return { strong: 'Hari ini', rest: clock(ts) };
  if (sameDay(now - DAY, ts)) return { strong: 'Kemarin', rest: clock(ts) };
  const date = new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  return { strong: date, rest: clock(ts) };
}

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('');
  return letters.toUpperCase() || '?';
}
