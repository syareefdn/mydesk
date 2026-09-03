/**
 * ============================================================================
 *  SETUP  —  jalankan fungsi di file ini sekali saja setelah tempel skrip
 * ============================================================================
 */

/** Menu di Google Spreadsheet (muncul setelah setup). */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Seragam IPI')
      .addItem('1. Siapkan sheet + contoh data', 'setupSheet')
      .addItem('2. Buka Pratinjau & Tautan Web App', 'tampilkanInfo')
      .addItem('3. Rekap ke Google Doc', 'buatRekapDoc')
      .addItem('4. Kirim pengingat yang belum mengisi', 'kirimPengingat')
      .addSeparator()
      .addItem('5. Impor nama dari teks (tempel dari PDF)', 'menuImporNamaDariTeks')
      .addItem('6. Periksa kebersihan daftar nama', 'periksaDaftarNama')
      .addSeparator()
      .addItem('Buka / tutup form', 'toggleForm')
      .addItem('Kosongkan jawaban (nama & size chart tetap aman)', 'kosongkanJawaban')
      .addToUi();
  } catch (e) { /* Web app standalone tanpa UI: abaikan */ }
}

/**
 * Buat semua sheet yang belum ada + isi contoh.
 * Jalankan satu kali dari editor Apps Script (pilih fungsi → Run).
 */
function setupSheet() {
  var ss = getSs_();
  if (!ss) throw new Error('SPREADSHEET_ID kosong dan skrip tidak ter-bound ke spreadsheet.');

  getSheet_(CONFIG.SHEET.DATA, true);
  getSheet_(CONFIG.SHEET.NAMA, true);
  getSheet_(CONFIG.SHEET.SET, true);
  getSheet_(CONFIG.SHEET.LOG, true);

  // SizeChart dengan contoh → silakan timpa dari PDF.
  var size = ss.getSheetByName(CONFIG.SHEET.SIZE) || ss.insertSheet(CONFIG.SHEET.SIZE);
  if (size.getLastRow() < 1) {
    size.getRange(1, 1, 1, 9).setValues([[
      'Ukuran', 'Lingkar Dada Min', 'Lingkar Dada Max', 'Panjang Badan Min',
      'Panjang Badan Max', 'Lebar Bahu', 'BB Min', 'BB Max', 'Catatan'
    ]]);
    size.getRange(2, 1, DEFAULT_SIZE_CHART.length, 8).setValues(
      DEFAULT_SIZE_CHART.map(function (c) {
        return [c.ukuran, c.dada[0], c.dada[1], c.panjang[0], c.panjang[1], c.bahu, c.bb[0], c.bb[1]];
      })
    );
    size.setFrozenRows(1);
  }
  size.getRange(1, 1).setBackground('#1a7f5c').setFontColor('#ffffff');

  // DaftarNama contoh (ganti dengan daftar dari PDF).
  var nama = getSheet_(CONFIG.SHEET.NAMA, true);
  if (nama.getLastRow() < 2) {
    nama.getRange(1, 1, 1, CONFIG.HEADERS_NAMA.length).setValues([CONFIG.HEADERS_NAMA]);
    nama.getRange(2, 1, CONTOH_NAMA.length, CONFIG.HEADERS_NAMA.length).setValues(CONTOH_NAMA);
    nama.setFrozenRows(1);
    nama.autoResizeColumns(1, CONFIG.HEADERS_NAMA.length);
  }

  if (!getSettings()[SETTING_KEY.TANGGAL_TUTUP]) {
    setSetting(SETTING_KEY.TANGGAL_TUTUP, String(CONFIG.BATAS_ISI || ''));
    setSetting(SETTING_KEY.TUTUP_FORM, 'false');
    setSetting(SETTING_KEY.CATATAN_ADMIN,
      'Ukuran di luar size chart (XS–4XL) akan dikoordinasikan terpisah dengan penjahit.');
  }

  uiAlert_('Setup selesai.\n\n1) Sheet sudah siap.\n2) Tempel daftar nama dari PDF ke tab "' +
    CONFIG.SHEET.NAMA + '" (kolom B).\n3) Sesuaikan tab "' + CONFIG.SHEET.SIZE + '" dengan size chart Anda.' +
    '\n4) Deploy web app (langkah ada di README).');
  tampilkanInfo();
}

/** Info tautan + status di sheet Settings, supaya tidak perlu buka editor. */
function tampilkanInfo() {
  var n = getDaftarNama().length;
  var j = getSemuaJawaban().length;
  var url = (getAppUrl_() || '(belum di-deploy)');
  setSetting('url_webapp', url);
  setSetting('url_admin', url ? (url + '?view=admin&token=' + CONFIG.ADMIN_TOKEN) : '');
  setSetting('jumlah_anggota', String(n));
  setSetting('jumlah_terisi', String(j));
  Logger.log('Form: %s\nAdmin: %s?view=admin&token=%s\nAnggota: %d, terisi: %d',
    url, url, CONFIG.ADMIN_TOKEN, n, j);
}

function getAppUrl_() {
  try {
    var m = ScriptApp.getService().getUrl();
    return m || '';
  } catch (e) { return ''; }
}

/** Contoh 6 nama — HAPUS dan ganti dengan daftar dari PDF Anda. */
var CONTOH_NAMA = [
  [1, 'Siti Nurhaliza', 'Semarang', 'Ketua Cabang', '081234567890', '', ''],
  [2, 'Budi Santoso', 'Surakarta', 'Sekretaris', '081234567891', '', ''],
  [3, 'Rina Wulandari', 'Yogyakarta*', 'Bendahara', '081234567892', '', ''],
  [4, 'Agus Priyanto', 'Purwokerto', 'Koordinator Perpustakaan Sekolah', '081234567893', '', ''],
  [5, 'Dewi Lestari', 'Magelang', 'Anggota', '081234567894', '', ''],
  [6, 'Mohammad Fauzan', 'Brebes', 'Anggota', '081234567895', '', '']
];

/** Reset total: hanya jawab tab DataSeragam (daftar nama & size chart aman). */
function kosongkanJawaban() {
  var sh = getSheet_(CONFIG.SHEET.DATA, true);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  log_('reset-jawaban', 'Semua baris jawaban dihapus');
}
