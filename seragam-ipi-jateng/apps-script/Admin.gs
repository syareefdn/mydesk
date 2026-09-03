/**
 * ============================================================================
 *  ADMIN  —  rekap, reminder, buka/tutup form, export
 *  Semua fungsi apiAdmin* meminta token (CONFIG.ADMIN_TOKEN).
 * ============================================================================
 */

function cekToken_(token) {
  if (String(token || '') !== String(CONFIG.ADMIN_TOKEN)) {
    throw new Error('Token admin tidak valid. Buka lewat ?view=admin&token=<ADMIN_TOKEN>');
  }
  return true;
}

/** Data lengkap untuk tabel admin. */
function apiAdminData(token) {
  cekToken_(token);
  var rows = getSemuaJawaban();
  var chart = getSizeChart().map(function (c) { return c.ukuran; });
  var daftar = getDaftarNama();
  var sudah = {};
  rows.forEach(function (r) { sudah[nameKey_(r['Nama'])] = true; });

  var belum = daftar.filter(function (d) { return !sudah[d.namaKey]; });
  var perUkuran = {};
  var perWilayah = {};
  var perModel = {};
  var perKelamin = {};
  rows.forEach(function (r) {
    var u = String(r['Ukuran'] || 'Belum lengkap');
    perUkuran[u] = (perUkuran[u] || 0) + 1;
    var w = String(r['Kabupaten/Kota'] || 'Tanpa wilayah');
    perWilayah[w] = (perWilayah[w] || 0) + 1;
    perModel[r['Model Baju'] || '-'] = (perModel[r['Model Baju'] || '-'] || 0) + 1;
    perKelamin[r['Jenis Kelamin'] || '-'] = (perKelamin[r['Jenis Kelamin'] || '-'] || 0) + 1;
  });

  return {
    ok: true,
    headers: CONFIG.HEADERS,
    rows: rows.map(function (r) {
      var o = { _row: r._row };
      CONFIG.HEADERS.forEach(function (h) { o[h] = r[h] || ''; });
      return o;
    }),
    ringkas: {
      total: rows.length,
      anggota: daftar.length,
      belum: belum.length,
      perluKonfirmasi: rows.filter(function (r) { return r['Status'] === 'Perlu Konfirmasi'; }).length,
      updateTerakhir: rows.length ? rows[rows.length - 1]['Timestamp'] : '-'
    },
    chart: chart,
    distribusi: { ukuran: perUkuran, wilayah: perWilayah, model: perModel, kelamin: perKelamin },
    daftarBelum: belum.map(function (d) {
      return { nama: d.nama, wilayah: d.wilayah, jabatan: d.jabatan, wa: d.wa, email: d.email };
    }),
    settings: getSettings(),
    statusList: CONFIG.STATUS,
    formTutup: formTertutup(),
    tenggat: fmtTanggalPanjang_(CONFIG.BATAS_ISI)
  };
}

/** Ubah Status / Petugas / kolom lain dari tabel admin. */
function apiAdminUbah(token, row, kolom, nilai) {
  cekToken_(token);
  ubahKolom_(Number(row), kolom, nilai);
  log_('admin-ubah', kolom + ' → ' + nilai + ' (baris ' + row + ')');
  return { ok: true };
}

/** Hapus satu baris jawaban (mis. salah nama). */
function apiAdminHapus(token, row) {
  cekToken_(token);
  var sh = getSheet_(CONFIG.SHEET.DATA);
  sh.deleteRow(Number(row));
  log_('admin-hapus', 'baris ' + row);
  return { ok: true };
}

function apiAdminSetSetting(token, key, value) {
  cekToken_(token);
  setSetting(key, value);
  log_('admin-setting', key + ' = ' + value);
  return { ok: true, tutup: formTertutup() };
}

/** Toggle tutup form dari halaman admin. */
function apiAdminToggleForm(token, tutup, catatan) {
  cekToken_(token);
  setSetting(SETTING_KEY.TUTUP_FORM, tutup ? 'true' : 'false');
  if (catatan !== undefined && catatan !== null) setSetting(SETTING_KEY.CATATAN_ADMIN, catatan);
  log_('admin-form', 'tutup=' + !!tutup);
  return { ok: true, tutup: formTertutup() };
}

