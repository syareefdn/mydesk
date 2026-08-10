<?php
/**
 * SLIMS Chatbot Widget Integration
 * 
 * File ini bisa disisipkan ke theme SLIMS untuk menampilkan chatbot
 * 
 * Cara penggunaan:
 * 1. Include file ini di template SLIMS
 * 2. Atau gunakan sebagai standalone dengan simpan di root SLIMS
 * 
 * Contoh include di template:
 * <?php include '/path/to/ai-chatbot/slims-widget.php'; ?>
 */

// Load konfigurasi
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/Logger.php';
require_once __DIR__ . '/includes/SlimsService.php';
require_once __DIR__ . '/includes/GeminiService.php';
require_once __DIR__ . '/includes/ChatManager.php';
?>
<!-- AI Chatbot Widget for SLIMS -->
<style>
/* Widget Floating Button */
.ai-chatbot-float-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.ai-chatbot-float-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.ai-chatbot-float-btn svg {
    width: 28px;
    height: 28px;
    fill: white;
}

.ai-chatbot-float-btn .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    background: #ef4444;
    border-radius: 50%;
    color: white;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

/* Chat Popup */
.ai-chatbot-popup {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 380px;
    max-width: calc(100vw - 48px);
    height: 550px;
    max-height: calc(100vh - 150px);
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 9998;
    display: none;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.ai-chatbot-popup.active {
    display: flex;
}

/* Popup Header */
.ai-chatbot-popup-header {
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    color: white;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.ai-chatbot-popup-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ai-chatbot-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.ai-chatbot-close:hover {
    background: rgba(255,255,255,0.3);
}

/* Stats Bar */
.ai-chatbot-stats {
    background: #f8fafc;
    padding: 12px 20px;
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
}

.ai-chatbot-stat {
    display: flex;
    align-items: center;
    gap: 4px;
}

.ai-chatbot-stat strong {
    color: #1e293b;
}

/* Messages Area */
.ai-chatbot-popup-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #f8fafc;
}

/* Message Styles */
.ai-chatbot-msg {
    max-width: 85%;
    animation: fadeIn 0.3s ease;
}

.ai-chatbot-msg.user {
    align-self: flex-end;
}

.ai-chatbot-msg.bot {
    align-self: flex-start;
}

.ai-chatbot-msg-content {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
}

.ai-chatbot-msg.user .ai-chatbot-msg-content {
    background: #2563eb;
    color: white;
    border-bottom-right-radius: 4px;
}

.ai-chatbot-msg.bot .ai-chatbot-msg-content {
    background: white;
    color: #1e293b;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.ai-chatbot-msg-time {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 4px;
    padding: 0 4px;
}

/* Quick Actions */
.ai-chatbot-quick-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 12px;
    background: #f8fafc;
}

.ai-chatbot-quick-btn {
    padding: 6px 12px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.ai-chatbot-quick-btn:hover {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
}

/* Input Area */
.ai-chatbot-popup-input {
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #e2e8f0;
    display: flex;
    gap: 8px;
}

.ai-chatbot-popup-input input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
}

.ai-chatbot-popup-input input:focus {
    border-color: #2563eb;
}

.ai-chatbot-popup-input button {
    width: 40px;
    height: 40px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.ai-chatbot-popup-input button:hover {
    background: #1d4ed8;
}

/* Loading */
.ai-chatbot-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: white;
    border-radius: 12px;
    width: fit-content;
}

.ai-chatbot-loading-dots span {
    width: 6px;
    height: 6px;
    background: #94a3b8;
    border-radius: 50%;
    display: inline-block;
    animation: bounce 1.4s infinite ease-in-out both;
}

.ai-chatbot-loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.ai-chatbot-loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Responsive */
@media (max-width: 480px) {
    .ai-chatbot-popup {
        right: 12px;
        bottom: 90px;
        width: calc(100vw - 24px);
    }
    
    .ai-chatbot-float-btn {
        right: 16px;
        bottom: 16px;
        width: 52px;
        height: 52px;
    }
}
</style>

<!-- Floating Button -->
<button class="ai-chatbot-float-btn" id="aiChatbotFloatBtn" title="AI Assistant">
    <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        <circle cx="8" cy="10" r="1.5"/>
        <circle cx="12" cy="10" r="1.5"/>
        <circle cx="16" cy="10" r="1.5"/>
    </svg>
    <span class="badge" id="aiChatbotBadge" style="display: none;">1</span>
</button>

