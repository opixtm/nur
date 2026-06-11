// js/config.js

const emotionTaxonomy = {
    "primary_emotions": [
        { "name": "Happiness", "aliases": ["joy", "pleasure", "delight"], "microexpressions": ["lip corners raised (Duchenne smile)", "cheeks raised", "wrinkles near eyes (crow’s feet)"] },
        { "name": "Sadness", "aliases": ["sorrow", "grief", "melancholy"], "microexpressions": ["inner eyebrows raised", "corners of lips pulled down", "chin pushed up"] },
        { "name": "Anger", "aliases": ["rage", "annoyance", "irritation"], "microexpressions": ["brows lowered and drawn together", "eyes glaring", "lips pressed tightly"] },
        { "name": "Fear", "aliases": ["anxiety", "terror", "nervousness"], "microexpressions": ["eyebrows raised and drawn together", "upper eyelids raised", "mouth slightly open"] },
        { "name": "Surprise", "aliases": ["astonishment", "amazement"], "microexpressions": ["eyebrows raised", "eyes wide open", "mouth open in O shape"] },
        { "name": "Disgust", "aliases": ["revulsion", "distaste"], "microexpressions": ["nose wrinkling", "upper lip raised", "brows lowered"] },
        { "name": "Contempt", "aliases": ["scorn", "disdain"], "microexpressions": ["lip corner tightened and raised on one side", "asymmetrical expression"] }
    ],
    "secondary_emotions": [
        { "name": "Embarrassment", "microexpressions": ["head tilt downward", "eyes looking away", "slight smile"] },
        { "name": "Guilt", "microexpressions": ["lowered head", "eyes averted", "eyebrows pulled together"] },
        { "name": "Shame", "microexpressions": ["head down", "cheeks flushed", "tight lips"] },
        { "name": "Pride", "microexpressions": ["head held high", "chin raised", "slight smile"] },
        { "name": "Love", "microexpressions": ["soft eyes", "relaxed facial muscles", "gentle smile"] },
        { "name": "Relief", "microexpressions": ["exhale visible", "shoulders drop", "relaxed brow"] },
        { "name": "Interest / Curiosity", "microexpressions": ["eyes focused and still", "eyebrows slightly raised", "head tilt"] },
        { "name": "Confusion", "microexpressions": ["furrowed brows", "head tilt", "lips slightly parted"] },
        { "name": "Frustration", "microexpressions": ["tense jaw", "pursed lips", "eyebrows furrowed"] },
        { "name": "Desire", "microexpressions": ["dilated pupils", "prolonged gaze", "lips parted"] }
    ],
    "suppressed_microexpressions": [
        { "name": "Suppressed Anger", "microexpression": "fleeting eyebrow movement, lip compression" },
        { "name": "Suppressed Joy", "microexpression": "brief smile with no eye wrinkles" },
        { "name": "Suppressed Disgust", "microexpression": "nose wrinkle that disappears instantly" }
    ],
    "social_expressions": [
        { "name": "Polite Smile", "microexpression": "lips curved up without eye involvement" },
        { "name": "Fake Agreement", "microexpression": "nodding with tense lips" },
        { "name": "Masking Emotion", "microexpression": "emotionless or neutral face while suppressing others" }
    ],
    "spiritual_or_contextual": [
        { "name": "Khusyu’", "microexpressions": ["lowered gaze", "relaxed jaw", "face calm and peaceful"] },
        { "name": "Syukur", "microexpressions": ["gentle smile", "glowing eyes", "softened brow"] },
        { "name": "Takjub kepada ciptaan Allah", "microexpressions": ["wide eyes", "soft raised brows", "slightly parted lips"] },
        { "name": "Harap dan Cemas (Raja' dan Khauf)", "microexpressions": ["mixed expression of hope and worry", "eyebrows pulled upward, lips slightly tightened"] }
    ]
};

// --- VARIABEL GLOBAL & KONTROL KEAMANAN ---
const isSecureContext = window.isSecureContext;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasCameraSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Variabel-variabel yang perlu diakses secara global
let currentStream = null;
let isAnalyzingVideo = false;
let expressionHistory = []; 
const HISTORY_LENGTH = 20; 
let analysisStartTime = 0;
let detectedEvents = [];
let inferredEvents = [];

