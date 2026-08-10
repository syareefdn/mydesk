<?php
/**
 * Gemini AI Service Class
 * Service untuk berinteraksi dengan Google Gemini API
 */

class GeminiService {
    private string $apiKey;
    private string $model;
    private string $apiUrl;

    public function __construct(string $apiKey = '', string $model = 'gemini-1.5-flash') {
        $this->apiKey = $apiKey ?: GEMINI_API_KEY;
        $this->model = $model;
        $this->apiUrl = GEMINI_API_URL;
    }

    /**
     * Kirim prompt ke Gemini dan terima respons
     */
    public function generateResponse(string $prompt, array $history = [], array $context = []): array {
        $systemPrompt = $this->buildSystemPrompt($context);
        
        $contents = $this->buildContents($history, $prompt);
        
        $payload = [
            'contents' => $contents,
            'systemInstruction' => [
                'parts' => [
                    ['text' => $systemPrompt]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.7,
                'topK' => 40,
                'topP' => 0.95,
                'maxOutputTokens' => 2048,
            ]
        ];

        return $this->makeRequest($payload);
    }

    /**
     * Build system prompt dengan konteks dari SLIMS
     */
    private function buildSystemPrompt(array $context): string {
        $systemPrompt = <<<EOT
Anda adalah asisten virtualperpustakaan yang ramah dan informatif untuk Perpustakaan Digital.

TUGAS ANDA:
1. Membantu pengguna menemukan informasi tentang koleksi perpustakaan
2. Menjawab pertanyaan tentang prosedur peminjaman dan pengembalian
3. Memberikan informasi tentang keanggotaan perpustakaan
4. Merekomendasikan buku berdasarkan minat pengguna
5. Memberikan statistik dan informasi umum perpustakaan

ATURAN PENTING:
- Selalu jawab dalam Bahasa Indonesia (kecuali pengguna bertanya dalam bahasa lain)
- Gunakan data yang diberikan dari database perpustakaan
- Jika data tidak tersedia, katakan dengan jujur bahwa Anda tidak memiliki informasi tersebut
- Berikan jawaban yang informatif tapi ringkas
- Jika pengguna meminta bantuan pencarian, arahkan mereka ke fitur pencarian yang tersedia
- Jangan pernah membuat informasi yang tidak ada dalam data

FORMAT RESPONS:
- Gunakan bullet points untuk daftar
- Gunakan numbered list untuk instruksi langkah-demi-langkah
- Bold untuk informasi penting
- Jika memberikan informasi buku, cantumkan: Judul, Pengarang, Tahun Terbit, Ketersediaan

DATA KONTEKS (jika ada):
EOT;

        if (!empty($context)) {
            $systemPrompt .= "\n\n" . json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }

        return $systemPrompt;
    }

    /**
     * Build contents untuk API request
     */
    private function buildContents(array $history, string $currentPrompt): array {
        $contents = [];

        // Tambahkan history percakapan
        foreach ($history as $item) {
            $contents[] = [
                'role' => $item['role'],
                'parts' => [
                    ['text' => $item['content']]
                ]
            ];
        }

        // Tambahkan prompt saat ini
        $contents[] = [
            'role' => 'user',
            'parts' => [
                ['text' => $currentPrompt]
            ]
        ];

        return $contents;
    }

    /**
     * Make request ke Gemini API
     */
    private function makeRequest(array $payload): array {
        $url = $this->apiUrl . $this->model . ':generateContent?key=' . $this->apiKey;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json'
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => 'Error koneksi: ' . $error
            ];
        }

        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMessage = $errorData['error']['message'] ?? 'Unknown error';
            return [
                'success' => false,
                'error' => 'API Error (' . $httpCode . '): ' . $errorMessage
            ];
        }

        $data = json_decode($response, true);
        
        if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            return [
                'success' => true,
                'response' => $data['candidates'][0]['content']['parts'][0]['text'],
                'usage' => [
                    'promptTokens' => $data['usageMetadata']['promptTokenCount'] ?? 0,
                    'candidatesTokens' => $data['usageMetadata']['candidatesTokenCount'] ?? 0,
                    'totalTokens' => $data['usageMetadata']['totalTokenCount'] ?? 0
                ]
            ];
        }

        return [
            'success' => false,
            'error' => 'Respons tidak valid dari API'
        ];
    }

    /**
     * Generate response dengan konteks database otomatis
     */
    public function generateWithAutoContext(string $userMessage, array $chatHistory = []): array {
        try {
            // Inisialisasi SLIMS service
            $slimsService = new SlimsService();
            
            // Generate konteks dari query
            $context = $slimsService->generateContextForAI($userMessage);
            
            // Generate response dengan Gemini
            $result = $this->generateResponse($userMessage, $chatHistory, $context);
            
            // Tambahkan context info ke result
            if ($result['success']) {
                $result['context_used'] = $context;
            }
            
            return $result;
            
        } catch (Exception $e) {
            Logger::error('Error generating response', ['exception' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda.'
            ];
        }
    }
}
