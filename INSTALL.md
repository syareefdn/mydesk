# 📖 Panduan Instalasi AI Library Chatbot untuk SLIMS Bulian 9

Panduan lengkap untuk menginstal dan mengkonfigurasi AI Chatbot di perpustakaan Anda.

## Prerequisites

1. **SLIMS Bulian 9** sudah terinstall dan berjalan
2. **PHP 7.4+** dengan ekstensi: PDO, cURL, JSON
3. **MySQL 5.7+** atau **MariaDB 10.3+**
4. **Akun Google Cloud** untuk Gemini API

---

## Langkah 1: Persiapan

### 1.1 Clone/Download Project

```bash
# Jika menggunakan Git
git clone <repo-url> /var/www/ai-chatbot

# Atau download dan extract ke folder
```

### 1.2 Buat Database untuk Chatbot

Chatbot membutuhkan database sendiri untuk menyimpan chat history:

```bash
mysql -u root -p

# Buat database
CREATE DATABASE ai_chatbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ai_chatbot'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ai_chatbot.* TO 'ai_chatbot'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 1.3 Install Schema Database

```bash
mysql -u root -p ai_chatbot < install/install.sql
```

---

## Langkah 2: Konfigurasi

### 2.1 Edit File Konfigurasi

Buka file `config/config.php` dan isi dengan kredensial Anda:

```php
<?php
// ======================
// SLIMS DATABASE CONFIG
// ======================
define('SLIMS_HOST', 'localhost');
define('SLIMS_DATABASE', 'slims9_bulian');
define('SLIMS_USERNAME', 'slims_user');        // User database SLIMS
define('SLIMS_PASSWORD', 'slims_password');
define('SLIMS_PORT', 3306);
define('SLIMS_CHARSET', 'utf8mb4');

// ======================
// GEMINI API CONFIG
// ======================
define('GEMINI_API_KEY', 'AIzaSy...');         // API Key dari Google AI Studio
define('GEMINI_MODEL', 'gemini-1.5-flash');     // atau 'gemini-1.5-pro'
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/');

// ======================
// APP CONFIG
// ======================
define('APP_NAME', 'AI Library Assistant');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'https://perpustakaan.domain.com/ai-chatbot/');
```

### 2.2 Setup Google Gemini API

1. Buka [Google AI Studio](https://aistudio.google.com/)
2. Login dengan akun Google
3. Klik **Get API Key** di sidebar
4. Klik **Create API Key**
5. Copy API Key yang dihasilkan
6. Paste ke `GEMINI_API_KEY` di config

---

## Langkah 3: Instalasi Web Server

### 3.1 Apache (XAMPP/WAMP)

Copy seluruh folder ke htdocs:

```bash
# XAMPP (Windows)
xcopy /E /I C:\path\to\ai-chatbot C:\xampp\htdocs\ai-chatbot

# XAMPP (Linux)
sudo cp -r /path/to/ai-chatbot /opt/lampp/htdocs/

# Set permissions
sudo chmod -R 755 /opt/lampp/htdocs/ai-chatbot
sudo chmod -R 777 /opt/lampp/htdocs/ai-chatbot/logs
```

### 3.2 Nginx

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
    
    location ~ /\.ht {
        deny all;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ai-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.3 VPS/CentOS dengan Apache

```bash
# Install Apache & PHP
sudo yum install httpd php php-pdo php-mysqlnd php-json php-curl

# Copy files
sudo cp -r /path/to/ai-chatbot /var/www/html/

# Set permissions
sudo chown -R apache:apache /var/www/html/ai-chatbot
sudo chmod -R 755 /var/www/html/ai-chatbot
sudo mkdir -p /var/www/html/ai-chatbot/logs
sudo chown -R apache:apache /var/www/html/ai-chatbot/logs

# Edit Apache config
sudo nano /etc/httpd/conf.d/ai-chatbot.conf
```

```apache
<VirtualHost *:80>
    ServerName ai-library.yourdomain.com
    DocumentRoot /var/www/html/ai-chatbot
    
    <Directory /var/www/html/ai-chatbot>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog /var/log/httpd/ai-chatbot-error.log
    CustomLog /var/log/httpd/ai-chatbot-access.log combined
</VirtualHost>
```

```bash
sudo systemctl restart httpd
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

---

## Langkah 4: Verifikasi Instalasi

### 4.1 Test Langsung

Buka browser dan akses:

```
http://localhost/ai-chatbot/
```

ATAU

```
http://localhost/ai-chatbot/index.php
```

### 4.2 Test API

```bash
curl -X POST http://localhost/ai-chatbot/api/chat.php \
  -H "Content-Type: application/json" \
  -d '{"action":"get_stats"}'
```

