/**
 * ============================================================================
 *  WEB APP  —  doGet + API yang dipanggil halaman HTML (google.script.run)
 * ============================================================================
 */

/** URL utama: /exec  |  Admin: /exec?view=admin&token=<ADMIN_TOKEN> */
function doGet(e) {
  var q = (e && e.parameter) || {};
  var t = HtmlService.createTemplateFromFile('Index');
  t.view = q.view === 'admin' ? 'admin' : 'form';
  t.tokenOk = String(q.token || '') === String(CONFIG.ADMIN_TOKEN) ? '1' : '0';
  t.token = String(q.token || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80);
  return t.evaluate()
    .setTitle(CONFIG.KEGIATAN + ' — ' + CONFIG.ORGANISASI)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Dipanggil client saat halaman dibuka (google.script.run tidak bisa membaca query string). */
function apiBootstrap() {
  return bootstrap();
}

/** Konfigurasi awal yang diinjeksikan ke halaman (hemat 1 round-trip). */
function bootstrap(q) {
  q = q || {};
  var daftar = getDaftarNama();
  var sesi = {
    ok: true,
    app: {
      organisasi: CONFIG.ORGANISASI,
      kegiatan: CONFIG.KEGIATAN,
      periode: CONFIG.PERIODE,
      pic: CONFIG.PIC,
      logo: CONFIG.LOGO_URL,
      tenggat: fmtTanggalPanjang_(CONFIG.BATAS_ISI),
      tutup: formTertutup(),
      catatan: String(getSettings()[SETTING_KEY.CATATAN_ADMIN] || ''),
      bolehUbah: !!CONFIG.BOLEH_UBAH_JAWABAN,
      wajibList: !!CONFIG.WAJIB_LIST_NAMA,
      modelBaju: CONFIG.MODEL_BAJU,
      ukuran: CONFIG.UKURAN,
      jenisKelamin: CONFIG.JENIS_KELAMIN,
      bordir: CONFIG.BORDIR
    },
    sizeChart: getSizeChart(),
    daftar: daftar.map(function (d) {
      return { n: d.nama, w: d.wilayah, j: d.jabatan, wa: d.wa, e: d.email, c: d.catatan };
    }),
    saya: ''
  };
  try { sesi.saya = Session.getActiveUser().getEmail() || ''; } catch (err) {}
  return sesi;
}

/* --------------------------------------------------------------- API CLIENT */

/** Dipanggil saat user memilih nama → cek jawaban sebelumnya + data daftar. */
function apiCariNama(nama) {
  var key = nameKey_(nama);
  var d = getDaftarMap()[key] || null;
  var lama = cariJawaban(key);
  return {
    ditemukan: !!d,
    data: d ? { w: d.wilayah, j: d.jabatan, wa: d.wa, e: d.email } : null,
    adaJawaban: !!lama,
    bolehUbah: !!CONFIG.BOLEH_UBAH_JAWABAN,
    jawaban: lama ? ringkasRow_(lama) : null
  };
}

function ringkasRow_(r) {
  var o = {};
  CONFIG.HEADERS.forEach(function (h) { o[h] = r[h] || ''; });
  return o;
}

/** Hitung rekomendasi ukuran secara live dari pengukuran (tanpa menyimpan). */
function apiHitungUkuran(inp) {
  var r = rekomendasiUkuran(inp || {});
  var chart = getSizeChart();
  var c = r.ukuran ? cariChart_(chart, r.ukuran) : null;
  return {
    ukuran: r.ukuran,
    alternatif: r.alternatif,
    keyakinan: r.keyakinan,
    alasan: r.alasan,
    rentangDada: c ? c.dada : null,
    rentangPanjang: c ? c.panjang : null
  };
}

/**
 * Simpan jawaban. Satu-satunya jalur tulis dari form user.
 * @return {ok, mode, pesan, peringatan[], rekap{}}
 */
function apiKirim(p) {
  p = p || {};
  if (formTertutup()) {
    return { ok: false, pesan: 'Form sudah ditutup. Silakan hubungi panitia: ' + CONFIG.PIC };
  }

  var nama = String(p['Nama'] || '').replace(/\s+/g, ' ').trim();
  if (nama.length < 3) return { ok: false, pesan: 'Nama lengkap belum diisi dengan benar.' };

  var key = nameKey_(nama);
  var daftar = getDaftarMap()[key];
  if (!daftar && CONFIG.WAJIB_LIST_NAMA) {
    return {
      ok: false,
      pesan: 'Nama tidak ditemukan di daftar anggota IPI Jawa Tengah. ' +
        'Periksa ejaan (spasi/tanggal lahir) atau hubungi panitia untuk ditambahkan.'
    };
  }

  var sug = rekomendasiUkuran({ dada: p['Lingkar Dada (cm)'], bb: p['Berat Badan (kg)'], tb: p['Tinggi Badan (cm)'] });
  var v = validasiJawaban(p, { dada: p['Lingkar Dada (cm)'], tb: p['Tinggi Badan (cm)'], bb: p['Berat Badan (kg)'], pinggang: p['Lingkar Pinggang (cm)'] });

  // User harus menekan "kirim ulang" bila sistem menolak karena kesalahan data.
  if (v.kesalahan.length && !p._paksa) {
    return { ok: false, kesalahan: v.kesalahan, pesan: 'Ada data yang perlu diperbaiki sebelum dikirim.' };
  }
  // Perubahan ukuran yang berbeda jauh dari rekomendasi wajib dikonfirmasi.
  if (p._bedaTerkonfirmasi !== true && sug.ukuran && p['Ukuran'] &&
      norm_(sug.ukuran) !== norm_(p['Ukuran']) &&
      (langkahUkuran_(getSizeChart(), sug.ukuran, p['Ukuran']) || 0) >= 2) {
    return {
      ok: false,
      butuhKonfirmasi: true,
      rekomendasi: sug,
      pesan: 'Ukuran yang Anda pilih berbeda 2 langkah dari rekomendasi (' + sug.ukuran + '). ' +
        'Klik "Ya, ukuran saya sudah benar" untuk mengirim.'
    };
  }

  var now = new Date();
  var row = {};
  Object.keys(p).forEach(function (k) { if (CONFIG.HEADERS.indexOf(k) >= 0) row[k] = p[k]; });

  row['Timestamp'] = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  row['Nama'] = daftar ? daftar.nama : nama;               // normalisasi ejaan
  row['Email'] = String(p['Email'] || (daftar && daftar.email) || '');
  if (!row['Kabupaten/Kota'] && daftar) row['Kabupaten/Kota'] = daftar.wilayah;
  if (!row['Jabatan'] && daftar) row['Jabatan'] = daftar.jabatan;
  row['Rekomendasi Sistem'] = [sug.ukuran, sug.keyakinan, sug.alasan[0]].filter(Boolean).join(' | ');
  row['Status'] = v.peringatan.length ? 'Perlu Konfirmasi' : 'Terkirim';
  row['Sumber'] = 'Web App';
  if (!daftar) row['Catatan'] = ('[DI LUAR DAFTAR] ' + (row['Catatan'] || '')).trim();

  var hasil = simpanJawaban_(row, key);
  log_(hasil.mode === 'update' ? 'revisi-jawaban' : 'jawaban-baru', row['Nama'], row['Email']);
  kirimNotifikasi_(row, hasil);

  return {
    ok: true,
    mode: hasil.mode,
    pesan: hasil.mode === 'update'
      ? 'Jawaban Anda berhasil diperbarui.'
      : 'Terima kasih, data ukuran seragam Anda sudah terkirim.',
    peringatan: v.peringatan,
    rekap: {
      nama: row['Nama'], ukuran: row['Ukuran'], model: row['Model Baju'],
      waktu: fmtWaktu_(now), bordir: row['Bordir'] || '', status: row['Status']
    }
  };
}

/* ------------------------------------------------------------------ EMAIL */

function kirimNotifikasi_(row, hasil) {
  var subjek = '[' + (hasil.mode === 'update' ? 'Revisi' : 'Baru') + '] Seragam — ' +
    row['Nama'] + ' (' + (row['Ukuran'] || '-') + ')';
  var html = '<div style="font:14px/1.6 Arial,sans-serif;color:#222">' +
    '<p><b>' + esc_(CONFIG.KEGIATAN) + '</b> — ' + esc_(CONFIG.ORGANISASI) + '</p>' +
    '<table style="border-collapse:collapse">' +
    CONFIG.HEADERS.filter(function (h) { return row[h]; })
      .map(function (h) {
        return '<tr><td style="padding:3px 10px 3px 0;color:#666;white-space:nowrap">' +
          esc_(h) + '</td><td style="padding:3px 0"><b>' + esc_(row[h]) + '</b></td></tr>';
      }).join('') +
    '</table><p style="color:#666">Baris #' + hasil.row + ' di sheet ' + esc_(CONFIG.SHEET.DATA) + '.</p></div>';

  if (CONFIG.EMAIL_PANITIA && CONFIG.EMAIL_PANITIA.length) {
    mailBebasGangguan_(CONFIG.EMAIL_PANITIA, subjek, html);
  }
  if (CONFIG.KIRIM_SALINAN_KE_PENGISI && row['Email'] && row['Email'].indexOf('@') > 0) {
    mailBebasGangguan_([row['Email']], 'Konfirmasi data ukuran seragam — ' + CONFIG.ORGANISASI,
      '<div style="font:14px/1.6 Arial,sans-serif"><p>Yth. ' + esc_(row['Nama']) + ',</p>' +
      '<p>Data ukuran seragam Anda sudah kami terima' + (hasil.mode === 'update' ? ' (versi revisi)' : '') + ':</p>' +
      '<p style="background:#f4f7f6;border-left:3px solid #1a7f5c;padding:10px 14px">' +
      esc_(ringkasJawaban(row)).replace(/\n/g, '<br>') + '</p>' +
      '<p>Perlu mengubah? Buka kembali formulir yang sama dan kirim ulang — data lama otomatis ditimpa.</p>' +
      '<p style="color:#666">' + esc_(CONFIG.PIC) + '</p></div>');
  }
}
