<?php
/**
 * AI Chat API Endpoint
 * API untuk menangani request chat dari frontend
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load konfigurasi
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/Logger.php';
require_once __DIR__ . '/../includes/SlimsService.php';
require_once __DIR__ . '/../includes/GeminiService.php';
require_once __DIR__ . '/../includes/ChatManager.php';

$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // Validasi method
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan');
    }

    // Ambil input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['action'])) {
        throw new Exception('Request tidak valid');
    }

    // Initialize Chat Manager
    $chatManager = new ChatManager();

    switch ($input['action']) {
        case 'chat':
            $response = handleChat($input, $chatManager);
            break;
            
        case 'get_history':
            $response = handleGetHistory($chatManager);
            break;
            
        case 'clear_history':
            $response = handleClearHistory($chatManager);
            break;
            
        case 'get_stats':
            $response = handleGetStats();
            break;
            
        case 'search_books':
            $response = handleSearchBooks($input);
            break;
            
        case 'quick_action':
            $response = handleQuickAction($input, $chatManager);
            break;
            
        default:
            throw new Exception('Action tidak valid');
    }

} catch (Exception $e) {
    Logger::error('API Error', ['message' => $e->getMessage()]);
    $response = [
        'success' => false,
        'message' => $e->getMessage()
    ];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE);

/**
 * Handle chat message
 */
function handleChat(array $input, ChatManager $chatManager): array {
    // Check rate limit
    if (!$chatManager->checkRateLimit()) {
        return [
            'success' => false,
            'message' => 'Terlalu banyak request. Mohon tunggu sebentar.',
            'rate_limited' => true
        ];
    }

    // Validasi message
    if (empty($input['message'])) {
        throw new Exception('Pesan tidak boleh kosong');
    }

    $message = trim($input['message']);
    
    // Validasi panjang pesan
    if (strlen($message) > 1000) {
        throw new Exception('Pesan terlalu panjang (maksimal 1000 karakter)');
    }

    // Simpan pesan user
    $chatManager->addMessage('user', $message);

    // Generate response
    $gemini = new GeminiService();
    $history = $chatManager->getHistoryForApi();
    $result = $gemini->generateWithAutoContext($message, $history);

    if (!$result['success']) {
        // Hapus pesan user jika gagal
        Logger::error('Gemini Error', ['error' => $result['error']]);
        return [
            'success' => false,
            'message' => 'Maaf, terjadi kesalahan: ' . $result['error']
        ];
    }

    // Simpan respons bot
    $chatManager->addMessage('model', $result['response']);

    return [
        'success' => true,
        'message' => $result['response'],
        'remaining_requests' => $chatManager->getRemainingRequests(),
        'context' => $result['context_used'] ?? null,
        'usage' => $result['usage'] ?? null
    ];
}

/**
 * Handle get history
 */
function handleGetHistory(ChatManager $chatManager): array {
    return [
        'success' => true,
        'data' => $chatManager->getHistory(),
        'remaining_requests' => $chatManager->getRemainingRequests()
    ];
}

/**
 * Handle clear history
 */
function handleClearHistory(ChatManager $chatManager): array {
    $chatManager->clearHistory();
    return [
        'success' => true,
        'message' => 'Riwayat chat berhasil dihapus'
    ];
}

/**
 * Handle get stats
 */
function handleGetStats(): array {
    $slims = new SlimsService();
    $stats = $slims->getLibraryStats();
    
    return [
        'success' => true,
        'data' => $stats
    ];
}

/**
 * Handle search books
 */
function handleSearchBooks(array $input): array {
    if (empty($input['query'])) {
        throw new Exception('Query pencarian tidak boleh kosong');
    }

    $slims = new SlimsService();
    $books = $slims->searchBooks($input['query'], 10);
    
    return [
        'success' => true,
        'data' => $books
    ];
}

/**
 * Handle quick action
 */
function handleQuickAction(array $input, ChatManager $chatManager): array {
    $action = $input['action_type'] ?? '';
    
    $quickMessages = [
        'latest' => 'Apa koleksi terbaru di perpustakaan ini?',
        'popular' => 'Buku apa saja yang paling sering dipinjam?',
        'help' => 'Bantu saya mencari buku tentang programming',
        'stats' => 'Berikan saya statistik perpustakaan',
        'how_to_borrow' => 'Bagaimana cara meminjam buku di perpustakaan ini?',
        'membership' => 'Bagaimana cara menjadi anggota perpustakaan?'
    ];

    if (!isset($quickMessages[$action])) {
        throw new Exception('Quick action tidak valid');
    }

    // Proses seolah-olah user mengirim pesan
    $input['message'] = $quickMessages[$action];
    return handleChat($input, $chatManager);
}
