# Form Data Ukuran Seragam — IPI Jawa Tengah

Aplikasi Google Apps Script untuk mengumpulkan data ukuran seragam anggota
**Ikatan Pustakawan Indonesia (IPI) Jawa Tengah**: nama (dari daftar anggota),
model baju lengan panjang/pendek, ukuran, lingkar dada, TB/BB, bordir,
kontak, dan alamat kirim. Semua jawaban masuk ke satu Google Spreadsheet,
lengkap dengan **rekomendasi ukuran otomatis** dari size chart.

Dua cara pakai, boleh dipilih (atau digabung):

| | Web App (default) | Google Form biasa (`CreateForm.gs`) |
|---|---|---|
| Tampilan | form rapi, ada saran ukuran langsung | tampilan Google Form standar |
| Cegah dobel nama | ✅ (satu nama = satu baris, bisa direvisi) | lewat tombol "ubah respons" |
| Rekap & tutup form | ✅ halaman admin | manual di sheet |
|link pendek untuk grup WA | perlu deploy | ✅ bawaan Google |

---

## 0. Enam hal yang perlu Anda ganti

| Apa | Di mana | Catatan |
|---|---|---|
| `ADMIN_TOKEN` | `Config.gs` | kunci halaman rekap — pakai string acak |
| `EMAIL_PANITIA` | `Config.gs` | isi `['...']`; kosong = notifikasi email mati (data tetap masuk) |
| `BATAS_ISI` & `PIC` | `Config.gs` | tenggat tampil di header; tenggat lewat = form tertutup sendiri |
| Daftar nama anggota | tab `DaftarNama` (atau menu **Seragam IPI ▸ 5**) | masih 6 nama contoh — **ganti dengan daftar dari PDF** |
| Size chart | tab `SizeChart` | masih angka umum S–4XL — **sesuaikan dengan chart konveksi Anda** |
| `HANYA_ATASAN` | `Config.gs` | `true` (default) = hanya baju atasan; `false` = celana/rok jadi wajib |

Sesuai pilihan Anda, kontrol pengisian sudah aktif: **hanya nama di daftar yang bisa mengirim**
(`WAJIB_LIST_NAMA`), **satu nama = satu baris** (kirim ulang = revisi, bukan duplikat),
dan ukuran yang meleset ≥ 2 langkah dari rekomendasi dikonfirmasi dulu sebelum tersimpan.

## 1. Pasang (± 10 menit)

1. Buat Google Spreadsheet baru, nama bebas, mis. **"Data Seragam IPI Jateng 2026"**.
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs`, lalu buat file satu per satu (ikon **+** → *Script*) dan tempel:

   | File | Isi |
   |---|---|
   | `Config.gs` | konfigurasi — **yang perlu Anda ubah** |
   | `Util.gs` | util |
   | `Data.gs` | baca/tulis sheet |
   | `SizeHelper.gs` | size chart + rekomendasi ukuran |
   | `WebApp.gs` | form + API |
   | `Admin.gs` | rekap, export, pengingat |
   | `Setup.gs` | setup sheet + menu |
   | `Impor.gs` | tempel daftar nama dari PDF |
   | `CreateForm.gs` | (opsional) pembuat Google Form |
   | `Index.html` (file **HTML**) | tampilan form — tempel isi `web/Index.html` |

4. Di `Config.gs`, minimal ubah: `ADMIN_TOKEN`, `EMAIL_PANITIA`, `BATAS_ISI`, `PIC`.
   Kalau skrip dibuat **dari dalam** spreadsheet (cara di atas), biarkan `SPREADSHEET_ID = ''`.
5. Jalankan fungsi **`setupSheet`** (pilih di daftar fungsi → ▶ Run) → izinkan akses (*Authorize*).
   Sheet `DaftarNama`, `DataSeragam`, `SizeChart`, `Settings`, `LogAktivitas` dibuat otomatis.
6. Deploy: **Deploy → New deployment → Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (atau "Anyone with Google account" bila ingin merekam email pengisi)
   - Copy **URL `/exec`** → itu yang dibagikan ke anggota.

Selesai: `https://script.google.com/macros/s/…/exec` sudah bisa diisi anggota.
Kalau skrip diubah, klik **Deploy → Manage deployments → ✏️ → New version** agar perubahan aktif.

## 2. Isi daftar nama (dari PDF Anda)

Pilih salah satu:

* **Menu spreadsheet** (setelah `setupSheet`): **Seragam IPI → 5. Impor nama dari teks…**
  lalu tempel hasil *copy* dari PDF. Nomor halaman, "Halaman 2", baris header,
  dan nomor urut (`1.`, `02)`) dibersihkan otomatis; duplikat dihapus.
  Format yang dikenali: `Nama`, `Nama — Kabupaten`, `Nama | Kabupaten | 08xxx`.
* **Konversi PDF otomatis**: `imporNamaDariPdf('https://drive.google.com/file/d/ID/view')`
  (perlu **Services → Drive API** diaktifkan). PDF disalin jadi Google Doc, teksnya dibaca, lalu Doc sementara dihapus.
* **Manual**: tempel langsung ke tab `DaftarNama`, kolom B = Nama, C = Kabupaten/Kota,
  D = Jabatan, E = WhatsApp, F = Email. Template: [`data/daftar-nama-template.csv`](data/daftar-nama-template.csv).

Cek kebersihan daftar: **Seragam IPI → 6. Periksa kebersihan daftar nama**
(nama satu kata, duplikat, tanpa kontak).

## 3. Sesuaikan size chart

Tab **`SizeChart`** dipakai untuk menghitung rekomendasi ukuran dan untuk
menampilkan rentang "dada 102–108 cm" di tiap tombol ukuran. Kolom:

```
Ukuran | Lingkar Dada Min | Lingkar Dada Max | Panjang Badan Min | Panjang Badan Max | Lebar Bahu | BB Min | BB Max | Catatan
```

Template dengan angka sementara (⚠️ **ganti dengan PDF size chart Anda**):
[`data/size-chart-template.csv`](data/size-chart-template.csv). Baris di bawah rentang
terkecil/teratas otomatis diarahkan ke **"Ukuran Khusus (Custom)"**.

## 4. Yang dapat dilihat/dilakukan panitia

Halaman admin: `…/exec?view=admin&token=<ADMIN_TOKEN>`

* kelengkapan (terisi / belum / perlu dikonfirmasi), diagram batang per ukuran & per wilayah;
* tabel jawaban: cari, filter ukuran/status, ubah Status inline, hapus baris;
* tab **"Belum mengisi"** + tombol **Chat WA** berisi link form (surat panggilan otomatis);
* **Unduh CSV** siap kirim ke konveksi (urutan sesuai ukuran, tersimpan juga di Drive folder `Seragam IPI Jateng`);
* **Rekap Google Doc** (tabel rekap per ukuran/wilayah + daftar yang belum mengisi) untuk rapat;
* **tutup/buka form** + pengumuman yang tampil di atas form (tersimpan di tab `Settings`).

Menu spreadsheet menyediakan hal yang sama: **Seragam IPI → 3/4/toggle form**.

## 5. Keamanan & catatan

* Web app "Anyone" tidak memuat data admin tanpa `token`; semua fungsi `apiAdmin*`
  menolak token salah (`cekToken_`). Ganti `ADMIN_TOKEN` dengan string acak.
* Nama harus ada di `DaftarNama` (`WAJIB_LIST_NAMA = true`) → data tidak nyasar.
  Set `false` bila anggota umum boleh mengisi (ditandai `[DI LUAR DAFTAR]` di kolom Catatan).
* Satu nama = satu baris: kirim ulang = **merevisi**, bukan menambah duplikat (`BOLEH_UBAH_JAWABAN`).
* Pengiriman email butuh `EMAIL_PANITIA` diisi dan kuota MailApp harian (kuota Google ~100/hari).
* Log semua aksi ada di tab `LogAktivitas`.

## 6. Uji sendiri (opsional, tanpa internet/Google)

```bash
cd seragam-ipi-jateng
python3 preview/serve.py 8080        # lihat http://localhost:8080/  (dan /?view=admin)
npm i                                # hanya untuk tes: memasang jsdom
npm test                             # 40 tes logika Apps Script + 32 tes tampilan (jsdom)
```

`preview/serve.py` menjalankan `web/Index.html` dalam **mode Mock**: data disimpan di
localStorage browser, jadi Anda bisa mencoba alur lengkap (pilih nama → saran ukuran →
kirim → rekap admin) sebelum menyentuh Google. File `apps-script/*.gs` tidak dipakai di
sini — itu bagian yang berjalan di server Apps Script.

## 7. Struktur

```
seragam-ipi-jateng/
├── apps-script/     9 file .gs + appsscript.json untuk editor Apps Script
├── web/Index.html   tampilan form (dipakai juga sebagai file HTML "Index")
├── preview/serve.py server statis untuk pratinjau lokal
├── tools/           smoke-test.js (logika) & client-test.js (DOM/jsdom)
└── data/            template CSV untuk daftar nama & size chart
```
