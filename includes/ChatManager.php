<?php
/**
 * Chat Manager Class
 * Mengelola session dan history chat
 */

class ChatManager {
    private Database $db;
    private string $sessionId;
    private array $chatHistory = [];
    private int $maxHistory = MAX_CHAT_HISTORY;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->initSession();
    }

    /**
     * Inisialisasi session
     */
    private function initSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_name(SESSION_NAME);
            session_start();
        }
        
        // Generate atau ambil session ID
        if (!isset($_SESSION['chat_session_id'])) {
            $_SESSION['chat_session_id'] = $this->generateSessionId();
        }
        
        $this->sessionId = $_SESSION['chat_session_id'];
        
        // Load chat history dari session atau database
        $this->loadHistory();
    }

    /**
     * Generate unique session ID
     */
    private function generateSessionId(): string {
        return bin2hex(random_bytes(16));
    }

    /**
     * Load chat history
     */
    private function loadHistory(): void {
        // Coba load dari database dulu
        $dbHistory = $this->getHistoryFromDb();
        
        if (!empty($dbHistory)) {
            $this->chatHistory = $dbHistory;
        } elseif (isset($_SESSION['chat_history'])) {
            $this->chatHistory = $_SESSION['chat_history'];
        }
    }

    /**
     * Simpan chat ke database
     */
    private function saveToDb(string $role, string $content): void {
        $sql = "INSERT INTO ai_chat_history (session_id, role, content, created_at) 
                VALUES (?, ?, ?, NOW())";
        $this->db->execute($sql, [$this->sessionId, $role, $content]);
    }

    /**
     * Ambil history dari database
     */
    private function getHistoryFromDb(): array {
        $sql = "SELECT role, content FROM ai_chat_history 
                WHERE session_id = ? 
                ORDER BY created_at ASC 
                LIMIT ?";
        return $this->db->query($sql, [$this->sessionId, $this->maxHistory]);
    }

    /**
     * Tambah pesan ke chat
     */
    public function addMessage(string $role, string $content): void {
        $this->chatHistory[] = [
            'role' => $role,
            'content' => $content,
            'timestamp' => date('Y-m-d H:i:s')
        ];

        // Simpan ke database
        $this->saveToDb($role, $content);

        // Trim history jika terlalu panjang
        if (count($this->chatHistory) > $this->maxHistory) {
            $this->chatHistory = array_slice($this->chatHistory, -$this->maxHistory);
        }

        // Update session
        $_SESSION['chat_history'] = $this->chatHistory;
    }

    /**
     * Ambil chat history
     */
    public function getHistory(): array {
        return $this->chatHistory;
    }

    /**
     * Ambil history untuk API (format yang dimengerti Gemini)
     */
    public function getHistoryForApi(): array {
        $history = [];
        
        // Ambil 10 percakapan terakhir (pair)
        $recentHistory = array_slice($this->chatHistory, -20);
        
        foreach ($recentHistory as $msg) {
            $history[] = [
                'role' => $msg['role'],
                'content' => $msg['content']
            ];
        }
        
        return $history;
    }

    /**
     * Clear chat history
     */
    public function clearHistory(): void {
        $this->chatHistory = [];
        $_SESSION['chat_history'] = [];
        
        // Hapus dari database
        $sql = "DELETE FROM ai_chat_history WHERE session_id = ?";
        $this->db->execute($sql, [$this->sessionId]);
    }

    /**
     * Get session ID
     */
    public function getSessionId(): string {
        return $this->sessionId;
    }

    /**
     * Check rate limiting
     */
    public function checkRateLimit(): bool {
        $sql = "SELECT COUNT(*) as cnt FROM ai_chat_history 
                WHERE session_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)";
        
        $result = $this->db->queryOne($sql, [$this->sessionId]);
        return ($result['cnt'] ?? 0) < MAX_REQUESTS_PER_MINUTE;
    }

    /**
     * Get remaining requests
     */
    public function getRemainingRequests(): int {
        $sql = "SELECT COUNT(*) as cnt FROM ai_chat_history 
                WHERE session_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)";
        
        $result = $this->db->queryOne($sql, [$this->sessionId]);
        return max(0, MAX_REQUESTS_PER_MINUTE - ($result['cnt'] ?? 0));
    }
}
