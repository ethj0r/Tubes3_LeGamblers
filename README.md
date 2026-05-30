# Judol Detector

Chromium browser extension untuk mendeteksi konten judi online (judol) pada halaman web menggunakan string matching. 

> built for Tugas Besar 3 IF2211 Strategi Algoritma.

## Algorithms

### Knuth-Morris-Pratt (KMP)

Pencocokan string yang memanfaatkan informasi kecocokan parsial sehingga pointer teks tidak perlu mundur saat mismatch. Memakai *border function* (failure function) untuk menentukan seberapa jauh pola digeser. Kompleksitas pencarian `O(n + m)` untuk teks berukuran `n` dan pola berukuran `m`, ditambah preprocessing `O(m)`.

### Boyer-Moore (BM)

Pencocokan string yang membandingkan karakter pola dari kanan ke kiri sementara pola tetap maju ke kanan pada teks. Memakai heuristik *bad character* lewat *last occurrence table*, sehingga pola bisa melompat banyak karakter sekaligus saat mismatch. Kasus terbaik `O(n / m)`, worst case `O(n * m)`.

## Requirement

- Node.js >= 20
- pnpm >= 9
- Browser berbasis Chromium (Chrome, Edge, Brave)

## How to Install

```bash
git clone https://github.com/ethj0r/Tubes3_LeGamblers.git
cd Tubes3_LeGamblers
pnpm install
```

## Build & Load Extension

1. Build production bundle:

   ```bash
   pnpm build
   ```

   Output dihasilkan di folder `dist/`.

2. Buka `chrome://extensions` di browser.

3. Aktifkan **Developer mode** (toggle kanan atas).

4. Klik **Load unpacked**, pilih folder `dist/`.

5. Ekstensi aktif. Buka halaman web target, pemindaian berjalan otomatis.

## Authors

| Nama | NIM |
| --- | --- |
| Made Branenda Jordhy | 13524026 |
| Stefani Angeline Oroh | 13524064 |
| Michael James Liman | 13524106 |
