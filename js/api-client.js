// js/api-client.js

async function callGeminiAPI(payload, retries = 3, delay = 1000) {
    // [CLEAN CODE REFACTOR] Terhubung ke Hermes Gateway API (OpenAI format) via Tailscale Funnel
    const apiUrl = 'https://taufiks-imac.tailb50867.ts.net/v1/chat/completions';
    
    let messages = [];
    
    if (payload.messages) {
        messages = payload.messages; // Menggunakan mode chat history
    } else {
        let openAiContent = [];
        const parts = payload.contents?.[0]?.parts;
        
        if (parts && parts.length > 0) {
            for (const part of parts) {
                if (part.text) {
                    openAiContent.push({ type: "text", text: part.text });
                } else if (part.inline_data) {
                    openAiContent.push({ 
                        type: "image_url", 
                        image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` }
                    });
                }
            }
        } else {
            openAiContent = payload.query || JSON.stringify(payload);
        }
        messages = [{ role: "user", content: openAiContent }];
    }
    
    const requestBody = {
        model: "default",
        messages: messages,
        temperature: 0.1,
        response_format: { type: "json_object" }
    };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer hermes_public_key'
                }, 
                body: JSON.stringify(requestBody) 
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error(`Backend API Error Response (Attempt ${i + 1}/${retries}):`, errorData);

                if (response.status === 429) {
                    throw new Error('⏳ [ERROR 429: API QUOTA EXHAUSTED] Sistem kehabisan Token (Google Free Tier). Harap bersabar 1-2 menit hingga Quota di-reset otomatis.');
                }
                if (response.status === 504 || response.status === 502) {
                    throw new Error('🔌 [ERROR 504/502: GATEWAY TIMEOUT] Koneksi terputus. Hal ini biasanya terjadi karena Gateway menahan koneksi akibat Limit Quota token terkuras. Harap coba lagi dalam 1 menit.');
                }

                if (i < retries - 1) {
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                    continue;
                } else {
                    throw new Error(`Gagal menghubungi Backend Master Agent (Error ${response.status}). Pastikan server Python berjalan.`);
                }
            }

            const data = await response.json();
            // Parse the content string back to JSON object
            return JSON.parse(data.choices[0].message.content);
            
        } catch (error) {
            if (i === retries - 1) {
                if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Load failed'))) {
                    throw new Error('🔌 KONEKSI TERPUTUS: Tailscale memutus koneksi (Timeout). Ini terjadi jika Hermes Gateway sedang terjebak Limit Quota (Error 429) dan tertahan puluhan detik. Harap tunggu 1-2 menit agar Quota pulih.');
                }
                throw error;
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
    throw new Error("Gagal memproses data dari Backend lokal.");
}
