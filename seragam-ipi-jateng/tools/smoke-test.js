#!/usr/bin/env node
/**
 * Smoke test lokal untuk logika Apps Script (TIDAK dijalankan di Google).
 * Meniru sebagian kecil API SpreadsheetApp/Utilities/Session/HtmlService,
 * lalu menjalankan fungsi dari ../apps-script/*.gs.
 *
 *   node seragam-ipi-jateng/tools/smoke-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'apps-script');
const FILES = ['Util.gs', 'Config.gs', 'Data.gs', 'SizeHelper.gs', 'Setup.gs', 'WebApp.gs', 'Admin.gs', 'CreateForm.gs', 'Impor.gs'];

/* ------------------------------------------------------------------ FAKE UI */
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
  appendRow(vals) { this.data.push(vals.map(v => (v === undefined || v === null) ? '' : String(v))); return this; }
  deleteRow(n) { this.data.splice(n - 1, 1); return this; }
  deleteRows(start, count) { this.data.splice(start - 1, count); return this; }
  getRange(row, col, nr, nc) {
    nr = nr || 1; nc = nc || 1;
    const sheet = this;
    const ensure = () => {
      while (sheet.data.length < row + nr - 1) sheet.data.push([]);
      sheet.data.forEach(r => { while (r.length < col + nc - 1) r.push(''); });
    };
    return {
      getValues() { ensure(); return sheet.data.slice(row - 1, row - 1 + nr).map(r => r.slice(col - 1, col - 1 + nc)); },
      getDisplayValues() { return this.getValues(); },
      setValues(v) { ensure(); v.forEach((r, i) => r.forEach((c, j) => { sheet.data[row - 1 + i][col - 1 + j] = (c === null || c === undefined) ? '' : String(c); })); return this; },
      setValue(v) { return this.setValues([[v]]); },
      setBackground() { return this; },
      setFontColor() { return this; }
    };
  }
  setFrozenRows() { return this; }
  autoResizeColumns() { return this; }
}
class FakeSs {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { this.sheets[n] = new FakeSheet(n); return this.sheets[n]; }
  getSpreadsheetProperties() { return { setDescription() {} }; }
  getId() { return 'SS_FAKE'; }
}
const ss = new FakeSs();
const sent = [];

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function formatDate(d, tz, fmt) {
  const p = n => String(n).padStart(2, '0');
  return fmt
    .replace('yyyy', d.getUTCFullYear())
    .replace('MMM', BULAN[d.getUTCMonth()])
    .replace('MM', p(d.getUTCMonth() + 1))
    .replace('dd', p(d.getUTCDate()))
    .replace('HH', p(d.getUTCHours() + 7))
    .replace('mm', p(d.getUTCMinutes()))
    .replace('ss', p(d.getUTCSeconds()));
}

const ctx = {
  console,
  JSON, Math, Date, Number, String, Array, Object, RegExp, isNaN, parseFloat, parseInt,
  Utilities: { formatDate },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    openById: () => ss,
    getUi: () => { throw new Error('no ui'); }
  },
  Session: { getActiveUser: () => ({ getEmail: () => 'panitia@example.com' }) },
  PropertiesService: { getDocumentProperties: () => ({ setProperty() {}, getProperty: () => '' }) },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
  MailApp: { sendEmail: o => sent.push(o) },
  DriveApp: {
    getFoldersByName: () => ({ hasNext: () => true, next: () => ({ getId: () => 'folder' }) }),
    createFileInFolder: (f, n, c, t) => { files.push({ name: n, csv: c }); return { getUrl: () => 'https://drive/' + n }; }
  },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 1 },
    createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: f => f, addMetaTag: f => f, setXFrameOptionsMode: f => f }) })
  },
  DocumentApp: {
    ParagraphHeading: { TITLE: 1, SUBTITLE: 2, HEADING1: 3 },
    create: () => { const b = { appendParagraph: () => ({ setHeading() {} }), appendTable: t => { tables.push(t); }, appendPageBreak: () => {} }; return { getUrl: () => 'https://docs/test', getBody: () => b }; }
  },
  FormApp: { DestinationType: { SPREADSHEET: 1 }, create: () => fakeForm(),
             openById: () => ({ getResponseDestination: () => ({ getSheet: () => null }) }) },
  Logger: { log: (...a) => {} }
};
const files = [], tables = [];
function fakeForm() {
  const buat = () => {
    const chain = () => form;
    const form = {
      addListItem: () => form, addMultipleChoiceItem: () => form, addCheckboxItem: () => form,
      addTextItem: () => form, addParagraphTextItem: () => form, addSectionHeaderItem: () => form,
      setTitle: chain, setHelpText: chain, setChoiceValues: chain, setRequired: chain,
      showOtherOption: chain, setValidation: chain, setDescription: chain, setCollectEmail: chain,
      setConfirmationMessage: chain, setAllowResponseEdits: chain, setLimitOneResponsePerUser: chain,
      setDestination: chain, getPublishedUrl: () => 'https://docs.google.com/forms/d/test/viewform',
      getEditUrl: () => 'https://docs.google.com/forms/d/test/edit', getId: () => 'test'
    };
    return form;
  };
  return buat();
}

