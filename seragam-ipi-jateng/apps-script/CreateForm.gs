/**
 * ============================================================================
 *  OPSI B: GOOGLE FORM (bukan web app)
 *  ---------------------------------------------------------------------------
 *  Sebagian panitia lebih suka Google Form biasa (link pendek, bisa dibagikan
 *  ke grup WA, notifikasi bawaan). Skrip ini membuat form-nya otomatis dari
 *  DaftarNama + size chart, lalu menyinkronkan respons ke tab DataSeragam.
 *
 *  Cara pakai:
 *   1. jalankan `buatGoogleForm()` dari editor Apps Script;
 *   2. buka link yang muncul di Logger, bagikan;
 *   3. jalankan `sinkronkanDariForm()` (atau dari trigger onFormSubmit) untuk
 *      memindahkan jawaban ke tab DataSeragam + menghitung rekomendasi.
 *
 *  Untuk otomatis: Extensions → Apps Script → Triggers → onFormSubmit pada
 *  spreadsheet, fungsi `synchronousTrigger_(e)` (lihat di bawah).
 * ============================================================================
 */

var FORM_PROP = 'FORM_ID';
var FORM_SHEET_PROP = 'FORM_SHEET';

function buatGoogleForm() {
  var ss = getSs_();
  var daftar = getDaftarNama();
  if (!daftar.length) throw new Error('Sheet DaftarNama masih kosong. Tempel daftar nama dulu, jalankan setupSheet().');

  var form = FormApp.create(CONFIG.KEGIATAN + ' — ' + CONFIG.ORGANISASI);
  form.setDescription(
    'Mohon isi data dengan teliti. Ukuran mengacu pada size chart IPI Jawa Tengah ' +
    '(lingkar dada dalam cm). Data dapat diubah dengan mengisi ulang form — nama yang sama akan menimpa data lama.'
  );
  form.setCollectEmail(true)
      .setConfirmationMessage('Terima kasih! Data ukuran seragam Anda tercatat.')
      .setAllowResponseEdits(true)
      .setLimitOneResponsePerUser(false);

  // 1. Identitas
  form.addSectionHeaderItem().setTitle('A. Identitas Anggota');
  form.addListItem().setTitle('Nama Lengkap (wajib sama dengan daftar anggota)')
    .setHelpText('Ketik untuk mencari. Nama tidak ditemukan? Hubungi panitia.')
    .setChoiceValues(daftar.map(function (d) { return d.nama; }))
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('Jenis Kelamin')
    .setChoiceValues(CONFIG.JENIS_KELAMIN).setRequired(true);
  form.addTextItem().setTitle('Kabupaten/Kota')
    .setHelpText('Mis. Semarang, Banyumas, Surakarta').setRequired(true);
  form.addTextItem().setTitle('Jabatan di IPI (opsional)').setRequired(false);

  // 2. Model & ukuran
  form.addSectionHeaderItem().setTitle('B. Model & Ukuran Baju');
  form.addCheckboxItem().setTitle('Model Baju yang Dibutuhkan')
    .setChoiceValues(CONFIG.MODEL_BAJU).setRequired(true);

  form.addListItem().setTitle('Ukuran Baju')
    .setHelpText('Bingung? pilih XL bila di antara L dan XXL — seragam organisasi cenderung longgar.')
    .setChoiceValues(CONFIG.UKURAN).setRequired(true);

  form.addListItem().setTitle('Ukuran Cadangan (bila stok habis)')
    .setChoiceValues(CONFIG.UKURAN).setRequired(false);

  [[
    'Lingkar Dada (cm)', 'Ukur melingkar 1 cm di bawah ketiak, saat bernapas normal', 55, 200
  ], [
    'Lingkar Pinggang (cm)', 'Di bagian tersempit pinggang', 45, 200
  ], [
    'Tinggi Badan (cm)', 'Tanpa sepatu', 100, 230
  ], [
    'Berat Badan (kg)', 'Pembulatan 1 kg', 25, 250
  ]].forEach(function (q) {
    var it = form.addTextItem().setTitle(q[0]).setHelpText(q[1]).setRequired(false);
    try {
      it.setValidation(FormApp.createTextValidation().requireNumberBetween(q[2], q[3]));
    } catch (e) { /* versi FormApp lama: lewati validasi angka */ }
  });

  // 3. Pelengkap
  form.addSectionHeaderItem().setTitle('C. Pelengkap & Pengiriman');
  form.addTextItem().setTitle('Ukuran Celana/Rok (no atau cm pinggang)').setRequired(false);
  form.addTextItem().setTitle('Ukuran Sepatu (no. RI / cm)').setRequired(false);
  form.addCheckboxItem().setTitle('Bordir').setChoiceValues(CONFIG.BORDIR).setRequired(false);
  form.addTextItem().setTitle('Nama untuk Bordir (maks. 20 karakter)').setRequired(false);
  form.addTextItem().setTitle('No. WhatsApp (untuk konfirmasi cepat)').setRequired(true);
  form.addParagraphTextItem().setTitle('Alamat Pengiriman (kurir)').setRequired(false);
  form.addParagraphTextItem()
    .setTitle('Catatan lain (mis. potongan longgar, hijab senada, lengan diperpanjang)')
    .setRequired(false);
  form.addCheckboxItem().setTitle('Pernyataan')
    .setChoiceValues(['Data yang saya isi sudah benar dan saya pahami bahwa ukuran di luar size chart dapat menambah biaya/waktu produksi'])
    .setRequired(true);

  // Simpan ke spreadsheet yang sama.
  var sheet = ss.getSheetByName('ResponForm') || ss.insertSheet('ResponForm');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  ss.getSheetByName('Form Responses 1') && ss.getSheetByName('Form Responses 1').setName('ResponForm');

  ss.getSpreadsheetProperties().setDescription(
    'Form: ' + form.getPublishedUrl() + ' | Edit: ' + form.getEditUrl());
  PropertiesService.getDocumentProperties().setProperty(FORM_PROP, form.getId());
  PropertiesService.getDocumentProperties().setProperty(FORM_SHEET_PROP, 'ResponForm');
  log_('buat-form', form.getPublishedUrl());

  var info = 'Google Form dibuat.\nIsi: ' + form.getPublishedUrl() +
    '\nEdit: ' + form.getEditUrl() +
    '\nJalankan sinkronkanDariForm() untuk memindahkan jawaban ke ' + CONFIG.SHEET.DATA + '.';
  uiAlert_(info);
  Logger.log(info);
  return { ok: true, live: form.getPublishedUrl(), edit: form.getEditUrl() };
}

