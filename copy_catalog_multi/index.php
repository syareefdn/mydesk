<?php
/**
 * Copy Catalog Multi Server - Halaman utama
 *
 * Dimuat SLiMS melalui admin/plugin_container.php sehingga
 * konstanta INDEX_AUTH, SB, LIB, SIMBIO, MWB, SWB, dan $dbs
 * sudah tersedia. File ini sekaligus menjadi endpoint AJAX
 * (?action=search|detail|save|test|save_config|...).
 *
 * @package copy_catalog_multi
 * @license GPL-3.0-or-later
 */

defined('INDEX_AUTH') or die('Direct access not allowed!');

// Batas akses berbasis IP (samakan dengan modul bibliography)
require_once LIB . 'ip_based_access.inc.php';
do_checkIP('smc');
do_checkIP('smc-bibliography');

// Mulai/resume sesi admin (plugin_container.php tidak melakukannya sendiri)
require SB . 'admin/default/session.inc.php';

// Cek hak akses
$can_read = utility::havePrivilege('bibliography', 'r');
$can_write = utility::havePrivilege('bibliography', 'w');
if (!$can_read) {
    die('<div class="errorBox">' . __('You are not authorized to view this section') . '</div>');
}

require_once __DIR__ . '/lib/Helper.php';

$config = CCM_Helper::loadConfig();
$servers = CCM_Helper::getServers($dbs, $config);

// URL ajax ke halaman ini via plugin_container
$__mod = isset($_GET['mod']) ? preg_replace('/[^a-z_]/i', '', (string)$_GET['mod']) : 'bibliography';
$__id = isset($_GET['id']) ? preg_replace('/[^a-z0-9]/i', '', (string)$_GET['id']) : '';
$SELF = $_SERVER['PHP_SELF'] . '?mod=' . urlencode($__mod) . '&id=' . urlencode($__id);

// URL aset plugin (untuk <script>/<link>)
$PLUGIN_DIRNAME = basename(__DIR__);
$ASSETS = SWB . 'plugins/' . $PLUGIN_DIRNAME . '/assets/';

$action = isset($_REQUEST['action']) ? trim((string)$_REQUEST['action']) : '';

// ======================================================================
// ENDPOINT AJAX (JSON)
// ======================================================================

if ($action === 'servers') {
    $list = array();
    foreach ($servers as $s) {
        $list[] = array('key' => $s['key'], 'name' => $s['name'], 'uri' => $s['uri'], 'origin' => $s['origin']);
    }
    CCM_Helper::json(array('status' => 'ok', 'servers' => $list));
}

if ($action === 'search') {
    $keywords = isset($_GET['keywords']) ? trim((string)$_GET['keywords']) : '';
    $field = isset($_GET['field']) ? trim((string)$_GET['field']) : $config['default_field'];
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $wanted = isset($_GET['servers']) ? (array)$_GET['servers'] : array();

    if ($keywords === '') {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Kata kunci masih kosong.'));
    }

    // Tentukan server yang dicari (default: semua)
    $targets = array();
    foreach ($servers as $s) {
        if (empty($wanted) || in_array($s['key'], $wanted, true)) {
            $targets[] = $s;
        }
    }
    if (empty($targets)) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Tidak ada server SLiMS yang tersedia. Tambahkan dulu di Master File > Copy Cataloging Server Configuration.'));
    }

    // Fetch paralel ke semua server
    $jobs = array();
    foreach ($targets as $s) {
        $jobs[$s['key']] = CCM_Helper::buildSearchUrl($s['uri'], $keywords, $field, $page);
    }
    $fetches = CCM_Helper::fetchMulti($jobs, $config['timeout']);

    $records = array();
    $meta = array();
    foreach ($targets as $s) {
        $key = $s['key'];
        $fetch = isset($fetches[$key]) ? $fetches[$key] : array('ok' => false, 'content' => '', 'error' => 'Tidak ada respon.', 'http' => 0, 'time' => 0);
        $info = array(
            'key' => $key,
            'name' => $s['name'],
            'found' => 0,
            'returned' => 0,
            'error' => '',
            'time' => isset($fetch['time']) ? $fetch['time'] : 0,
        );
        if (!$fetch['ok']) {
            $info['error'] = $fetch['error'] !== '' ? $fetch['error'] : 'Server tidak merespon.';
            $meta[] = $info;
            continue;
        }
        $parseError = '';
        $data = CCM_Helper::parseMods($fetch['content'], $parseError);
        if ($data === false || !isset($data['records'])) {
            $info['error'] = $parseError !== '' ? $parseError : 'Gagal mem-parsing XML (pastikan resultXML aktif di server sumber).';
            $meta[] = $info;
            continue;
        }
        $info['found'] = isset($data['result_num']) ? (int)$data['result_num'] : count($data['records']);
        $n = 0;
        foreach ($data['records'] as $rec) {
            if ($n >= $config['per_server_limit']) {
                break;
            }
            $summary = CCM_Helper::summarizeRecord($rec, $s);
            if ($summary['remote_id'] === '') {
                continue;
            }
            $records[] = $summary;
            $n++;
        }
        $info['returned'] = $n;
        $meta[] = $info;
    }

    CCM_Helper::json(array(
        'status' => 'ok',
        'page' => $page,
        'total' => count($records),
        'records' => $records,
        'servers' => $meta,
    ));
}

