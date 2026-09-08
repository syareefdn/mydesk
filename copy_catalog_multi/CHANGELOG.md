# Changelog

## 1.0.2 — 2026-09-08

- Perbaikan: pola loader agar kebal bug pemindai plugin SLiMS 9.3.x (9.3.x
  hanya memindai 2 folder pertama di `plugins/`). Berkas
  `copy_catalog_multi.plugin.php` kini diletakkan langsung di `plugins/`,
  folder `copy_catalog_multi/` tidak lagi berisi berkas `.plugin.php`.
- Cara upgrade dari 1.0.x: hapus folder lama, salin folder baru + berkas
  loader, lalu aktifkan ulang di System → Plugin.
- `cek_instalasi.php` kini memeriksa berkas loader dan mendeteksi sisa
  instalasi lama.

## 1.0.1 — 2026-09-08

- Perbaikan: tab Pengaturan & Bantuan tidak lagi dicegat AJAX bawaan admin
  (tambah kelas `notAJAX` pada tab dan tautan judul hasil).

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
