/**
 * ============================================================================
 *  UTILITAS  —  normalisasi teks, angka, CSV, waktu, keamanan
 * ============================================================================
 */

/** Buang spasi berlebih, samakan huruf besar/kecil untuk pencocokan nama. */
function norm_(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[’`´]/g, "'");
}

/** Kunci unik per nama, dipakai untuk mencegah duplikat & mencari jawaban lama. */
function nameKey_(nama) {
  return norm_(nama)
    .replace(/[^a-z0-9' ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ambil angka dari input user ("70 kg", " 70,5 " → 70.5). null bila kosong. */
function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function clamp_(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Escape untuk HTML client-side (dipakai render tabel admin). */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Format tanggal Indonesia: 03 Sep 2026 14:05 */
function fmtWaktu_(d) {
  var t = d instanceof Date ? d : new Date(d);
  if (isNaN(t.getTime())) return String(d || '');
  return Utilities.formatDate(t, CONFIG.TIMEZONE, 'dd MMM yyyy HH:mm');
}

function todayStr_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/** Envelope tanggal BATAS_ISI → "20 September 2026" (aman bila format salah). */
function fmtTanggalPanjang_(iso) {
  var bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
             'September','Oktober','November','Desember'];
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return Number(m[3]) + ' ' + bln[Number(m[2]) - 1] + ' ' + m[1];
}

/** Sudah lewat tenggat? */
function lewatTenggat_() {
  var iso = CONFIG.BATAS_ISI;
  if (!iso) return false;
  var t = new Date(iso);
  return !isNaN(t.getTime()) && new Date() > t;
}

/** CSV dengan quote RFC-4180 (titik-koma? tidak: pakai koma + BOM agar rapi di Excel). */
function toCsv_(rows) {
  return rows.map(function (r) {
    return r.map(function (c) {
      var s = String(c == null ? '' : c).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? '"' + s + '"' : s;
    }).join(',');
  }).join('\r\n');
}

/** Taksiran jumlah huruf vokal/konsonan — dipakai untuk nama bordir maksimal. */
function potong_(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Kirim email dengan pengaman: tidak pernah membuat submit gagal karena email. */
function mailBebasGangguan_(to, subjek, html, opts) {
  try {
    if (!to || !to.length) return false;
    var o = opts || {};
    o.from = CONFIG.DARI_EMAIL || undefined;
    MailApp.sendEmail({
      to: to.filter(function (x) { return x && x.indexOf('@') > 0; }).join(','),
      subject: subjek,
      htmlBody: html,
      cc: o.cc || undefined,
      name: o.name || CONFIG.ORGANISASI
    });
    return true;
  } catch (e) {
    log_('email-gagal', 'MailApp: ' + e.message);
    return false;
  }
}

/** Alert hanya bila sedang dijalankan dari UI spreadsheet (aman di web app). */
function uiAlert_(pesan, style) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui) ui.alert(String(pesan), style || ui.ButtonSet.OK);
  } catch (e) { Logger.log(pesan); }
}

/** Tulis ke sheet LogAktivitas (dibuat otomatis bila belum ada). */
function log_(aksi, pesan, email) {
  try {
    var sh = getSheet_(CONFIG.SHEET.LOG, true);
    sh.appendRow([new Date(), aksi, pesan, email || Session.getActiveUser().getEmail() || '-']);
  } catch (e) { /* jangan gagalkan aksi utama karena log */ }
}