if ($action === 'detail') {
    $serverKey = isset($_GET['server']) ? trim((string)$_GET['server']) : '';
    $remoteId = isset($_GET['remote_id']) ? trim((string)$_GET['remote_id']) : '';
    $server = CCM_Helper::findServer($dbs, $serverKey, $config);
    if ($server === null) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Server tidak dikenal.'));
    }
    if ($remoteId === '') {
        CCM_Helper::json(array('status' => 'error', 'message' => 'ID record kosong.'));
    }
    $detail = CCM_Helper::getDetail($server['uri'], $remoteId, $config['timeout']);
    if (!$detail['ok']) {
        CCM_Helper::json(array('status' => 'error', 'message' => $detail['error']));
    }
    $rec = $detail['record'];

    // Susun tampilan detail yang rapi untuk modal
    $authors = array();
    if (isset($rec['authors']) && is_array($rec['authors'])) {
        foreach ($rec['authors'] as $a) {
            $authors[] = array(
                'name' => isset($a['name']) ? (string)$a['name'] : '',
                'type' => isset($a['author_type']) ? (string)$a['author_type'] : '',
                'level' => isset($a['level']) ? (int)$a['level'] : 1,
            );
        }
    }
    $subjects = array();
    if (isset($rec['subjects']) && is_array($rec['subjects'])) {
        foreach ($rec['subjects'] as $subj) {
            $subjects[] = array(
                'term' => isset($subj['term']) ? (string)$subj['term'] : '',
                'type' => isset($subj['term_type']) ? (string)$subj['term_type'] : '',
            );
        }
    }
    $digitals = array();
    if (isset($rec['digitals']) && is_array($rec['digitals'])) {
        foreach ($rec['digitals'] as $dig) {
            $digitals[] = array(
                'id' => isset($dig['id']) ? (string)$dig['id'] : '',
                'title' => isset($dig['title']) ? (string)$dig['title'] : '',
                'path' => isset($dig['path']) ? (string)$dig['path'] : '',
                'mimetype' => isset($dig['mimetype']) ? (string)$dig['mimetype'] : '',
            );
        }
    }

    // Cek duplikat lokal untuk peringatan dini
    $dup = CCM_Helper::findDuplicate($dbs, isset($rec['isbn_issn']) ? $rec['isbn_issn'] : '', isset($rec['title']) ? $rec['title'] : '');

    CCM_Helper::json(array(
        'status' => 'ok',
        'server' => array('key' => $server['key'], 'name' => $server['name']),
        'remote_id' => (string)$remoteId,
        'title' => isset($rec['title']) ? (string)$rec['title'] : '',
        'gmd' => isset($rec['gmd']) ? (string)$rec['gmd'] : '',
        'edition' => isset($rec['edition']) ? (string)$rec['edition'] : '',
        'isbn' => isset($rec['isbn_issn']) ? (string)$rec['isbn_issn'] : '',
        'publisher' => isset($rec['publisher']) ? (string)$rec['publisher'] : '',
        'publish_place' => isset($rec['publish_place']) ? (string)$rec['publish_place'] : '',
        'publish_year' => isset($rec['publish_year']) ? (string)$rec['publish_year'] : '',
        'collation' => isset($rec['collation']) ? (string)$rec['collation'] : '',
        'series' => isset($rec['series_title']) ? (string)$rec['series_title'] : '',
        'classification' => isset($rec['classification']) ? (string)$rec['classification'] : '',
        'call_number' => isset($rec['call_number']) ? (string)$rec['call_number'] : '',
        'language' => (isset($rec['language']) && is_array($rec['language']) && isset($rec['language']['name'])) ? (string)$rec['language']['name'] : '',
        'notes' => isset($rec['notes']) ? (string)$rec['notes'] : '',
        'image' => isset($rec['image']) ? (string)$rec['image'] : '',
        'authors' => $authors,
        'subjects' => $subjects,
        'digitals' => $digitals,
        'duplicate' => $dup,
        'origin_url' => $server['uri'] . 'index.php?p=show_detail&id=' . urlencode((string)$remoteId),
    ));
}

