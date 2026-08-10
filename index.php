<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="AI Library Assistant - Asisten Virtual Perpustakaan Digital">
    <title>AI Library Assistant - <?php echo defined('APP_NAME') ? APP_NAME : 'Perpustakaan'; ?></title>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Chatbot Styles -->
    <link rel="stylesheet" href="assets/css/chatbot.css">
</head>
<body>
    <div class="ai-chatbot-container">
        <div class="ai-chatbot-wrapper">
            <!-- Header -->
            <header class="ai-chatbot-header">
                <h1>
                    <span>🤖</span>
                    <?php echo defined('APP_NAME') ? APP_NAME : 'AI Library Assistant'; ?>
                </h1>
                <p>Asisten virtual perpustakaan untuk membantu Anda menemukan informasi dan layanan kami</p>
            </header>

            <!-- Stats Grid -->
            <div class="ai-stats-grid">
                <div class="ai-stat-card">
                    <div class="ai-stat-icon blue">📚</div>
                    <div class="ai-stat-content">
                        <h3>Loading...</h3>
                        <p>Total Koleksi</p>
                    </div>
                </div>
                <div class="ai-stat-card">
                    <div class="ai-stat-icon green">📖</div>
                    <div class="ai-stat-content">
                        <h3>Loading...</h3>
                        <p>Item Tersedia</p>
                    </div>
                </div>
                <div class="ai-stat-card">
                    <div class="ai-stat-icon purple">👥</div>
                    <div class="ai-stat-content">
                        <h3>Loading...</h3>
                        <p>Total Anggota</p>
                    </div>
                </div>
                <div class="ai-stat-card">
                    <div class="ai-stat-icon orange">📊</div>
                    <div class="ai-stat-content">
                        <h3>Loading...</h3>
                        <p>Peminjaman Bulan Ini</p>
                    </div>
                </div>
            </div>

            <!-- Main Chat Layout -->
            <div class="ai-chat-layout">
                <!-- Chat Box -->
                <div class="ai-chat-box">
                    <!-- Messages Area -->
                    <div class="ai-chat-messages">
                        <div class="ai-welcome-message">
                            <div class="ai-welcome-icon">🤖</div>
                            <h2>Selamat Datang di AI Library Assistant</h2>
                            <p>Saya asisten virtual perpustakaan Anda. Tanyakan tentang koleksi, prosedur peminjaman, atau informasi lainnya!</p>
                            <div class="ai-quick-actions">
                                <button class="ai-quick-btn" data-action="latest">📚 Koleksi Terbaru</button>
                                <button class="ai-quick-btn" data-action="popular">⭐ Populer</button>
                                <button class="ai-quick-btn" data-action="stats">📊 Statistik</button>
                                <button class="ai-quick-btn" data-action="help">🔍 Cari Buku</button>
                            </div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="ai-chat-input-area">
                        <div class="ai-chat-input-wrapper">
                            <textarea 
                                class="ai-chat-input" 
                                placeholder="Ketik pertanyaan Anda di sini..."
                                rows="1"
                                maxlength="1000"
                            ></textarea>
                            <button class="ai-send-btn" title="Kirim pesan">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                        <div class="ai-rate-limit" style="display: none;">
                            ⏳ Terlalu banyak request. Mohon tunggu sebentar.
                        </div>
                    </div>
                </div>

                <!-- Sidebar -->
                <aside class="ai-chat-sidebar">
                    <!-- Quick Actions -->
                    <div class="ai-sidebar-card">
                        <div class="ai-sidebar-header">
                            <span>⚡</span> Aksi Cepat
                        </div>
                        <div class="ai-sidebar-content">
                            <div class="ai-action-list">
                                <button class="ai-action-btn" data-action="latest">
                                    <span>📚</span> Koleksi Terbaru
                                </button>
                                <button class="ai-action-btn" data-action="popular">
                                    <span>🔥</span> Buku Terpopuler
                                </button>
                                <button class="ai-action-btn" data-action="how_to_borrow">
                                    <span>📖</span> Cara Meminjam
                                </button>
                                <button class="ai-action-btn" data-action="membership">
                                    <span>🎫</span> Jadi Anggota
                                </button>
                                <button class="ai-action-btn" data-action="stats">
                                    <span>📊</span> Statistik Perpustakaan
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Search Books -->
                    <div class="ai-sidebar-card">
                        <div class="ai-sidebar-header">
                            <span>🔍</span> Cari Buku
                        </div>
                        <div class="ai-sidebar-content">
                            <div class="ai-search-box">
                                <input 
                                    type="text" 
                                    class="ai-search-input" 
                                    placeholder="Ketik judul atau pengarang..."
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Clear Chat -->
                    <div class="ai-sidebar-card">
                        <div class="ai-sidebar-content">
                            <button class="ai-clear-chat">
                                <span>🗑️</span> Hapus Riwayat Chat
                            </button>
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="ai-sidebar-card" style="background: #f8fafc;">
                        <div class="ai-sidebar-content" style="font-size: 0.8rem; color: #64748b;">
                            <p style="margin-bottom: 8px;"><strong>💡 Tips:</strong></p>
                            <ul style="padding-left: 16px; line-height: 1.8;">
                                <li>Tanyakan tentang koleksi buku</li>
                                <li>Info prosedur peminjaman</li>
                                <li>Status keanggotaan</li>
                                <li>Rekomendasi buku</li>
                            </ul>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    </div>

    <!-- Chatbot Script -->
    <script src="assets/js/chatbot.js"></script>
</body>
</html>
