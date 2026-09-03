#!/usr/bin/env node
/**
 * Uji end-to-end halaman client (Index.html) memakai jsdom + mode Mock.
 * Meniru perilaku browser: buka form → pilih nama → ukur → kirim → buka admin.
 *
 *   npm i jsdom   (sekali saja, di folder seragam-ipi-jateng)
 *   node tools/client-test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'web', 'Index.html'), 'utf8');
const tick = (w, ms = 40) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0, label = '';

function ok(c, m) { if (!c) throw new Error(m); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); }
async function t(n, fn) {
  label = n;
  try { await fn(); console.log('  ✓ ' + n); pass++; }
  catch (e) { console.log('  ✗ ' + n + '\n      ' + e.message); fail++; }
}
function buka(url, seed) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', url, pretendToBeVisual: true,
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = function () {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.alert = m => { w.__alert = m; };
      w.confirm = () => true;
      w.print = () => {}; w.scrollTo = () => {}; w.scroll = () => {}; w.print = () => {};
      w.URL.createObjectURL = () => 'blob:x';
      if (seed) w.localStorage.setItem('ipi-seragam-mock', JSON.stringify(seed));
    }
  });
  return dom;
}
async function siap(dom) {
  const w = dom.window;
  await tick(w, 60);
  if (!w.S || !w.S.boot) { w.boot(); await tick(w, 60); }
  ok(w.S.boot, 'boot() gagal: ' + (w.document.getElementById('subjudul').textContent));
  return w;
}
const klik = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const isi = (w, id, val) => { const e = w.document.getElementById(id); e.value = val; e.dispatchEvent(new w.Event('input', { bubbles: true })); return e; };
const tampil = (w, id) => !w.document.getElementById(id).classList.contains('hide');

(async function main() {
  console.log('\n== FORM: pemuatan awal ==');
  const dom = buka('http://localhost/');
  const w = await siap(dom);
  const D = w.document;

  await t('judul & tenggat terisi dari konfigurasi', () => {
    ok(/IPI|Pustakawan/i.test(D.getElementById('subjudul').textContent), D.getElementById('subjudul').textContent);
    ok(/Batas isi/.test(D.getElementById('chipTenggat').textContent), 'chip tenggat kosong');
  });
  await t('8 nama contoh masuk ke datalist', () => {
    eq(D.getElementById('daftarNama').children.length, 8, 'opsi datalist');
  });
  await t('chip ukuran menampilkan rentang lingkar dada', () => {
    const s = D.getElementById('sizeSet');
    eq(s.children.length, 9, 'jumlah chip ukuran');
    ok(/dada 102–108/.test(s.children[3].textContent), s.children[3].textContent);
    ok(/Custom/i.test(s.children[8].textContent), 'chip terakhir harus custom');
  });
  await t('3 kartu model baju + 2 pilihan jenis kelamin', () => {
    eq(D.getElementById('modelSet').children.length, 3, 'model');
    eq(D.getElementById('kelamin').children.length, 2, 'kelamin');
  });
  await t('pengumuman panitia tampil sebagai banner', () => {
    ok(tampil(w, 'bannerCatatan'), 'banner catatan tidak tampil');
    ok(/pratinjau/i.test(D.getElementById('bannerCatatanTxt').textContent), D.getElementById('bannerCatatanTxt').textContent);
  });

  console.log('\n== FORM: pengisian ==');
  await t('memilih nama mengisi wilayah, jabatan, WA otomatis', async () => {
    isi(w, 'nama', 'Budi Santoso');
    D.getElementById('nama').dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick(w, 80);
    eq(D.getElementById('wilayah').value, 'Surakarta');
    eq(D.getElementById('jabatan').value, 'Sekretaris');
    eq(D.getElementById('wa').value, '081234567891');
    ok(/Wilayah:/.test(D.getElementById('namaInfo').textContent), 'info wilayah hilang');
  });
  await t('nama di luar daftar memberi peringatan', async () => {
    isi(w, 'nama', 'Warga Umum');
    await w.pickNama(); await tick(w, 40);
    ok(/belum ada di daftar/.test(D.getElementById('namaInfo').textContent), D.getElementById('namaInfo').textContent);
    isi(w, 'nama', 'Budi Santoso'); w.pickNama(); await tick(w, 40);
  });
  await t('memilih pill/chip memberi state .on', () => {
    klik(w, D.getElementById('kelamin').children[0]);
    klik(w, D.getElementById('modelSet').children[0]);
    ok(D.getElementById('kelamin').children[0].classList.contains('on'), 'pill kelamin');
    eq(w.getRadio('model'), 'Lengan Panjang', 'radio model');
  });
  await t('input lingkar dada memunculkan rekomendasi L', async () => {
    isi(w, 'dada', '105'); isi(w, 'bb', '70');
    w.live(); await tick(w, 60);
    ok(/Rekomendasi sistem: L/.test(D.getElementById('saranBox').textContent), D.getElementById('saranBox').textContent);
  });
  await t('tombol "Pakai rekomendasi ini" memilih ukuran L', async () => {
    const bt = Array.from(D.getElementById('saranBox').querySelectorAll('button')).filter(b => /Pakai/.test(b.textContent))[0];
    ok(bt, 'tombol pakai rekomendasi tidak ada');
    klik(w, bt); await tick(w, 40);
    eq(w.getRadio('ukuran'), 'L', 'ukuran terpilih');
  });
  await t('ukuran bertentangan dengan dada → peringatan langsung', async () => {
    const chipXs = D.getElementById('sizeSet').children[0];
    klik(w, chipXs); w.live(); await tick(w, 60);
    ok(/disarankan L/.test(D.getElementById('warnLive').textContent), D.getElementById('warnLive').textContent);
    klik(w, D.getElementById('sizeSet').children[3]); w.live(); await tick(w, 60);
    eq(D.getElementById('warnLive').children.length, 0, 'peringatan seharusnya hilang');
  });
  await t('nama bordir terisi otomatis & uppercase', () => {
    eq(D.getElementById('namaBordir').value, 'BUDI SANTOSO');
    eq(D.getElementById('bordirPrev').textContent, 'BUDI SANTOSO');
  });
  await t('validasi depan menolak pernyataan kosong', () => {
    D.getElementById('setuju').checked = false;
    eq(w.validasiDepan(w.payload()).length, 1, 'harus 1 error pernyataan');
    D.getElementById('setuju').checked = true;
    eq(w.validasiDepan(w.payload()).length, 0, 'tidak boleh ada error');
  });
  await t('kirim berhasil → layar konfirmasi dengan rekap', async () => {
    D.getElementById('formSeragam').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await tick(w, 120);
    ok(tampil(w, 'viewSukses'), 'layar sukses tidak tampil');
    ok(/Budi Santoso/.test(D.getElementById('suksesIsi').textContent), D.getElementById('suksesIsi').textContent);
    ok(/Lengan Panjang/.test(D.getElementById('suksesIsi').textContent), 'model baju tidak direkap');
    const db = JSON.parse(w.localStorage.getItem('ipi-seragam-mock'));
    eq(db.rows.length, 1, 'baris tersimpan di mock');
    eq(db.rows[0]['Ukuran'], 'L');
    ok(/L \| tinggi/.test(db.rows[0]['Rekomendasi Sistem']), db.rows[0]['Rekomendasi Sistem']);
  });
  await t('menekan "Perbaiki jawaban" mengembalikan form', () => {
    klik(w, D.getElementById('btnUbahLagi'));
    ok(!D.getElementById('formSeragam').classList.contains('hide'), 'form tidak muncul lagi');
  });
  await t('buka ulang dengan nama sama → banner data lama + prefill', async () => {
    isi(w, 'nama', 'Budi Santoso');
    await w.pickNama(); await tick(w, 80);
    ok(tampil(w, 'bannerLama'), 'banner data lama tidak tampil');
    ok(/Ukuran: L/.test(D.getElementById('bannerLamaInfo').textContent), D.getElementById('bannerLamaInfo').textContent);
  });
  await t('data lama TIDAK auto-menimpa isian; dimuat lewat tombol', async () => {
    D.getElementById('formSeragam').reset();
    eq(D.getElementById('dada').value, '', 'reset gagal');
    isi(w, 'nama', 'Budi Santoso'); await w.pickNama(); await tick(w, 60);
    eq(D.getElementById('dada').value, '', 'seharusnya belum terisi otomatis');
    klik(w, D.getElementById('btnIsiUlang')); await tick(w, 60);
    eq(D.getElementById('dada').value, '105', 'tombol muat tidak mengisi ulang');
    eq(w.getRadio('ukuran'), 'L', 'ukuran lama tidak dipulihkan');
    ok(!tampil(w, 'bannerLama'), 'banner masih tampil setelah dimuat');
  });
  await t('tombol "isi untuk orang lain" menghapus isian', async () => {
    klik(w, D.getElementById('btnBaru')); await tick(w, 40);
    eq(D.getElementById('nama').value, '');
    eq(D.getElementById('dada').value, '');
    eq(w.getRadio('ukuran'), '', 'ukuran masih terpilih');
    ok(tampil(w, 'formSeragam') || !D.getElementById('formSeragam').classList.contains('hide'), 'form tidak tampil lagi');
  });
  await t('kirim ulang → menimpa, tidak dobel', async () => {
    isi(w, 'nama', 'Budi Santoso'); await w.pickNama(); await tick(w, 50);
    klik(w, D.getElementById('kelamin').children[0]);      // form sempat direset tes sebelumnya
    klik(w, D.getElementById('modelSet').children[0]);
    isi(w, 'dada', '112');
    klik(w, D.getElementById('sizeSet').children[4]);      // XL
    D.getElementById('setuju').checked = true;
    await w.kirim(); await tick(w, 100);
    const db = JSON.parse(w.localStorage.getItem('ipi-seragam-mock'));
    eq(db.rows.length, 1, 'jumlah baris harus tetap 1');
    eq(db.rows[0]['Ukuran'], 'XL');
  });
  await t('bendera HANYA_ATASAN=false menjadikan celana wajib', () => {
    w.S.boot.app.hanyaAtasan = false;
    ok(w.validasiDepan(w.payload()).some(x => /celana/.test(x)), 'tidak menuntut ukuran celana');
    w.S.boot.app.hanyaAtasan = true;
    ok(!w.validasiDepan(w.payload()).some(x => /celana/.test(x)), 'masih menuntut celana padahal hanya atasan');
  });
  await t('tombol "isi contoh" mengisi seluruh field wajib', async () => {
    w.isiContoh(); await tick(w, 60);
    const p = w.payload();
    ok(p['Nama'] && p['Ukuran'] !== '' && p['Model Baju'], JSON.stringify(p).slice(0, 120));
  });

  console.log('\n== ADMIN ==');
  const seed = { set: { catatan_form: 'uji' }, rows: [
    { 'Nama': 'Siti Nurhaliza', 'Kabupaten/Kota': 'Semarang', 'Jenis Kelamin': 'Perempuan',
      'Model Baju': 'Lengan Panjang', 'Ukuran': 'XXL', 'Lingkar Dada (cm)': '116', 'Tinggi Badan (cm)': '168',
      'Berat Badan (kg)': '80', 'Bordir': 'Ya, bordir nama + logo IPI', 'No. WhatsApp': '081234567890',
      'Status': 'Terkirim', 'Timestamp': '03/09/2026 10:00:00' },
    { 'Nama': 'Budi Santoso', 'Kabupaten/Kota': 'Surakarta', 'Jenis Kelamin': 'Laki-laki',
      'Model Baju': 'Lengan Pendek', 'Ukuran': 'L', 'Lingkar Dada (cm)': '105', 'Tinggi Badan (cm)': '170',
      'Berat Badan (kg)': '70', 'Bordir': '', 'No. WhatsApp': '081234567891',
      'Status': 'Perlu Konfirmasi', 'Timestamp': '03/09/2026 10:05:00' }
  ] };
  const domA = buka('http://localhost/?view=admin', seed);
  const wa = await siap(domA);
  const DA = wa.document;
  await t('mode admin menyembunyikan form & membuka panel rekap', () => {
    ok(DA.getElementById('adminPanel') && !DA.getElementById('adminPanel').classList.contains('hide'), 'panel admin tidak terbuka');
    ok(DA.getElementById('viewForm').classList.contains('hide'), 'form masih tampil');
  });
  await t('statistik: 2 terisi dari 8, 6 belum', () => {
    const s = DA.getElementById('adminStats').textContent;
    ok(/2 \/ 8/.test(s), s);
    ok(/6/.test(s), 'jumlah belum mengisi tidak ada');
  });
  await t('diagram batang distribusi ukuran terisi', () => {
    const b = DA.getElementById('barUkuran');
    ok(b.children.length >= 2, 'batang kurang: ' + b.children.length);
    ok(/XXL/.test(b.textContent) && /L/.test(b.textContent), b.textContent);
  });
  await t('tabel menampilkan semua kolom jawaban', () => {
    const rows = DA.querySelectorAll('#tabel tbody tr');
    eq(rows.length, 2, 'baris tabel');
    ok(/Siti Nurhaliza/.test(rows[0].textContent), rows[0].textContent);
    eq(DA.querySelectorAll('#tabel thead th').length, 15, 'jumlah kolom header (12 data + # + status + aksi)');
  });
  await t('filter pencarian mempersempit tabel', async () => {
    isi(wa, 'cari', 'siti'); await tick(wa, 40);
    eq(DA.querySelectorAll('#tabel tbody tr').length, 1, 'hasil filter');
    isi(wa, 'cari', ''); await tick(wa, 40);
  });
  await t('filter ukuran mempersempit tabel', async () => {
    DA.getElementById('fUkuran').value = 'L';
    DA.getElementById('fUkuran').dispatchEvent(new wa.Event('change', { bubbles: true }));
    await tick(wa, 40);
    eq(DA.querySelectorAll('#tabel tbody tr').length, 1, 'filter ukuran');
    DA.getElementById('fUkuran').value = '';
    DA.getElementById('fUkuran').dispatchEvent(new wa.Event('change', { bubbles: true }));
  });
  await t('toggle status di tabel menulis balik ke penyimpanan', async () => {
    const sel = DA.querySelector('#tabel tbody tr td select');
    sel.value = 'Diverifikasi';
    sel.dispatchEvent(new wa.Event('change', { bubbles: true }));
    await tick(wa, 100);
    const db = JSON.parse(wa.localStorage.getItem('ipi-seragam-mock'));
    eq(db.rows[0]['Status'], 'Diverifikasi', 'status tidak tersimpan');
  });
  await t('mode "Belum mengisi" menampilkan 6 orang + tautan WA', async () => {
    DA.getElementById('fBelum').checked = true;
    DA.getElementById('fBelum').dispatchEvent(new wa.Event('change', { bubbles: true }));
    await tick(wa, 40);
    const n = DA.querySelectorAll('#tabel tbody tr').length;
    eq(n, 6, 'daftar yang belum mengisi');
    const a = DA.querySelector('#tabel tbody tr td a');
    ok(/wa\.me\/628/.test(a.href), a.href);
    ok(/view%3Dadmin|view=admin|\?view=admin/.test(decodeURIComponent(a.href)) || /localhost/.test(a.href), 'tautan reminder: ' + a.href);
    DA.getElementById('fBelum').checked = false;
    DA.getElementById('fBelum').dispatchEvent(new wa.Event('change', { bubbles: true }));
  });
  await t('tutup form tersimpan & statusnya terbaca', async () => {
    DA.getElementById('swTutup').checked = true;
    DA.getElementById('swTutup').dispatchEvent(new wa.Event('change', { bubbles: true }));
    await tick(wa, 80);
    eq(JSON.parse(wa.localStorage.getItem('ipi-seragam-mock')).set.tutup_form, 'true');
  });
  await t('tombol rekap/pengingat membalas tanpa error', async () => {
    klik(wa, DA.getElementById('btnReminder')); await tick(wa, 80);
    ok(/belum mengisi/.test(wa.__alert), wa.__alert);
    klik(wa, DA.getElementById('btnDoc')); await tick(wa, 80);
    ok(/Google Doc/.test(wa.__alert), wa.__alert);
  });
  await t('form tertutup menolak pengiriman baru (mode mock)', async () => {
    const domT = buka('http://localhost/', { set: { tutup_form: 'true' }, rows: [] });
    const wt = await siap(domT);
    ok(tampil(wt, 'bannerTutup'), 'banner tutup tidak tampil');
    eq(wt.document.getElementById('formSeragam').classList.contains('hide'), true, 'form masih bisa diisi');
  });

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + ' lulus, ' + fail + ' gagal\n');
  process.exit(fail ? 1 : 0);
})();

process.on('unhandledRejection', e => { console.error('Rejection di ' + label + ': ' + e.message); process.exit(1); });
