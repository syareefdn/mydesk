<?php
/**
 * SLIMS Service Class
 * Service untuk mengambil data dari database SLIMS Bulian 9
 */

class SlimsService {
    private Database $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    /**
     * Cari buku berdasarkan judul, pengarang, atau ISBN
     */
    public function searchBooks(string $keyword, int $limit = 10): array {
        $keyword = '%' . $keyword . '%';
        
        $sql = "SELECT 
                    b.biblio_id,
                    b.title,
                    b.isbn_issn,
                    b.publish_year,
                    b.call_number,
                    b.language_id,
                    b.frequency_id,
                    GROUP_CONCAT(DISTINCT a.author_name SEPARATOR ', ') as authors,
                    p.publisher_name,
                    pl.place_name as publish_place
                FROM biblio b
                LEFT JOIN biblio_author ba ON b.biblio_id = ba.biblio_id
                LEFT JOIN mst_author a ON ba.author_id = a.author_id
                LEFT JOIN mst_publisher p ON b.publisher_id = p.publisher_id
                LEFT JOIN mst_place pl ON b.publish_place_id = pl.place_id
                WHERE b.title LIKE ? 
                   OR b.isbn_issn LIKE ?
                   OR EXISTS (
                       SELECT 1 FROM biblio_author ba2 
                       JOIN mst_author a2 ON ba2.author_id = a2.author_id 
                       WHERE ba2.biblio_id = b.biblio_id AND a2.author_name LIKE ?
                   )
                GROUP BY b.biblio_id
                ORDER BY b.last_update DESC
                LIMIT ?";
        
        return $this->db->query($sql, [$keyword, $keyword, $keyword, $limit]);
    }

    /**
     * Ambil detail buku lengkap
     */
    public function getBookDetail(int $biblioId): ?array {
        $sql = "SELECT 
                    b.*,
                    GROUP_CONCAT(DISTINCT a.author_name SEPARATOR ', ') as authors,
                    p.publisher_name,
                    pl.place_name as publish_place,
                    btc.topic as subjects
                FROM biblio b
                LEFT JOIN biblio_author ba ON b.biblio_id = ba.biblio_id
                LEFT JOIN mst_author a ON ba.author_id = a.author_id
                LEFT JOIN mst_publisher p ON b.publisher_id = p.publisher_id
                LEFT JOIN mst_place pl ON b.publish_place_id = pl.place_id
                LEFT JOIN biblio_topic bt ON b.biblio_id = bt.biblio_id
                LEFT JOIN mst_topic btc ON bt.topic_id = btc.topic_id
                WHERE b.biblio_id = ?
                GROUP BY b.biblio_id";
        
        return $this->db->queryOne($sql, [$biblioId]);
    }

    /**
     * Ambil informasi ketersediaan item (eksemplar)
     */
    public function getBookAvailability(int $biblioId): array {
        $sql = "SELECT 
                    i.item_code,
                    i.call_number,
                    i.inventory_code,
                    i.site,
                    i.location,
                    s.source_name,
                    i.status_id,
                    st.status_name,
                    CASE 
                        WHEN i.status_id = 'AVAILABLE' THEN 'Tersedia'
                        ELSE st.status_name
                    END as availability_status,
                    CASE 
                        WHEN i.status_id = 'AVAILABLE' THEN 1
                        ELSE 0
                    END as is_available
                FROM items i
                LEFT JOIN mst_source s ON i.source_id = s.source_id
                LEFT JOIN mst_availability_status st ON i.status_id = st.status_code
                WHERE i.biblio_id = ?
                ORDER BY i.item_code";
        
        return $this->db->query($sql, [$biblioId]);
    }

    /**
     * Cek ketersediaan buku
     */
    public function checkAvailability(int $biblioId): array {
        $sql = "SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN status_id = 'AVAILABLE' THEN 1 ELSE 0 END) as available_items,
                    SUM(CASE WHEN status_id != 'AVAILABLE' THEN 1 ELSE 0 END) as borrowed_items
                FROM items
                WHERE biblio_id = ?";
        
        return $this->db->queryOne($sql, [$biblioId]) ?? ['total_items' => 0, 'available_items' => 0, 'borrowed_items' => 0];
    }