if ($action === 'save') {
    if (!$can_write) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Anda tidak memiliki hak tulis di modul bibliography.'));
    }
    $items = isset($_POST['items']) ? (array)$_POST['items'] : array();
    if (empty($items)) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Tidak ada record yang dipilih.'));
    }
    // Batasi 25 record per request agar tidak timeout
    $items = array_slice($items, 0, 25);

    $options = array(
        'download_cover' => $config['download_cover'],
        'download_digitals' => $config['download_digitals'],
        'skip_duplicate_isbn' => $config['skip_duplicate_isbn'],
    );

    // Kumpulkan kebutuhan detail per server, lalu fetch paralel
    $jobs = array();
    $plan = array();
    foreach ($items as $idx => $item) {
        if (!is_array($item)) {
            continue;
        }
        $serverKey = isset($item['server']) ? trim((string)$item['server']) : '';
        $remoteId = isset($item['remote_id']) ? trim((string)$item['remote_id']) : '';
        $server = CCM_Helper::findServer($dbs, $serverKey, $config);
        if ($server === null || $remoteId === '') {
            $plan[$idx] = array('error' => 'Server/ID tidak valid.', 'server' => null, 'remote_id' => $remoteId);
            continue;
        }
        $digitals = (isset($item['digitals']) && is_array($item['digitals'])) ? array_values(array_map('strval', $item['digitals'])) : null;
        $plan[$idx] = array('error' => '', 'server' => $server, 'remote_id' => $remoteId, 'digitals' => $digitals);
        $jobs[$idx] = CCM_Helper::buildDetailUrl($server['uri'], $remoteId);
    }

    $fetches = CCM_Helper::fetchMulti($jobs, max($config['timeout'], 15));
    $caches = null;
    $results = array();
    $saved = 0;

    foreach ($plan as $idx => $p) {
        $label = '#' . ((int)$idx + 1);
        if ($p['error'] !== '' || $p['server'] === null) {
            $results[] = array('status' => 'error', 'title' => $label, 'message' => $p['error'], 'biblio_id' => 0, 'server_name' => '');
            continue;
        }
        $server = $p['server'];
        $fetch = isset($fetches[$idx]) ? $fetches[$idx] : array('ok' => false, 'content' => '', 'error' => 'Tidak ada respon.');
        if (!$fetch['ok']) {
            $results[] = array('status' => 'error', 'title' => $label, 'message' => 'Gagal mengambil detail dari ' . $server['name'] . ': ' . $fetch['error'], 'biblio_id' => 0, 'server_name' => $server['name']);
            continue;
        }
        $parseError = '';
        $data = CCM_Helper::parseMods($fetch['content'], $parseError);
        if ($data === false || empty($data['records'])) {
            $results[] = array('status' => 'error', 'title' => $label, 'message' => 'Gagal mem-parsing detail XML dari ' . $server['name'] . '. ' . $parseError, 'biblio_id' => 0, 'server_name' => $server['name']);
            continue;
        }
        $itemOptions = $options;
        $itemOptions['digitals'] = $p['digitals'];
        $res = CCM_Helper::saveRecord($dbs, $data['records'][0], $server, $itemOptions, $caches);
        $res['server_name'] = $server['name'];
        $res['remote_id'] = $p['remote_id'];
        if ($res['status'] === 'saved') {
            $saved++;
        }
        $results[] = $res;
    }

    CCM_Helper::json(array('status' => 'ok', 'saved' => $saved, 'total' => count($results), 'results' => $results));
}