<!-- Chat Popup -->
<div class="ai-chatbot-popup" id="aiChatbotPopup">
    <div class="ai-chatbot-popup-header">
        <h3>
            <span>🤖</span>
            AI Library Assistant
        </h3>
        <button class="ai-chatbot-close" id="aiChatbotClose">×</button>
    </div>
    
    <div class="ai-chatbot-stats" id="aiChatbotStats">
        <div class="ai-chatbot-stat">📚 <strong id="statBooks">-</strong> Koleksi</div>
        <div class="ai-chatbot-stat">📖 <strong id="statAvailable">-</strong> Tersedia</div>
    </div>
    
    <div class="ai-chatbot-popup-messages" id="aiChatbotMessages">
        <div class="ai-chatbot-msg bot">
            <div class="ai-chatbot-msg-content">
                Halo! 👋 Saya asisten virtual perpustakaan.<br><br>
                Ada yang bisa saya bantu hari ini?
            </div>
        </div>
    </div>
    
    <div class="ai-chatbot-quick-btns">
        <button class="ai-chatbot-quick-btn" data-msg="Apa koleksi terbaru?">📚 Terbaru</button>
        <button class="ai-chatbot-quick-btn" data-msg="Cari buku tentang programming">🔍 Cari</button>
        <button class="ai-chatbot-quick-btn" data-msg="Bagaimana cara pinjam buku?">📖 Pinjam</button>
        <button class="ai-chatbot-quick-btn" data-msg="Berikan statistik perpustakaan">📊 Stats</button>
    </div>
    
    <div class="ai-chatbot-popup-input">
        <input type="text" id="aiChatbotInput" placeholder="Ketik pertanyaan Anda..." maxlength="500">
        <button id="aiChatbotSend">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    </div>
</div>

<script>
(function() {
    const API_URL = '<?php echo defined("APP_URL") ? APP_URL : ""; ?>api/chat.php';
    
    const floatBtn = document.getElementById('aiChatbotFloatBtn');
    const popup = document.getElementById('aiChatbotPopup');
    const closeBtn = document.getElementById('aiChatbotClose');
    const input = document.getElementById('aiChatbotInput');
    const sendBtn = document.getElementById('aiChatbotSend');
    const messages = document.getElementById('aiChatbotMessages');
    const quickBtns = document.querySelectorAll('.ai-chatbot-quick-btn');
    
    let isLoading = false;
    let newMessageCount = 0;
    
    // Toggle popup
    floatBtn.addEventListener('click', () => {
        popup.classList.toggle('active');
        if (popup.classList.contains('active')) {
            newMessageCount = 0;
            document.getElementById('aiChatbotBadge').style.display = 'none';
            input.focus();
            loadStats();
        }
    });
    
    closeBtn.addEventListener('click', () => {
        popup.classList.remove('active');
    });
    
    // Load stats
    async function loadStats() {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'get_stats'})
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('statBooks').textContent = formatNum(data.data.total_books);
                document.getElementById('statAvailable').textContent = formatNum(data.data.available_items);
            }
        } catch (e) {}
    }
    
    // Send message
    async function sendMessage(msg) {
        if (isLoading || !msg.trim()) return;
        
        isLoading = true;
        addMessage('user', msg);
        input.value = '';
        
        const loadingEl = addLoading();
        
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'chat', message: msg})
            });
            const data = await res.json();
            
            messages.removeChild(loadingEl);
            
            if (data.success) {
                addMessage('bot', data.message);
            } else {
                addMessage('bot', 'Maaf, terjadi kesalahan. Silakan coba lagi.');
            }
        } catch (e) {
            messages.removeChild(loadingEl);
            addMessage('bot', 'Gagal terhubung ke server.');
        }
        
        isLoading = false;
    }
    
    // Add message to chat
    function addMessage(type, content) {
        const msg = document.createElement('div');
        msg.className = 'ai-chatbot-msg ' + type;
        
        const time = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Format content
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/^- (.+)$/gm, '• $1<br>');
        
        msg.innerHTML = `
            <div class="ai-chatbot-msg-content">${formatted}</div>
            <div class="ai-chatbot-msg-time">${time}</div>
        `;
        
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        
        // Notify if popup is closed
        if (!popup.classList.contains('active') && type === 'bot') {
            newMessageCount++;
            const badge = document.getElementById('aiChatbotBadge');
            badge.textContent = newMessageCount;
            badge.style.display = 'flex';
        }
    }
    
    // Add loading indicator
    function addLoading() {
        const loading = document.createElement('div');
        loading.className = 'ai-chatbot-msg bot';
        loading.innerHTML = `
            <div class="ai-chatbot-loading">
                <div class="ai-chatbot-loading-dots"><span></span><span></span><span></span></div>
                <span>Mengetik...</span>
            </div>
        `;
        messages.appendChild(loading);
        messages.scrollTop = messages.scrollHeight;
        return loading;
    }
    
    // Format number
    function formatNum(num) {
        if (num >= 1000) return (num/1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    // Event listeners
    sendBtn.addEventListener('click', () => sendMessage(input.value));
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage(input.value);
    });
    
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sendMessage(btn.dataset.msg);
        });
    });
    
    // Initial stats load
    loadStats();
})();
</script>
