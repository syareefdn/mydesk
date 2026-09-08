<?php
/**
 * Plugin Name: Copy Catalog Multi Server
 * Plugin URI: https://github.com/syareefdn/mydesk
 * Description: Cari sekali ke banyak OPAC/katalog SLiMS sekaligus, lalu salin data bibliografi dengan satu klik. Melengkapi P2P Service bawaan yang hanya mencari ke satu server.
 * Version: 1.0.2
 * Author: SLiMS Community (dikembangkan untuk SLiMS 9.3.x)
 * Author URI: https://slims.web.id
 *
 * CATATAN INSTALASI:
 * Berkas loader ini diletakkan LANGSUNG di <slims>/plugins/ (sejajar dengan
 * folder copy_catalog_multi/). Alasannya: pemindai plugin SLiMS 9.3.x hanya
 * memindai 2 folder pertama (bug penghitung kedalaman), sementara berkas
 * .plugin.php berbentuk file selalu terdeteksi. Dengan pola loader ini,
 * plugin kebal terhadap bug tersebut berapa pun banyaknya folder lain.
 */

use SLiMS\Plugins;

$__ccm_index = __DIR__ . '/copy_catalog_multi/index.php';
if (is_file($__ccm_index)) {
    $plugin = Plugins::getInstance();
    $plugin->registerMenu('bibliography', 'Copy Catalog Multi', $__ccm_index, 'Cari & salin katalog dari banyak server SLiMS sekaligus');
}
