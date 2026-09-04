# Pesan — chatbot AI dengan tampilan iMessage

Aplikasi **React Native (Expo)** untuk iPhone: ngobrol dengan karakter AI, tapi rasanya seperti
chatting dengan orang sungguhan di iMessage. Model dipanggil lewat **OpenRouter** memakai API key
milikmu sendiri — mirip cara orang pakai proxy di Janitor AI.

<p align="center">
  <img src="docs/screenshot-list.png" width="250" alt="Daftar percakapan" />
  <img src="docs/screenshot-chat.png" width="250" alt="Percakapan" />
  <img src="docs/screenshot-settings.png" width="250" alt="Pengaturan" />
</p>

## Fitur

- **Tampilan iMessage** — gelembung biru/abu berekor, pengelompokan pesan, penanda waktu
  (`Hari ini 15.10`), label "Terkirim", indikator titik-titik saat mengetik, dan tapback ❤️
  (ketuk dua kali gelembung).
- **Terasa seperti orang beneran** — instruksi global bikin model membalas pendek dan santai tanpa
  gaya asisten, ditambah "jeda mengetik" acak sebelum balasan muncul.
- **Kontak = karakter** — tiap percakapan punya nama, warna avatar, sapaan pembuka, dan persona
  (system prompt) sendiri.
- **Kontrol generasi** — model, temperature, top-p, panjang balasan, dan seberapa banyak pesan lama
  yang diingat. Bisa diatur global maupun per kontak.
- **Regenerate & edit** — tahan sebuah gelembung untuk menyalin, mengulang balasan, mengedit pesanmu
  lalu kirim ulang, atau menghapus percakapan dari titik itu ke bawah.
- **Pemilih model OpenRouter** — daftar model diambil langsung dari akunmu, lengkap dengan harga per
  1 juta token dan filter "hanya model gratis".
- **Data tersimpan di HP** — riwayat chat di AsyncStorage, API key di penyimpanan aman
  (Keychain lewat `expo-secure-store`). Tidak ada server perantara.
- Dark mode otomatis dan streaming balasan huruf per huruf.

## Menjalankan (laptop Windows + iPhone)

```bash
npm install
npx expo start
```

1. Install **Expo Go** dari App Store di iPhone.
2. Pastikan iPhone dan laptop tersambung ke Wi-Fi yang sama.
3. Scan QR code yang muncul di terminal pakai kamera iPhone → terbuka di Expo Go.
   Kalau Wi-Fi kantor/kampus memblokir koneksi antar-perangkat, jalankan `npx expo start --tunnel`.
4. Di aplikasi, buka **⚙️ Pengaturan** → tempel **API key OpenRouter** (ambil di
   <https://openrouter.ai/keys>).
5. Pilih model lewat **Pengaturan → Model**, lalu mulai chat.

Perintah lain:

```bash
npm run typecheck   # cek TypeScript
npm run web         # pratinjau di browser (untuk cek tampilan cepat)
node scripts/make-icon.mjs   # buat ulang ikon aplikasi
```

## Biaya & API key

Aplikasi ini tidak punya key bawaan — kamu pakai key sendiri, jadi pemakaian dibayar dari kredit
OpenRouter-mu. Beberapa model di OpenRouter gratis; nyalakan filter **"Hanya model gratis"** di layar
pemilih model kalau mau coba-coba tanpa biaya. **Pengaturan → Cek key & kredit** menampilkan sisa
pemakaian key-mu.

Model bawaan diisi `anthropic/claude-3.5-sonnet`. Kalau slug itu sudah tidak ada di OpenRouter,
aplikasi akan memberi tahu ("Model itu tidak ada di OpenRouter") — tinggal pilih model lain dari
daftar.

## Struktur

```
App.tsx                      Navigasi (native stack) + provider
src/api/openrouter.ts        Streaming SSE, daftar model, info kredit
src/store/StoreProvider.tsx  State global, AsyncStorage, SecureStore, prompt global
src/screens/ChatsScreen      Daftar percakapan (large title + search bar iOS)
src/screens/ChatScreen       Thread, streaming, composer, menu aksi pesan
src/screens/ContactScreen    Editor kontak/karakter + kontrol generasi per kontak
src/screens/SettingsScreen   API key, default generasi, instruksi global
src/screens/ModelPickerScreen Daftar model OpenRouter + pencarian
src/components/Bubble.tsx    Gelembung iMessage lengkap dengan ekornya
```

## Catatan teknis

- React Native belum mendukung `fetch` streaming, jadi SSE dibaca lewat `XMLHttpRequest`:
  `responseText` yang terus bertambah dipotong per frame `data:` di `onprogress`
  (lihat `src/api/openrouter.ts`). Baris keep-alive `: OPENROUTER PROCESSING` diabaikan.
- Ekor gelembung dibuat dari dua `View` — satu berwarna gelembung yang menyembul keluar, satu lagi
  berwarna latar untuk melengkungkannya — sehingga tidak perlu SVG.
- Riwayat yang dikirim ke model dipotong sesuai setelan "Ingatan percakapan" biar biaya tidak
  membengkak di percakapan panjang.
- Semua paket yang dipakai tersedia di Expo Go, jadi tidak perlu build native (`expo prebuild`)
  maupun Mac.