/** CSV siap kirim ke penjahit (hanya kolom relevan, urut ukuran). */
function apiAdminCsv(token) {
  cekToken_(token);
  var kolom = ['Nama', 'Kabupaten/Kota', 'Jenis Kelamin', 'Model Baju', 'Ukuran',
    'Ukuran Cadangan', 'Lingkar Dada (cm)', 'Tinggi Badan (cm)', 'Berat Badan (kg)',
    'Ukuran Celana/Rok', 'Bordir', 'Nama untuk Bordir', 'No. WhatsApp',
    'Alamat Pengiriman', 'Status', 'Timestamp'];
  var rows = getSemuaJawaban().slice().sort(function (a, b) {
    var ua = String(a['Ukuran'] || 'zz'), ub = String(b['Ukuran'] || 'zz');
    return ua < ub ? -1 : ua > ub ? 1 : norm_(a['Nama']).localeCompare(norm_(b['Nama']));
  });
  var out = [kolom].concat(rows.map(function (r) {
    return kolom.map(function (k) { return r[k] || ''; });
  }));
  var csv = '\ufeff' + toCsv_(out);

  // Simpan salinan di Drive agar bisa dibuka/dibagikan.
  try {
    var folder = cariFolder_('Seragam IPI Jateng');
    var f = DriveApp.createFileInFolder(folder,
      'Rekap Ukuran Seragam ' + todayStr_() + '.csv', csv, 'text/csv');
    return { ok: true, url: f.getUrl(), jumlah: rows.length, csv: csv };
  } catch (e) {
    return { ok: true, url: '', jumlah: rows.length, csv: csv };
  }
}

function cariFolder_(nama) {
  var it = DriveApp.getFoldersByName(nama);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nama);
}

/**
 * Rekap ke Google Doc (untuk rapat koordinasi / vendor konveksi):
 * distribusi ukuran per wilayah + daftar yang perlu dikonfirmasi.
 */
function buatRekapDoc(token) {
  var data = token ? apiAdminData(token) : apiAdminData(CONFIG.ADMIN_TOKEN);
  var d = new Date();
  var doc = DocumentApp.create('Rekap Ukuran Seragam — ' + CONFIG.ORGANISASI);
  var b = doc.getBody();
  var logoTxt = CONFIG.ORGANISASI;

  b.appendParagraph('DATA UKURAN SERAGAM').setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph(logoTxt + ' — ' + CONFIG.KEGIATAN + ' ' + CONFIG.PERIODE)
    .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  b.appendParagraph('Disusun: ' + fmtWaktu_(d) + ' WIB  |  Total terisi: ' +
    data.ringkas.total + ' dari ' + data.ringkas.anggota + ' anggota  |  Perlu dikonfirmasi: ' +
    data.ringkas.perluKonfirmasi);

  b.appendPageBreak();
  b.appendParagraph('Rekapitulasi per Ukuran').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var urutan = Object.keys(data.distribusi.ukuran).sort();
  var tabel = [['Ukuran', 'Jumlah', 'Lengan Panjang', 'Lengan Pendek']];
  var rows = data.rows;
  urutan.forEach(function (u) {
    var sub = rows.filter(function (r) { return String(r['Ukuran']) === u; });
    tabel.push([
      u, String(sub.length),
      String(sub.filter(function (r) { return /panjang/i.test(r['Model Baju']); }).length),
      String(sub.filter(function (r) { return /pendek/i.test(r['Model Baju']); }).length)
    ]);
  });
  var totalSemua = rows.length;
  tabel.push(['TOTAL', String(totalSemua),
    String(rows.filter(function (r) { return /panjang/i.test(r['Model Baju']); }).length),
    String(rows.filter(function (r) { return /pendek/i.test(r['Model Baju']); }).length)]);
  b.appendTable(tabel);

  b.appendParagraph('Rekap per Kabupaten/Kota').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var w = Object.keys(data.distribusi.wilayah).sort();
  var t2 = [['Wilayah', 'Jumlah Anggota Mengisi']];
  w.forEach(function (k) { t2.push([k, String(data.distribusi.wilayah[k])]); });
  b.appendTable(t2);

  if (data.daftarBelum.length) {
    b.appendParagraph('Belum Mengisi (' + data.daftarBelum.length + ')')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    var t3 = [['No', 'Nama', 'Kabupaten/Kota', 'Kontak']];
    data.daftarBelum.forEach(function (x, i) {
      t3.push([String(i + 1), x.nama, x.wilayah, x.wa || x.email || '-']);
    });
    b.appendTable(t3);
  }

  b.appendParagraph('Rincian Lengkap').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var t4 = [['Nama', 'Wilayah', 'Kelamin', 'Model', 'Ukuran', 'Dada (cm)', 'Status']];
  rows.forEach(function (r) {
    t4.push([r['Nama'], r['Kabupaten/Kota'], r['Jenis Kelamin'], r['Model Baju'],
      r['Ukuran'], r['Lingkar Dada (cm)'], r['Status']]);
  });
  b.appendTable(t4);

  log_('rekap-doc', doc.getUrl());
  var hasil = { ok: true, url: doc.getUrl() };
  if (!token) uiAlert_('Rekap dibuat:\n' + doc.getUrl());
  return hasil;
}

