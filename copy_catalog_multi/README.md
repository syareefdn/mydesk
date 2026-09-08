# Copy Catalog SLiMS Multi Server

Plugin untuk **SLiMS 9.3.x (diuji pada 9.3.1)** yang mempermudah input data
bibliografi: cukup **cari sekali**, sistem otomatis mencari ke **banyak
OPAC/katalog SLiMS sekaligus**, lalu cukup **klik judul** untuk pratinjau
atau tombol **Salin** untuk menyalin data bibliografi ke database lokal.

Plugin ini melengkapi **P2P Service** bawaan SLiMS yang hanya bisa mencari ke
*satu* server dalam satu waktu.

## Fitur

- 🔍 **Pencarian paralel multi-server** — satu kata kunci dikirim serentak ke
  semua server SLiMS yang dicentang (via `curl_multi`, ada fallback sekuensial
  bila `php-curl` tidak tersedia).
- 🖱️ **Salin satu klik** — tiap baris hasil memiliki tombol *Salin*; bisa juga
  mencentang banyak record lalu *Salin yang dipilih* (maks. 25 per proses).
- 👁️ **Pratinjau detail** — klik judul untuk melihat data lengkap (pengarang,
  GMD, edisi, ISBN, penerbitan, subjek, catatan, file digital) sebelum menyalin.
- 📚 **Data tersimpan lengkap** — GMD, penerbit, tempat terbit, bahasa,
  pengarang, dan subjek yang belum ada dibuat otomatis; indeks pencarian
  diperbarui; tercatat di log staf.
- 🖼️ **Cover otomatis** — gambar sampul ikut diunduh bila tersedia.
- 📎 **File digital opsional** — saat menyalin satu per satu, file
  digital/attachment dapat dipilih untuk ikut disalin.
- ⚠️ **Peringatan duplikat** — cek ISBN/judul yang sudah ada di database lokal,
  dengan opsi *lewati otomatis bila ISBN sama*.
- 🛰️ **Uji koneksi** — tombol *uji* per server dan *uji semua* untuk memastikan
  `resultXML`/`inXML` aktif di server sumber.
- ➕ **Server kustom** — tambahan server di luar Master File, tersimpan di
  `config.json` plugin (tidak mengotak-atik data inti).
- 🌐 Kompatibel **SLiMS 9.3.0 – 9.3.x** (PHP 7.2+), tanpa `composer`,
  tanpa migrasi database, tanpa dependensi pada pustaka SLiMS versi baru.

## Syarat

| Kebutuhan | Keterangan |
|---|---|
| SLiMS | 9.3.x (dikembangkan & diuji pada **9.3.1**) |
| PHP | 7.2+ (mengikuti syarat SLiMS 9.3) |
| Ekstensi wajib | `SimpleXML`/`php-xml` |
| Ekstensi disarankan | `php-curl` (untuk pencarian paralel yang cepat) |
| Koneksi internet | Server SLiMS harus dapat mengakses OPAC sumber |
| Hak akses | Modul *Bibliography*: baca untuk mencari, tulis untuk menyalin |

Server **sumber** harus berbasis SLiMS dengan fitur XML aktif:

- `https://opac.sumber/index.php?resultXML=true&keywords=...`
- `https://opac.sumber/index.php?p=show_detail&inXML=true&id=...`

## Instalasi

1. Salin folder **`copy_catalog_multi/`** dari repositori ini langsung ke
   folder plugin SLiMS, sehingga strukturnya menjadi:

   ```
   <slims>/plugins/copy_catalog_multi/
   ├── copy_catalog_multi.plugin.php
   ├── index.php
   ├── config.json
   ├── lib/
   │   └── Helper.php
   └── assets/
       ├── app.js
       └── style.css
   ```

   (Berkas `README.md`, `LICENSE`, dan `CHANGELOG.md` di dalam folder hanya
   dokumentasi; SLiMS mengabaikannya.)

   Contoh via terminal di server SLiMS:

   ```bash
   cd /tmp && git clone --depth 1 https://github.com/syareefdn/mydesk
   cp -r mydesk/copy_catalog_multi /var/www/html/slims/plugins/
   chown -R www-data:www-data /var/www/html/slims/plugins/copy_catalog_multi
   chmod 775 /var/www/html/slims/plugins/copy_catalog_multi /var/www/html/slims/plugins/copy_catalog_multi/config.json
   ```

   > `config.json` perlu *writable* agar pengaturan bisa disimpan dari browser.
   > Bila ragu, `chmod 775` (atau `777` bila perlu).

2. Masuk ke SLiMS sebagai admin, buka **System → Plugin**, cari
   **Copy Catalog Multi Server**, lalu **aktifkan** (Enabled).

3. Menu baru muncul di **Bibliografi → Copy Catalog Multi**.

## Menyiapkan server sumber

Ada dua cara (boleh digabung):

**A. Via Master File (disarankan)** — sama seperti P2P bawaan:

1. Buka **Master File → Copy Cataloging Server Configuration → Add New Server**.
2. Isi *Server Name* (mis. `Perpusnas`) dan *URI* basis OPAC
   (mis. `https://opac.contoh.go.id/slims/`).
3. Pilih *Server Type* = **P2P Server**, lalu simpan.

**B. Server kustom** — di tab **Pengaturan** plugin, isi nama + URL lalu
tambah. Cocok untuk server sementara tanpa mengubah Master File.

Gunakan tombol **Uji** pada tiap server. Status *online* berarti URL terjangkau
dan `resultXML` aktif.