/**
 * Pindahkan jawaban ResponForm → DataSeragam (upsert by nama) dan hitungkan
 * rekomendasi ukuran. Aman dijalankan berulang.
 */
function sinkronkanDariForm() {
  var ss = getSs_();
  var src = ss.getSheetByName('ResponForm') ||
    (FormApp.openById(PropertiesService.getDocumentProperties().getProperty(FORM_PROP))
      .getResponseDestination().getSheet());
  if (!src || src.getLastRow() < 2) return { ok: true, masuk: 0, pesan: 'Belum ada respons di form.' };

  var header = src.getRange(1, 1, 1, src.getLastColumn()).getDisplayValues()[0];
  var val = src.getRange(2, 1, src.getLastRow() - 1, header.length).getDisplayValues();
  var idx = {};
  header.forEach(function (h, i) { idx[String(h).trim()] = i; });

  var petakan = {
    'Timestamp': ['Timestamp'],
    'Email': ['Email address', 'Email'],
    'Nama': ['Nama Lengkap (wajib sama dengan daftar anggota)'],
    'Jenis Kelamin': ['Jenis Kelamin'],
    'Model Baju': ['Model Baju yang Dibutuhkan'],
    'Ukuran': ['Ukuran Baju'],
    'Ukuran Cadangan': ['Ukuran Cadangan (bila stok habis)'],
    'Lingkar Dada (cm)': ['Lingkar Dada (cm)'],
    'Lingkar Pinggang (cm)': ['Lingkar Pinggang (cm)'],
    'Tinggi Badan (cm)': ['Tinggi Badan (cm)'],
    'Berat Badan (kg)': ['Berat Badan (kg)'],
    'Ukuran Celana/Rok': ['Ukuran Celana/Rok (no atau cm pinggang)'],
    'Ukuran Sepatu (cm/no)': ['Ukuran Sepatu (no. RI / cm)'],
    'Bordir': ['Bordir'],
    'Nama untuk Bordir': ['Nama untuk Bordir (maks. 20 karakter)'],
    'No. WhatsApp': ['No. WhatsApp (untuk konfirmasi cepat)'],
    'Alamat Pengiriman': ['Alamat Pengiriman (kurir)'],
    'Catatan': ['Catatan lain (mis. potongan longgar, hijab senada, lengan diperpanjang)']
  };

  var n = 0;
  val.forEach(function (r) {
    var p = {};
    Object.keys(petakan).forEach(function (kunci) {
      petakan[kunci].some(function (namaKolom) {
        if (idx[namaKolom] !== undefined) { p[kunci] = r[idx[namaKolom]]; return true; }
        return false;
      });
    });
    var nama = String(p['Nama'] || '').trim();
    if (!nama) return;
    p['Sumber'] = 'Google Form';
    var sug = rekomendasiUkuran({ dada: p['Lingkar Dada (cm)'], bb: p['Berat Badan (kg)'], tb: p['Tinggi Badan (cm)'] });
    p['Rekomendasi Sistem'] = [sug.ukuran, sug.keyakinan].filter(Boolean).join(' | ');
    p['Status'] = 'Terkirim';
    simpanJawaban_(p, nameKey_(nama));
    n++;
  });

  log_('sinkron-form', n + ' baris');
  var pesan = 'Sinkron selesai: ' + n + ' jawaban dipetakan ke ' + CONFIG.SHEET.DATA + '.';
  uiAlert_(pesan);
  return { ok: true, masuk: n, pesan: pesan };
}

/** Trigger otomatis tiap ada respons Google Form. Daftarkan di Triggers. */
function onFormSubmitSync_(e) {
  try { sinkronkanDariForm(); } catch (err) { log_('sinkron-gagal', err.message); }
}