if ($action === 'test') {
    $serverKey = isset($_GET['server']) ? trim((string)$_GET['server']) : '';
    $server = CCM_Helper::findServer($dbs, $serverKey, $config);
    if ($server === null) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Server tidak dikenal.'));
    }
    // Uji dengan kata kunci generik "a" halaman 1
    $url = CCM_Helper::buildSearchUrl($server['uri'], 'a', '', 1);
    $fetch = CCM_Helper::fetchOne($url, $config['timeout']);
    if (!$fetch['ok']) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Tidak terhubung: ' . $fetch['error'], 'url' => $url));
    }
    $parseError = '';
    $data = CCM_Helper::parseMods($fetch['content'], $parseError);
    if ($data === false || !isset($data['records'])) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Terhubung, tetapi XML tidak valid / resultXML dimatikan. ' . $parseError, 'url' => $url));
    }
    CCM_Helper::json(array(
        'status' => 'ok',
        'message' => 'Online — resultXML aktif.',
        'found' => isset($data['result_num']) ? (int)$data['result_num'] : count($data['records']),
        'time' => $fetch['time'],
        'url' => $url,
    ));
}

if ($action === 'save_config') {
    if (!$can_write) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Anda tidak memiliki hak tulis.'));
    }
    $config['timeout'] = isset($_POST['timeout']) ? max(5, min(60, (int)$_POST['timeout'])) : $config['timeout'];
    $config['per_server_limit'] = isset($_POST['per_server_limit']) ? max(1, min(50, (int)$_POST['per_server_limit'])) : $config['per_server_limit'];
    $config['download_cover'] = isset($_POST['download_cover']) ? true : false;
    $config['download_digitals'] = isset($_POST['download_digitals']) ? true : false;
    $config['skip_duplicate_isbn'] = isset($_POST['skip_duplicate_isbn']) ? true : false;
    $df = isset($_POST['default_field']) ? trim((string)$_POST['default_field']) : '';
    $config['default_field'] = in_array($df, array('', 'title', 'author', 'isbn'), true) ? $df : '';
    $saved = CCM_Helper::saveConfig($config);
    if ($saved !== true) {
        CCM_Helper::json(array('status' => 'error', 'message' => $saved));
    }
    CCM_Helper::json(array('status' => 'ok', 'message' => 'Pengaturan tersimpan.'));
}

if ($action === 'add_custom_server') {
    if (!$can_write) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Anda tidak memiliki hak tulis.'));
    }
    $name = isset($_POST['name']) ? trim((string)$_POST['name']) : '';
    $uri = isset($_POST['uri']) ? trim((string)$_POST['uri']) : '';
    if ($name === '' || $uri === '') {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Nama dan URL server wajib diisi.'));
    }
    if (!CCM_Helper::isValidUrl($uri)) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'URL tidak valid. Contoh: https://opac.contoh.id/slims/'));
    }
    $config['custom_servers'][] = array('name' => $name, 'uri' => $uri);
    $saved = CCM_Helper::saveConfig($config);
    if ($saved !== true) {
        CCM_Helper::json(array('status' => 'error', 'message' => $saved));
    }
    CCM_Helper::json(array('status' => 'ok', 'message' => 'Server kustom ditambahkan.'));
}

if ($action === 'del_custom_server') {
    if (!$can_write) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Anda tidak memiliki hak tulis.'));
    }
    $index = isset($_POST['index']) ? (int)$_POST['index'] : -1;
    if (!isset($config['custom_servers'][$index])) {
        CCM_Helper::json(array('status' => 'error', 'message' => 'Server tidak ditemukan.'));
    }
    array_splice($config['custom_servers'], $index, 1);
    $config['custom_servers'] = array_values($config['custom_servers']);
    $saved = CCM_Helper::saveConfig($config);
    if ($saved !== true) {
        CCM_Helper::json(array('status' => 'error', 'message' => $saved));
    }
    CCM_Helper::json(array('status' => 'ok', 'message' => 'Server kustom dihapus.'));
}

// ======================================================================
// TAMPILAN HTML
// ======================================================================

$hasCurl = function_exists('curl_init') && function_exists('curl_multi_init');
$hasSimpleXML = function_exists('simplexml_load_string');
$mwbMaster = defined('MWB') ? MWB : 'modules/';
?>
<link rel="stylesheet" href="<?php echo CCM_Helper::h($ASSETS . 'style.css?v=' . CCM_Helper::VERSION); ?>">
<div class="menuBox">
  <div class="menuBoxInner biblioIcon">
    <div class="per_title">
      <h2><?php echo __('Copy Catalog Multi Server'); ?></h2>
    </div>
    <div class="infoBox">
      <?php echo __('Cari sekali ke banyak OPAC/katalog SLiMS sekaligus, lalu klik judul untuk pratinjau atau tombol Salin untuk menyalin data bibliografi.'); ?>
    </div>
    <?php if (!$hasCurl): ?>
    <div class="alert alert-warning mx-3 mt-2">
      <?php echo __('Ekstensi PHP <strong>curl</strong> tidak terdeteksi. Plugin tetap berjalan (mode sekuensial) tetapi pencarian multi-server akan lebih lambat. Aktifkan php-curl untuk hasil terbaik.'); ?>
    </div>
    <?php endif; ?>
    <?php if (!$hasSimpleXML): ?>
    <div class="alert alert-danger mx-3 mt-2">
      <?php echo __('Ekstensi PHP <strong>SimpleXML/php-xml</strong> tidak tersedia. Plugin membutuhkan ekstensi ini.'); ?>
    </div>
    <?php endif; ?>
  </div>