vm.createContext(ctx);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext(code, ctx, { filename: 'test' });

/* -------------------------------------------------------------------- TESTS */
let pass = 0, fail = 0;
function t(nama, fn) {
  try { fn(); console.log('  ✓ ' + nama); pass++; }
  catch (e) { console.log('  ✗ ' + nama + '\n      ' + e.message); fail++; }
}
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'nilai') + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'harus benar'); };

console.log('\n== SETUP ==');
t('setupSheet membuat 6 tab', () => {
  run('setupSheet()');
  ok(ss.sheets['DaftarNama'], 'DaftarNama'); ok(ss.sheets['DataSeragam'], 'DataSeragam');
  ok(ss.sheets['SizeChart'], 'SizeChart'); ok(ss.sheets['Settings'], 'Settings');
  eq(ss.sheets['DaftarNama'].getLastRow(), 7, 'baris daftar nama (header + 6)');
});
t('daftar nama terbaca + dinormalisasi', () => {
  const d = run('getDaftarNama()');
  eq(d.length, 6); eq(d[0].nama, 'Siti Nurhaliza'); eq(d[0].wilayah, 'Semarang');
  eq(run('nameKey_("  SITI   nurhaliza ")'), 'siti nurhaliza');
});

console.log('\n== REKOMENDASI UKURAN ==');
t('dada 104 cm → L', () => eq(run('rekomendasiUkuran({dada:104})').ukuran, 'L'));
t('dada 96 cm → M (batas bawah)', () => eq(run('rekomendasiUkuran({dada:96})').ukuran, 'M'));
t('dada 102 + BB 90 → naik ke XL/XXL', () => ok(['XL', 'XXL'].includes(run('rekomendasiUkuran({dada:102, bb:90})').ukuran), 'hasil'));
t('tanpa dada, BB 70 → L', () => eq(run('rekomendasiUkuran({bb:70})').ukuran, 'L'));
t('dada 150 → di luar chart, alternatif custom', () => {
  const r = run('rekomendasiUkuran({dada:150})');
  eq(r.ukuran, '4XL'); eq(r.alternatif, 'Ukuran Khusus (Custom)'); eq(r.keyakinan, 'sedang');
});
t('tanpa pengukuran → keyakinan rendah', () => eq(run('rekomendasiUkuran({})').keyakinan, 'rendah'));

console.log('\n== VALIDASI ==');
t('dada tidak wajar → kesalahan', () => ok(run('validasiJawaban({"Lingkar Dada (cm)":10},{"dada":10})').kesalahan.length > 0));
t('salah pilih ukuran → peringatan', () => {
  const v = run('validasiJawaban({"Ukuran":"S","Lingkar Dada (cm)":120,"No. WhatsApp":"0812345678"},{dada:120})');
  ok(v.peringatan.some(w => /biasanya untuk dada/.test(w)), 'pesan rekomendasi: ' + JSON.stringify(v.peringatan));
});
t('ukuran custom tanpa dada → ditolak', () => {
  const v = run('validasiJawaban({"Ukuran":"Ukuran Khusus (Custom)","No. WhatsApp":"0812345678"},{})');
  ok(v.kesalahan.some(x => /wajib diisi/.test(x)), JSON.stringify(v));
});

