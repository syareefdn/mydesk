<?php
/**
 * Copy Catalog Multi Server - Helper
 *
 * Inti logika plugin: daftar server, fetch paralel (curl_multi),
 * parsing MODS XML, dan penyimpanan data bibliografi.
 *
 * Dibuat kompatibel dengan SLiMS 9.3.x (PHP 7.2+) :
 *  - Tidak bergantung pada SLiMS\Http\Client, SLiMS\Url,
 *    maupun SLiMS\Filesystems\Storage (ada fallback sendiri).
 *  - Memakai ulang pustaka inti SLiMS yang sudah lama ada:
 *    modsxmlsenayan.inc.php, biblio_utils.inc.php,
 *    biblio_indexer.inc.php, simbio_dbop.
 *
 * @package copy_catalog_multi
 * @license GPL-3.0-or-later
 */

if (!defined('INDEX_AUTH')) {
    die('Direct access not allowed!');
}

class CCM_Helper
{
    const VERSION = '1.0.2';
    const CONFIG_FILE = 'config.json';

    /**
     * Konfigurasi bawaan.
     */
    public static function defaultConfig()
    {
        return array(
            // Maksimum detik menunggu tiap server saat pencarian
            'timeout' => 12,
            // Maksimum record yang diambil per server per halaman
            'per_server_limit' => 10,
            // Unduh gambar cover saat menyalin?
            'download_cover' => true,
            // Unduh file digital/attachment saat menyalin?
            // (daftar file digital dipilih saat menyalin satu record)
            'download_digitals' => true,
            // Lewati penyimpanan bila ISBN sudah ada di database lokal?
            'skip_duplicate_isbn' => true,
            // Field pencarian bawaan: '' (semua), 'title', 'author', 'isbn'
            'default_field' => '',
            // Server tambahan (di luar mst_servers), dikelola dari tab Pengaturan.
            // Format: array(array('name' => ..., 'uri' => ...), ...)
            'custom_servers' => array(),
        );
    }

    /**
     * Lokasi file config.json
     */
    public static function configPath()
    {
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . self::CONFIG_FILE;
    }