</div>

<div class="ccm-wrap">
  <ul class="nav nav-tabs" id="ccmTabs" role="tablist">
    <li class="nav-item">
      <a class="nav-link active notAJAX" data-toggle="tab" href="#ccm-tab-search" role="tab"><?php echo __('Pencarian'); ?></a>
    </li>
    <li class="nav-item">
      <a class="nav-link notAJAX" data-toggle="tab" href="#ccm-tab-setting" role="tab"><?php echo __('Pengaturan'); ?></a>
    </li>
    <li class="nav-item">
      <a class="nav-link notAJAX" data-toggle="tab" href="#ccm-tab-help" role="tab"><?php echo __('Bantuan'); ?></a>
    </li>
  </ul>

  <div class="tab-content pt-3">
    <!-- ================= TAB PENCARIAN ================= -->
    <div class="tab-pane fade show active" id="ccm-tab-search" role="tabpanel">
      <div class="card mb-3">
        <div class="card-body">
          <form id="ccm-form" class="form-inline" onsubmit="return false;">
            <label class="mr-2 font-weight-bold" for="ccm-keywords"><?php echo __('Kata kunci'); ?></label>
            <input type="text" id="ccm-keywords" class="form-control col-md-4 mr-2" placeholder="<?php echo __('Judul / pengarang / ISBN...'); ?>" autocomplete="off">
            <label class="mr-2" for="ccm-field"><?php echo __('Ruas'); ?></label>
            <select id="ccm-field" class="form-control mr-2">
              <option value=""<?php echo $config['default_field'] === '' ? ' selected' : ''; ?>><?php echo __('Semua'); ?></option>
              <option value="title"<?php echo $config['default_field'] === 'title' ? ' selected' : ''; ?>><?php echo __('Judul'); ?></option>
              <option value="author"<?php echo $config['default_field'] === 'author' ? ' selected' : ''; ?>><?php echo __('Pengarang'); ?></option>
              <option value="isbn"<?php echo $config['default_field'] === 'isbn' ? ' selected' : ''; ?>><?php echo __('ISBN'); ?></option>
            </select>
            <button type="submit" id="ccm-btn-search" class="btn btn-primary">
              <i class="fa fa-search"></i> <?php echo __('Cari ke Semua Server'); ?>
            </button>
          </form>
          <small class="text-muted d-block mt-2">
            <?php echo __('Tips: gunakan ISBN untuk hasil paling tepat. Pencarian dikirim paralel ke semua server yang dicentang.'); ?>
          </small>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong><?php echo __('Server sumber'); ?> (<span id="ccm-server-count"><?php echo count($servers); ?></span>)</strong>
          <span>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="ccm-check-all"><?php echo __('Pilih semua'); ?></button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="ccm-uncheck-all"><?php echo __('Batal semua'); ?></button>
            <button type="button" class="btn btn-sm btn-outline-info" id="ccm-test-all"><?php echo __('Uji semua'); ?></button>
            <a class="btn btn-sm btn-outline-primary ccm-ajax-link" href="<?php echo CCM_Helper::h($mwbMaster . 'master_file/p2pservers.php'); ?>"><?php echo __('Kelola server'); ?></a>
          </span>
        </div>
        <div class="card-body ccm-server-list">
          <?php if (empty($servers)): ?>
            <div class="alert alert-warning mb-0">
              <?php echo __('Belum ada server. Tambahkan di'); ?>
              <a class="ccm-ajax-link" href="<?php echo CCM_Helper::h($mwbMaster . 'master_file/p2pservers.php'); ?>"><?php echo __('Master File &gt; Copy Cataloging Server Configuration'); ?></a>
              <?php echo __('(tipe: P2P Server), atau tambahkan server kustom di tab Pengaturan.'); ?>
            </div>
          <?php else: ?>
            <div class="row">
              <?php foreach ($servers as $s): ?>
              <div class="col-md-4 mb-2">
                <div class="custom-control custom-checkbox ccm-server-item" data-server="<?php echo CCM_Helper::h($s['key']); ?>">
                  <input type="checkbox" class="custom-control-input ccm-server-check" id="ccm-srv-<?php echo CCM_Helper::h($s['key']); ?>" value="<?php echo CCM_Helper::h($s['key']); ?>" checked>
                  <label class="custom-control-label" for="ccm-srv-<?php echo CCM_Helper::h($s['key']); ?>">
                    <strong><?php echo CCM_Helper::h($s['name']); ?></strong>
                    <?php if ($s['origin'] === 'custom'): ?><span class="badge badge-secondary">kustom</span><?php endif; ?>
                    <br><small class="text-muted"><?php echo CCM_Helper::h($s['uri']); ?></small>
                  </label>
                  <span class="ccm-server-status ml-2"></span>
                  <button type="button" class="btn btn-xs btn-link ccm-btn-test p-0 ml-1" data-server="<?php echo CCM_Helper::h($s['key']); ?>" title="<?php echo __('Uji koneksi'); ?>"><?php echo __('uji'); ?></button>
                </div>
              </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div id="ccm-summary" class="mb-2" style="display:none;"></div>

      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong><?php echo __('Hasil pencarian'); ?> <span id="ccm-result-count" class="badge badge-info">0</span></strong>
          <span>
            <select id="ccm-filter-server" class="form-control form-control-sm d-inline-block" style="width:auto;">
              <option value=""><?php echo __('Semua server'); ?></option>
            </select>
            <?php if ($can_write): ?>
            <button type="button" class="btn btn-sm btn-success" id="ccm-copy-selected" disabled>
              <i class="fa fa-copy"></i> <?php echo __('Salin yang dipilih'); ?> (<span id="ccm-selected-count">0</span>)
            </button>
            <?php endif; ?>
          </span>
        </div>
        <div class="card-body p-0">
          <div id="ccm-loading" class="text-center p-4" style="display:none;">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="mt-2"><?php echo __('Mencari ke semua server...'); ?></div>
          </div>
          <div id="ccm-empty" class="text-center text-muted p-4">
            <?php echo __('Belum ada hasil. Masukkan kata kunci lalu tekan Cari.'); ?>
          </div>
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0" id="ccm-table" style="display:none;">
              <thead class="thead-light">
                <tr>
                  <th style="width:34px;"><input type="checkbox" id="ccm-row-check-all" title="<?php echo __('Pilih semua'); ?>"></th>
                  <th><?php echo __('Judul / Pengarang'); ?></th>
                  <th><?php echo __('Penerbitan'); ?></th>
                  <th><?php echo __('ISBN'); ?></th>
                  <th><?php echo __('Asal server'); ?></th>
                  <th style="width:150px;"><?php echo __('Aksi'); ?></th>
                </tr>
              </thead>
              <tbody id="ccm-tbody"></tbody>
            </table>
          </div>
          <div class="p-3 text-center" id="ccm-more-wrap" style="display:none;">
            <button type="button" class="btn btn-outline-primary" id="ccm-btn-more"><?php echo __('Muat hasil berikutnya'); ?></button>
          </div>
        </div>
      </div>

      <div id="ccm-save-report" class="mt-3" style="display:none;"></div>
    </div>

    <!-- ================= TAB PENGATURAN ================= -->
    <div class="tab-pane fade" id="ccm-tab-setting" role="tabpanel">
      <div class="card mb-3">
        <div class="card-header"><strong><?php echo __('Pengaturan umum'); ?></strong></div>
        <div class="card-body">
          <form id="ccm-config-form" onsubmit="return false;">
            <div class="form-group row">
              <label class="col-sm-4 col-form-label" for="cfg-timeout"><?php echo __('Timeout per server (detik)'); ?></label>
              <div class="col-sm-2">
                <input type="number" min="5" max="60" class="form-control" id="cfg-timeout" value="<?php echo (int)$config['timeout']; ?>">
              </div>
              <small class="col-sm-6 text-muted pt-2"><?php echo __('5–60 detik. Disarankan 10–15.'); ?></small>
            </div>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label" for="cfg-limit"><?php echo __('Maksimal hasil per server'); ?></label>
              <div class="col-sm-2">
                <input type="number" min="1" max="50" class="form-control" id="cfg-limit" value="<?php echo (int)$config['per_server_limit']; ?>">
              </div>
            </div>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label" for="cfg-field"><?php echo __('Ruas pencarian bawaan'); ?></label>
              <div class="col-sm-3">
                <select id="cfg-field" class="form-control">
                  <option value=""<?php echo $config['default_field'] === '' ? ' selected' : ''; ?>><?php echo __('Semua'); ?></option>
                  <option value="title"<?php echo $config['default_field'] === 'title' ? ' selected' : ''; ?>><?php echo __('Judul'); ?></option>
                  <option value="author"<?php echo $config['default_field'] === 'author' ? ' selected' : ''; ?>><?php echo __('Pengarang'); ?></option>
                  <option value="isbn"<?php echo $config['default_field'] === 'isbn' ? ' selected' : ''; ?>><?php echo __('ISBN'); ?></option>
                </select>
              </div>
            </div>
            <div class="form-group row">
              <div class="col-sm-8 offset-sm-4">
                <div class="custom-control custom-checkbox mb-1">
                  <input type="checkbox" class="custom-control-input" id="cfg-cover"<?php echo !empty($config['download_cover']) ? ' checked' : ''; ?>>
                  <label class="custom-control-label" for="cfg-cover"><?php echo __('Unduh gambar cover bila tersedia'); ?></label>
                </div>
                <div class="custom-control custom-checkbox mb-1">
                  <input type="checkbox" class="custom-control-input" id="cfg-digitals"<?php echo !empty($config['download_digitals']) ? ' checked' : ''; ?>>
                  <label class="custom-control-label" for="cfg-digitals"><?php echo __('Izinkan unduh file digital/attachment (dipilih per record saat menyalin satu-satu)'); ?></label>
                </div>
                <div class="custom-control custom-checkbox mb-1">
                  <input type="checkbox" class="custom-control-input" id="cfg-skipdup"<?php echo !empty($config['skip_duplicate_isbn']) ? ' checked' : ''; ?>>
                  <label class="custom-control-label" for="cfg-skipdup"><?php echo __('Lewati otomatis bila ISBN sudah ada di database lokal'); ?></label>
                </div>
              </div>
            </div>
            <?php if ($can_write): ?>
            <button type="submit" class="btn btn-primary" id="ccm-btn-save-config"><i class="fa fa-save"></i> <?php echo __('Simpan pengaturan'); ?></button>
            <?php endif; ?>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><strong><?php echo __('Server kustom'); ?></strong>
          <small class="text-muted"><?php echo __('(tambahan di luar Master File; tersimpan di config.json plugin)'); ?></small>
        </div>
        <div class="card-body">
          <?php if ($can_write): ?>
          <form id="ccm-custom-form" class="form-inline mb-3" onsubmit="return false;">
            <input type="text" id="ccm-custom-name" class="form-control mr-2" placeholder="<?php echo __('Nama perpustakaan'); ?>" style="min-width:220px;">
            <input type="url" id="ccm-custom-uri" class="form-control mr-2" placeholder="https://opac.contoh.id/slims/" style="min-width:320px;">
            <button type="submit" class="btn btn-success" id="ccm-btn-add-custom"><i class="fa fa-plus"></i> <?php echo __('Tambah'); ?></button>
          </form>
          <?php endif; ?>
          <?php if (empty($config['custom_servers'])): ?>
            <p class="text-muted mb-0"><?php echo __('Belum ada server kustom.'); ?></p>
          <?php else: ?>
            <table class="table table-sm">
              <thead><tr><th>#</th><th><?php echo __('Nama'); ?></th><th><?php echo __('URL'); ?></th><th></th></tr></thead>
              <tbody>
                <?php foreach ($config['custom_servers'] as $i => $cs): ?>
                <tr>
                  <td><?php echo $i + 1; ?></td>
                  <td><?php echo CCM_Helper::h($cs['name']); ?></td>
                  <td><small><?php echo CCM_Helper::h($cs['uri']); ?></small></td>
                  <td>
                    <?php if ($can_write): ?>
                    <button type="button" class="btn btn-sm btn-danger ccm-btn-del-custom" data-index="<?php echo $i; ?>"><?php echo __('Hapus'); ?></button>
                    <?php endif; ?>
                  </td>
                </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <!-- ================= TAB BANTUAN ================= -->
    <div class="tab-pane fade" id="ccm-tab-help" role="tabpanel">
      <div class="card">
        <div class="card-body">
          <h5><?php echo __('Cara memakai'); ?></h5>
          <ol>
            <li><?php echo __('Pastikan server sumber terdaftar di <strong>Master File &gt; Copy Cataloging Server Configuration</strong> dengan tipe <strong>P2P Server</strong>, atau tambahkan server kustom di tab Pengaturan.'); ?></li>
            <li><?php echo __('Centang server yang ingin dicari, masukkan kata kunci (ISBN paling akurat), lalu tekan <strong>Cari ke Semua Server</strong>.'); ?></li>
            <li><?php echo __('Klik <strong>judul</strong> untuk melihat detail lengkap sebelum menyalin, atau langsung tekan tombol <strong>Salin</strong>.'); ?></li>
            <li><?php echo __('Untuk banyak record sekaligus, centang beberapa baris lalu tekan <strong>Salin yang dipilih</strong> (maksimal 25 per proses).'); ?></li>
            <li><?php echo __('Data tersalin otomatis masuk indeks pencarian dan tercatat di log staf. GMD, penerbit, tempat terbit, bahasa, pengarang, dan subjek yang belum ada akan dibuat otomatis.'); ?></li>
          </ol>
          <h5 class="mt-3"><?php echo __('Syarat server sumber'); ?></h5>
          <ul>
            <li><?php echo __('Berbasis SLiMS dan dapat diakses dari server SLiMS Anda (cek firewall/DNS).'); ?></li>
            <li><?php echo __('Fitur XML aktif: <code>index.php?resultXML=true&amp;keywords=...</code> dan <code>index.php?p=show_detail&amp;inXML=true&amp;id=...</code> dapat dibuka.'); ?></li>
            <li><?php echo __('Gunakan tombol <strong>Uji</strong> pada tiap server untuk memastikan koneksi.'); ?></li>
                  </ul>
          <h5 class="mt-3"><?php echo __('Catatan'); ?></h5>
          <ul>
            <li><?php echo __('Salin massal tidak mengunduh file digital agar proses cepat. Untuk menyertakan file digital, salin satu per satu lewat tombol Detail lalu centang file yang diinginkan.'); ?></li>
            <li><?php echo __('Data hasil salinan ditandai <code>source = 1.{server_id}</code> sama seperti P2P bawaan, sehingga badge asal data tetap tampil di daftar bibliografi.'); ?></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal detail -->
