<?php
/**
 * AI Library Chatbot Configuration
 * Konfigurasi untuk Portal AI Chatbot Perpustakaan
 * 
 * @author Arena.ai Agent
 * @version 1.0.0
 */

// ======================
// SLIMS DATABASE CONFIG
// ======================
define('SLIMS_HOST', 'localhost');
define('SLIMS_DATABASE', 'slims9_bulian');
define('SLIMS_USERNAME', 'root');
define('SLIMS_PASSWORD', '');
define('SLIMS_PORT', 3306);
define('SLIMS_CHARSET', 'utf8mb4');

// ======================
// GEMINI API CONFIG
// ======================
define('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY_HERE');
define('GEMINI_MODEL', 'gemini-1.5-flash'); // atau 'gemini-1.5-pro' untuk hasil lebih baik
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/');

// ======================
// APP CONFIG
// ======================
define('APP_NAME', 'AI Library Assistant');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'https://your-domain.com/ai-chatbot/');

// Session & Security
define('SESSION_NAME', 'AI_LIBRARY_SESSION');
define('CSRF_TOKEN_NAME', 'csrf_token');

// Rate Limiting
define('MAX_REQUESTS_PER_MINUTE', 30);
define('MAX_REQUESTS_PER_HOUR', 200);

// Chat Settings
define('MAX_CHAT_HISTORY', 50);
define('CHAT_TIMEOUT_MINUTES', 30);

// Log Settings
define('ENABLE_DEBUG', false);
define('LOG_FILE', __DIR__ . '/../logs/app.log');