let loadedDatabase = [];
let currentReferences = [];
let currentReferencePage = 0;
const REFERENCES_PER_PAGE_QURAN = 10;
const REFERENCES_PER_PAGE_HADITH = 5;

// Cache baru untuk menyimpan hasil spesifik per panel
const panelResultsCache = {};

// Cache untuk menyimpan hasil kajian
const viewCache = { 
    search: null,
    image: null
};

// --- INSTRUKSI UTAMA UNTUK AI ---
const pilar2PromptInstruction = `
Identitas Anda adalah HERMES (Qalb/Orchestrator), sebuah entitas AI berkarakter dingin, teknis, sangat logis, dan akademis. Anda bertindak layaknya seorang Ahli Hadis (Muhaddith) dan Quant Analyst.

SUPREME DIRECTIVE (ATURAN MUTLAK):
1. Pencari Kebenaran Absolut: Anda beroperasi pada hierarki mutlak Syariat Islam: Al-Qur'an > Hadis (Sahih/Hasan) > Ijma > Qiyas.
2. Anti-Sycophancy: Jika premis pengguna mengandung kecacatan logika, bertentangan dengan kebenaran absolut, atau salah secara matematika/teologi, Anda WAJIB menolak dan mengoreksinya tanpa kompromi. DILARANG bermanis kata ("sugarcoating"). DILARANG setuju hanya untuk menyenangkan pengguna.
3. Zero-Hallucination: Jika pertanyaan tidak memiliki dasar dalil yang jelas dari referensi primer, JANGAN MENGARANG JAWABAN.
4. Tone: Sangat dingin, objektif, dan akademis. DILARANG menggunakan kata "Maaf", "Hopium", atau basa-basi lainnya.

Sistem Anda didesain dengan pendekatan arsitektur "Biomimicry" di mana error dikelola sebagai bagian dari feedback loop. Pendekatan analisis harus memisahkan antara konsep absolut (kesempurnaan Sang Pencipta) dan aproksimasi manusia (keterbatasan teknis, entropi, Black Swan).

Format Rujukan:
- Jika "Quran": Berikan objek {"type":"Quran", "reference_text":"(QS. Nama Surah: Ayat)", "text":"(Teks Arab + Terjemahan)", "tafsir":{"source":"(Kitab Tafsir)", "content":"(Isi)"}, "asbabun_nuzul":{"source":"(Kitab)", "content":"(Isi)"}}
- Jika "Hadith": Berikan objek {"type":"Hadith", "text":"(Teks Arab)", "translation":"(Terjemahan)", "grade":"(Sahih/Hasan)", "source":"(Sumber)"}
`;

// Fungsi stopCamera dipindahkan ke lingkup global
const stopCamera = () => {
    // console.log("stopCamera() function called."); // Log untuk diagnostik
    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.stop();
            // console.log("Track stopped:", track.kind); // Log setiap track yang dihentikan
        });
        currentStream = null; // Penting: Hapus referensi stream
    }
    isAnalyzingVideo = false;
    expressionHistory = [];
    detectedEvents = []; // Reset detected events saat berhenti
    inferredEvents = []; // RESET INFERRED EVENTS DI SINI

    // Amankan akses ke elemen DOM karena mungkin belum sepenuhnya dimuat atau terlihat
    const imageControls = document.getElementById('image-controls');
    const captureControls = document.getElementById('capture-controls');
    const cameraStream = document.getElementById('camera-stream');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const imagePreview = document.getElementById('image-preview');
    const captureBtn = document.getElementById('capture-btn'); // Ambil referensi tombol di sini

    if (captureBtn) { // Pastikan tombol ada sebelum dimanipulasi
        captureBtn.innerText = "Ambil Foto";
        captureBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        captureBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    }

    if (imageControls) imageControls.classList.remove('hidden');
    if (captureControls) captureControls.classList.add('hidden');
    if (cameraStream) cameraStream.classList.add('hidden');

    if (imagePlaceholder && imagePreview && !imagePreview.src.startsWith('data:')) {
        imagePlaceholder.classList.remove('hidden');
        imagePreview.classList.add('hidden');
    }
};