<div class="modal fade" id="ccm-modal" tabindex="-1" role="dialog" aria-hidden="true">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title"><?php echo __('Detail katalog'); ?></h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body" id="ccm-modal-body">
        <div class="text-center p-4"><div class="spinner-border text-primary"></div></div>
      </div>
      <div class="modal-footer">
        <a href="#" target="_blank" id="ccm-modal-origin" class="btn btn-outline-secondary mr-auto" style="display:none;"><?php echo __('Buka di OPAC asal'); ?></a>
        <button type="button" class="btn btn-secondary" data-dismiss="modal"><?php echo __('Tutup'); ?></button>
        <?php if ($can_write): ?>
        <button type="button" class="btn btn-success" id="ccm-modal-copy"><i class="fa fa-copy"></i> <?php echo __('Salin record ini'); ?></button>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<script>
var CCM = {
  ajax: <?php echo json_encode($SELF); ?>,
  canWrite: <?php echo $can_write ? 'true' : 'false'; ?>,
  allowDigitals: <?php echo !empty($config['download_digitals']) ? 'true' : 'false'; ?>,
  editUrl: <?php echo json_encode($mwbMaster . 'bibliography/index.php?action=detail&biblioID='); ?>,
  lang: {
    copying: <?php echo json_encode(__('Menyalin...')); ?>,
    copy: <?php echo json_encode(__('Salin')); ?>,
    copied: <?php echo json_encode(__('Tersalin')); ?>,
    detail: <?php echo json_encode(__('Detail')); ?>,
    noResult: <?php echo json_encode(__('Tidak ada hasil dari server yang dipilih.')); ?>,
    confirmCopy: <?php echo json_encode(__('Salin record ini ke database lokal?')); ?>,
    needSelect: <?php echo json_encode(__('Pilih minimal satu record.')); ?>,
    error: <?php echo json_encode(__('Terjadi kesalahan.')); ?>
  }
};
</script>
<script src="<?php echo CCM_Helper::h($ASSETS . 'app.js?v=' . CCM_Helper::VERSION); ?>"></script>
