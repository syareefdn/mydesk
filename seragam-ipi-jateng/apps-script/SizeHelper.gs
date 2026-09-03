/**
 * ============================================================================
 *  SIZE HELPER  —  baca size chart, rekomendasi ukuran, validasi silang
 * ============================================================================
 */

/**
 * Size chart aktif. Sumber utama: sheet `SizeChart` (kolom:
 * Ukuran | Lingkar Dada Min | Lingkar Dada Max | Panjang Badan Min |
 * Panjang Badan Max | Lebar Bahu | BB Min | BB Max | Catatan).
 * Bila sheet kosong → pakai DEFAULT_SIZE_CHART di Config.gs.
 */
function getSizeChart() {
  var sh = getSheet_(CONFIG.SHEET.SIZE);
  if (!sh || sh.getLastRow() < 2) return DEFAULT_SIZE_CHART.slice();

  var last = sh.getLastRow();
  var v = sh.getRange(2, 1, last - 1, Math.min(9, sh.getLastColumn())).getDisplayValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i], ukuran = String(r[0] || '').trim();
    if (!ukuran) continue;
    out.push({
      ukuran: ukuran,
      dada: [num_(r[1]), num_(r[2])],
      panjang: [num_(r[3]), num_(r[4])],
      bahu: num_(r[5]),
      bb: [num_(r[6]), num_(r[7])],
      catatan: String(r[8] || '').trim()
    });
  }
  return out.length ? out : DEFAULT_SIZE_CHART.slice();
}

/** Jarak |dada − titik tengah rentang| — pemecah saat dua ukuran berimpit. */
function jarakTengah_(c, dada) {
  if (!c.dada || c.dada[0] == null || c.dada[1] == null) return 1e9;
  return Math.abs(dada - (c.dada[0] + c.dada[1]) / 2);
}

/** Cari ukuran terbesar ≥ idxStart yang menampung berat badan (toleransi +4 kg). */
function cariNaikUntukBB_(chart, idxStart, bb) {
  for (var i = idxStart; i < chart.length; i++) {
    var c = chart[i];
    if (!c.bb || c.bb[1] == null || bb <= c.bb[1] + 4) return i;
  }
  return chart.length - 1;
}

function cariChart_(chart, ukuran) {
  var k = norm_(ukuran);
  for (var i = 0; i < chart.length; i++) {
    if (norm_(chart[i].ukuran) === k) return chart[i];
  }
  return null;
}

function dalamRentang_(v, rentang) {
  return v != null && rentang && rentang[0] != null && rentang[1] != null &&
         v >= rentang[0] && v <= rentang[1];
}

/** Ukuran terdekat berdasarkan lingkar dada (jeda skor = 1 langkah ukuran). */
function terdekatByDada_(chart, dada) {
  var best = null;
  chart.forEach(function (c) {
    if (!c.dada || c.dada[0] == null) return;
    var mid = (c.dada[0] + c.dada[1]) / 2;
    var d = Math.abs(dada - mid);
    if (!best || d < best.d) best = { ukuran: c.ukuran, d: d };
  });
  return best ? best.ukuran : null;
}

/**
 * Rekomendasi ukuran dari pengukuran.
 * Prioritas: lingkar dada → (berat badan + tinggi badan) → tidak yakin.
 * @return {ukuran, alternatif, keyakinan:'tinggi'|'sedang'|'rendah'|null, alasan[]}
 */