Respons yang diharapkan:
```json
{
  "success": true,
  "data": {
    "total_books": 1234,
    "total_items": 1500,
    "available_items": 1200,
    "total_members": 500,
    "monthly_loans": 150
  }
}
```

### 4.3 Test Chat

```bash
curl -X POST http://localhost/ai-chatbot/api/chat.php \
  -H "Content-Type: application/json" \
  -d '{"action":"chat","message":"Halo, apa kabar?"}'
```

---

## Langkah 5: Integrasi dengan SLIMS

### 5.1 Widget Floating (Recommended)

Tambahkan kode ini ke template SLIMS Anda (biasanya di `header.php` atau `template.php`):

```php
<?php
// Include chatbot widget
include '/var/www/ai-chatbot/slims-widget.php';
?>
```

### 5.2 Menu Link

Tambahkan link di menu SLIMS:

1. Buka Admin Panel SLIMS
2. Navigasi ke **System** > **Navigation**
3. Tambahkan menu baru:
   - **Title**: AI Assistant
   - **URL**: `/ai-chatbot/`
   - **Icon**: robot/bot icon
   - **Target**: New Window

### 5.3 Iframe Integration

Tambahkan page baru di SLIMS:

```html
<iframe src="/ai-chatbot/index.php" 
        width="100%" 
        height="700" 
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
</iframe>
```

---

## Troubleshooting

### Error: "Connection refused" atau "Database not found"

1. Cek kredensial database SLIMS di `config.php`
2. Pastikan MySQL service berjalan
3. Test koneksi:
   ```bash
   mysql -u slims_user -p -h localhost slims9_bulian
   ```

### Error: "Gemini API Error: Invalid API key"

1. Cek apakah API key sudah benar
2. Pastikan API key sudah di-enable di Google Cloud Console
3. Cek quota API:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
   ```

### Error: "Session save path not writable"

```bash
# Buat folder session
sudo mkdir -p /var/lib/php/session
sudo chmod 733 /var/lib/php/session

# Atau di php.ini
session.save_path = "/var/lib/php/session"
```

### Error: "CORS policy"

Pastikan `.htaccess` sudah ada dan mod_headers aktif:

```bash
sudo a2enmod headers
sudo systemctl restart apache2
```

### Blank Page / White Screen

1. Cek error log:
   ```bash
   tail -f /var/log/apache2/error.log
   ```
2. Enable error display di `config.php`:
   ```php
   define('ENABLE_DEBUG', true);
   ```

---

## Optimasi Production

### 1. HTTPS

```bash
# Let's Encrypt (Apache)
sudo certbot --apache -d ai-library.yourdomain.com

# Let's Encrypt (Nginx)
sudo certbot --nginx -d ai-library.yourdomain.com
```

### 2. PHP-FPM

```php
// Di config.php, tambahkan:
define('SESSION_NAME', 'AI_LIBRARY_SESSION');
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);  // Jika HTTPS
ini_set('session.use_strict_mode', 1);
```

### 3. Backup Otomatis

```bash
# Tambahkan ke crontab
crontab -e

# Backup database setiap hari jam 2 pagi
0 2 * * * mysqldump -u root -p'password' ai_chatbot > /backup/ai_chatbot_$(date +\%Y\%m\%d).sql

# Cleanup backup older dari 7 days
0 3 * * * find /backup -name "ai_chatbot_*.sql" -mtime +7 -delete
```

### 4. Monitoring

Monitor error rates dan performance dengan:

```bash
# Watch error log
tail -f /var/log/apache2/ai-chatbot-error.log

# Check API response time
curl -w "\nTime: %{time_total}s\n" -X POST http://localhost/ai-chatbot/api/chat.php \
  -H "Content-Type: application/json" \
  -d '{"action":"chat","message":"test"}'
```

---

## Update & Maintenance

### Update Code

```bash
cd /var/www/ai-chatbot
git pull origin main
```

### Update Knowledge Base

```sql
-- Tambah FAQ baru
INSERT INTO ai_chatbot.ai_knowledge_base 
(category, question, answer, keywords)
VALUES 
('FAQ', 'Pertanyaan baru?', 'Jawaban...', 'keywords');
```

### Monitor Usage

```sql
-- Cek statistik penggunaan
SELECT * FROM ai_usage_stats ORDER BY stat_date DESC LIMIT 30;

-- Cek sesi aktif
SELECT * FROM ai_conversations WHERE is_active = 1;

-- Cek error rate
SELECT DATE(created_at) as date, 
       COUNT(*) as total,
       SUM(CASE WHEN context_data IS NULL THEN 1 ELSE 0 END) as errors
FROM ai_chat_history
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Support

Jika mengalami kendala:
1. Cek dokumentasi di `README.md`
2. Lihat error log
3. Buka issue di repository
