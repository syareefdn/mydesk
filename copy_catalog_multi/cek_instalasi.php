<?php
/**
 * Copy Catalog Multi Server - Skrip Diagnosis Instalasi
 *
 * Cara pakai:
 *  1. Pastikan file ini ada di: <slims>/plugins/copy_catalog_multi/cek_instalasi.php
 *  2. Buka lewat browser, misal:
 *     https://domain-anda/slims/plugins/copy_catalog_multi/cek_instalasi.php
 *  3. Baca hasilnya / kirim screenshot ke pengembang bila masih bermasalah.
 *
 * PENTING: hapus file ini setelah selesai diagnosis.
 *
 * @package copy_catalog_multi
 * @license GPL-3.0-or-later
 */

header('Content-Type: text/html; charset=utf-8');

function ccm_h($s)
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function ccm_badge($ok)
{
    return $ok
        ? '<b style="color:#15803d">OK</b>'
        : '<b style="color:#b91c1c">GAGAL</b>';
}

$dir = __DIR__; // .../plugins/copy_catalog_multi (seharusnya)
$pluginsDir = dirname($dir); // .../plugins (seharusnya)
$slimsRoot = dirname($pluginsDir); // .../ (root SLiMS, seharusnya)

$rows = array();
$add = function ($label, $ok, $detail = '') use (&$rows) {
    $rows[] = array($label, (bool)$ok, (string)$detail);
};

// --- 1. Berkas loader plugin (v1.0.2+: pendaftaran via loader di plugins/) ---
$pluginFile = $pluginsDir . '/copy_catalog_multi.plugin.php';
$add('Berkas loader <code>copy_catalog_multi.plugin.php</code> ada di folder <code>plugins/</code> (sejajar folder ini)', is_file($pluginFile), $pluginFile);
$add('Berkas loader bisa dibaca oleh PHP', is_readable($pluginFile));

$headerOk = false;
if (is_readable($pluginFile)) {
    $head = @file_get_contents($pluginFile, false, null, 0, 2048);
    $headerOk = is_string($head) && stripos($head, 'Plugin Name:') !== false;
}
$add('Header <code>Plugin Name:</code> terbaca (syarat tampil di daftar plugin)', $headerOk);

$legacyFile = $dir . '/copy_catalog_multi.plugin.php';
$legacyGone = !is_file($legacyFile);
$add(
    'Tidak ada sisa instalasi lama v1.0.x di dalam folder ini',
    $legacyGone,
    $legacyGone ? 'Bersih' : 'Ditemukan! Hapus ' . $legacyFile . ' agar plugin tidak muncul ganda di daftar.'
);

// --- 2. Keterbacaan folder ---
$ownList = @scandir($dir);
$add('PHP bisa membaca isi folder plugin ini', is_array($ownList), is_array($ownList) ? (count($ownList) - 2) . ' berkas/folder terlihat' : 'scandir() gagal — cek permission folder (755)');

$pluginsList = @scandir($pluginsDir);
$add('PHP bisa membaca folder <code>plugins/</code> induk', is_array($pluginsList), $pluginsDir);

// --- 3. Apakah ini benar instalasi SLiMS? ---
$sysconfig = $slimsRoot . '/sysconfig.inc.php';
$add('Folder ini berada di dalam instalasi SLiMS (<code>sysconfig.inc.php</code> ditemukan dua tingkat di atas)', is_file($sysconfig), $slimsRoot);

$version = '-';
if (is_readable($sysconfig)) {
    $cfg = @file_get_contents($sysconfig);
    if (is_string($cfg)) {
        if (preg_match("/SENAYAN_VERSION_TAG'\\s*,\\s*'([^']+)'/", $cfg, $m)) {
            $version = $m[1];
        } elseif (preg_match('/SENAYAN_VERSION\'\\s*,\\s*\'([^\']+)\'/', $cfg, $m)) {
            $version = $m[1];
        }
    }
}
$versionOk = ($version !== '-') && (strpos($version, '9.3') !== false || strpos($version, '9.4') !== false || strpos($version, '9.5') !== false || strpos($version, '9.6') !== false || strpos($version, '9.7') !== false || strpos($version, '9.8') !== false || strpos($version, '9.9') !== false);
$add('Versi SLiMS terdeteksi 9.3 atau lebih baru (sistem plugin tersedia)', $versionOk, 'Terdeteksi: ' . $version);

