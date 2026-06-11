// js/face-engine.js

async function loadFaceApiModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        // console.log('Model Face Recognition berhasil dimuat.');
    } catch (error) {
        console.error('Gagal memuat model Face Recognition:', error);
        showError('Gagal memuat fitur pengenalan wajah. Coba refresh halaman.');
    }
}

async function generateMicroExpressionReport() {
    isAnalyzingVideo = false;
    showLoading('Membuat laporan analisis emosi kontekstual...');
    const videoEl = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0);
    const frameDataUrl = canvas.toDataURL('image/jpeg');
    const base64FrameData = frameDataUrl.split(',')[1];
    const prompt = `
Anda adalah 'Paul Ekman', seorang psikolog profesional ahli mikro ekspresi dan emosi, juga mampu melihat dari sudut pandang islam

**Data yang Dianalisis:**
- **Rangkaian Ekspresi Terdeteksi (Face-API.js):** ${JSON.stringify(detectedEvents)}
- **Inferensi Ekspresi (Berdasarkan Taksonomi Kustom):** ${JSON.stringify(inferredEvents)}
- **Definisi Taksonomi Emosi Kustom:**
${JSON.stringify(emotionTaxonomy, null, 2)}
- **Gambar Terlampir:** Frame terakhir dari video. Jika memungkinkan lakukan analisis dari SELURUH frame yang diperoleh.

**Tugas Anda:**
Buat laporan lengkap dalam format JSON. Ikuti struktur ini dengan ketat:
1.  **visual_description**: Deskripsikan gambar terlampir secara detail dan terstruktur(objek, pencahayaan, suasana).
2.  **emotion_analysis**: Berdasarkan rangkaian ekspresi yang terdeteksi dan inferensi ekspresi kustom, berikan interpretasi yang **sangat mendalam, detail, dan akurat**, berdasarkan keilmuan mikro ekspresi tentang kemungkinan perasaan atau pikiran subjek secara naratif. Gunakan frasa interpretatif seperti "ada indikasi..." atau "memberikan kesan...". Pertimbangkan juga definisi dari "Definisi Taksonomi Emosi Kustom" untuk analisis yang lebih kaya (misalnya tentang ekspresi yang ditekan, ekspresi sosial, atau spiritual). Berikan **DIAGNOSIS KLINIS** untuk debugging system.
3.  **contextual_wisdom**: Berikan hikmah Islami yang relevan dengan situasi tersebut.
4.  **references**: Sertakan 1-2 dalil (Al-Qur'an atau Hadis) yang mendukung hikmah Anda.
5.  **follow_up_questions**: Berikan 2-3 pertanyaan reflektif untuk pengguna.
BUAT KESIMPULAN SINGKAT PADA BAGIAN AKHIR DARI HASIL LAPORAN    
PENTING: SAMPAIKAN DALAM BAHASA INDONESIA DAN Gunakan format sub-judul singkat jika perlu

**STRUKTUR JSON OUTPUT (WAJIB):**
{
"visual_description": "(String)",
"emotion_analysis": "(String)",
"contextual_wisdom": "(String)",
"references": [/* array objek Al-Qur'an/Hadis */],
"follow_up_questions": [/* array pertanyaan */]
}
`;
    const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64FrameData } }] }], generationConfig: { responseMimeType: "application/json" } };
    try {
        const resultData = await callGeminiAPI(payload);
        renderMicroExpressionReport(resultData, frameDataUrl);
    } catch (error) { showError(error.message); } finally { stopCamera(); }
}

async function analyzeVideoStream() {
    // Bagian ini akan menghentikan loop jika analisis dihentikan dari tombol
    if (!isAnalyzingVideo) {
        const captureBtn = document.querySelector('#capture-btn');
        // Pastikan tombol direset ke status "Mulai Analisa" (biru)
        if (captureBtn) {
            captureBtn.innerText = "Mulai Analisa";
            captureBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            captureBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        return;
    }

    const videoEl = document.getElementById('camera-stream');
    const detection = await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();

    if (detection) {
        const expressions = detection.expressions;
        const currentExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

        const currentExpressionScore = expressions[currentExpression]; // Dapatkan skor kepercayaan
        expressionHistory.push({ expression: currentExpression, score: currentExpressionScore }); // Simpan objek {ekspresi, skor}
        // START LOGIKA INFERENSI BARU DI SINI
        const lastInferredEvent = inferredEvents[inferredEvents.length - 1];
        let newInference = null;

        // Contoh sederhana inferensi untuk Suppressed Joy:
        // Jika ekspresi dominan saat ini adalah 'neutral' tetapi sebelumnya ada 'happy' yang singkat dengan skor rendah,
        // atau jika ekspresi 'happy' itu sendiri memiliki skor kepercayaan yang rendah secara konsisten dalam sejarah singkat.
        const happyInHistory = expressionHistory.filter(h => h.expression === 'happy');
        if (currentExpression === 'neutral' && happyInHistory.length > 0 && happyInHistory.length < (HISTORY_LENGTH * 0.3) && happyInHistory[0].score < 0.7) {
            if (!lastInferredEvent || lastInferredEvent.name !== 'Suppressed Joy') {
                newInference = {
                    type: "suppressed_emotion",
                    name: "Suppressed Joy",
                    reason: "Brief, low-intensity happy expression followed by neutral state. Consistent with 'brief smile with no eye wrinkles' from taxonomy."
                };
            }
        }
        // Contoh sederhana inferensi untuk Suppressed Anger:
        // Jika ekspresi dominan saat ini adalah 'neutral' tetapi sebelumnya ada 'angry' yang singkat dengan skor rendah.
        const angryInHistory = expressionHistory.filter(h => h.expression === 'angry');
        if (currentExpression === 'neutral' && angryInHistory.length > 0 && angryInHistory.length < (HISTORY_LENGTH * 0.3) && angryInHistory[0].score < 0.7) {
             if (!lastInferredEvent || lastInferredEvent.name !== 'Suppressed Anger') {
                 newInference = {
                     type: "suppressed_emotion",
                     name: "Suppressed Anger",
                     reason: "Brief, low-intensity angry expression followed by neutral state. Consistent with 'fleeting eyebrow movement, lip compression' from taxonomy."
                 };
             }
         }

        // Tambahkan inferensi baru jika ada
        if (newInference) {
            const timestamp = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
            inferredEvents.push({ ...newInference, timestamp: `${timestamp}s` });
        }
        // END LOGIKA INFERENSI BARU DI SINI
        if (expressionHistory.length > HISTORY_LENGTH) {
            expressionHistory.shift();
        }

        const lastEvent = detectedEvents[detectedEvents.length - 1];

        if (!lastEvent || lastEvent.expression !== currentExpression) {
            const timestamp = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
            detectedEvents.push({ expression: currentExpression, timestamp: `${timestamp}s` });
            // console.log(detectedEvents);
        }

        const neutralCount = expressionHistory.filter(exp => exp.expression === 'neutral').length;
        if (currentExpression !== 'neutral' && neutralCount > HISTORY_LENGTH * 0.7) {
            // console.log(`MICRO EXPRESSION TERDETEKSI: ${currentExpression}. Membuat laporan...`);
            generateMicroExpressionReport();
        }
    }

    requestAnimationFrame(analyzeVideoStream);
}