    /**
     * Muat konfigurasi (digabung dengan bawaan).
     */
    public static function loadConfig()
    {
        $config = self::defaultConfig();
        $path = self::configPath();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false) {
                $parsed = json_decode($raw, true);
                if (is_array($parsed)) {
                    foreach ($parsed as $key => $val) {
                        $config[$key] = $val;
                    }
                }
            }
        }
        // Normalisasi tipe
        $config['timeout'] = max(5, min(60, (int)$config['timeout']));
        $config['per_server_limit'] = max(1, min(50, (int)$config['per_server_limit']));
        $config['download_cover'] = !empty($config['download_cover']);
        $config['download_digitals'] = !empty($config['download_digitals']);
        $config['skip_duplicate_isbn'] = !empty($config['skip_duplicate_isbn']);
        if (!is_array($config['custom_servers'])) {
            $config['custom_servers'] = array();
        }
        return $config;
    }

    /**
     * Simpan konfigurasi.
     *
     * @return true|string true bila sukses, pesan error bila gagal.
     */
    public static function saveConfig($config)
    {
        $path = self::configPath();
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (@file_put_contents($path, $json) === false) {
            return 'Gagal menulis file config.json. Pastikan folder plugin writable (chmod 775 atau 777).';
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Daftar server
    // ------------------------------------------------------------------

    /**
     * Ambil daftar server P2P/SLiMS dari mst_servers (server_type = 1)
     * digabung dengan custom_servers dari config.json.
     *
     * @return array daftar array('key'=>..., 'id'=>..., 'name'=>..., 'uri'=>..., 'origin'=>db|custom)
     */
    public static function getServers($dbs, $config = null)
    {
        if ($config === null) {
            $config = self::loadConfig();
        }
        $servers = array();

        // 1) Dari database (dikelola via Master File > Copy Cataloging Server Configuration)
        $res = @$dbs->query("SELECT server_id, name, uri FROM mst_servers WHERE server_type IN ('1', 1) ORDER BY name ASC");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $uri = trim((string)$row['uri']);
                if (!self::isValidUrl($uri)) {
                    continue;
                }
                $servers[] = array(
                    'key' => 'db' . (int)$row['server_id'],
                    'id' => (int)$row['server_id'],
                    'name' => $row['name'],
                    'uri' => self::cleanUrl($uri),
                    'origin' => 'db',
                );
            }
        }

        // 2) Server kustom dari config.json (tidak mengubah mst_servers)
        if (!empty($config['custom_servers']) && is_array($config['custom_servers'])) {
            $i = 0;
            foreach ($config['custom_servers'] as $custom) {
                $uri = isset($custom['uri']) ? trim((string)$custom['uri']) : '';
                $name = isset($custom['name']) ? trim((string)$custom['name']) : '';
                if ($name === '' || !self::isValidUrl($uri)) {
                    continue;
                }
                $servers[] = array(
                    'key' => 'c' . $i,
                    'id' => 0,
                    'custom_index' => $i,
                    'name' => $name,
                    'uri' => self::cleanUrl($uri),
                    'origin' => 'custom',
                );
                $i++;
            }
        }

        return $servers;
    }

    /**
     * Cari satu server berdasarkan key (db{id} atau c{index}).
     */
    public static function findServer($dbs, $key, $config = null)
    {
        $servers = self::getServers($dbs, $config);
        foreach ($servers as $server) {
            if ($server['key'] === $key) {
                return $server;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // URL
    // ------------------------------------------------------------------

    public static function isValidUrl($url)
    {
        if (!is_string($url) || trim($url) === '') {
            return false;
        }
        // filter_var cukup untuk validasi umum http/https
        if (filter_var(trim($url), FILTER_VALIDATE_URL) === false) {
            return false;
        }
        return (bool)preg_match('@^https?://@i', trim($url));
    }

    /**
     * Normalisasi URL basis OPAC: pastikan diakhiri garis miring tunggal.
     * Contoh: https://opac.contoh.id/slims  -> https://opac.contoh.id/slims/
     */
    public static function cleanUrl($url)
    {
        $url = trim($url);
        $parts = parse_url($url);
        if (!isset($parts['scheme']) || !isset($parts['host'])) {
            return rtrim($url, '/') . '/';
        }
        $base = strtolower($parts['scheme']) . '://' . $parts['host'];
        if (isset($parts['port'])) {
            $base .= ':' . $parts['port'];
        }
        $path = isset($parts['path']) ? $parts['path'] : '/';
        // Buang file index.php di ujung path bila ada
        $path = preg_replace('@/index\.php$@i', '/', $path);
        $base .= rtrim($path, '/') . '/';
        return $base;
    }

    /**
     * Bangun URL pencarian XML persis seperti P2P bawaan SLiMS.
     */
    public static function buildSearchUrl($baseUri, $keywords, $field, $page)
    {
        $page = max(1, (int)$page);
        $field = in_array($field, array('title', 'author', 'isbn'), true) ? $field : '';
        $keywords = trim((string)$keywords);
        if ($field !== '') {
            return $baseUri . 'index.php?resultXML=true&' . $field . '=' . urlencode($keywords) . '&search=Search&page=' . $page;
        }
        return $baseUri . 'index.php?resultXML=true&search=Search&page=' . $page . '&keywords=' . urlencode($keywords);
    }

    /**
     * Bangun URL detail XML satu record.
     */
    public static function buildDetailUrl($baseUri, $remoteId)
    {
        return $baseUri . 'index.php?p=show_detail&inXML=true&id=' . urlencode((string)$remoteId);
    }

    // ------------------------------------------------------------------
    // HTTP fetch (paralel + tunggal)
    // ------------------------------------------------------------------

    protected static function curlOptions($timeout)
    {
        $ua = 'SLiMS-CopyCatalogMulti/' . self::VERSION;
        if (isset($_SERVER['HTTP_USER_AGENT'])) {
            $ua .= ' (' . substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 120) . ')';
        }
        return array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => min(8, (int)$timeout),
            CURLOPT_TIMEOUT => (int)$timeout,
            CURLOPT_USERAGENT => $ua,
            CURLOPT_ENCODING => '',
            // Banyak server OPAC memakai HTTPS self-signed / chain tidak lengkap.
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
        );
    }

    /**
     * Fetch banyak URL sekaligus (curl_multi). Fallback sekuensial bila
     * ekstensi curl tidak tersedia.
     *
     * @param array $jobs key => url
     * @return array key => array(ok, content, error, http, time)
     */
    public static function fetchMulti($jobs, $timeout)
    {
        $timeout = (int)$timeout > 0 ? (int)$timeout : 12;
        $results = array();
        foreach ($jobs as $key => $url) {
            $results[$key] = array('ok' => false, 'content' => '', 'error' => '', 'http' => 0, 'time' => 0);
        }

        if (empty($jobs)) {
            return $results;
        }

        // --- Tanpa curl: fallback sekuensial via file_get_contents ---
        if (!function_exists('curl_init') || !function_exists('curl_multi_init')) {
            foreach ($jobs as $key => $url) {
                $results[$key] = self::fetchOne($url, $timeout);
            }
            return $results;
        }

        $mh = curl_multi_init();
        $handles = array();

        foreach ($jobs as $key => $url) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            foreach (self::curlOptions($timeout) as $opt => $val) {
                // FOLLOWLOCATION bisa gagal bila open_basedir aktif; abaikan.
                if ($opt === CURLOPT_FOLLOWLOCATION && ini_get('open_basedir') !== '') {
                    continue;
                }
                @curl_setopt($ch, $opt, $val);
            }
            curl_multi_add_handle($mh, $ch);
            $handles[$key] = $ch;
        }

        $start = microtime(true);
        $running = null;
        do {
            $status = curl_multi_exec($mh, $running);
            if ($running) {
                curl_multi_select($mh, 1.0);
            }
        } while ($running && $status == CURLM_OK);

        foreach ($handles as $key => $ch) {
            $content = curl_multi_getcontent($ch);
            $errno = curl_errno($ch);
            $error = $errno ? curl_error($ch) : '';
            $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $results[$key] = array(
                'ok' => ($errno === 0 && $http > 0 && $http < 400 && $content !== false && $content !== ''),
                'content' => is_string($content) ? $content : '',
                'error' => $error !== '' ? $error : ($http >= 400 ? 'HTTP ' . $http : ($content === '' || $content === false ? 'Respon kosong dari server.' : '')),
                'http' => $http,
                'time' => round(microtime(true) - $start, 2),
            );
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);

        return $results;
    }

    /**
     * Fetch satu URL.
     */
    public static function fetchOne($url, $timeout)
    {
        $timeout = (int)$timeout > 0 ? (int)$timeout : 12;
        $start = microtime(true);

        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            foreach (self::curlOptions($timeout) as $opt => $val) {
                if ($opt === CURLOPT_FOLLOWLOCATION && ini_get('open_basedir') !== '') {
                    continue;
                }
                @curl_setopt($ch, $opt, $val);
            }
            $content = curl_exec($ch);
            $errno = curl_errno($ch);
            $error = $errno ? curl_error($ch) : '';
            $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $ok = ($errno === 0 && $http > 0 && $http < 400 && $content !== false && $content !== '');
            return array(
                'ok' => $ok,
                'content' => is_string($content) ? $content : '',
                'error' => $error !== '' ? $error : ($http >= 400 ? 'HTTP ' . $http : (!$ok ? 'Respon kosong dari server.' : '')),
                'http' => $http,
                'time' => round(microtime(true) - $start, 2),
            );
        }

        // Fallback tanpa curl
        $ctx = stream_context_create(array(
            'http' => array(
                'method' => 'GET',
                'timeout' => $timeout,
                'ignore_errors' => true,
                'header' => "User-Agent: SLiMS-CopyCatalogMulti/" . self::VERSION . "\r\n",
            ),
            'ssl' => array('verify_peer' => false, 'verify_peer_name' => false),
        ));
        $content = @file_get_contents($url, false, $ctx);
        $ok = is_string($content) && $content !== '';
        return array(
            'ok' => $ok,
            'content' => is_string($content) ? $content : '',
            'error' => $ok ? '' : 'Gagal mengambil URL (curl tidak tersedia & file_get_contents gagal).',
            'http' => 0,
            'time' => round(microtime(true) - $start, 2),
        );
    }

    // ------------------------------------------------------------------
    // Parsing MODS XML
    // ------------------------------------------------------------------

    /**
     * Pastikan fungsi modsXMLsenayan() bawaan SLiMS tersedia.
     */
    public static function ensureModsParser()
    {
        if (!function_exists('modsXMLsenayan') && defined('LIB')) {
            $parser = LIB . 'modsxmlsenayan.inc.php';
            if (is_file($parser)) {
                require_once $parser;
            }
        }
        return function_exists('modsXMLsenayan');
    }

    /**
     * Parse string XML hasil pencarian/detail.
     *
     * @return array|false array('result_num'=>..,'records'=>array(...)) atau false bila gagal.
     */
    public static function parseMods($xmlString, &$error = '')
    {
        $error = '';
        if (!is_string($xmlString) || trim($xmlString) === '') {
            $error = 'XML kosong.';
            return false;
        }

        // 1) Pakai parser bawaan SLiMS bila ada (hasil paling konsisten).
        if (self::ensureModsParser()) {
            $data = @modsXMLsenayan($xmlString, 'string');
            if (is_array($data) && isset($data['records']) && is_array($data['records'])) {
                return $data;
            }
            if (is_string($data)) {
                $error = $data;
            }
            // lanjut ke fallback bila parser bawaan gagal
        }

        // 2) Fallback internal (SimpleXML) agar plugin tetap jalan.
        return self::parseModsFallback($xmlString, $error);
    }

    /**
     * Parser MODS minimal untuk format XML SLiMS.
     */
    public static function parseModsFallback($xmlString, &$error = '')
    {
        $error = '';
        if (!function_exists('simplexml_load_string')) {
            $error = 'Ekstensi PHP SimpleXML tidak tersedia.';
            return false;
        }
        $prev = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NSCLEAN);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        if ($xml === false) {
            $error = 'Gagal mem-parsing XML (bukan XML SLiMS yang valid / fitur XML dimatikan?).';
            return false;
        }

        $out = array('result_num' => 0, 'result_page' => 1, 'result_showed' => 0, 'records' => array());

        // Info jumlah hasil (namespace slims / senayan)
        foreach (array('http://slims.web.id', 'http://senayan.diknas.go.id') as $ns) {
            $slims = $xml->children($ns);
            if ($slims && isset($slims->resultInfo)) {
                $out['result_num'] = (int)$slims->resultInfo->modsResultNum;
                $out['result_page'] = (int)$slims->resultInfo->modsResultPage;
                $out['result_showed'] = (int)$slims->resultInfo->modsResultShowed;
                break;
            }
        }

        foreach ($xml->mods as $record) {
            $data = array();
            $data['id'] = (string)$record['ID'];
            if ($data['id'] === '') {
                $data['id'] = (string)$record['id'];
            }

            $data['title'] = (string)$record->titleInfo->title;
            if (isset($record->titleInfo->subTitle)) {
                $data['title'] .= (string)$record->titleInfo->subTitle;
            }

            $data['authors'] = array();
            if (isset($record->name) && $record->name) {
                foreach ($record->name as $nameNode) {
                    $role = isset($nameNode->role->roleTerm) ? (string)$nameNode->role->roleTerm : '';
                    $data['authors'][] = array(
                        'name' => (string)$nameNode->namePart,
                        'authority_list' => (string)$nameNode['authority'],
                        'level' => ($role === 'Primary Author') ? 1 : 2,
                        'author_type' => (string)$nameNode['type'],
                    );
                }
            }

            $data['publish_place'] = isset($record->originInfo->place->placeTerm) ? (string)$record->originInfo->place->placeTerm : '';
            $data['publisher'] = (string)$record->originInfo->publisher;
            $data['publish_year'] = (string)$record->originInfo->dateIssued;
            $data['edition'] = (string)$record->originInfo->edition;

            $data['language'] = array('code' => '', 'name' => '');
            if (isset($record->language->languageTerm)) {
                foreach ($record->language->languageTerm as $term) {
                    if ((string)$term['type'] === 'code') {
                        $data['language']['code'] = (string)$term;
                    } else {
                        $data['language']['name'] = (string)$term;
                    }
                }
            }

            $data['gmd'] = (string)$record->physicalDescription->form;
            $data['collation'] = (string)$record->physicalDescription->extent;
            if (isset($record->relatedItem['type']) && (string)$record->relatedItem['type'] === 'series') {
                $data['series_title'] = (string)$record->relatedItem->titleInfo->title;
            }
            $data['notes'] = (string)$record->note;

            $data['subjects'] = array();
            foreach ($record->subject as $subj) {
                $term = '';
                $termType = '';
                if (isset($subj->topic)) {
                    $term = (string)$subj->topic;
                    $termType = 'topical';
                } elseif (isset($subj->geographic)) {
                    $term = (string)$subj->geographic;
                    $termType = 'geographic';
                } elseif (isset($subj->name)) {
                    $term = (string)$subj->name;
                    $termType = 'name';
                } elseif (isset($subj->temporal)) {
                    $term = (string)$subj->temporal;
                    $termType = 'temporal';
                } elseif (isset($subj->genre)) {
                    $term = (string)$subj->genre;
                    $termType = 'genre';
                } elseif (isset($subj->occupation)) {
                    $term = (string)$subj->occupation;
                    $termType = 'occupation';
                }
                $data['subjects'][] = array('term' => $term, 'term_type' => $termType, 'authority' => (string)$subj['authority']);
            }

            $data['classification'] = (string)$record->classification;
            $data['isbn_issn'] = '';
            if (isset($record->identifier['type']) && strtolower((string)$record->identifier['type']) === 'isbn') {
                $data['isbn_issn'] = (string)$record->identifier;
            }
            $data['call_number'] = (string)$record->location->shelfLocator;

            if (isset($record->recordInfo)) {
                $rid = (string)$record->recordInfo->recordIdentifier;
                if ($rid !== '') {
                    $data['id'] = $rid;
                }
            }

            $slimsRec = $record->children('http://slims.web.id');
            if (isset($slimsRec->image)) {
                $data['image'] = (string)$slimsRec->image;
            }
            if (isset($slimsRec->digitals)) {
                $data['digitals'] = array();
                foreach ($slimsRec->digitals->digital_item as $dig) {
                    $attr = (array)$dig->attributes();
                    $attr = isset($attr['@attributes']) ? $attr['@attributes'] : array();
                    $data['digitals'][] = array(
                        'id' => isset($attr['id']) ? $attr['id'] : '',
                        'title' => (string)$dig,
                        'path' => isset($attr['path']) ? $attr['path'] : '',
                        'mimetype' => isset($attr['mimetype']) ? $attr['mimetype'] : '',
                        'url' => isset($attr['url']) ? $attr['url'] : '',
                    );
                }
            }

            $out['records'][] = $data;
        }

        if ($out['result_num'] <= 0) {
            $out['result_num'] = count($out['records']);
        }
        $out['result_showed'] = count($out['records']);

        return $out;
    }

    /**
     * Ringkas satu record untuk tabel hasil (hemat bandwidth JSON).
     */
    public static function summarizeRecord($record, $server)
    {
        $authors = array();
        if (isset($record['authors']) && is_array($record['authors'])) {
            foreach ($record['authors'] as $author) {
                if (isset($author['name']) && trim((string)$author['name']) !== '') {
                    $authors[] = trim((string)$author['name']);
                }
            }
        }
        $digitals = isset($record['digitals']) && is_array($record['digitals']) ? count($record['digitals']) : 0;

        return array(
            'remote_id' => isset($record['id']) ? (string)$record['id'] : '',
            'title' => isset($record['title']) ? (string)$record['title'] : '(Tanpa judul)',
            'authors' => implode('; ', $authors),
            'publisher' => isset($record['publisher']) ? (string)$record['publisher'] : '',
            'publish_year' => isset($record['publish_year']) ? (string)$record['publish_year'] : '',
            'isbn' => isset($record['isbn_issn']) ? (string)$record['isbn_issn'] : '',
            'gmd' => isset($record['gmd']) ? (string)$record['gmd'] : '',
            'call_number' => isset($record['call_number']) ? (string)$record['call_number'] : '',
            'has_digitals' => $digitals,
            'server_key' => $server['key'],
            'server_name' => $server['name'],
        );
    }

    // ------------------------------------------------------------------
    // Detail & simpan
    // ------------------------------------------------------------------

    /**
     * Ambil satu record detail dari server sumber.
     */
    public static function getDetail($serverUri, $remoteId, $timeout)
    {
        $url = self::buildDetailUrl($serverUri, $remoteId);
        $fetch = self::fetchOne($url, $timeout);
        if (!$fetch['ok']) {
            return array('ok' => false, 'record' => null, 'error' => 'Gagal mengambil detail: ' . $fetch['error'], 'url' => $url);
        }
        $error = '';
        $data = self::parseMods($fetch['content'], $error);
        if ($data === false || empty($data['records'])) {
            return array('ok' => false, 'record' => null, 'error' => 'Gagal mem-parsing detail XML. ' . $error, 'url' => $url);
        }
        return array('ok' => true, 'record' => $data['records'][0], 'error' => '', 'url' => $url);
    }

    /**
     * Cek duplikat lokal berdasarkan ISBN / judul persis.
     *
     * @return array('by_isbn'=>biblio_id|0, 'by_title'=>biblio_id|0)
     */
    public static function findDuplicate($dbs, $isbn, $title)
    {
        $dup = array('by_isbn' => 0, 'by_title' => 0);
        $isbn = trim((string)$isbn);
        if ($isbn !== '') {
            // ISBN di SLiMS kadang berisi beberapa nomor; cocokkan persis dulu.
            $safe = $dbs->escape_string($isbn);
            $q = @$dbs->query("SELECT biblio_id FROM biblio WHERE isbn_issn = '{$safe}' LIMIT 1");
            if ($q && $q->num_rows > 0) {
                $row = $q->fetch_row();
                $dup['by_isbn'] = (int)$row[0];
            }
        }
        $title = trim((string)$title);
        if ($title !== '') {
            $safe = $dbs->escape_string($title);
            $q = @$dbs->query("SELECT biblio_id FROM biblio WHERE title = '{$safe}' LIMIT 1");
            if ($q && $q->num_rows > 0) {
                $row = $q->fetch_row();
                $dup['by_title'] = (int)$row[0];
            }
        }
        return $dup;
    }

    /**
     * Pastikan direktori ada (rekursif).
     */
    public static function ensureDir($path)
    {
        if (is_dir($path)) {
            return true;
        }
        return @mkdir($path, 0755, true);
    }

    /**
     * Unduh berkas biner (cover / digital) dan kembalikan isinya.
     */
    public static function downloadBinary($url, $timeout, $maxBytes = 8388608)
    {
        $fetch = self::fetchOne($url, $timeout);
        if (!$fetch['ok']) {
            return array('ok' => false, 'content' => '', 'error' => $fetch['error']);
        }
        if (strlen($fetch['content']) > $maxBytes) {
            return array('ok' => false, 'content' => '', 'error' => 'Ukuran berkas melebihi ' . round($maxBytes / 1048576, 1) . ' MB.');
        }
        return array('ok' => true, 'content' => $fetch['content'], 'error' => '');
    }

    /**
     * Simpan satu record hasil copy ke database lokal.
     *
     * @param mysqli $dbs
     * @param array $record hasil parse MODS (detail)
     * @param array $server info server sumber
     * @param array $options download_cover, download_digitals, skip_duplicate_isbn, digitals(array id terpilih)
     * @param array &$caches cache ID (gmd, publisher, dsb) antar record dalam satu request bulk
     * @return array hasil: status, biblio_id, title, message, duplicate
     */
    public static function saveRecord($dbs, $record, $server, $options, &$caches = null)
    {
        if ($caches === null) {
            $caches = array('gmd' => array(), 'publ' => array(), 'place' => array(), 'lang' => array(), 'author' => array(), 'subject' => array());
        }
        foreach (array('gmd', 'publ', 'place', 'lang', 'author', 'subject') as $ck) {
            if (!isset($caches[$ck]) || !is_array($caches[$ck])) {
                $caches[$ck] = array();
            }
        }

        // Pustaka pendukung bawaan SLiMS
        if (defined('SIMBIO') && !class_exists('simbio_dbop')) {
            $dbop = SIMBIO . 'simbio_DB' . DIRECTORY_SEPARATOR . 'simbio_dbop.inc.php';
            if (is_file($dbop)) {
                require_once $dbop;
            }
        }
        if (defined('MDLBS') && !function_exists('getAuthorID')) {
            $utils = MDLBS . 'bibliography' . DIRECTORY_SEPARATOR . 'biblio_utils.inc.php';
            if (is_file($utils)) {
                require_once $utils;
            }
        }

        $title = isset($record['title']) ? trim((string)$record['title']) : '';
        $isbn = isset($record['isbn_issn']) ? trim((string)$record['isbn_issn']) : '';
        if ($title === '') {
            return array('status' => 'error', 'biblio_id' => 0, 'title' => '(Tanpa judul)', 'message' => 'Judul kosong, record dilewati.', 'duplicate' => null);
        }

        // --- Cek duplikat ---
        $dup = self::findDuplicate($dbs, $isbn, $title);
        if (!empty($options['skip_duplicate_isbn']) && $dup['by_isbn'] > 0) {
            return array(
                'status' => 'duplicate_skipped',
                'biblio_id' => $dup['by_isbn'],
                'title' => $title,
                'message' => 'Dilewati: ISBN sudah ada di database lokal (biblio_id ' . $dup['by_isbn'] . ').',
                'duplicate' => $dup,
            );
        }

        $sql_op = new simbio_dbop($dbs);

        // --- Susun data biblio ---
        $biblio = array();
        foreach ($record as $field => $content) {
            if (is_string($content)) {
                $biblio[$field] = $dbs->escape_string(trim($content));
            }
        }

        $gmdName = isset($record['gmd']) ? trim((string)$record['gmd']) : '';
        $biblio['gmd_id'] = ($gmdName !== '') ? utility::getID($dbs, 'mst_gmd', 'gmd_id', 'gmd_name', $record['gmd'], $caches['gmd']) : 'literal{NULL}';
        unset($biblio['gmd']);

        $publName = isset($record['publisher']) ? trim((string)$record['publisher']) : '';
        $biblio['publisher_id'] = ($publName !== '') ? utility::getID($dbs, 'mst_publisher', 'publisher_id', 'publisher_name', $record['publisher'], $caches['publ']) : 'literal{NULL}';
        unset($biblio['publisher']);

        $placeName = isset($record['publish_place']) ? trim((string)$record['publish_place']) : '';
        $biblio['publish_place_id'] = ($placeName !== '') ? utility::getID($dbs, 'mst_place', 'place_id', 'place_name', $record['publish_place'], $caches['place']) : 'literal{NULL}';
        unset($biblio['publish_place']);

        $langName = (isset($record['language']) && is_array($record['language']) && isset($record['language']['name'])) ? trim((string)$record['language']['name']) : '';
        $biblio['language_id'] = ($langName !== '') ? utility::getID($dbs, 'mst_language', 'language_id', 'language_name', $langName, $caches['lang']) : 'literal{NULL}';
        unset($biblio['language']);

        $authors = (isset($record['authors']) && is_array($record['authors'])) ? $record['authors'] : array();
        unset($biblio['authors']);
        $subjects = (isset($record['subjects']) && is_array($record['subjects'])) ? $record['subjects'] : array();
        unset($biblio['subjects']);
        $digitals = (isset($record['digitals']) && is_array($record['digitals'])) ? $record['digitals'] : array();

        // Penanda asal (format sama seperti P2P bawaan: "1.{server_id}")
        // sehingga badge "Copy from ..." bawaan SLiMS tetap tampil.
        $serverId = isset($server['id']) ? (int)$server['id'] : 0;
        $biblio['source'] = '1.' . $serverId;
        $biblio['input_date'] = date('Y-m-d H:i:s');
        $biblio['last_update'] = date('Y-m-d H:i:s');

        unset($biblio['manuscript'], $biblio['collection'], $biblio['resource_type']);
        unset($biblio['genre_authority'], $biblio['genre'], $biblio['issuance'], $biblio['location']);
        unset($biblio['id'], $biblio['create_date'], $biblio['modified_date'], $biblio['origin']);

        // --- Cover ---
        $coverInfo = '';
        if (isset($biblio['image']) && trim((string)$biblio['image']) !== '' && empty($options['download_cover'])) {
            // Unduh cover dimatikan: jangan simpan nama berkas remote tanpa berkasnya.
            $biblio['image'] = 'literal{NULL}';
        } elseif (!empty($options['download_cover']) && isset($biblio['image']) && trim((string)$biblio['image']) !== '') {
            $coverFile = basename((string)$record['image']);
            if (preg_match('/\.(jpe?g|png|gif)$/i', $coverFile)) {
                $destDir = defined('IMGBS') ? IMGBS . 'docs' : null;
                if ($destDir && self::ensureDir($destDir)) {
                    $dest = $destDir . DIRECTORY_SEPARATOR . $coverFile;
                    if (!is_file($dest)) {
                        // Coba berkas asli dulu, lalu thumbnail.
                        $tried = array(
                            $server['uri'] . 'images/docs/' . rawurlencode($coverFile),
                            $server['uri'] . 'lib/minigalnano/createthumb.php?filename=images/docs/' . rawurlencode($coverFile),
                        );
                        $saved = false;
                        foreach ($tried as $coverUrl) {
                            $dl = self::downloadBinary($coverUrl, 15, 2097152);
                            if ($dl['ok'] && strlen($dl['content']) > 100) {
                                if (@file_put_contents($dest, $dl['content']) !== false) {
                                    $saved = true;
                                    break;
                                }
                            }
                        }
                        if (!$saved) {
                            $coverInfo = ' (cover gagal diunduh)';
                            $biblio['image'] = 'literal{NULL}';
                        }
                    }
                } else {
                    $biblio['image'] = 'literal{NULL}';
                }
            } else {
                $biblio['image'] = 'literal{NULL}';
            }
        } elseif (isset($biblio['image']) && trim((string)$biblio['image']) === '') {
            $biblio['image'] = 'literal{NULL}';
        }

        // --- Insert biblio ---
        if (!$sql_op->insert('biblio', $biblio)) {
            return array('status' => 'error', 'biblio_id' => 0, 'title' => $title, 'message' => 'Gagal menyimpan biblio: ' . $sql_op->error, 'duplicate' => $dup);
        }
        $biblio_id = (int)$sql_op->insert_id;
        if ($biblio_id <= 0) {
            return array('status' => 'error', 'biblio_id' => 0, 'title' => $title, 'message' => 'Gagal menyimpan biblio (insert_id kosong).', 'duplicate' => $dup);
        }

        // --- Pengarang ---
        foreach ($authors as $author) {
            $authorName = isset($author['name']) ? trim((string)$author['name']) : '';
            if ($authorName === '') {
                continue;
            }
            $authorType = isset($author['author_type']) ? strtolower(substr((string)$author['author_type'], 0, 1)) : 'p';
            if (!in_array($authorType, array('p', 'o', 'c'), true)) {
                $authorType = 'p';
            }
            $level = isset($author['level']) ? (int)$author['level'] : 1;
            if (function_exists('getAuthorID')) {
                $author_id = getAuthorID($authorName, $authorType, $caches['author']);
                if ($author_id) {
                    @$dbs->query("INSERT IGNORE INTO biblio_author (biblio_id, author_id, level) VALUES ({$biblio_id}, {$author_id}, {$level})");
                }
            }
        }

        // --- Subjek/topik ---
        foreach ($subjects as $subject) {
            $term = isset($subject['term']) ? trim((string)$subject['term']) : '';
            if ($term === '') {
                continue;
            }
            $termType = isset($subject['term_type']) ? (string)$subject['term_type'] : '';
            $lower = strtolower($termType);
            if ($lower === 'temporal') {
                $subjectType = 'tm';
            } elseif ($lower === 'genre') {
                $subjectType = 'gr';
            } elseif ($lower === 'occupation') {
                $subjectType = 'oc';
            } else {
                $subjectType = strtolower(substr($termType, 0, 1));
                if (!in_array($subjectType, array('t', 'g', 'n'), true)) {
                    $subjectType = 't';
                }
            }
            if (function_exists('getSubjectID')) {
                $subject_id = getSubjectID($term, $subjectType, $caches['subject']);
                if ($subject_id) {
                    @$dbs->query("INSERT IGNORE INTO biblio_topic (biblio_id, topic_id, level) VALUES ({$biblio_id}, {$subject_id}, 1)");
                }
            }
        }

        // --- File digital (opsional, sesuai pilihan) ---
        $digitalSaved = 0;
        $wantedDigitals = (isset($options['digitals']) && is_array($options['digitals'])) ? $options['digitals'] : null;
        if (!empty($options['download_digitals']) && !empty($digitals) && defined('REPOBS')) {
            foreach ($digitals as $digital) {
                $digId = isset($digital['id']) ? (string)$digital['id'] : '';
                // Bila daftar pilihan dikirim (salin satu record via modal),
                // hanya unduh yang dicentang. Bila null (salin massal),
                // lewati digital agar cepat; user bisa salin ulang satu-satu.
                if (is_array($wantedDigitals) && !in_array($digId, $wantedDigitals, true)) {
                    continue;
                }
                if ($wantedDigitals === null) {
                    continue;
                }
                $digPath = isset($digital['path']) ? (string)$digital['path'] : '';
                if ($digId === '' || $digPath === '') {
                    continue;
                }
                $file_name = preg_replace('/.*\//', '', $digPath);
                $file_name = str_replace(array('/', '\\'), '', $file_name);
                if ($file_name === '') {
                    continue;
                }
                $target_path = str_replace('/', DIRECTORY_SEPARATOR, ltrim($digPath, '/'));
                $target_dir = dirname(REPOBS . $target_path);
                if (!self::ensureDir($target_dir)) {
                    continue;
                }
                $remoteId = isset($record['id']) ? (string)$record['id'] : '';
                $urls = array(
                    $server['uri'] . 'index.php?p=fstream-pdf&fid=' . urlencode($digId) . '&bid=' . urlencode($remoteId) . '&fname=' . urlencode($file_name),
                    $server['uri'] . 'index.php?p=fstream&fid=' . urlencode($digId) . '&bid=' . urlencode($remoteId) . '&fname=' . urlencode($file_name),
                );
                $content = '';
                foreach ($urls as $fileUrl) {
                    $dl = self::downloadBinary($fileUrl, 30, 20971520);
                    if ($dl['ok'] && strlen($dl['content']) > 100) {
                        $content = $dl['content'];
                        break;
                    }
                }
                if ($content === '') {
                    continue;
                }
                if (@file_put_contents(REPOBS . $target_path, $content) === false) {
                    continue;
                }
                $fdata = array(
                    'uploader_id' => isset($_SESSION['uid']) ? (int)$_SESSION['uid'] : 1,
                    'file_title' => $dbs->escape_string(isset($digital['title']) ? (string)$digital['title'] : $file_name),
                    'file_name' => $dbs->escape_string($file_name),
                    'file_url' => $dbs->escape_string($urls[1]),
                    'mime_type' => $dbs->escape_string(isset($digital['mimetype']) ? (string)$digital['mimetype'] : 'application/octet-stream'),
                    'file_desc' => '',
                    'input_date' => date('Y-m-d H:i:s'),
                    'last_update' => date('Y-m-d H:i:s'),
                );
                if ($sql_op->insert('files', $fdata)) {
                    $saved_file_id = (int)$sql_op->insert_id;
                    $ba = array(
                        'biblio_id' => $biblio_id,
                        'file_id' => $saved_file_id,
                        'access_type' => 'public',
                        'access_limit' => 'literal{NULL}',
                    );
                    $sql_op->insert('biblio_attachment', $ba);
                    $digitalSaved++;
                }
            }
        }

        // --- Indeks pencarian ---
        if (defined('MDLBS') && !class_exists('biblio_indexer')) {
            $indexerFile = MDLBS . 'system' . DIRECTORY_SEPARATOR . 'biblio_indexer.inc.php';
            if (is_file($indexerFile)) {
                require_once $indexerFile;
            }
        }
        if (class_exists('biblio_indexer')) {
            try {
                $indexer = new biblio_indexer($dbs);
                $indexer->makeIndex($biblio_id);
            } catch (Exception $e) {
                // Indeks gagal bukan fatal; data sudah tersimpan.
            }
        }

        // --- Log staf ---
        if (function_exists('writeLog') && isset($_SESSION['uid'])) {
            $realname = isset($_SESSION['realname']) ? $_SESSION['realname'] : 'staff';
            @writeLog(
                'staff',
                $_SESSION['uid'],
                'bibliography',
                $realname . ' menyalin data bibliografi via Copy Catalog Multi (server: ' . $server['name'] . ') berjudul (' . $title . ') dengan biblio_id (' . $biblio_id . ')',
                'Copy Catalog Multi',
                'Add'
            );
        }

        $message = 'Tersimpan sebagai biblio_id ' . $biblio_id . '.' . $coverInfo;
        if ($digitalSaved > 0) {
            $message .= ' (' . $digitalSaved . ' file digital ikut disalin.)';
        }
        if ($dup['by_isbn'] > 0 || $dup['by_title'] > 0) {
            $message .= ' Catatan: kemungkinan duplikat data lokal.';
        }

        return array(
            'status' => 'saved',
            'biblio_id' => $biblio_id,
            'title' => $title,
            'message' => $message,
            'duplicate' => $dup,
        );
    }

    /**
     * Kirim respon JSON dan hentikan eksekusi.
     */
    public static function json($data)
    {
        // Bersihkan output sebelumnya agar JSON valid.
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Escape HTML.
     */
    public static function h($str)
    {
        return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
    }
}