// --- 4. Lingkungan PHP ---
$add('PHP versi 7.2+', version_compare(PHP_VERSION, '7.2.0', '>='), 'Versi: ' . PHP_VERSION);
$add('Ekstensi <code>SimpleXML</code> (wajib)', extension_loaded('simplexml'));
$add('Ekstensi <code>curl</code> (disarankan)', extension_loaded('curl'));
$add('Ekstensi <code>mbstring</code> (disarankan)', extension_loaded('mbstring'));

// --- 5. Kepenulisan ---
$add('Berkas <code>config.json</code> bisa ditulis (untuk menyimpan pengaturan)', is_writable($dir . '/config.json'));
$add('Folder <code>images/docs/</code> bisa ditulis (untuk cover)', is_dir($slimsRoot . '/images/docs') && is_writable($slimsRoot . '/images/docs'));
$add('Folder <code>repository/</code> bisa ditulis (untuk file digital)', is_dir($slimsRoot . '/repository') && is_writable($slimsRoot . '/repository'));

$failCount = 0;
foreach ($rows as $r) {
    if (!$r[1]) {
        $failCount++;
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnosis Copy Catalog Multi Server</title>
<style>
body { font-family: Arial, sans-serif; background: #f3f4f6; color: #111827; margin: 0; padding: 20px; }
.box { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; }
h1 { font-size: 20px; margin: 0 0 4px; }
.sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
th { background: #f9fafb; }
code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
.detail { color: #6b7280; font-size: 12px; }
.warn { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 12px; margin-top: 16px; font-size: 13px; }
.good { background: #dcfce7; border: 1px solid #16a34a; border-radius: 6px; padding: 10px 12px; margin-top: 16px; font-size: 13px; }
ul { margin: 6px 0 0 18px; padding: 0; font-size: 13px; }
</style>
</head>
<body>
<div class="box">
  <h1>Diagnosis: Copy Catalog Multi Server</h1>
  <div class="sub">
    Dibuka via <code><?php echo ccm_h(isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '-'); ?></code>
    &middot; Folder skrip: <code><?php echo ccm_h($dir); ?></code>
  </div>
  <table>
    <tr><th style="width:60px">Status</th><th>Pemeriksaan</th><th>Keterangan</th></tr>
    <?php foreach ($rows as $r): ?>
    <tr>
      <td><?php echo ccm_badge($r[1]); ?></td>
      <td><?php echo $r[0]; ?></td>
      <td class="detail"><?php echo ccm_h($r[2]); ?></td>
    </tr>
    <?php endforeach; ?>
  </table>

  <?php if ($failCount === 0): ?>
  <div class="good">
    <b>Semua pemeriksaan lolos.</b> Dari sisi berkas, plugin seharusnya sudah tampil di
    <b>System &rarr; Plugin</b> dengan nama <i>Copy Catalog Multi Server</i>. Bila tetap tidak muncul,
    kemungkinan besar Anda membuka <b>instalasi SLiMS yang berbeda</b> di browser
    (mis. domain/subfolder lain) — pastikan alamat browser menunjuk ke SLiMS yang
    foldernya Anda lihat di File Manager ini (root terdeteksi: <code><?php echo ccm_h($slimsRoot); ?></code>).
  </div>
  <?php else: ?>
  <div class="warn">
    <b>Ada <?php echo (int)$failCount; ?> pemeriksaan yang gagal.</b> Periksa yang bertanda GAGAL:
    <ul>
      <li>Berkas loader tidak ada / tidak terbaca &rarr; upload berkas <code>copy_catalog_multi.plugin.php</code>
        LANGSUNG ke folder <code>plugins/</code> (sejajar folder <code>copy_catalog_multi/</code>,
        bukan di dalamnya), dengan nama persis huruf kecil.</li>
      <li><code>sysconfig.inc.php</code> tidak ditemukan &rarr; folder plugin <b>salah tempat</b>;
        pindahkan ke <code>&lt;slims&gt;/plugins/copy_catalog_multi/</code> instalasi yang benar.</li>
      <li>Versi SLiMS di bawah 9.3 &rarr; sistem plugin tidak tersedia; plugin ini butuh SLiMS 9.3+.</li>
      <li>Folder/berkas tidak writable &rarr; set permission folder <code>755</code> dan berkas <code>644</code>
        via File Manager (klik kanan &rarr; Change Permissions).</li>
    </ul>
  </div>
  <?php endif; ?>

  <div class="warn">
    <b>Setelah selesai:</b> hapus berkas <code>cek_instalasi.php</code> ini dari server.
  </div>
</div>
</body>
</html>
