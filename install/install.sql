-- =====================================================
-- AI Library Chatbot Database Schema
-- Tabel untuk menyimpan chat history dan session
-- =====================================================

-- Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS ai_chatbot
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE ai_chatbot;

-- =====================================================
-- Tabel: ai_chat_history
-- Menyimpan riwayat percakapan chat
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(64) NOT NULL,
    role ENUM('user', 'model') NOT NULL COMMENT 'user atau model (bot)',
    content TEXT NOT NULL,
    context_data JSON NULL COMMENT 'Data konteks jika ada (hasil query SLIMS)',
    token_count INT UNSIGNED NULL COMMENT 'Jumlah token yang digunakan',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_session_created (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabel menyimpan riwayat chat AI chatbot';

-- =====================================================
-- Tabel: ai_conversations
-- Menyimpan metadata percakapan
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(64) NOT NULL,
    first_message TEXT NULL,
    last_message TEXT NULL,
    message_count INT UNSIGNED NOT NULL DEFAULT 0,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_session_id (session_id),
    INDEX idx_is_active (is_active),
    INDEX idx_last_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Metadata percakapan chat';

-- =====================================================
-- Tabel: ai_rate_limits
-- Untuk tracking rate limiting per session/IP
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    identifier VARCHAR(128) NOT NULL COMMENT 'Session ID atau IP Address',
    identifier_type ENUM('session', 'ip') NOT NULL,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_identifier_type (identifier, identifier_type),
    INDEX idx_window_start (window_start),
    INDEX idx_blocked (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracking rate limiting';

-- =====================================================
-- Tabel: ai_feedback
-- Feedback pengguna untuk improve AI responses
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_feedback (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    chat_history_id BIGINT UNSIGNED NOT NULL,
    is_helpful BOOLEAN NULL COMMENT 'NULL=neutral, TRUE=helpful, FALSE=not helpful',
    feedback_text TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_chat_history_id (chat_history_id),
    FOREIGN KEY (chat_history_id) REFERENCES ai_chat_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Feedback untuk responses AI';

-- =====================================================
-- Tabel: ai_usage_stats
-- Statistik penggunaan AI chatbot
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_usage_stats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stat_date DATE NOT NULL,
    total_requests INT UNSIGNED NOT NULL DEFAULT 0,
    total_conversations INT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens_used BIGINT UNSIGNED NOT NULL DEFAULT 0,
    avg_response_time_ms INT UNSIGNED NULL,
    error_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Statistik penggunaan harian';

-- =====================================================
-- Tabel: ai_audit_log
-- Log untuk audit dan debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_audit_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(64) NULL,
    action VARCHAR(50) NOT NULL,
    request_data JSON NULL,
    response_data JSON NULL,
    error_message TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_session_id (session_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit log untuk tracking';

-- =====================================================
-- Tabel: ai_knowledge_base
-- Knowledge base untuk context-aware responses
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category VARCHAR(50) NOT NULL COMMENT 'FAQ, PROCEDURE, POLICY, dll',
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    keywords VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    view_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_category (category),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_search (question, keywords)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Knowledge base untuk responses';

-- =====================================================
-- Insert sample knowledge base
-- =====================================================
INSERT INTO ai_knowledge_base (category, question, answer, keywords) VALUES
('PROCEDURE', 'Bagaimana cara meminjam buku?', 
'Untuk meminjam buku di perpustakaan kami:\n\n1. **Login** ke akun anggota perpustakaan Anda\n2. **Cari** buku yang ingin dipinjam melalui katalog\n3. **Pilih** buku dan klik "Pinjam"\n4. **Konfirmasi** peminjaman\n5. **Catat** tanggal jatuh tempo pengembalian\n\nBatas peminjaman:\n- Anggota reguler: 3 buku, 7 hari\n- Anggota premium: 5 buku, 14 hari',
'pinjam,cara,meminjam,buku,loan,borrow,prosedur'),

('PROCEDURE', 'Bagaimana cara mengembalikan buku?',
'Pengembalian buku dapat dilakukan dengan:\n\n1. **Online**: Login ke akun, pilih menu "Pengembalian", scan/barcode buku\n2. **Langsung**: Bawa buku ke loket perpustakaan\n\nPenting:\n- Pastikan buku dalam kondisi baik\n- Denda keterlambatan Rp 1.000/hari\n- Denda kerusakan disesuaikan',
'kembali,pengembalian,return, cara mengembalikan buku'),

('PROCEDURE', 'Bagaimana cara menjadi anggota perpustakaan?',
'Untuk menjadi anggota perpustakaan:\n\n1. **Registrasi** online melalui website kami\n2. **Isi** formulir dengan data diri lengkap\n3. **Validasi** email\n4. **Aktifkan** kartu anggota\n5. **Kunjungi** perpustakaan untuk aktivasi fisik\n\nSyarat:\n- Foto KTP/SIM\n- Pas foto 3x4\n- Mengisi formulir keanggotaan',
'anggota,member,daftar,registrasi,bergabung,sign up,join'),

('FAQ', 'Berapa lama masa berlaku keanggotaan?',
'Masa berlaku keanggotaan perpustakaan adalah **1 tahun** sejak tanggal registrasi. Anggota dapat memperpanjang keanggotaan secara online atau langsung di perpustakaan dengan memperbarui data dan memperpanjang masa berlaku.',
'masa berlaku,expired,kedaluwarsa,membership validity,perpanjangan'),

('FAQ', 'Berapa batas peminjaman buku?',
'Batas peminjaman tergantung jenis keanggotaan:\n\n- **Anggota Reguler**: 3 buku, 7 hari\n- **Anggota Premium**: 5 buku, 14 hari\n- **Mahasiswa**: 5 buku, 14 hari\n- **Dosen**: 10 buku, 30 hari\n\nPengunjung dapat membaca di tempat tanpa batas.',
'batas,peminjaman,limit,loan limit,max,buku,quantity'),

('FAQ', 'Apakah ada denda keterlambatan?',
'Ya, berlaku denda keterlambatan:\n\n- **Denda telat**: Rp 1.000 per hari per buku\n- **Denda hilang**: Harga buku + biaya admin Rp 25.000\n- **Denda rusak**: Ditentukan berdasarkan tingkat kerusakan\n\nDenda dapat dibayar melalui transfer bank atau langsung di loket.',
'denda,fine,terlambat,lambat,keterlambatan,late,charges');

-- =====================================================
-- Stored Procedure: Cleanup old chat data
-- =====================================================
DELIMITER //
CREATE PROCEDURE sp_cleanup_old_chats(IN days_to_keep INT)
BEGIN
    DECLARE cutoff_date DATETIME;
    
    SET cutoff_date = DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Delete old chat history
    DELETE FROM ai_chat_history 
    WHERE created_at < cutoff_date;
    
    -- Mark old conversations as ended
    UPDATE ai_conversations 
    SET is_active = FALSE, ended_at = NOW()
    WHERE is_active = TRUE AND last_activity_at < cutoff_date;
    
    -- Clean up old rate limit entries
    DELETE FROM ai_rate_limits 
    WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR);
    
    -- Log cleanup
    INSERT INTO ai_audit_log (action, request_data) 
    VALUES ('CLEANUP', JSON_OBJECT('days_kept', days_to_keep, 'cutoff_date', cutoff_date));
END //
DELIMITER ;

-- =====================================================
-- Stored Procedure: Update daily stats
-- =====================================================
DELIMITER //
CREATE PROCEDURE sp_update_daily_stats()
BEGIN
    DECLARE today DATE;
    
    SET today = CURDATE();
    
    INSERT INTO ai_usage_stats (stat_date, total_requests, total_conversations, total_tokens_used, error_count)
    SELECT 
        today,
        COUNT(*) as total_requests,
        COUNT(DISTINCT session_id) as total_conversations,
        COALESCE(SUM(token_count), 0) as total_tokens,
        SUM(CASE WHEN context_data IS NULL THEN 1 ELSE 0 END) as error_count
    FROM ai_chat_history
    WHERE DATE(created_at) = today
    ON DUPLICATE KEY UPDATE
        total_requests = VALUES(total_requests),
        total_conversations = VALUES(total_conversations),
        total_tokens_used = VALUES(total_tokens_used),
        error_count = VALUES(error_count);
END //
DELIMITER ;

-- =====================================================
-- Event: Auto cleanup dan stats update
-- =====================================================
SET GLOBAL event_scheduler = ON;

-- Cleanup every day at 2 AM
CREATE EVENT IF NOT EXISTS evt_daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
DO CALL sp_cleanup_old_chats(30);

-- Update stats every hour
CREATE EVENT IF NOT EXISTS evt_hourly_stats
ON SCHEDULE EVERY 1 HOUR
DO CALL sp_update_daily_stats();