    /**
     * Cari anggota perpustakaan
     */
    public function searchMembers(string $keyword, int $limit = 10): array {
        $keyword = '%' . $keyword . '%';
        
        $sql = "SELECT 
                    member_id,
                    member_name,
                    member_email,
                    member_phone,
                    member_address,
                    register_date,
                    expire_date,
                    member_type_id,
                    is_pending,
                    is_expired,
                    CASE 
                        WHEN is_pending = 1 THEN 'Menunggu Konfirmasi'
                        WHEN is_expired = 1 THEN 'Kedaluwarsa'
                        ELSE 'Aktif'
                    END as member_status
                FROM member
                WHERE member_name LIKE ? 
                   OR member_id LIKE ?
                   OR member_email LIKE ?
                ORDER BY member_name
                LIMIT ?";
        
        return $this->db->query($sql, [$keyword, $keyword, $keyword, $limit]);
    }

    /**
     * Ambil riwayat peminjaman anggota
     */
    public function getMemberLoanHistory(string $memberId, int $limit = 10): array {
        $sql = "SELECT 
                    l.loan_id,
                    l.loan_date,
                    l.due_date,
                    l.return_date,
                    l.is_return,
                    b.biblio_id,
                    b.title,
                    b.call_number,
                    lkd.fine_each_day,
                    lk.due_day as loan_due_days,
                    DATEDIFF(COALESCE(l.return_date, CURDATE()), l.due_date) as overdue_days,
                    CASE 
                        WHEN l.is_return = 0 AND l.due_date < CURDATE() THEN 'Terlambat'
                        WHEN l.is_return = 0 THEN 'Dipinjam'
                        ELSE 'Dikembalikan'
                    END as loan_status
                FROM loan l
                JOIN items i ON l.item_code = i.item_code
                JOIN biblio b ON i.biblio_id = b.biblio_id
                LEFT JOIN loan_rule lk ON i.loan_type = lk.loan_type
                LEFT JOIN loan_rule_detail lkd ON lk.loan_type = lkd.loan_type AND lk.member_type_id = lkd.member_type_id
                WHERE l.member_id = ?
                ORDER BY l.loan_date DESC
                LIMIT ?";
        
        return $this->db->query($sql, [$memberId, $limit]);
    }

    /**
     * Ambil peminjaman aktif anggota
     */
    public function getActiveLoans(string $memberId): array {
        $sql = "SELECT 
                    l.loan_id,
                    l.loan_date,
                    l.due_date,
                    l.is_return,
                    b.biblio_id,
                    b.title,
                    b.call_number,
                    i.item_code,
                    DATEDIFF(l.due_date, CURDATE()) as days_remaining,
                    CASE 
                        WHEN DATEDIFF(l.due_date, CURDATE()) < 0 THEN 'Terlambat'
                        WHEN DATEDIFF(l.due_date, CURDATE()) <= 3 THEN 'Segera Dikembalikan'
                        ELSE 'Masih Dipinjam'
                    END as status_text
                FROM loan l
                JOIN items i ON l.item_code = i.item_code
                JOIN biblio b ON i.biblio_id = b.biblio_id
                WHERE l.member_id = ? AND l.is_return = 0
                ORDER BY l.due_date ASC";
        
        return $this->db->query($sql, [$memberId]);
    }

    /**
     * Ambil koleksi berdasarkan tema/topik
     */
    public function getCollectionsByTopic(string $topic, int $limit = 10): array {
        $topic = '%' . $topic . '%';
        
        $sql = "SELECT DISTINCT
                    b.biblio_id,
                    b.title,
                    b.call_number,
                    b.publish_year,
                    GROUP_CONCAT(DISTINCT a.author_name SEPARATOR ', ') as authors
                FROM biblio b
                JOIN biblio_topic bt ON b.biblio_id = bt.biblio_id
                JOIN mst_topic t ON bt.topic_id = t.topic_id
                LEFT JOIN biblio_author ba ON b.biblio_id = ba.biblio_id
                LEFT JOIN mst_author a ON ba.author_id = a.author_id
                WHERE t.topic LIKE ?
                GROUP BY b.biblio_id
                ORDER BY b.last_update DESC
                LIMIT ?";
        
        return $this->db->query($sql, [$topic, $limit]);
    }