console.log('\n== KIRIM JAWABAN ==');
const dasar = {
  'Nama': 'budi   santoso', 'Model Baju': 'Lengan Panjang', 'Ukuran': 'L',
  'Lingkar Dada (cm)': 105, 'Tinggi Badan (cm)': 170, 'Berat Badan (kg)': 70,
  'No. WhatsApp': '081234567891', 'Jenis Kelamin': 'Laki-laki', 'Bordir': 'Ya, logo IPI saja'
};
t('insert baru + ejaan nama dinormalisasi dari daftar', () => {
  const r = run('apiKirim(' + JSON.stringify(dasar) + ')');
  ok(r.ok, r.pesan); eq(r.mode, 'insert'); ok(/Budi Santoso/.test(r.rekap.nama), r.rekap.nama);
  eq(ss.sheets['DataSeragam'].getLastRow(), 2, '1 data + header');
});
t('wilayah & jabatan terisi otomatis dari DaftarNama', () => {
  const rows = run('getSemuaJawaban()');
  eq(rows[0]['Kabupaten/Kota'], 'Surakarta'); eq(rows[0]['Jabatan'], 'Sekretaris');
});
t('kirim ulang nama sama = update, bukan duplikat', () => {
  const r = run('apiKirim(' + JSON.stringify(Object.assign({}, dasar, { 'Ukuran': 'XL' })) + ')');
  eq(r.mode, 'update'); eq(ss.sheets['DataSeragam'].getLastRow(), 2, 'tetap 1 baris');
  eq(run('getSemuaJawaban()')[0]['Ukuran'], 'XL');
});
t('nama di luar daftar ditolak', () => {
  const r = run('apiKirim(' + JSON.stringify(Object.assign({}, dasar, { 'Nama': 'Warga Umum' })) + ')');
  eq(r.ok, false); ok(/tidak ditemukan/i.test(r.pesan), r.pesan);
});
t('selisih 2 ukuran → minta konfirmasi lalu lanjut', () => {
  const p = Object.assign({}, dasar, { 'Nama': 'Dewi Lestari', 'Ukuran': 'S', 'Lingkar Dada (cm)': 118 });
  const r1 = run('apiKirim(' + JSON.stringify(p) + ')');
  eq(r1.ok, false); ok(r1.butuhKonfirmasi, 'harus flag konfirmasi');
  const r2 = run('apiKirim(' + JSON.stringify(Object.assign({}, p, { _bedaTerkonfirmasi: true })) + ')');
  ok(r2.ok, r2.pesan);
});
t('tanpa WA → status Perlu Konfirmasi (bukan ditolak)', () => {
  const p = Object.assign({}, dasar, { 'Nama': 'Rina Wulandari', 'Ukuran': 'M', 'No. WhatsApp': '', 'Lingkar Dada (cm)': '', 'Berat Badan (kg)': '' });
  const r = run('apiKirim(' + JSON.stringify(p) + ')');
  ok(r.ok, r.pesan); eq(r.rekap.status, 'Perlu Konfirmasi');
  ok(r.peringatan.length > 0, 'harus ada peringatan pengukuran');
});
t('email panitia & salinan pengisi terkirim', () => {
  run('CONFIG.EMAIL_PANITIA = ["seragam@ipijateng.or.id"]');
  const r = run('apiKirim(' + JSON.stringify(Object.assign({}, dasar, { Email: 'budi@example.com' })) + ')');
  ok(r.ok, r.pesan);
  ok(sent.length >= 2, 'email terkirim hanya ' + sent.length);
  ok(/Seragam/.test(sent[sent.length - 2].subject), sent[sent.length - 2].subject);
  ok(sent[sent.length - 1].to === 'budi@example.com', sent[sent.length - 1].to);
  ok(/Lingkar dada|Dada/.test(sent[sent.length - 1].htmlBody), 'isi email konfirmasi kurang lengkap');
});
t('rekomendasi sistem tercatat di kolom khusus', () =>
  ok(/L \|/.test(run('getSemuaJawaban()')[0]['Rekomendasi Sistem']), run('getSemuaJawaban()')[0]['Rekomendasi Sistem']));

