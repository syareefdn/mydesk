# 🤖 AI Library Chatbot untuk SLIMS Bulian 9

Asisten virtual AI untuk Perpustakaan Digital berbasis SLIMS (Senayan Library Management System) Bulian 9 dengan integrasi Google Gemini.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![PHP](https://img.shields.io/badge/PHP-7.4+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Fitur

- **🔍 Pencarian Cerdas**: Cari koleksi perpustakaan dengan natural language
- **📊 Informasi Real-time**: Statistik perpustakaan dari database SLIMS
- **💬 Chat Natural**: Tanya jawab dalam Bahasa Indonesia dengan AI
- **📚 Konteks Database**: AI terintegrasi langsung dengan data SLIMS
- **⚡ Quick Actions**: Aksi cepat untuk informasi umum
- **📱 Responsive**: Tampilan mobile-friendly
- **🔒 Rate Limiting**: Proteksi terhadap spam request
- **📝 Chat History**: Riwayat percakapan tersimpan

## 🛠️ Persyaratan Sistem

- PHP 7.4 atau lebih tinggi
- MySQL 5.7+ / MariaDB 10.3+
- Ekstensi PHP: PDO, cURL, JSON
- Akses ke database SLIMS Bulian 9
- API Key Google Gemini

## 📦 Instalasi

### 1. Clone atau Download

```bash
git clone <repository-url> ai-chatbot
cd ai-chatbot
```

### 2. Konfigurasi Database SLIMS

Edit file `config/config.php`:

```php
// Konfigurasi Database SLIMS
define('SLIMS_HOST', 'localhost');
define('SLIMS_DATABASE', 'slims9_bulian');
define('SLIMS_USERNAME', 'root');
define('SLIMS_PASSWORD', 'your_password');
define('SLIMS_PORT', 3306);

// Konfigurasi Gemini API
define('GEMINI_API_KEY', 'your_gemini_api_key');
define('GEMINI_MODEL', 'gemini-1.5-flash');
```

### 3. Install Database Chatbot

Jalankan script SQL untuk membuat tabel yang diperlukan:

```bash
mysql -u root -p < install/install.sql
```

### 4. Setup Google Gemini API

1. Buka [Google AI Studio](https://aistudio.google.com/apikey)
2. Buat API Key baru
3. Masukkan API Key ke konfigurasi

### 5. Web Server Configuration

**Apache (Virtual Host):**
```apache
<VirtualHost *:80>
    ServerName ai-library.yourdomain.com
    DocumentRoot /var/www/ai-chatbot
    <Directory /var/www/ai-chatbot>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

**Nginx:**
```nginx
server {
    listen 80;
    server_name ai-library.yourdomain.com;
    root /var/www/ai-chatbot;
    index index.php;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

## 🔧 Struktur Direktori

```
ai-chatbot/
├── assets/
│   ├── css/
│   │   └── chatbot.css          # Styling chatbot
│   └── js/
│       └── chatbot.js            # Frontend logic
├── config/
│   ├── config.example.php        # Template konfigurasi
│   └── database.php              # Koneksi database
├── includes/
│   ├── Logger.php                # Logging class
│   ├── SlimsService.php          # Service SLIMS
│   ├── GeminiService.php         # Service Gemini API
│   └── ChatManager.php          # Management chat
├── api/
│   └── chat.php                  # API endpoint
├── install/
│   └── install.sql               # Database schema
├── index.php                     # Halaman utama
└── README.md                     # Dokumentasi
```

## 🚀 Penggunaan

### Menjalankan Chatbot

1. Buka browser ke URL chatbot
2. Klik salah satu quick action atau ketik pertanyaan
3. AI akan menjawab berdasarkan data SLIMS

### Contoh Pertanyaan

```
- "Cari buku tentang programming"
- "Apa koleksi terbaru perpustakaan?"
- "Berapa batas peminjaman buku?"
- "Bagaimana cara menjadi anggota?"
- "Buku apa yang paling populer?"
- "Apakah ada buku tentang web development?"
```

## 🔌 API Reference

### Endpoint: `/api/chat.php`

**Chat Message:**
```json
POST /api/chat.php
{
    "action": "chat",
    "message": "Cari buku tentang AI"
}
```

**Get History:**
```json
POST /api/chat.php
{
    "action": "get_history"
}
```

**Clear History:**
```json
POST /api/chat.php
{
    "action": "clear_history"
}
```

**Search Books:**
```json
POST /api/chat.php
{
    "action": "search_books",
    "query": "programming"
}
```

**Get Stats:**
```json
POST /api/chat.php
{
    "action": "get_stats"
}
```

## 📊 Integrasi dengan SLIMS

Chatbot ini terintegrasi dengan tabel-tabel SLIMS:

| Tabel SLIMS | Fungsi |
|------------|--------|
| `biblio` | Informasi bibliografi/katalog |
| `items` | Item/eksemplar buku |
| `member` | Data anggota |
| `loan` | Peminjaman aktif |
| `loan_history` | Riwayat peminjaman |
| `mst_author` | Master pengarang |
| `mst_publisher` | Master penerbit |
| `mst_topic` | Master topik/subjek |

## 🎨 Kustomisasi

### Mengubah Tema Warna

Edit CSS variables di `assets/css/chatbot.css`:

```css
:root {
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --success-color: #10b981;
    /* ... */
}
```

### Menambah Quick Actions

Edit di `index.php`:

```html
<button class="ai-action-btn" data-action="custom_action">
    <span>🔧</span> Aksi Custom
</button>
```

### Menambah Knowledge Base

Insert ke tabel `ai_knowledge_base`:

```sql
INSERT INTO ai_knowledge_base (category, question, answer, keywords)
VALUES ('FAQ', 'Pertanyaan?', 'Jawaban...', 'kata kunci');
```

## 🔒 Keamanan

- Rate limiting untuk mencegah spam
- Input sanitization
- CSRF protection
- SQL injection prevention (prepared statements)
- XSS prevention (output escaping)

## 📝 Maintenance

### Cleanup Otomatis

Data chat older dari 30 hari akan dihapus otomatis via event scheduler.

### Backup

```bash
mysqldump -u root -p ai_chatbot > backup_chatbot.sql
```

## 🐛 Troubleshooting

### Error: "Database connection failed"
- Pastikan kredensial database SLIMS benar
- Pastikan MySQL service berjalan
- Cek firewall untuk port MySQL

### Error: "Gemini API Error"
- Pastikan API key valid
- Cek quota API di Google Cloud Console
- Pastikan koneksi internet stabil

### Error: "Session not found"
- Pastikan PHP session terkonfigurasi dengan benar
- Cek folder session writable

## 📄 Lisensi

MIT License - Bebas digunakan untuk keperluan apapun.

## 🤝 Kontribusi

Silakan buat issue atau pull request untuk perbaikan dan fitur baru.

## 📞 Dukungan

Untuk bantuan, silakan hubungi tim IT perpustakaan Anda.