function rekomendasiUkuran(inp) {
  var chart = getSizeChart();
  var dada = num_(inp.dada), pinggang = num_(inp.pinggang);
  var tb = num_(inp.tb), bb = num_(inp.bb);
  var alasan = [];
  var kandidat = [];

  // 1) Lingkar dada = dasar paling andal untuk atasan.
  if (dada) {
    chart.forEach(function (c, i) {
      if (dalamRentang_(dada, c.dada)) kandidat.push({ i: i, ukuran: c.ukuran, skor: 100 });
    });
    // Rentang size chart sering bersinggungan di batas (mis. 96 cm = S sekaligus M):
    // ambil ukuran dengan titik tengah paling dekat, lalu naik 1 bila BB di atas batas.
    kandidat.sort(function (a, b) {
      var d = jarakTengah_(chart[a.i], dada) - jarakTengah_(chart[b.i], dada);
      return d !== 0 ? d : (b.i - a.i);          // seri → ambil yang lebih longgar
    });
    if (kandidat.length > 1) {
      alasan.push('Dada ' + dada + ' cm berada di perbatasan dua ukuran — yang lebih longgar dipilih ' +
        'karena seragam organisasi biasanya tidak dipakai ketat.');
    }
    if (kandidat.length) {
      if (bb) {
        var tetap = kandidat.filter(function (k) {
          var c = chart[k.i];
          return !c.bb || c.bb[0] == null || bb <= c.bb[1] + 4;
        });
        if (tetap.length) {
          if (tetap.length !== kandidat.length) {
            alasan.push('Berat ' + bb + ' kg dipertimbangkan agar tidak sempit di badan.');
          }
          kandidat = tetap;
        } else {
          var naik = cariNaikUntukBB_(chart, kandidat[0].i, bb);
          if (naik > kandidat[0].i) {
            alasan.push('Berat ' + bb + ' kg di atas rentang ' + chart[kandidat[0].i].ukuran +
              ' — ukuran dinaikkan ke ' + chart[naik].ukuran + ' agar nyaman dipakai.');
            kandidat = [{ i: naik, ukuran: chart[naik].ukuran, skor: 90 }];
          }
        }
      }
      var utama = kandidat[0];
      var alt = chart[Math.min(chart.length - 1, utama.i + 1)];
      return {
        ukuran: utama.ukuran,
        alternatif: alt ? alt.ukuran : '',
        keyakinan: 'tinggi',
        alasan: ['Lingkar dada ' + dada + ' cm masuk rentang ' +
          chart[utama.i].dada[0] + '–' + chart[utama.i].dada[1] + ' cm.']
          .concat(alasan)
      };
    }
    // Di luar semua rentang (mis. sangat besar/kecil) → terdekat + flag custom.
    var terdekat = terdekatByDada_(chart, dada);
    return {
      ukuran: terdekat,
      alternatif: 'Ukuran Khusus (Custom)',
      keyakinan: 'sedang',
      alasan: ['Lingkar dada ' + dada + ' cm di luar rentang size chart standar ' +
        chart[0].ukuran + '–' + chart[chart.length - 1].ukuran +
        '. Disarankan ukuran khusus dengan pengukuran lengkap.']
    };
  }

  // 2) Tanpa lingkar dada → perkiraan dari BB (+TB sebagai penyesuai panjang).
  if (bb) {
    var byBB = chart.filter(function (c) { return dalamRentang_(bb, c.bb); });
    var u = byBB.length ? byBB[0].ukuran : terdekatByDada_(chart, 0);
    return {
      ukuran: u,
      alternatif: u ? naikSatu_(chart, u) : '',
      keyakinan: 'sedang',
      alasan: ['Diperkirakan dari berat badan ' + bb + ' kg (tanpa lingkar dada).',
        'Tambahkan ukuran lingkar dada agar akurasi naik.']
    };
  }

  // 3) Tidak ada pengukuran sama sekali.
  return {
    ukuran: '', alternatif: '', keyakinan: 'rendah',
    alasan: ['Belum ada pengukuran. Isi lingkar dada / berat badan untuk rekomendasi.']
  };
}

function naikSatu_(chart, ukuran) {
  for (var i = 0; i < chart.length; i++) {
    if (norm_(chart[i].ukuran) === norm_(ukuran)) {
      return chart[Math.min(chart.length - 1, i + 1)].ukuran;
    }
  }
  return '';
}