console.log('\n== ADMIN ==');
t('apiAdminData: statistik & distribusi', () => {
  const d = run('apiAdminData(CONFIG.ADMIN_TOKEN)');
  eq(d.ringkas.total, 3); eq(d.ringkas.anggota, 6); eq(d.ringkas.belum, 3);
  ok(d.distribusi.ukuran['L'] === 1, JSON.stringify(d.distribusi.ukuran));
  eq(Object.keys(d.distribusi.model).length, 1, 'semua pilih Lengan Panjang');
  ok(d.daftarBelum.some(x => x.nama === 'Siti Nurhaliza'), 'Siti belum mengisi');
});
t('token salah ditolak', () => {
  let e = null; try { run('apiAdminData("salah")'); } catch (x) { e = x; }
  ok(e && /Token admin/.test(e.message), 'harus ditolak');
});
t('ubah status per baris', () => {
  const d = run('apiAdminData(CONFIG.ADMIN_TOKEN)');
  run('apiAdminUbah(CONFIG.ADMIN_TOKEN, ' + d.rows[0]._row + ', "Status", \'Diverifikasi\')');
  eq(run('getSemuaJawaban()')[0]['Status'], 'Diverifikasi');
});
t('tutup form → pengiriman baru diblokir', () => {
  run('apiAdminToggleForm(CONFIG.ADMIN_TOKEN, true, "Tenggat habis")');
  const r = run('apiKirim(' + JSON.stringify(Object.assign({}, dasar, { 'Nama': 'Agus Priyanto' })) + ')');
  eq(r.ok, false); ok(/ditutup/i.test(r.pesan), r.pesan);
  run('apiAdminToggleForm(CONFIG.ADMIN_TOKEN, false, "")');
  ok(run('apiKirim(' + JSON.stringify(Object.assign({}, dasar, { 'Nama': 'Agus Priyanto' })) + ')').ok, 'buka lagi');
});
t('CSV penjahit tersimpan & berheader benar', () => {
  const r = run('apiAdminCsv(CONFIG.ADMIN_TOKEN)');
  ok(r.url, 'file csv tidak dibuat'); eq(r.jumlah, 4);
  const baris = files[0].csv.replace(/^\uFEFF/, '').split('\r\n');
  ok(/^Nama,Kabupaten\/Kota,/.test(baris[0]), baris[0]);
  ok(baris.length >= 5, 'jumlah baris csv');
});
t('rekap Doc terbentuk (tabel distribusi)', () => {
  run('buatRekapDoc(CONFIG.ADMIN_TOKEN)');
  ok(tables.length >= 3, 'tabel rekap kurang: ' + tables.length);
  const t0 = tables[0]; eq(t0[0][0], 'Ukuran'); eq(t0[t0.length - 1][0], 'TOTAL');
});
t('pengingat dry-run tidak mengirim email', () => {
  const sebelum = sent.length;
  const r = run('kirimPengingat(false)');
  eq(sent.length, sebelum, 'dry-run malah mengirim email');
  ok(/belum mengisi/.test(r.pesan), r.pesan);
});

console.log('\n== IMPOR DARI PDF/TEKS ==');
const impor = arr => ctx.imporNamaDariTeks([].concat(arr).join('\n'));
const KASUS = ['IKATAN PUSTAKAWAN INDONESIA', 'JAWA TENGAH', 'Daftar Nama Anggota',
  'No\tNama\tKabupaten', '1. Siti Nurhaliza', '02) Budi Santoso \u2014 Surakarta',
  'Rina Wulandari | Banyumas | 081234567892', 'Halaman 2', '1', '....................',
  'Siti Nurhaliza', 'dewi lestari', 'Agus Priyanto - Purwokerto', '   ', 'SITI   NURHALIZA'];
