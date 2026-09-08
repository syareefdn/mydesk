/* Copy Catalog Multi Server - frontend
 * Membutuhkan jQuery + Bootstrap modal (sudah tersedia di template admin SLiMS).
 */
(function ($) {
  'use strict';

  var state = {
    page: 1,
    loading: false,
    records: [], // hasil gabungan
    currentDetail: null // {server, remote_id, digitals:[...]}
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function notify(msg, type) {
    type = type || 'info';
    try {
      if (window.parent && window.parent.toastr && window.parent.toastr[type]) {
        window.parent.toastr[type](msg, 'Copy Catalog Multi');
        return;
      }
      if (window.toastr && window.toastr[type]) {
        window.toastr[type](msg, 'Copy Catalog Multi');
        return;
      }
    } catch (e) { /* abaikan */ }
    alert(msg);
  }

  function checkedServers() {
    var out = [];
    $('.ccm-server-check:checked').each(function () { out.push($(this).val()); });
    return out;
  }

  function setLoading(on) {
    state.loading = on;
    $('#ccm-loading').toggle(on);
    $('#ccm-btn-search').prop('disabled', on);
    $('#ccm-btn-more').prop('disabled', on);
    if (on) { $('#ccm-empty').hide(); }
  }

  // ---------------------------------------------------------------
  // Pencarian
  // ---------------------------------------------------------------
  function doSearch(page, append) {
    var keywords = $.trim($('#ccm-keywords').val());
    if (!keywords) { notify('Masukkan kata kunci terlebih dahulu.', 'warning'); return; }
    var servers = checkedServers();
    if (!servers.length) { notify('Pilih minimal satu server sumber.', 'warning'); return; }

    setLoading(true);
    state.page = page;

    $.ajax({
      url: CCM.ajax,
      data: { action: 'search', keywords: keywords, field: $('#ccm-field').val(), page: page, servers: servers },
      dataType: 'json',
      timeout: 90000
    }).done(function (res) {
      if (!res || res.status !== 'ok') {
        notify((res && res.message) ? res.message : CCM.lang.error, 'error');
        return;
      }
      if (!append) { state.records = []; $('#ccm-tbody').empty(); }
      // Hindari duplikat baris saat "muat berikutnya"
      var seen = {};
      $.each(state.records, function (_, r) { seen[r.server_key + ':' + r.remote_id] = true; });
      $.each(res.records || [], function (_, r) {
        var k = r.server_key + ':' + r.remote_id;
        if (!seen[k]) { seen[k] = true; state.records.push(r); }
      });
      renderSummary(res.servers || [], res.page);
      renderTable();
      rebuildServerFilter();
    }).fail(function (xhr, status) {
      var msg = 'Gagal menghubungi server lokal.';
      if (status === 'timeout') msg = 'Permintaan ke server lokal timeout.';
      notify(msg, 'error');
    }).always(function () {
      setLoading(false);
    });
  }

  function renderSummary(serversMeta, page) {
    var html = '<div class="alert alert-info mb-2"><strong>Halaman ' + page + ':</strong> ';
    var parts = [];
    $.each(serversMeta, function (_, m) {
      var badge;
      if (m.error) {
        badge = '<span class="badge badge-danger" title="' + esc(m.error) + '">' + esc(m.name) + ': error</span>';
      } else {
        badge = '<span class="badge badge-success">' + esc(m.name) + ': ' + m.returned + '/' + m.found + '</span>';
      }
      parts.push(badge);
    });
    html += parts.join(' ') + '</div>';
    $('#ccm-summary').html(html).show();
  }

  function renderTable() {
    var filter = $('#ccm-filter-server').val() || '';
    var $tbody = $('#ccm-tbody');
    $tbody.empty();
    var shown = 0;

    $.each(state.records, function (i, r) {
      if (filter && r.server_key !== filter) { return; }
      shown++;
      var pub = $.trim(((r.publisher || '') + ' ' + (r.publish_year || '')));
      var dig = r.has_digitals > 0 ? ' <span class="badge badge-secondary" title="Ada file digital">' + r.has_digitals + ' file</span>' : '';
      var row = '<tr data-index="' + i + '">' +
        '<td><input type="checkbox" class="ccm-row-check" data-index="' + i + '"></td>' +
        '<td><a href="#" class="ccm-title-link font-weight-bold notAJAX" data-index="' + i + '">' + esc(r.title) + '</a>' +
        '<div class="small text-muted">' + esc(r.authors || '-') + '</div></td>' +
        '<td><small>' + esc(pub || '-') + (r.gmd ? '<br><span class="badge badge-light">' + esc(r.gmd) + '</span>' : '') + '</small></td>' +
        '<td><small>' + esc(r.isbn || '-') + '</small></td>' +
        '<td><small>' + esc(r.server_name) + '</small>' + dig + '</td>' +
        '<td>' +
        (CCM.canWrite ? '<button type="button" class="btn btn-sm btn-success ccm-btn-copy" data-index="' + i + '">' + esc(CCM.lang.copy) + '</button> ' : '') +
        '<button type="button" class="btn btn-sm btn-outline-secondary ccm-btn-detail" data-index="' + i + '">' + esc(CCM.lang.detail) + '</button>' +
        '</td></tr>';
      $tbody.append(row);
    });

    $('#ccm-result-count').text(state.records.length);
    $('#ccm-table').toggle(state.records.length > 0);
    $('#ccm-empty').toggle(state.records.length === 0);
    if (state.records.length === 0) { $('#ccm-empty').text(CCM.lang.noResult); }
    $('#ccm-more-wrap').toggle(state.records.length > 0);
    updateSelectedCount();
  }

  function rebuildServerFilter() {
    var $sel = $('#ccm-filter-server');
    var current = $sel.val() || '';
    var map = {};
    $.each(state.records, function (_, r) { map[r.server_key] = r.server_name; });
    $sel.empty().append('<option value="">Semua server</option>');
    $.each(map, function (key, name) { $sel.append('<option value="' + esc(key) + '">' + esc(name) + '</option>'); });
    $sel.val(current);
  }

  function updateSelectedCount() {
    var n = $('.ccm-row-check:checked').length;
    $('#ccm-selected-count').text(n);
    $('#ccm-copy-selected').prop('disabled', n === 0);
    var total = $('.ccm-row-check').length;
    $('#ccm-row-check-all').prop('checked', total > 0 && n === total);
  }

  // ---------------------------------------------------------------
  // Detail (modal)
  // ---------------------------------------------------------------
  function showDetail(index) {
    var r = state.records[index];
    if (!r) return;
    $('#ccm-modal-body').html('<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>');
    $('#ccm-modal-origin').hide();
    $('#ccm-modal').modal('show');

    $.ajax({
      url: CCM.ajax,
      data: { action: 'detail', server: r.server_key, remote_id: r.remote_id },
      dataType: 'json',
      timeout: 60000
    }).done(function (res) {
      if (!res || res.status !== 'ok') {
        $('#ccm-modal-body').html('<div class="alert alert-danger">' + esc((res && res.message) || CCM.lang.error) + '</div>');
        return;
      }
      state.currentDetail = res;
      var html = '';
      if (res.duplicate && (res.duplicate.by_isbn > 0 || res.duplicate.by_title > 0)) {
        html += '<div class="alert alert-warning">Data kemungkinan sudah ada di database lokal' +
          (res.duplicate.by_isbn > 0 ? ' (ISBN cocok: biblio_id ' + res.duplicate.by_isbn + ')' : ' (judul cocok: biblio_id ' + res.duplicate.by_title + ')') + '.</div>';
      }
      html += '<table class="table table-sm">';
      function row(label, val) {
        if (!val) return '';
        return '<tr><th style="width:160px;">' + label + '</th><td>' + val + '</td></tr>';
      }
      html += row('Judul', esc(res.title));
      var authors = $.map(res.authors || [], function (a) { return esc(a.name); }).join('; ');
      html += row('Pengarang', esc(authors || '-'));
      html += row('GMD', esc(res.gmd || '-'));
      html += row('Edisi', esc(res.edition || '-'));
      html += row('ISBN/ISSN', esc(res.isbn || '-'));
      html += row('Penerbit', esc($.trim((res.publish_place ? res.publish_place + ': ' : '') + (res.publisher || '') + ' ' + (res.publish_year || '')) || '-'));
      html += row('Deskripsi fisik', esc(res.collation || '-'));
      html += row('Seri', esc(res.series || '-'));
      html += row('Klasifikasi', esc(res.classification || '-'));
      html += row('No. panggil', esc(res.call_number || '-'));
      html += row('Bahasa', esc(res.language || '-'));
      var subjects = $.map(res.subjects || [], function (s) { return esc(s.term); }).join(' -- ');
      html += row('Subjek', esc(subjects || '-'));
      html += row('Catatan', esc(res.notes ? String(res.notes).substring(0, 1500) : '-'));
      html += row('Sumber', esc(res.server.name));
      html += '</table>';

      if (CCM.allowDigitals && res.digitals && res.digitals.length) {
        html += '<h6>File digital/attachment <small class="text-muted">(centang untuk ikut disalin)</small></h6><ul class="list-group mb-2">';
        $.each(res.digitals, function (_, d) {
          html += '<li class="list-group-item py-1"><label class="mb-0"><input type="checkbox" class="ccm-digital-check" value="' + esc(d.id) + '"> ' +
            esc(d.title || d.path) + ' <small class="text-muted">' + esc(d.mimetype || '') + '</small></label></li>';
        });
        html += '</ul>';
      }

      $('#ccm-modal-body').html(html);
      $('#ccm-modal-origin').attr('href', res.origin_url).show();
    }).fail(function () {
      $('#ccm-modal-body').html('<div class="alert alert-danger">' + esc(CCM.lang.error) + '</div>');
    });
  }

  // ---------------------------------------------------------------
  // Salin
  // ---------------------------------------------------------------
  function doCopy(items, $btn) {
    if (!CCM.canWrite) { notify('Anda tidak memiliki hak tulis.', 'error'); return; }
    if (!items.length) { notify(CCM.lang.needSelect, 'warning'); return; }

    var original = null;
    if ($btn && $btn.length) {
      original = $btn.html();
      $btn.prop('disabled', true).html(CCM.lang.copying);
    }

    $.ajax({
      url: CCM.ajax,
      method: 'POST',
      data: { action: 'save', items: items },
      dataType: 'json',
      timeout: 180000
    }).done(function (res) {
      if (!res || res.status !== 'ok') {
        notify((res && res.message) || CCM.lang.error, 'error');
        return;
      }
      renderSaveReport(res.results || []);
      var okCount = 0;
      $.each(res.results || [], function (_, r) { if (r.status === 'saved') okCount++; });
      notify(okCount + ' dari ' + (res.results || []).length + ' record tersalin.', okCount ? 'success' : 'warning');
      $('#ccm-modal').modal('hide');
    }).fail(function (xhr, status) {
      notify(status === 'timeout' ? 'Proses salin timeout di browser, tetapi sebagian data mungkin sudah tersimpan. Cek daftar bibliografi.' : CCM.lang.error, 'error');
    }).always(function () {
      if ($btn && $btn.length) { $btn.prop('disabled', false).html(original); }
    });
  }

  function renderSaveReport(results) {
    var html = '<div class="card"><div class="card-header"><strong>Hasil penyalinan</strong></div><div class="card-body p-0">' +
      '<table class="table table-sm mb-0"><thead><tr><th>Status</th><th>Judul</th><th>Server</th><th>Keterangan</th><th></th></tr></thead><tbody>';
    $.each(results, function (_, r) {
      var badge = 'badge-secondary';
      var label = r.status;
      if (r.status === 'saved') { badge = 'badge-success'; label = 'Tersalin'; }
      else if (r.status === 'duplicate_skipped') { badge = 'badge-warning'; label = 'Dilewati (duplikat)'; }
      else if (r.status === 'error') { badge = 'badge-danger'; label = 'Gagal'; }
      var link = '';
      if (r.biblio_id > 0) {
        link = '<a class="btn btn-sm btn-outline-primary ccm-open-biblio" href="' + CCM.editUrl + r.biblio_id + '">Buka</a>';
      }
      html += '<tr><td><span class="badge ' + badge + '">' + esc(label) + '</span></td>' +
        '<td>' + esc(r.title || '-') + '</td><td><small>' + esc(r.server_name || '-') + '</small></td>' +
        '<td><small>' + esc(r.message || '') + '</small></td><td>' + link + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    $('#ccm-save-report').html(html).show();
    $('html, body').animate({ scrollTop: $('#ccm-save-report').offset().top - 60 }, 300);
  }

  // ---------------------------------------------------------------
  // Uji koneksi
  // ---------------------------------------------------------------
  function testServer(key) {
    var $item = $('.ccm-server-item[data-server="' + key + '"] .ccm-server-status');
    $item.html('<span class="badge badge-info">...</span>');
    $.ajax({ url: CCM.ajax, data: { action: 'test', server: key }, dataType: 'json', timeout: 60000 })
      .done(function (res) {
        if (res && res.status === 'ok') {
          $item.html('<span class="badge badge-success" title="' + esc(res.message) + '">online</span>');
        } else {
          $item.html('<span class="badge badge-danger" title="' + esc((res && res.message) || '') + '">offline</span>');
        }
      })
      .fail(function () { $item.html('<span class="badge badge-danger">offline</span>'); });
  }

  // ---------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------
  $(document).ready(function () {
    // Halaman plugin dimuat ulang via simbioAJAX setiap dikunjungi, sehingga
    // app.js dieksekusi berulang. Bersihkan handler terdelegasi lama agar
    // tidak terjadi dobel request.
    $(document).off('.ccm');
    $('#ccm-form').on('submit', function () { doSearch(1, false); });
    $('#ccm-btn-more').on('click', function () { doSearch(state.page + 1, true); });
    $('#ccm-filter-server').on('change', renderTable);

    $('#ccm-check-all').on('click', function () { $('.ccm-server-check').prop('checked', true); });
    $('#ccm-uncheck-all').on('click', function () { $('.ccm-server-check').prop('checked', false); });
    $('#ccm-test-all').on('click', function () {
      $('.ccm-server-check').each(function () { testServer($(this).val()); });
    });
    $(document).on('click.ccm', '.ccm-btn-test', function () { testServer($(this).data('server')); });

    $(document).on('click.ccm', '.ccm-title-link, .ccm-btn-detail', function (e) {
      e.preventDefault();
      showDetail($(this).data('index'));
    });

    $(document).on('click.ccm', '.ccm-btn-copy', function () {
      var r = state.records[$(this).data('index')];
      if (r) { doCopy([{ server: r.server_key, remote_id: r.remote_id }], $(this)); }
    });

    $(document).on('change.ccm', '.ccm-row-check', updateSelectedCount);
    $('#ccm-row-check-all').on('change', function () {
      $('.ccm-row-check').prop('checked', $(this).prop('checked'));
      updateSelectedCount();
    });

    $('#ccm-copy-selected').on('click', function () {
      var items = [];
      $('.ccm-row-check:checked').each(function () {
        var r = state.records[$(this).data('index')];
        if (r) { items.push({ server: r.server_key, remote_id: r.remote_id }); }
      });
      doCopy(items, $(this));
    });

    $('#ccm-modal-copy').on('click', function () {
      if (!state.currentDetail) return;
      var digitals = [];
      $('.ccm-digital-check:checked').each(function () { digitals.push($(this).val()); });
      doCopy([{ server: state.currentDetail.server.key, remote_id: state.currentDetail.remote_id, digitals: digitals }], $(this));
    });

    // Pengaturan
    $('#ccm-config-form').on('submit', function () {
      var data = {
        action: 'save_config',
        timeout: $('#cfg-timeout').val(),
        per_server_limit: $('#cfg-limit').val(),
        default_field: $('#cfg-field').val()
      };
      if ($('#cfg-cover').prop('checked')) data.download_cover = 1;
      if ($('#cfg-digitals').prop('checked')) data.download_digitals = 1;
      if ($('#cfg-skipdup').prop('checked')) data.skip_duplicate_isbn = 1;
      $.ajax({ url: CCM.ajax, method: 'POST', data: data, dataType: 'json' })
        .done(function (res) {
          notify((res && res.message) || '', (res && res.status === 'ok') ? 'success' : 'error');
        })
        .fail(function () { notify(CCM.lang.error, 'error'); });
    });

    $('#ccm-custom-form').on('submit', function () {
      var name = $.trim($('#ccm-custom-name').val());
      var uri = $.trim($('#ccm-custom-uri').val());
      if (!name || !uri) { notify('Nama dan URL wajib diisi.', 'warning'); return; }
      $.ajax({ url: CCM.ajax, method: 'POST', data: { action: 'add_custom_server', name: name, uri: uri }, dataType: 'json' })
        .done(function (res) {
          notify((res && res.message) || '', (res && res.status === 'ok') ? 'success' : 'error');
          if (res && res.status === 'ok') { setTimeout(function () { location.reload(); }, 800); }
        })
        .fail(function () { notify(CCM.lang.error, 'error'); });
    });

    $(document).on('click.ccm', '.ccm-btn-del-custom', function () {
      if (!confirm('Hapus server kustom ini?')) return;
      var idx = $(this).data('index');
      $.ajax({ url: CCM.ajax, method: 'POST', data: { action: 'del_custom_server', index: idx }, dataType: 'json' })
        .done(function (res) {
          notify((res && res.message) || '', (res && res.status === 'ok') ? 'success' : 'error');
          if (res && res.status === 'ok') { setTimeout(function () { location.reload(); }, 800); }
        })
        .fail(function () { notify(CCM.lang.error, 'error'); });
    });

    // Enter di kolom kata kunci langsung mencari
    $('#ccm-keywords').on('keydown', function (e) {
      if (e.keyCode === 13) { e.preventDefault(); doSearch(1, false); }
    });

    // Tautan internal SLiMS (edit biblio / kelola server): muat via simbioAJAX
    // agar tetap di dalam bingkai admin. Dilewati bila event sudah dicegah
    // (artinya handler AJAX bawaan template admin sudah menanganinya).
    $(document).on('click.ccm', '.ccm-open-biblio, .ccm-ajax-link', function (e) {
      if (e.isDefaultPrevented()) { return; }
      var url = $(this).attr('href');
      try {
        if (url && window.jQuery && jQuery.fn.simbioAJAX && jQuery('#mainContent').length) {
          e.preventDefault();
          jQuery('#mainContent').simbioAJAX(url);
        }
      } catch (err) { /* fallback ke navigasi normal */ }
    });
  });
})(jQuery);
