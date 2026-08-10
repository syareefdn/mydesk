/**
 * AI Library Chatbot JavaScript
 * Frontend logic untuk portal AI chatbot
 */

class AILibraryChatbot {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || '/api/chat.php';
        this.container = options.container || '.ai-chatbot-container';
        this.maxLength = 1000;
        
        this.elements = {};
        this.state = {
            isLoading: false,
            hasError: false,
            remainingRequests: 30
        };
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadInitialData();
    }

    cacheElements() {
        const container = document.querySelector(this.container);
        if (!container) return;

        this.elements = {
            container: container,
            messagesArea: container.querySelector('.ai-chat-messages'),
            inputField: container.querySelector('.ai-chat-input'),
            sendBtn: container.querySelector('.ai-send-btn'),
            clearBtn: container.querySelector('.ai-clear-chat'),
            rateLimit: container.querySelector('.ai-rate-limit'),
            statsGrid: container.querySelector('.ai-stats-grid'),
            actionBtns: container.querySelectorAll('.ai-action-btn'),
            searchInput: container.querySelector('.ai-search-input')
        };
    }

    bindEvents() {
        // Send message on button click
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Send message on Enter (Shift+Enter for new line)
        if (this.elements.inputField) {
            this.elements.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            this.elements.inputField.addEventListener('input', () => {
                this.elements.inputField.style.height = 'auto';
                this.elements.inputField.style.height = Math.min(this.elements.inputField.scrollHeight, 120) + 'px';
            });
        }

        // Clear chat
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Quick action buttons
        if (this.elements.actionBtns) {
            this.elements.actionBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action) this.handleQuickAction(action);
                });
            });
        }

        // Search books
        if (this.elements.searchInput) {
            let searchTimeout;
            this.elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchBooks(e.target.value);
                }, 500);
            });
        }
    }

    async loadInitialData() {
        await this.loadStats();
        await this.loadHistory();
    }

    async loadStats() {
        try {
            const response = await this.apiCall({ action: 'get_stats' });
            if (response.success) {
                this.renderStats(response.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    renderStats(stats) {
        if (!this.elements.statsGrid) return;

        const statItems = [
            { icon: '📚', label: 'Total Koleksi', value: this.formatNumber(stats.total_books), color: 'blue' },
            { icon: '📖', label: 'Item Tersedia', value: this.formatNumber(stats.available_items), color: 'green' },
            { icon: '👥', label: 'Total Anggota', value: this.formatNumber(stats.total_members), color: 'purple' },
            { icon: '📊', label: 'Peminjaman Bulan Ini', value: this.formatNumber(stats.monthly_loans), color: 'orange' }
        ];

        this.elements.statsGrid.innerHTML = statItems.map(stat => `
            <div class="ai-stat-card">
                <div class="ai-stat-icon ${stat.color}">${stat.icon}</div>
                <div class="ai-stat-content">
                    <h3>${stat.value}</h3>
                    <p>${stat.label}</p>
                </div>
            </div>
        `).join('');
    }

    async loadHistory() {
        try {
            const response = await this.apiCall({ action: 'get_history' });
            if (response.success && response.data.length > 0) {
                this.renderMessages(response.data);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    renderMessages(messages) {
        if (!this.elements.messagesArea) return;

        // Remove welcome message if exists
        const welcome = this.elements.messagesArea.querySelector('.ai-welcome-message');
        if (welcome) welcome.remove();

        messages.forEach(msg => {
            this.appendMessage(msg.role === 'user' ? 'user' : 'bot', msg.content, false);
        });

        this.scrollToBottom();
    }

    async sendMessage() {
        const message = this.elements.inputField.value.trim();
        
        if (!message) return;
        if (message.length > this.maxLength) {
            this.showError(`Pesan terlalu panjang (maksimal ${this.maxLength} karakter)`);
            return;
        }

        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.elements.inputField.value = '';
        this.elements.inputField.style.height = 'auto';
        this.hideError();
        this.hideRateLimit();

        // Remove welcome message
        const welcome = this.elements.messagesArea.querySelector('.ai-welcome-message');
        if (welcome) welcome.remove();

        // Add user message
        this.appendMessage('user', message);

        // Show loading indicator
        const loadingEl = this.showLoading();

        try {
            const response = await this.apiCall({
                action: 'chat',
                message: message
            });

            // Remove loading
            this.removeLoading(loadingEl);

            if (response.success) {
                this.appendMessage('bot', response.message);
                this.state.remainingRequests = response.remaining_requests;
                
                // Show context info if available
                if (response.context && response.context.books) {
                    this.showBookCards(response.context.books);
                }
            } else {
                if (response.rate_limited) {
                    this.showRateLimit();
                } else {
                    this.showError(response.message || 'Terjadi kesalahan');
                }
            }
        } catch (error) {
            this.removeLoading(loadingEl);
            this.showError('Gagal terhubung ke server');
        } finally {
            this.state.isLoading = false;
        }
    }

    async handleQuickAction(action) {
        this.state.isLoading = true;

        try {
            const response = await this.apiCall({
                action: 'quick_action',
                action_type: action
            });

            if (response.success) {
                // Remove welcome message
                const welcome = this.elements.messagesArea.querySelector('.ai-welcome-message');
                if (welcome) welcome.remove();

                this.appendMessage('bot', response.message);
            } else {
                this.showError(response.message);
            }
        } catch (error) {
            this.showError('Gagal memproses aksi');
        } finally {
            this.state.isLoading = false;
        }
    }

    async searchBooks(query) {
        if (!query || query.length < 2) return;

        try {
            const response = await this.apiCall({
                action: 'search_books',
                query: query
            });

            if (response.success && response.data.length > 0) {
                this.showSearchResults(response.data);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    showSearchResults(books) {
        // Could implement a dropdown or modal with search results
        console.log('Search results:', books);
    }

    async clearChat() {
        if (!confirm('Apakah Anda yakin ingin menghapus semua riwayat chat?')) {
            return;
        }

        try {
            const response = await this.apiCall({ action: 'clear_history' });
            if (response.success) {
                this.elements.messagesArea.innerHTML = this.getWelcomeMessage();
            }
        } catch (error) {
            this.showError('Gagal menghapus riwayat chat');
        }
    }

    appendMessage(type, content, animate = true) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${type}`;
        
        if (!animate) {
            msgDiv.style.animation = 'none';
        }

        const time = new Date().toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // Parse markdown-like formatting
        const formattedContent = this.formatMessage(content);

        msgDiv.innerHTML = `
            <div class="ai-message-content">${formattedContent}</div>
            <div class="ai-message-time">${time}</div>
        `;

        this.elements.messagesArea.appendChild(msgDiv);
        this.scrollToBottom();
    }

    formatMessage(text) {
        // Escape HTML
        let formatted = this.escapeHtml(text);
        
        // Bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Lists
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Numbered lists
        formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        
        // Links
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showBookCards(books) {
        if (!books || books.length === 0) return;

        const booksHtml = books.map(book => `
            <div class="ai-book-card">
                <div class="ai-book-title">${this.escapeHtml(book.title)}</div>
                <div class="ai-book-meta">
                    ${book.authors ? 'Pengarang: ' + this.escapeHtml(book.authors) : ''}
                    ${book.publish_year ? ' | Tahun: ' + book.publish_year : ''}
                </div>
            </div>
        `).join('');

        // Append as a bot message
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-message bot';
        msgDiv.innerHTML = `
            <div class="ai-message-content">
                <p><strong>Buku yang mungkin relevant:</strong></p>
                ${booksHtml}
            </div>
        `;
        this.elements.messagesArea.appendChild(msgDiv);
        this.scrollToBottom();
    }

    showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-message bot ai-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="ai-loading">
                <div class="ai-loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span>Sedang mengetik...</span>
            </div>
        `;
        this.elements.messagesArea.appendChild(loadingDiv);
        this.scrollToBottom();
        return loadingDiv;
    }

    removeLoading(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    showError(message) {
        this.hideError();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ai-error-message';
        errorDiv.textContent = message;
        
        this.elements.messagesArea.appendChild(errorDiv);
        this.scrollToBottom();
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    hideError() {
        const existing = this.elements.messagesArea.querySelector('.ai-error-message');
        if (existing) {
            existing.remove();
        }
    }

    showRateLimit() {
        if (this.elements.rateLimit) {
            this.elements.rateLimit.style.display = 'block';
        }
    }

    hideRateLimit() {
        if (this.elements.rateLimit) {
            this.elements.rateLimit.style.display = 'none';
        }
    }

    scrollToBottom() {
        if (this.elements.messagesArea) {
            this.elements.messagesArea.scrollTop = this.elements.messagesArea.scrollHeight;
        }
    }

    getWelcomeMessage() {
        return `
            <div class="ai-welcome-message">
                <div class="ai-welcome-icon">🤖</div>
                <h2>Selamat Datang di ${document.title || 'AI Library Assistant'}</h2>
                <p>Saya asisten virtual perpustakaan Anda. Tanyakan tentang koleksi, prosedur peminjaman, atau informasi lainnya!</p>
                <div class="ai-quick-actions">
                    <button class="ai-quick-btn" data-action="latest">📚 Koleksi Terbaru</button>
                    <button class="ai-quick-btn" data-action="popular">⭐ Populer</button>
                    <button class="ai-quick-btn" data-action="stats">📊 Statistik</button>
                    <button class="ai-quick-btn" data-action="help">🔍 Cari Buku</button>
                </div>
            </div>
        `;
    }

    async apiCall(data) {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        return response.json();
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if container exists
    const container = document.querySelector('.ai-chatbot-container');
    if (container) {
        window.aiChatbot = new AILibraryChatbot({
            apiUrl: '/api/chat.php'
        });
    }
});
