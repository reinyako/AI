# Pesan — Chat AI dengan UI ala iMessage

Platform chat ke AI (Claude) yang tampilannya dibuat semirip mungkin dengan **iMessage di iPhone**:
gelembung biru–abu dengan ekor, indikator "sedang mengetik", transisi push ala iOS, dark mode,
dan bisa dipasang ke Home Screen sebagai PWA (tampil full-screen tanpa address bar).

<p align="center">
  <img src="docs/screenshot-list.png" width="260" alt="Daftar percakapan" />
  <img src="docs/screenshot-chat.png" width="260" alt="Percakapan" />
</p>

## Fitur

- **UI iMessage**: gelembung dengan ekor, pengelompokan pesan, penanda waktu (`Hari ini 14.42`),
  label "Terkirim", tapback ❤️ (ketuk dua kali gelembung), dan animasi pop saat pesan muncul.
- **Streaming**: balasan muncul huruf per huruf lewat SSE, lengkap dengan indikator titik-titik.
- **Banyak "kontak" AI**: tiap percakapan punya nama, warna avatar, dan karakter (system prompt) sendiri.
- **Riwayat tersimpan** di `localStorage` perangkat — tidak ada database, tidak ada data yang menumpuk di server.
- **Siap iPhone**: `viewport-fit=cover` + safe area, tidak zoom saat mengetik, dark mode otomatis,
  penyesuaian saat keyboard muncul, ikon Home Screen.
- **API key aman di server**: browser tidak pernah menyentuh key; semua permintaan lewat `/api/chat`.

## Menjalankan

```bash
npm install
cp .env.example .env      # lalu isi ANTHROPIC_API_KEY
npm start                 # http://localhost:3000
```

Ambil API key di <https://console.anthropic.com/settings/keys>.

### Membuka dari iPhone

1. Pastikan iPhone dan komputer berada di Wi-Fi yang sama.
2. Cari IP komputer (`ipconfig getifaddr en0` di macOS, `hostname -I` di Linux).
3. Buka `http://<ip-komputer>:3000` di Safari.
4. Tekan tombol **Share → Add to Home Screen** supaya jalan full-screen seperti aplikasi asli.

Untuk akses dari luar jaringan lokal, deploy ke host Node mana pun (Railway, Fly.io, Render, VPS)
lalu set environment variable `ANTHROPIC_API_KEY`.

## Konfigurasi

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Wajib. Tanpa ini `/api/chat` menolak permintaan. |
| `PORT` | `3000` | Port server. |
| `MODEL` | `claude-opus-5` | Model yang dipakai. |

## Struktur

```
server.js              Server HTTP (static + proxy streaming ke Claude)
public/index.html      Kerangka dua layar: daftar pesan & percakapan
public/styles.css      Seluruh tampilan iMessage (gelembung, ekor, nav, composer)
public/app.js          State, penyimpanan lokal, render thread, streaming SSE
scripts/make-icons.mjs Generator ikon PNG aplikasi (tanpa dependensi)
```

## Catatan teknis

- Endpoint `POST /api/chat` menerima `{ persona, messages: [{role, content}] }` dan membalas
  `text/event-stream` berisi event `thinking`, `text`, `error`, dan `done`.
- Riwayat dibersihkan di server: dibatasi 200 pesan terakhir, hanya teks, peran diselang-seling,
  dan harus diakhiri pesan pengguna.
- System prompt di-*cache* (`cache_control: ephemeral`) supaya percakapan panjang lebih murah.
- Adaptive thinking aktif dengan ringkasan yang ditampilkan sebagai teks kecil selagi AI berpikir.
- `fallbacks: "default"` dinyalakan, jadi kalau satu model menolak permintaan, permintaan yang sama
  otomatis dijalankan ulang di model cadangan dalam satu panggilan.