function langkahUkuran_(chart, a, b) {
  var ia = -1, ib = -1;
  for (var i = 0; i < chart.length; i++) {
    if (norm_(chart[i].ukuran) === norm_(a)) ia = i;
    if (norm_(chart[i].ukuran) === norm_(b)) ib = i;
  }
  return (ia < 0 || ib < 0) ? null : Math.abs(ia - ib);
}

/**
 * Validasi silang jawaban pengisi.
 * @return {peringatan: string[], kesalahan: string[]}
 */
function validasiJawaban(p, inp) {
  var chart = getSizeChart();
  var err = [], warn = [];
  var dada = num_(p['Lingkar Dada (cm)']);
  var tb = num_(p['Tinggi Badan (cm)']);
  var bb = num_(p['Berat Badan (kg)']);
  var pinggang = num_(p['Lingkar Pinggang (cm)']);
  var ukuran = String(p['Ukuran'] || '');
  var custom = /custom/i.test(ukuran);

  if (dada != null && (dada < 60 || dada > 200)) err.push('Lingkar dada tidak wajar (60–200 cm).');
  if (tb != null && (tb < 100 || tb > 230)) err.push('Tinggi badan tidak wajar (100–230 cm).');
  if (bb != null && (bb < 25 || bb > 250)) err.push('Berat badan tidak wajar (25–250 kg).');
  if (pinggang != null && (pinggang < 50 || pinggang > 200)) err.push('Lingkar pinggang tidak wajar.');

  if (!custom && ukuran) {
    var c = cariChart_(chart, ukuran);
    if (c && dada && !dalamRentang_(dada, c.dada)) {
      var sug = rekomendasiUkuran(inp);
      var jauh = langkahUkuran_(chart, ukuran, sug.ukuran || '');
      var msg = 'Ukuran ' + ukuran + ' biasanya untuk dada ' + c.dada[0] + '–' + c.dada[1] +
        ' cm, sedangkan dada Anda ' + dada + ' cm.';
      if (sug.ukuran && sug.ukuran !== ukuran) msg += ' Rekomendasi: ' + sug.ukuran + '.';
      if (jauh != null && jauh >= 2) warn.push(msg + ' (selisih ' + jauh + ' ukuran — mohon dipastikan ulang)');
      else warn.push(msg);
    }
  }

  if (!dada && !bb) {
    warn.push('Belum ada pengukuran (lingkar dada/berat badan). Risiko salah ukuran lebih besar — ' +
      'panitia mungkin akan menghubungi Anda.');
  }
  if (custom) {
    if (!dada) err.push('Untuk ukuran khusus, lingkar dada wajib diisi.');
    else warn.push('Ukuran khusus: panitia akan menghubungi Anda untuk detail jahitan (lingkar lengan, panjang lengan).');
  }
  var waDigit = String(p['No. WhatsApp'] || '').replace(/\D/g, '');
  if (waDigit.length < 9) {
    warn.push('Nomor WhatsApp belum lengkap; ini satu-satunya jalur cepat bila ukuran perlu dikonfirmasi.');
  }
  return { kesalahan: err, peringatan: warn };
}

/** Ringkasan untuk email/WhatsApp panitia. */
function ringkasJawaban(p) {
  return [
    p['Nama'] + (p['Kabupaten/Kota'] ? ' (' + p['Kabupaten/Kota'] + ')' : ''),
    'Model: ' + p['Model Baju'] + ' | Ukuran: ' + p['Ukuran'],
    'Dada ' + (p['Lingkar Dada (cm)'] || '-') + ' cm, TB ' + (p['Tinggi Badan (cm)'] || '-') +
      ' cm, BB ' + (p['Berat Badan (kg)'] || '-') + ' kg',
    p['Catatan'] ? 'Catatan: ' + p['Catatan'] : ''
  ].filter(Boolean).join('\n');
}