t('teks kotor PDF → 5 nama bersih', () => {
  const h = impor(KASUS);
  eq(h.tersimpan, 5, 'jumlah nama: ' + JSON.stringify(h));
  eq(h.dilewati, 7, 'baris header/nomor halaman yang dibuang');
  const d = run('getDaftarNama()').map(x => x.nama + '/' + x.wilayah);
  eq(d[0], 'Siti Nurhaliza/'); eq(d[1], 'Budi Santoso/Surakarta');
  eq(d[2], 'Rina Wulandari/Banyumas'); eq(d[3], 'Dewi Lestari/');
  eq(d[4], 'Agus Priyanto/Purwokerto');
});
t('nomor urut dibuat ulang 1..n & WA terpisah', () => {
  const r = run('getDaftarNama()');
  eq(r[0].no, '1'); eq(r[4].no, '5');
  eq(r[2].wa, '081234567892'); eq(r[4].wilayah, 'Purwokerto');
});
t('sheet DaftarNama tertimpa (contoh sebelumnya hilang)', () => eq(ss.sheets['DaftarNama'].getLastRow(), 6, 'header + 5'));
t('nama duplikat dalam satu tempelan diabaikan', () => {
  const h = impor(['1. Budi Santoso', '2. Budi  SANTOSO', '3. Orang Baru']);
  eq(h.tersimpan, 2, JSON.stringify(h));
});
t('huruf pertama tiap kata dikapitalkan', () => {
  impor(['siti aminah rahayu']);
  eq(run('getDaftarNama()')[0].nama, 'Siti Aminah Rahayu');
});
t('input tanpa nama → error yang menjelaskan', () => {
  let e = null; try { impor(['Halaman 1', '', '.....']); } catch (x) { e = x; }
  ok(e && /Tidak ada nama/.test(e.message), e && e.message);
});
t('periksaDaftarNama menandai nama satu kata / tanpa WA', () => {
  impor(['1. Budi', '2. Siti Aminah']);
  const p = run('periksaDaftarNama()');
  eq(p.jumlah, 2); ok(p.temuan >= 2, JSON.stringify(p));
  ok(p.laporan.some(x => /satu kata/.test(x)), JSON.stringify(p.laporan));
});
t('baris gabungan 2 nama (PDF dua kolom) tidak dianggap 1 nama', () => {
  const h = impor(['1. Siti Nurhaliza   2. Budi Santoso']);
  ok(h.tersimpan >= 1, 'perlu dipisah manual');
});

console.log('\n== GOOGLE FORM (opsi B) ==');
t('buatGoogleForm menghasilkan item lengkap', () => {
  const r = run('buatGoogleForm()');
  ok(r.live.indexOf('/viewform') > 0, r.live);
});
t('sinkronkanDariForm aman dipanggil tanpa respons', () => {
  const r = run('sinkronkanDariForm()');
  ok(r.ok, r.pesan);
});

console.log('\n== UTIL ==');
t('csv quote', () => {
  const CR2 = String.fromCharCode(13) + String.fromCharCode(10);
  eq(ctx.toCsv_([['a', 'b,c'], ['d"e', 'f']]), 'a,"b,c"' + CR2 + '"d""e",f');
  eq(ctx.toCsv_([['a', 'b;'], ['c', 3]]), 'a,"b;"' + CR2 + 'c,3');
});
t('num_ tahan format Indonesia', () => { eq(run('num_("70,5 kg")'), 70.5); eq(run('num_("")'), null); });
t('norm_ / esc_', () => { eq(run('norm_("  A  B ")'), 'a b'); eq(run('esc_("<b>&")'), '&lt;b&gt;&amp;'); });
t('tenggat: BATAS_ISI lampau → form tertutup otomatis', () => {
  run('CONFIG.BATAS_ISI = "2020-01-01T00:00:00+07:00"');
  run('setSetting(SETTING_KEY.TUTUP_FORM, "false")');
  ok(run('lewatTenggat_()'), 'harus lewat');
  run('CONFIG.BATAS_ISI = "2099-01-01T23:59:00+07:00"');
});

console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + ' lulus, ' + fail + ' gagal\n');
process.exit(fail ? 1 : 0);
