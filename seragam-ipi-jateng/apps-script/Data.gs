/**
 * ============================================================================
 *  DATA  —  semua baca/tulis spreadsheet ada di sini
 * ============================================================================
 */

function getSs_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Ambil sheet by nama; buat + kasih header bila createIfMissing. */
function getSheet_(nama, createIfMissing) {
  var ss = getSs_();
  var sh = ss.getSheetByName(nama);
  if (sh || !createIfMissing) return sh;

  sh = ss.insertSheet(nama);
  if (nama === CONFIG.SHEET.DATA) sh.appendRow(CONFIG.HEADERS);
  else if (nama === CONFIG.SHEET.NAMA) sh.appendRow(CONFIG.HEADERS_NAMA);
  else if (nama === CONFIG.SHEET.SET) sh.appendRow(['Key', 'Value', 'Keterangan']);
  else if (nama === CONFIG.SHEET.LOG) sh.appendRow(['Waktu', 'Aksi', 'Detail', 'Oleh']);
  sh.setFrozenRows(1);
  return sh;
}

/** Baca range menjadi array-of-object dengan kunci = header. */
function bacaSheet_(sh, keys) {
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  var nilai = sh.getRange(2, 1, last - 1, header.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < nilai.length; i++) {
    if (!String(nilai[i][0] === undefined ? '' : nilai[i][0]) &&
        !String(nilai[i][1] || '')) continue;                    // lewati baris kosong
    var o = { _row: i + 2 };
    for (var c = 0; c < header.length; c++) o[header[c]] = nilai[i][c];
    o.__namaKey = nameKey_(o[keys && keys.nama ? keys.nama : 'Nama']);
    out.push(o);
  }
  return out;
}

/* ---------------------------------------------------------------- DAFTAR NAMA */

/**
 * Daftar anggota dari sheet DaftarNama.
 * Menghasilkan: [{row, no, nama, namaKey, wilayah, jabatan, wa, email, catatan}]
 */
function getDaftarNama() {
  var sh = getSheet_(CONFIG.SHEET.NAMA);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var v = sh.getRange(2, 1, last - 1, Math.max(1, sh.getLastColumn())).getDisplayValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i];
    var nama = String(r[1] || r[0] || '').trim();   // kolom B = Nama (fallback kolom A)
    if (!nama) continue;
    if (/^(nama|nama lengkap)$/i.test(nama)) continue;
    out.push({
      row: i + 2,
      no: String(r[0] || (i + 1)),
      nama: nama,
      namaKey: nameKey_(nama),
      wilayah: String(r[2] || '').trim(),
      jabatan: String(r[3] || '').trim(),
      wa: String(r[4] || '').trim(),
      email: String(r[5] || '').trim(),
      catatan: String(r[6] || '').trim()
    });
  }
  return out;
}

/** Peta lookup namaKey → data DaftarNama. */
function getDaftarMap() {
  var m = {};
  getDaftarNama().forEach(function (d) {
    if (!m[d.namaKey]) m[d.namaKey] = d;
  });
  return m;
}

/* ------------------------------------------------------------- DATA SERAGAM */

/** Semua jawaban, urut baris. Menyertakan _row untuk update. */
function getSemuaJawaban() {
  return bacaSheet_(getSheet_(CONFIG.SHEET.DATA), { nama: 'Nama' });
}

function cariJawaban(namaKey) {
  var semua = getSemuaJawaban();
  for (var i = 0; i < semua.length; i++) {
    if (semua[i].__namaKey === namaKey) return semua[i];
  }
  return null;
}

/**
 * Simpan jawaban: insert baru atau update milik nama yang sama.
 * payload = object flat dengan kunci sesuai CONFIG.HEADERS.
 */
function simpanJawaban_(payload, namaKey) {
  var sh = getSheet_(CONFIG.SHEET.DATA, true);
  var h = CONFIG.HEADERS;
  var baris = h.map(function (k) { return payload[k] === undefined ? '' : payload[k]; });

  var lama = cariJawaban(namaKey);
  if (lama && CONFIG.BOLEH_UBAH_JAWABAN) {
    sh.getRange(lama._row, 1, 1, h.length).setValues([baris]);
    return { mode: 'update', row: lama._row, lama: lama };
  }
  sh.appendRow(baris);
  return { mode: 'insert', row: sh.getLastRow(), lama: null };
}

/** Ubah satu kolom (dipakai admin: Status/Petugas). */
function ubahKolom_(row, kolom, nilai) {
  var sh = getSheet_(CONFIG.SHEET.DATA);
  var idx = CONFIG.HEADERS.indexOf(kolom);
  if (idx < 0) throw new Error('Kolom tidak dikenal: ' + kolom);
  sh.getRange(row, idx + 1).setValue(nilai);
}

/* --------------------------------------------------------------- SETTINGS */

var SETTING_KEY = {
  TUTUP_FORM: 'tutup_form',
  CATATAN_ADMIN: 'catatan_form',
  TANGGAL_TUTUP: 'tanggal_tutup'
};

function getSettings() {
  var sh = getSheet_(CONFIG.SHEET.SET, true);
  var out = {};
  var last = sh.getLastRow();
  if (last > 1) {
    var v = sh.getRange(2, 1, last - 1, 2).getDisplayValues();
    for (var i = 0; i < v.length; i++) out[String(v[i][0]).trim()] = v[i][1];
  }
  return out;
}

function setSetting(key, value) {
  var sh = getSheet_(CONFIG.SHEET.SET, true);
  var last = sh.getLastRow();
  var found = 0;
  if (last > 1) {
    var k = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
    for (var i = 0; i < k.length; i++) {
      if (String(k[i][0]).trim() === key) { found = i + 2; break; }
    }
  }
  if (found) sh.getRange(found, 2).setValue(value);
  else sh.appendRow([key, value, 'diubah dari halaman admin']);
  return { ok: true, key: key, value: value };
}

/** Status form: gabungan CONFIG dan override di sheet. */
function formTertutup() {
  var s = getSettings();
  if (s[SETTING_KEY.TUTUP_FORM] !== undefined) {
    return /^(true|ya|1|y)$/i.test(String(s[SETTING_KEY.TUTUP_FORM]).trim());
  }
  return !!CONFIG.TUTUP_FORM || lewatTenggat_();
}
