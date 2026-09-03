/**
 * ============================================================================
 *  KONFIGURASI UTAMA  —  cukup edit di file ini
 *  Form Pendataan Ukuran Seragam — Ikatan Pustakawan Indonesia (IPI) Jawa Tengah
 * ============================================================================
 */

/**
 * ID Spreadsheet. Diambil dari URL:
 *   https://docs.google.com/spreadsheets/d/【ID_INI】/edit
 * Kosongkan ('') bila skrip dibuat dari dalam spreadsheet
 * (menu Ekstensi → Apps Script), karena otomatis memakai spreadsheet aktif.
 */
var SPREADSHEET_ID = '';

var CONFIG = {
  /* ---------- Identitas ---------- */
  ORGANISASI: 'Ikatan Pustakawan Indonesia (IPI) Jawa Tengah',
  KEGIATAN: 'Pendataan Ukuran Seragam Organisasi',
  PERIODE: 'Tahun 2026',
  BATAS_ISI: '2026-09-20T23:59:00+07:00',   // dipakai untuk menampilkan tenggat
  PIC: 'Seksi Organisasi & Keanggotaan IPI Jateng — wa.me/628xxxxxxxxxxx',
  TIMEZONE: 'Asia/Jakarta',

  /**
   * Logo/banner (opsional). Isi URL gambar yang boleh di-embed, atau '' untuk
   * menampilkan lencana teks. Jangan pakai URL yang butuh login.
   */
  LOGO_URL: '',

  /* ---------- Nama sheet ---------- */
  SHEET: {
    NAMA: 'DaftarNama',      // sumber dropdown nama (tempel dari PDF)
    DATA: 'DataSeragam',     // hasil isian form
    SIZE: 'SizeChart',       // tabel ukuran → dipakai untuk rekomendasi
    SET: 'Settings',         // pengaturan yang bisa diubah dari halaman admin
    LOG: 'LogAktivitas'      // jejak audit (siapa mengisi/mengubah)
  },

  /* ---------- Keamanan halaman admin ---------- */
  // Ganti dengan string acak sendiri. Admin dibuka lewat:
  //   .../exec?view=admin&token=ADMIN_TOKEN
  ADMIN_TOKEN: 'IPI-JATENG-SERAGAM-2026',

  /* ---------- Email ---------- */
  EMAIL_PANITIA: [],                 // mis. ['seragam@ipijateng.or.id']
  KIRIM_SALINAN_KE_PENGISI: true,    // kirim konfirmasi ke No./email pengisi
  DARI_EMAIL: '',                    // '' = Gmail default pengirim

  /* ---------- Perilaku form ---------- */
  BOLEH_UBAH_JAWABAN: true,   // pengisi boleh merevisi jawabannya sendiri
  WAJIB_LIST_NAMA: true,      // true: hanya nama di DaftarNama yang boleh mengirim
                              // false: nama di luar daftar boleh masuk (ditandai)
  KEY_PRESENSI: false,        // true: wajib cocok dengan kolom Email/Key di DaftarNama
  TUTUP_FORM: false,          // bisa diubah tanpa deploy lewat sheet Settings
  PAKAI_GOOGLE_FORM: false,   // true: alur Google Form (lihat CreateForm.gs)

  /* ---------- Pilihan jawaban ---------- */
  MODEL_BAJU: ['Lengan Panjang', 'Lengan Pendek', 'Lengan Panjang + Pendek (2 set)'],
  UKURAN: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', 'Ukuran Khusus (Custom)'],
  JENIS_KELAMIN: ['Laki-laki', 'Perempuan'],
  BORDIR: ['Ya, bordir nama + logo IPI', 'Ya, logo IPI saja', 'Tanpa bordir'],
  STATUS: ['Terkirim', 'Diverifikasi', 'Perlu Konfirmasi', 'Sudah Diproduksi'],

  /**
   * Kolom DataSeragam. Urutan = urutan di sheet. Jangan menghapus kolom lama
   * tanpa menyesuaikan fungsi; menambah kolom di bagian akhir lebih aman.
   */
  HEADERS: [
    'Timestamp', 'Email', 'Nama', 'Kabupaten/Kota', 'Jabatan',
    'Jenis Kelamin', 'Model Baju', 'Ukuran', 'Ukuran Cadangan',
    'Lingkar Dada (cm)', 'Lingkar Pinggang (cm)', 'Tinggi Badan (cm)',
    'Berat Badan (kg)', 'Ukuran Celana/Rok', 'Ukuran Sepatu (cm/no)',
    'Bordir', 'Nama untuk Bordir', 'No. WhatsApp', 'Alamat Pengiriman',
    'Rekomendasi Sistem', 'Catatan', 'Status', 'Petugas', 'Sumber'
  ],

  /** Kolom DaftarNama. Baris pertama = header. */
  HEADERS_NAMA: [
    'No', 'Nama', 'Kabupaten/Kota', 'Jabatan', 'No. WhatsApp', 'Email', 'Catatan'
  ]
};

/** Tabel ukuran cadangan — otomatis ditimpa bila sheet SizeChart sudah diisi.
 *  ⚠️ GANTI dengan size chart dari PDF Anda (satuan: cm, lingkar dada = keliling). */
var DEFAULT_SIZE_CHART = [
  //  Ukuran, LD min, LD max, PB min, PB max, Bahu, BB min, BB max
  { ukuran: 'XS',   dada: [84, 90],   panjang: [62, 65], bahu: 40, bb: [40, 48] },
  { ukuran: 'S',    dada: [90, 96],   panjang: [65, 68], bahu: 42, bb: [48, 57] },
  { ukuran: 'M',    dada: [96, 102],  panjang: [68, 71], bahu: 44, bb: [57, 66] },
  { ukuran: 'L',    dada: [102, 108], panjang: [71, 73], bahu: 46, bb: [66, 76] },
  { ukuran: 'XL',   dada: [108, 114], panjang: [73, 75], bahu: 48, bb: [76, 86] },
  { ukuran: 'XXL',  dada: [114, 122], panjang: [75, 77], bahu: 50, bb: [86, 96] },
  { ukuran: 'XXXL', dada: [122, 130], panjang: [77, 79], bahu: 52, bb: [96, 106] },
  { ukuran: '4XL',  dada: [130, 138], panjang: [79, 81], bahu: 54, bb: [106, 116] }
];
