<?php
/**
 * Logger Class
 * Untuk debugging dan logging aplikasi
 */

class Logger {
    private static string $logFile;
    
    public static function init(string $logFile): void {
        self::$logFile = $logFile;
        $dir = dirname($logFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }

    public static function info(string $message, array $context = []): void {
        self::log('INFO', $message, $context);
    }

    public static function error(string $message, array $context = []): void {
        self::log('ERROR', $message, $context);
    }

    public static function debug(string $message, array $context = []): void {
        if (ENABLE_DEBUG) {
            self::log('DEBUG', $message, $context);
        }
    }

    private static function log(string $level, string $message, array $context): void {
        if (!defined('LOG_FILE')) return;
        
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = !empty($context) ? ' ' . json_encode($context) : '';
        $logMessage = "[$timestamp] [$level] $message$contextStr" . PHP_EOL;
        
        file_put_contents(LOG_FILE, $logMessage, FILE_APPEND);
    }
}

// Initialize logger
if (defined('LOG_FILE')) {
    Logger::init(LOG_FILE);
}