## Cara memakai

1. Buka **Bibliografi → Copy Catalog Multi**.
2. Centang server yang ingin dicari (atau *Pilih semua*).
3. Masukkan kata kunci — **ISBN paling akurat** — pilih ruas bila perlu
   (Semua/Judul/Pengarang/ISBN), lalu tekan **Cari ke Semua Server**.
4. Hasil gabungan tampil dalam satu tabel beserta asal servernya:
   - Klik **judul** untuk pratinjau detail (termasuk peringatan duplikat dan
     daftar file digital).
   - Tekan **Salin** untuk menyalin satu record, atau centang beberapa baris
     lalu tekan **Salin yang dipilih**.
   - Gunakan filter *Semua server* untuk menyaring asal, dan
     *Muat hasil berikutnya* untuk halaman selanjutnya.
5. Laporan penyalinan menampilkan status tiap record + tombol **Buka** menuju
   halaman edit bibliografi hasil salinan.

Data hasil salinan ditandai `source = 1.{server_id}` persis seperti P2P
bawaan, sehingga badge asal data tetap tampil di daftar bibliografi.

## Pengaturan

Di tab **Pengaturan**:

| Opsi | Default | Keterangan |
|---|---|---|
| Timeout per server | 12 dtk | Maksimum tunggu tiap server (5–60) |
| Maksimal hasil per server | 10 | Batas record per server per halaman (1–50) |
| Ruas pencarian bawaan | Semua | Pilihan awal dropdown ruas |
| Unduh cover | Ya | Ikut unduh gambar sampul |
| Izinkan unduh file digital | Ya | Tampilkan pilihan file saat salin satu-satu |
| Lewati ISBN duplikat | Ya | Lewati otomatis bila ISBN sudah ada |

Pengaturan tersimpan di `config.json`. Contoh:

```json
{
    "timeout": 12,
    "per_server_limit": 10,
    "download_cover": true,
    "download_digitals": true,
    "skip_duplicate_isbn": true,
    "default_field": "",
    "custom_servers": [
        {"name": "OPAC Contoh", "uri": "https://opac.contoh.id/slims/"}
    ]
}
```

## Struktur kode

| File | Peran |
|---|---|
| `copy_catalog_multi/copy_catalog_multi.plugin.php` | Registrasi menu ke modul Bibliography |
| `copy_catalog_multi/index.php` | UI + endpoint AJAX (`search`, `detail`, `save`, `test`, `save_config`, `add/del_custom_server`) |
| `copy_catalog_multi/lib/Helper.php` | `CCM_Helper`: daftar server, `curl_multi`, parsing MODS XML (+ fallback internal), simpan biblio |
| `copy_catalog_multi/assets/app.js` | Logika frontend (jQuery): pencarian, tabel hasil, modal detail, salin, uji koneksi |
| `copy_catalog_multi/assets/style.css` | Gaya tambahan |
| `copy_catalog_multi/config.json` | Konfigurasi + server kustom (dibuat writable) |

Prinsip kompatibilitas 9.3.1: tidak memakai `SLiMS\Http\Client`, `SLiMS\Url`,
atau `SLiMS\Filesystems\Storage` (pustaka yang berubah antar versi); sebagai
gantinya memakai `curl`/stream bawaan PHP dan pustaka inti SLiMS yang stabil
(`modsxmlsenayan.inc.php`, `biblio_utils.inc.php`, `biblio_indexer.inc.php`).

## Troubleshooting

| Gejala | Penyebab umum & solusi |
|---|---|
| Semua server *offline* | Server SLiMS tidak bisa keluar internet (cek DNS/firewall/`allow_url_fopen`), atau URL basis salah (harus basis instalasi SLiMS, mis. `.../slims/` bukan halaman detail). |
| *Terhubung, tetapi XML tidak valid* | `resultXML`/`inXML` dimatikan di server sumber, atau URL bukan OPAC SLiMS. Buka URL XML manual di browser untuk memastikan. |
| Hasil kosong padahal data ada | Coba ruas *Semua* atau kata kunci lain; sebagian OPAC memakai mesin indeks berbeda. |
| Salin gagal sebagian | Timeout ke server sumber saat ambil detail; ulangi untuk record yang gagal. Perbesar timeout bila perlu. |
| Cover tidak ikut | Nama berkas tidak standar / proteksi hotlink di server sumber. Data teks tetap tersimpan. |
| Pengaturan tidak tersimpan | `config.json` tidak writable — `chmod 775` folder plugin & berkasnya. |
| Menu tidak muncul | Plugin belum di-Enable di **System → Plugin**; pastikan nama folder `copy_catalog_multi` dan `.plugin.php` terbaca (pemindaian maks. 3 tingkat). |
| Tidak bisa menyalin (tombol hilang) | Akun staf tidak punya hak **tulis** modul Bibliography. |

## Batasan yang disengaja

- Salin massal **tidak** mengunduh file digital (agar cepat & tidak timeout);
  file digital hanya diunduh saat menyalin satu per satu lewat modal detail.
- Maksimal 25 record per sekali proses salin massal.
- Hanya mendukung sumber **SLiMS** (protokol XML `resultXML`/`inXML`), bukan
  Z39.50/SRU generik (untuk itu tetap gunakan menu MARC SRU / Z39.50 bawaan).

## Lisensi

GPL-3.0-or-later — mengikuti lisensi SLiMS. Lihat `LICENSE`.
