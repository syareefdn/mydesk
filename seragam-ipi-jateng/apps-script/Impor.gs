/**
 * ============================================================================
 *  IMPOR DAFTAR NAMA  —  dari PDF / teks hasil copy-paste ke sheet DaftarNama
 * ============================================================================
 *  Cara tercepat: buka PDF di browser → Ctrl/Cmd+A pada halaman daftar nama →
 *  Ctrl/Cmd+C → jalankan menu "Seragam IPI ▸ 5. Impor nama dari teks…" →
 *  tempel (Ctrl/Cmd+V) → OK. Angka nomor & header halaman dibersihkan otomatis.
 *
 *  Alternatif: imporNamaDariPdf('URL/file-Id-PDF-di-Drive')
 *  (butuh Services ▸ Drive API diaktifkan agar PDF bisa dikonversi ke Google Doc).
 * ============================================================================
 */

/** Menu spreadsheet: kotak tempel teks. */
function menuImporNamaDariTeks() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(
    'Impor daftar nama dari PDF',
    'Tempel teks daftar nama hasil copy dari PDF. Baris pertama opsional (header).\n' +
    'Format yang dikenali: "1. Nama Lengkap", "02) Nama — Semarang", "Nama | Kab. | WhatsApp".',
    ui.PromptType.TEXT
  );
  var teks = r.getResponseText();
  if (!teks || teks.length < 3) { ui.alert('Tidak ada teks yang ditempel.'); return; }
  var hasil = imporNamaDariTeks(teks);
  ui.alert('Impor selesai: ' + hasil.tersimpan + ' nama tersimpan.' +
    (hasil.dilewati ? '\n' + hasil.dilewati + ' baris dilewati (lihat LogAktivitas).' : '') +
    '\n\nContoh 5 nama pertama:\n' + hasil.contoh.join('\n'));
}

/**
 * Parse teks kasar menjadi baris DaftarNama lalu menulisnya ke sheet.
 * @param {string} teks
 * @param {Object} [opsi] {ganti:boolean, pisahkanWilayah:boolean}
 * @return {tersimpan, dilewati, contoh, dilewatiDetail[]}
 */
function imporNamaDariTeks(teks, opsi) {
  opsi = opsi || {};
  var ganti = opsi.ganti !== false;
  var pisah = opsi.pisahkanWilayah !== false;

  var mentah = String(teks).replace(/\u00a0/g, ' ').split(/[\r\n]+/);
  var baris = [], lewati = [], lihat = {};

  for (var i = 0; i < mentah.length; i++) {
    var s = mentah[i].replace(/\s+/g, ' ').trim();
    if (!s) continue;

    // buang elemen navegasi PDF
    if (/^(hal(aman)?|page|dari|of)\b/i.test(s)) { lewati.push(s); continue; }
    if (/^[\d\s.\-–—_=*'"]+$/.test(s)) { lewati.push(s); continue; }          // nomor halaman / titik-titik
    if (/^(no\.?|nama|nama lengkap|nama anggota|kabupaten|kota)$/i.test(s)) { lewati.push(s); continue; }
    if (/^(daftar|rekap|list)\b/i.test(s) && s.split(' ').length <= 5) { lewati.push(s); continue; }
    var kata = s.toLowerCase().split(' ');
    var kepala = 0;
    ['no', 'nama', 'kabupaten', 'kota', 'jabatan', 'whatsapp', 'wa', 'email', 'alamat', 'ukuran'].forEach(function (h) {
      if (kata.indexOf(h) >= 0) kepala++;
    });
    if (kepala >= 2) { lewati.push(s); continue; }                     // baris header tabel
    if (/ikatan pustakawan|jawa tengah|provinsi|sekretariat|alamat|telp|phone|email@/i.test(s) &&
        s.split(' ').length <= 3) { lewati.push(s); continue; }                 // footer singkat

    // buang penomoran di awal: "1." "01)" "No 7 -"
    s = s.replace(/^(no\.?\s*)?\d{1,3}\s*[.)\-–—:]\s*/i, '').replace(/^[.)\-–—]\s*/, '').trim();

    var wilayah = '', wa = '', email = '', jabatan = '', nama = s;

    // pola terpisahn pemisah: "Nama | Kab | 08xx" atau "Nama - Kab"
    if (/[|;\t]/.test(s) || (pisah && /\s+[—–-]\s+/.test(s))) {
      var bagian = s.split(/\s*[|;\t]\s*|\s+[—–]\s+|\s+-\s+(?=[A-Z])/);
      nama = String(bagian[0] || '').trim();
      if (bagian[1]) wilayah = String(bagian[1]).replace(/^(kab\.?|kota\.?)\s*/i, '').trim();
      for (var k = 2; k < bagian.length; k++) {
        var b = String(bagian[k]).trim();
        if (!b) continue;
        if (/^[\d+()\-.\s]{8,}$/.test(b)) wa = b;
        else if (/@/.test(b)) email = b;
        else if (!jabatan && b.split(' ').length <= 6) jabatan = b;
      }
    }
    // buang sisa nomor halaman yang menempel di akhir ("Siti 12")
    nama = nama.replace(/\s+\d{1,3}$/, '').replace(/[.,;:]+$/, '').trim();
    // huruf pertama kapital rapi
    nama = nama.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });

    if (nama.length < 3 || !/[a-z]/i.test(nama)) { lewati.push(s); continue; }
    var key = nameKey_(nama);
    if (lihat[key]) { continue; }                     // duplikat dalam teks yang sama
    lihat[key] = true;
    baris.push([0, nama, wilayah, jabatan, wa, email, '']);
  }

  baris.forEach(function (r, i) { r[0] = i + 1; });
  if (!baris.length) throw new Error('Tidak ada nama yang terbaca. Tempel teks yang berisi daftar nama, bukan judul halaman.');

  var sh = getSheet_(CONFIG.SHEET.NAMA, true);
  sh.getRange(1, 1, 1, CONFIG.HEADERS_NAMA.length).setValues([CONFIG.HEADERS_NAMA]);
  if (ganti && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  sh.getRange(sh.getLastRow() + 1, 1, baris.length, CONFIG.HEADERS_NAMA.length).setValues(baris);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, CONFIG.HEADERS_NAMA.length);
  log_('impor-nama', 'tersimpan=' + baris.length + '; dilewati=' + lewati.length +
    '; daftar: ' + lewati.slice(0, 40).join(' / '));

  return {
    ok: true,
    tersimpan: baris.length,
    dilewati: lewati.length,
    contoh: baris.slice(0, 5).map(function (r) { return r[0] + '. ' + r[1] + (r[2] ? ' — ' + r[2] : ''); }),
    dilewatiDetail: lewati
  };
}

