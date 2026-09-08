<?php
/**
 * Plugin Name: Copy Catalog Multi Server
 * Plugin URI: https://github.com/syareefdn/mydesk
 * Description: Cari sekali ke banyak OPAC/katalog SLiMS sekaligus, lalu salin data bibliografi dengan satu klik. Melengkapi P2P Service bawaan yang hanya mencari ke satu server.
 * Version: 1.0.0
 * Author: SLiMS Community (dikembangkan untuk SLiMS 9.3.x)
 * Author URI: https://slims.web.id
 */

use SLiMS\Plugins;

$plugin = Plugins::getInstance();
$plugin->registerMenu('bibliography', 'Copy Catalog Multi', __DIR__ . '/index.php', 'Cari & salin katalog dari banyak server SLiMS sekaligus');