/** Kirim email pengingat ke anggota yang belum mengisi. Default: dry-run. */
function kirimPengingat(/** @param {boolean} kirimNyata */ kirimNyata) {
  var nyata = kirimNyata === true;
  var data = apiAdminData(CONFIG.ADMIN_TOKEN);
  var target = data.daftarBelum.filter(function (x) { return x.email && x.email.indexOf('@') > 0; });
  var tanpaEmail = data.daftarBelum.filter(function (x) { return !x.email; });

  var subjek = 'Reminder: isi data ukuran seragam ' + CONFIG.ORGANISASI;
  var html = '<div style="font:14px/1.6 Arial,sans-serif">' +
    '<p>Yth. Bapak/Ibu anggota ' + esc_(CONFIG.ORGANISASI) + ',</p>' +
    '<p>Sehubungan ' + esc_(CONFIG.KEGIATAN) + ' ' + esc_(CONFIG.PERIODE) +
    ', mohon melengkapi data ukuran seragam paling lambat <b>' + esc_(data.tenggat || CONFIG.BATAS_ISI) + '</b>.</p>' +
    '<p><a href="' + (getAppUrl_() || '#') + '">Buka formulir data ukuran seragam</a></p>' +
    '<p style="color:#666">' + esc_(CONFIG.PIC) + '</p></div>';

  var terkirim = 0;
  target.forEach(function (x) {
    if (nyata && mailBebasGangguan_([x.email], subjek, html)) terkirim++;
  });

  var pesan = 'Anggota belum mengisi: ' + data.daftarBelum.length +
    '\nPunya email (target): ' + target.length +
    '\nTanpa email (kirim via grup WA/koordinator wilayah): ' + tanpaEmail.length +
    '\nStatus: ' + (nyata ? 'terkirim ' + terkirim + ' email' : 'DRAFT — set kirimPengingat(true) untuk kirim') +
    '\nDaftar tanpa email tersimpan di sheet LogAktivitas.';

  if (!nyata) {
    try {
      var sh = getSheet_(CONFIG.SHEET.LOG, true);
      sh.appendRow([new Date(), 'pengingat-preview',
        'Tanpa email: ' + tanpaEmail.map(function (x) { return x.nama + ' (' + x.wilayah + ')'; }).join('; '),
        'dry-run']);
    } catch (e) {}
    uiAlert_(pesan);
  }
  log_('pengingat', 'nyata=' + nyata + ', target=' + target.length);
  return { ok: true, pesan: pesan, target: target.length, tanpaEmail: tanpaEmail.length };
}

/** Menu: buka/tutup form cepat. */
function toggleForm() {
  var tutup = !formTertutup();
  setSetting(SETTING_KEY.TUTUP_FORM, tutup ? 'true' : 'false');
  uiAlert_('Form ' + (tutup ? 'DITUTUP — pengisian baru tidak diterima.' : 'DIBUKA kembali.'));
}

/** Endpoint web app: rekap Doc. */
function apiAdminDoc(token) {
  cekToken_(token);
  return buatRekapDoc();
}

/** Endpoint web app: pengingat. kirimNyata=false → hanya preview. */
function apiAdminReminder(token, kirimNyata) {
  cekToken_(token);
  return kirimPengingat(kirimNyata === true || kirimNyata === 'true');
}