/**
 * Baca PDF dari Drive → konversi ke Google Doc → ambil teksnya → impor.
 * Butuh: Services (ikon +) ▸ "Drive API" diaktifkan.
 * @param {string} urlAtauId URL file PDF di Google Drive atau file ID-nya.
 */
function imporNamaDariPdf(urlAtauId, opsiHalaman) {
  var id = String(urlAtauId).match(/[-\w]{25,}/);
  if (!id) throw new Error('URL/ID PDF tidak dikenali.');
  var opsi = {
    mimeType: 'application/vnd.google-apps.document',
    name: 'Ekstrak Daftar Nama Seragam'
  };
  var docFile;
  try {
    docFile = Drive.Files.copy(opsi, id[0]);
  } catch (e) {
    throw new Error('Gagal mengonversi PDF (aktifkan Services ▸ Drive API terlebih dahulu).' +
      '\nAlternatif: copy teks dari PDF lalu jalankan menu "Impor nama dari teks". Detail: ' + e.message);
  }
  var doc = DocumentApp.openById(docFile.getId());
  var teks = doc.getBody().getText();
  var hasil = imporNamaDariTeks(teks, opsiHalaman);
  try { DriveApp.getFileById(docFile.getId()).setTrashed(true); } catch (e2) {}
  try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (e3) {}
  uiAlert_('Ekstrak PDF selesai: ' + hasil.tersimpan + ' nama masuk ke ' + CONFIG.SHEET.NAMA + '.');
  return hasil;
}

/** Periksa kualitas daftar nama: terlalu pendek, duplikat, karakter aneh. */
function periksaDaftarNama() {
  var d = getDaftarNama(), laporan = [];
  var lihat = {};
  d.forEach(function (x) {
    if (x.nama.split(' ').length < 2) laporan.push('Nama satu kata: ' + x.nama + ' (baris ' + x.row + ')');
    if (x.nama.length < 5) laporan.push('Nama terlalu pendek: ' + x.nama + ' (baris ' + x.row + ')');
    if (lihat[x.namaKey]) laporan.push('Duplikat: ' + x.nama + ' (baris ' + x.row + ')');
    lihat[x.namaKey] = true;
    if (!x.wa) laporan.push('Tanpa WhatsApp: ' + x.nama + ' (baris ' + x.row + ')');
  });
  var hasil = { jumlah: d.length, temuan: laporan.length, laporan: laporan.slice(0, 60) };
  uiAlert_('Total ' + d.length + ' nama. Temuan: ' + laporan.length +
    (laporan.length ? '\n' + hasil.laporan.slice(0, 15).join('\n') + (laporan.length > 15 ? '\n…' : '') : '\nSemua rapi.'));
  return hasil;
}