    /**
     * Ambil statistik perpustakaan
     */
    public function getLibraryStats(): array {
        $stats = [];

        // Total koleksi
        $sql = "SELECT COUNT(*) as total FROM biblio";
        $stats['total_books'] = $this->db->queryOne($sql)['total'] ?? 0;

        // Total item
        $sql = "SELECT COUNT(*) as total FROM items";
        $stats['total_items'] = $this->db->queryOne($sql)['total'] ?? 0;

        // Item tersedia
        $sql = "SELECT COUNT(*) as total FROM items WHERE status_id = 'AVAILABLE'";
        $stats['available_items'] = $this->db->queryOne($sql)['total'] ?? 0;

        // Total anggota
        $sql = "SELECT COUNT(*) as total FROM member WHERE is_pending = 0";
        $stats['total_members'] = $this->db->queryOne($sql)['total'] ?? 0;

        // Peminjaman bulan ini
        $sql = "SELECT COUNT(*) as total FROM loan WHERE MONTH(loan_date) = MONTH(CURDATE()) AND YEAR(loan_date) = YEAR(CURDATE())";
        $stats['monthly_loans'] = $this->db->queryOne($sql)['total'] ?? 0;

        // Pengunjung bulan ini (jika ada tabel visits)
        $sql = "SELECT COUNT(*) as total FROM visitor_count WHERE DATE(visit_date) = CURDATE()";
        $result = $this->db->queryOne($sql);
        $stats['today_visitors'] = $result['total'] ?? 0;

        return $stats;
    }

    /**
     * Ambil koleksi terbaru
     */
    public function getLatestCollections(int $limit = 10): array {
        $sql = "SELECT 
                    b.biblio_id,
                    b.title,
                    b.call_number,
                    b.input_date,
                    GROUP_CONCAT(DISTINCT a.author_name SEPARATOR ', ') as authors,
                    p.publisher_name,
                    b.publish_year
                FROM biblio b
                LEFT JOIN biblio_author ba ON b.biblio_id = ba.biblio_id
                LEFT JOIN mst_author a ON ba.author_id = a.author_id
                LEFT JOIN mst_publisher p ON b.publisher_id = p.publisher_id
                GROUP BY b.biblio_id
                ORDER BY b.input_date DESC
                LIMIT ?";
        
        return $this->db->query($sql, [$limit]);
    }

    /**
     * Ambil koleksi terpopuler (paling sering dipinjam)
     */
    public function getPopularCollections(int $limit = 10): array {
        $sql = "SELECT 
                    b.biblio_id,
                    b.title,
                    b.call_number,
                    GROUP_CONCAT(DISTINCT a.author_name SEPARATOR ', ') as authors,
                    COUNT(l.loan_id) as loan_count
                FROM biblio b
                LEFT JOIN items i ON b.biblio_id = i.biblio_id
                LEFT JOIN loan l ON i.item_code = l.item_code
                LEFT JOIN biblio_author ba ON b.biblio_id = ba.biblio_id
                LEFT JOIN mst_author a ON ba.author_id = a.author_id
                GROUP BY b.biblio_id
                HAVING loan_count > 0
                ORDER BY loan_count DESC
                LIMIT ?";
        
        return $this->db->query($sql, [$limit]);
    }

    /**
     * Generate context untuk AI dari query SLIMS
     */
    public function generateContextForAI(string $query): array {
        $context = [];
        
        // Deteksi jenis query
        $lowerQuery = strtolower($query);
        
        // Cek jika query tentang ketersediaan
        if (preg_match('/(tersedia|ada|stock|ketersediaan|availability)/i', $lowerQuery)) {
            $stats = $this->getLibraryStats();
            $context['type'] = 'availability';
            $context['stats'] = $stats;
        }
        
        // Cek jika query tentang pencarian buku
        if (preg_match('/(cari|temukan|search|book|buku)/i', $lowerQuery)) {
            // Ekstrak kata kunci pencarian
            $keywords = preg_replace('/(cari|temukan|search|book|buku|tentang| tentang)/i', '', $lowerQuery);
            $keywords = trim($keywords);
            if (!empty($keywords)) {
                $books = $this->searchBooks($keywords, 5);
                $context['type'] = 'book_search';
                $context['keyword'] = $keywords;
                $context['books'] = $books;
            }
        }
        
        // Cek jika query tentang statistik
        if (preg_match('/(statistik|jumlah|total|berapa banyak)/i', $lowerQuery)) {
            $stats = $this->getLibraryStats();
            $context['type'] = 'statistics';
            $context['stats'] = $stats;
        }
        
        // Cek jika query tentang koleksi terbaru
        if (preg_match('/(terbaru|new|latest|日前)/i', $lowerQuery)) {
            $latest = $this->getLatestCollections(5);
            $context['type'] = 'latest';
            $context['collections'] = $latest;
        }
        
        // Cek jika query tentang peminjaman anggota
        if (preg_match('/(pinjam|peminjaman|loan|meminjam)/i', $lowerQuery)) {
            $context['type'] = 'loan_info';
        }
        
        return $context;
    }
}
