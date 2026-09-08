# Changelog

## 1.0.0 — 2026-09-08

- Rilis awal untuk SLiMS 9.3.x (diuji pada 9.3.1).
- Pencarian paralel ke banyak server SLiMS sekaligus (curl_multi + fallback).
- Tabel hasil gabungan + filter asal server + muat halaman berikutnya.
- Pratinjau detail via modal (termasuk cek duplikat & daftar file digital).
- Salin satu klik & salin massal (maks. 25/request) dengan laporan hasil.
- Penyimpanan lengkap: GMD/penerbit/tempat/bahasa/pengarang/subjek otomatis,
  unduh cover, unduh file digital opsional, indeks pencarian, log staf.
- Uji koneksi per server, pengaturan (timeout, limit, dsb.), server kustom.
- Kompatibel PHP 7.2+, tanpa composer & tanpa migrasi database.
