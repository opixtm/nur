// js/app.js

async function loadDatabase(file) {
    try {
        const fileContent = await file.text();
        const cleanText = fileContent.trim();
        loadedDatabase = JSON.parse(cleanText);
        // console.log('Database Al-Qur'an & Hadis berhasil dimuat!', loadedDatabase.length, 'entri.');
    } catch (error) {
        console.error('Error loading or parsing database:', error);
        throw new Error('Gagal memuat atau mem-parsing database. Pastikan file adalah JSON yang valid.');
    }
}

function processQuery(userInput) {
    runQuickAnswerRAG(userInput);
}

let researchChatHistory = [];

async function runQuickAnswerRAG(query) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;

    const userBubbleHTML = `
        <div class="flex justify-end mb-6">
            <div class="bg-emerald-800/60 text-white p-4 rounded-xl rounded-tr-none max-w-[80%] border border-emerald-700">
                <p class="whitespace-pre-wrap">${query}</p>
            </div>
        </div>
    `;
    if (researchChatHistory.length === 0) {
        resultsContainer.innerHTML = userBubbleHTML;
    } else {
        resultsContainer.insertAdjacentHTML('beforeend', userBubbleHTML);
    }

    const loadingId = 'loading-' + Date.now();
    const loadingHTML = `
        <div id="${loadingId}" class="flex justify-start mb-6 animate-pulse">
            <div class="bg-gray-800/80 p-4 rounded-xl rounded-tl-none border border-gray-700 flex items-center space-x-3">
                <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <span class="text-sm text-gray-400 ml-2">Hermes sedang mendekonstruksi premis...</span>
            </div>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('beforeend', loadingHTML);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });

    setTimeout(async () => {
        const searchQuran = document.getElementById('filter-quran')?.checked ?? true;
        const searchHadith = document.getElementById('filter-hadith')?.checked ?? true;

        if (!searchQuran && !searchHadith) {
            showError("Anda harus memilih minimal satu sumber rujukan (Al-Qur'an atau Hadis) untuk melakukan pencarian.");
            return;
        }

        const relevantDocuments = await findRelevantDocuments(query, 15, { searchQuran, searchHadith });

        let contextText = "";
        let referenceObjects = [];

        if (relevantDocuments.length > 0) {
            relevantDocuments.forEach(doc => {
                if (doc.type === 'Quran') {
                    contextText += `[Qur'an] ${doc.source}: "${doc.translation}"\n`;
                    referenceObjects.push({
                        type: "Quran",
                        reference_text: doc.source,
                        text: doc.text,
                        translation: doc.translation,
                        tafsir: doc.tafsir || null,
                        asbabun_nuzul: doc.asbabun_nuzul || null
                    });
                } else if (doc.type === 'Hadith') {
                    contextText += `[Hadis] ${doc.source}: "${doc.translation}" (Grade: ${doc.grade || 'Tidak diketahui'})\n`;
                    referenceObjects.push({
                        type: "Hadith",
                        text: doc.text,
                        translation: doc.translation,
                        grade: doc.grade || "Tidak diketahui",
                        source: doc.source
                    });
                }
            });
        }

        let promptContextSection = "";
        if (contextText) {
            promptContextSection = `
    **KONTEKS RUJUKAN PRIMER DARI DATABASE LOKAL (AL-QUR'AN & HADIS):**
    ${contextText}
    `;
        }

        const instructionPayload = `${pilar2PromptInstruction}
        
        **INSTRUKSI JAWABAN (WAJIB DIIKUTI UNTUK SETIAP RESPON):**
        Sebagai HERMES, berikan analisis teknis dan LENGKAP mengenai input pengguna. Fokus pada dekonstruksi logika secara objektif dan mendalam.

        --- STRUKTUR ANALISIS WAJIB ---
        Setiap jawaban WAJIB dipecah ke dalam 3 bagian analisis ini:
        1.  **Sub-Agent Logika & Filosofi:** Analisis premis pengguna secara brutal dan dekonstruksi batasan masalah.
        2.  **Sub-Agent Statistik & Prediksi:** Petakan dampak dunia nyata, risiko, Fat-Tails, atau Black Swan.
        3.  **Kesimpulan Orkestrator (Qalb):** Sintesis dari sudut pandang Maqashid al-Shari'ah.

        Berikan jawaban MURNI dalam format JSON: 
        {
            "summary": "Jawaban lengkap", 
            "references": [
                {
                    "type": "Quran/Hadith", 
                    "reference_text": "QS. Surat:Ayat", 
                    "text": "Teks Arab jika ada", 
                    "translation": "Teks terjemahan",
                    "tafsir": {"source": "Nama Tafsir", "content": "Isi Tafsir"}
                }
            ], 
            "follow_up_questions": ["Tanya 1", "Tanya 2"]
        }
        `;

        let userContent = query;
        if (contextText) {
            userContent += `\n\n**KONTEKS RUJUKAN PRIMER DARI DATABASE LOKAL (AL-QUR'AN & HADIS):**\n${contextText}`;
        }

        if (researchChatHistory.length === 0) {
            researchChatHistory.push({ role: "system", content: instructionPayload });
        }
        researchChatHistory.push({ role: "user", content: userContent });

        const payload = { messages: researchChatHistory };

        try {
            const resultData = await callGeminiAPI(payload);
            
            researchChatHistory.push({ role: "assistant", content: JSON.stringify(resultData) });
            
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            if (referenceObjects.length > 0) {
                if (resultData.references && Array.isArray(resultData.references)) {
                    resultData.references.forEach(aiRef => {
                        if (aiRef && aiRef.reference_text) {
                            const localRef = referenceObjects.find(lr =>
                                lr.reference_text && lr.reference_text.includes(aiRef.reference_text.split(':')[0])
                            );
                            if (localRef) {
                                if (aiRef.tafsir) localRef.tafsir = aiRef.tafsir;
                                if (aiRef.asbabun_nuzul) localRef.asbabun_nuzul = aiRef.asbabun_nuzul;
                            }
                        }
                    });
                }
                resultData.references = referenceObjects;
                renderSearchResults(resultData, 'verified');
            } else {
                renderSearchResults(resultData, 'generative');
            }

        } catch (error) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            
            const errorBubble = `
                <div class="flex justify-start mb-6">
                    <div class="bg-red-900/50 text-red-300 p-4 rounded-xl border border-red-700">
                        <h3 class="font-bold">Error Hermes Qalb</h3><p>${error.message}</p>
                    </div>
                </div>
            `;
            resultsContainer.insertAdjacentHTML('beforeend', errorBubble);
            researchChatHistory.pop();
        }
    }, 0);
}

async function findRelevantDocuments(query, limit = 20, options = { searchQuran: true, searchHadith: true }) {
    const allFoundDocs = [];
    const lowerCaseQuery = query.toLowerCase().trim();
    const { searchQuran, searchHadith } = options;
    const stopWords = new Set([
        'adalah', 'adanya', 'adapun', 'agak', 'agar', 'akan', 'aku', 'akulah', 'amat', 'antara', 'antaranya', 'apabila', 'apakah', 'apaan', 'atas', 'atau', 'ataupun',
        'bagai', 'bagaikan', 'bagaimana', 'bagi', 'bahkan', 'bahwa', 'banyak', 'beberapa', 'belum', 'berada', 'berbagai', 'berdasarkan', 'berapa', 'berasal', 'berarti',
        'berikut', 'berikutnya', 'bersama', 'bersama-sama', 'besar', 'betulkah', 'bisa', 'boleh', 'bukan', 'bukankah', 'bukanlah',
        'cukup',
        'dari', 'daripada', 'demikian', 'demikianlah', 'dengan', 'depan', 'di', 'dia', 'dialah', 'dll', 'dsb',
        'guna',
        'harus', 'hendak', 'hendaklah', 'hingga',
        'ia', 'ialah', 'ibarat', 'ini', 'inilah', 'itu', 'itulah',
        'jangan', 'jika', 'juga', 'justru',
        'kala', 'kalau', 'kami', 'kamilah', 'kamu', 'karena', 'karenanya', 'ke', 'kecuali', 'keluar', 'kembali', 'kemudian', 'kepadanya', 'keterangan', 'kini', 'kira-kira', 'kita', 'kitalah',
        'kurang',
        'lagi', 'lagian', 'lalu', 'lain', 'lainnya', 'lepas', 'lebih',
        'maka', 'makanya', 'mana', 'manakala', 'masih', 'mau', 'maupun', 'melainkan', 'memang', 'mengenai', 'menurut', 'mereka', 'merekalah', 'mungkin', 'mustahil',
        'nah', 'namun',
        'oleh', 'olehnya',
        'pada', 'padahal', 'paling', 'para', 'pasti', 'pun',
        'saat', 'saja', 'saling', 'sama', 'sama-sama', 'sampai', 'sana', 'sangat', 'sangatlah', 'saya', 'sayalah', 'sebab', 'sebabnya', 'sebagai', 'sebagaimana', 'sebagian',
        'sebelum', 'sebelumnya', 'secara', 'sedang', 'sedangkan', 'sedikit', 'sedikitnya', 'segala', 'sehingga', 'sejak', 'sekali', 'sekalian', 'sekilas', 'sekitar', 'selain',
        'selalu', 'selama', 'selama-lamanya', 'seluruh', 'semata', 'sementara', 'semua', 'semuanya', 'semula', 'sendiri', 'sendirinya', 'seolah', 'seperti', 'sepertinya',
        'sering', 'seringnya', 'serta', 'siapa', 'siapakah', 'siapapun', 'sini', 'suatu', 'sudah', 'sungguh', 'sungguhnya', 'supaya',
        'tahukah', 'tanpa', 'tapi', 'terhadap', 'termasuk', 'tentang', 'tentu', 'terlalu', 'tersebut', 'tetapi', 'tiada', 'tidak', 'tidakkah', 'tidaklah',
        'toh', 'total', 'umum', 'umumnya', 'untuk', 'usah',
        'via',
        'wahai', 'walau', 'walaupun', 'wong',
        'yaitu', 'yakni', 'yang'
    ]);
    const queryWords = lowerCaseQuery.split(/\\s+/).filter(word => word.length > 2 && !stopWords.has(word));

    loadedDatabase.forEach(doc => {
        if (!searchQuran && doc.type === 'Quran') return;
        if (!searchHadith && doc.type === 'Hadith') return;

        let relevanceScore = 0;
        const contentToSearch = ((doc.translation || '') + ' ' + (doc.text || '')).toLowerCase();

        if (contentToSearch.includes(lowerCaseQuery)) {
            relevanceScore += 2000; 
        }

        if (doc.type === 'Quran' && queryWords.some(word => contentToSearch.includes(word))) {
            relevanceScore += 1000; 
        }

        if (queryWords.length > 0) {
            let matchedKeywordsCount = 0;
            queryWords.forEach(word => {
                if (contentToSearch.includes(word)) {
                    matchedKeywordsCount++;
                }
            });
            relevanceScore += matchedKeywordsCount * 100; 
        }

        if (relevanceScore === 0 && lowerCaseQuery.length > 2) {
            if (queryWords.some(word => contentToSearch.includes(word))) {
                relevanceScore += 1; 
            }
        }

        if (queryWords.length > 0) {
            const allKeywordsFound = queryWords.every(word => contentToSearch.includes(word));
            if (allKeywordsFound) {
                relevanceScore += (queryWords.length > 1) ? 200 : 100;
            }
        }

        if (relevanceScore >= 100) {
            if (!allFoundDocs.some(found => found.doc.id === doc.id)) {
                allFoundDocs.push({ doc, score: relevanceScore });
            }
        }
    });

    allFoundDocs.sort((a, b) => b.score - a.score);
    const uniqueRelevantDocs = allFoundDocs.map(item => item.doc);
    return uniqueRelevantDocs.slice(0, limit);
}

const panelInitializers = {
    'unified-search': function() {
        const panel = document.getElementById('unified-search-panel');
        if (!panel) return;
        panel.innerHTML = `<form id="unified-search-form" class="relative"><textarea id="unified-search-input" rows="3" placeholder="Ketik (Klik Mic) topik, pertanyaan, atau referensi (misal: QS. Al-Baqarah: 183, HR. Bukhari tentang niat) Pilih Rujukan Al-Qur'an/Hadis atau keduanya" class="w-full p-4 pr-12 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea><button type="button" class="dictation-btn absolute top-4 right-4 text-gray-400 hover:text-emerald-400" data-target="unified-search-input"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button><button type="submit" class="mt-4 w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors">SEARCH</button><div class="mt-4 flex items-center justify-center space-x-6"><label for="filter-quran" class="flex items-center text-gray-300 cursor-pointer"><input type="checkbox" id="filter-quran" class="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-emerald-500 focus:ring-emerald-500" checked><span class="ml-2">Al-Qur'an</span></label><label for="filter-hadith" class="flex items-center text-gray-300 cursor-pointer"><input type="checkbox" id="filter-hadith" class="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-emerald-500 focus:ring-emerald-500" checked><span class="ml-2">Hadis</span></label></div></form>`;
        panel.querySelector('#unified-search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const query = panel.querySelector('#unified-search-input').value.trim();
            if (query) processQuery(query);
        });
        const searchInput = panel.querySelector('#unified-search-input');
        const searchForm = panel.querySelector('#unified-search-form');

        if (searchInput && searchForm) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    searchForm.dispatchEvent(new Event('submit'));
                }
            });
         }
    },
    image: function() {
        const panel = document.getElementById('image-panel');
        if (!panel) return;
        panel.innerHTML = `<div class="max-w-md mx-auto text-center"><div id="image-display-area" class="mb-4 h-64 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center overflow-hidden"><p id="image-placeholder" class="text-gray-500">VIEW FINDER</p><img id="image-preview" src="" class="hidden max-h-full max-w-full rounded-lg"/><video id="camera-stream" class="hidden w-full h-full object-cover" autoplay></video></div><canvas id="camera-canvas" class="hidden"></canvas><div id="image-controls" class="space-y-2"><div class="space-y-2"><div class="flex space-x-2"><button id="upload-btn" class="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors">Upload Gambar</button><button id="camera-btn" class="w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors">Photo Capture</button></div><button id="micro-expression-btn" class="w-full px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 5.555a1 1 0 00-1.9 1.11l1.018 3.156a.5.5 0 01-.444.679H8a1 1 0 100 2h1.632a.5.5 0 01.444.679l-1.018 3.155a1 1 0 101.9 1.11l1.544-4.78a.5.5 0 010-.222L9.555 5.555z" clip-rule="evenodd" /></svg>Deteksi Ekspresi Mikro (Video)</button></div></div><div id="capture-controls" class="hidden space-y-2"><button id="capture-btn" class="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Ambil Foto</button><button id="switch-camera-btn" class="w-full text-sm py-2 text-gray-300 hover:text-white transition-colors">Kamera Belakang</button><button id="cancel-camera-btn" class="w-full text-sm text-gray-400 hover:text-white transition-colors">Batal</button></div><input type="file" id="image-input" class="hidden" accept="image/*"/></div>`;

        const imageInput = panel.querySelector('#image-input'), uploadBtn = panel.querySelector('#upload-btn'), cameraBtn = panel.querySelector('#camera-btn'), imagePreview = panel.querySelector('#image-preview'), imagePlaceholder = panel.querySelector('#image-placeholder'), cameraStream = panel.querySelector('#camera-stream'), cameraCanvas = panel.querySelector('#camera-canvas'), imageControls = panel.querySelector('#image-controls'), captureControls = panel.querySelector('#capture-controls'), captureBtn = panel.querySelector('#capture-btn'), cancelCameraBtn = panel.querySelector('#cancel-camera-btn'), microExpressionBtn = panel.querySelector('#micro-expression-btn'), switchCameraBtn = panel.querySelector('#switch-camera-btn');
        let currentFacingMode = 'user';

        async function startCamera(facingMode) {
            if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); }
            const constraints = { video: { facingMode: { exact: facingMode } } };
            try {
                currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                cameraStream.srcObject = currentStream;
                imageControls.classList.add('hidden');
                captureControls.classList.remove('hidden');
                imagePlaceholder.classList.add('hidden');
                imagePreview.classList.add('hidden');
                cameraStream.classList.remove('hidden');
            } catch (err) {
                showError(`Gagal mengakses kamera: ${err.message}. Coba gunakan kamera lain.`);
                stopCamera();
            }
        }

        const analyzeImage = async (base64Data, mimeType) => {
            showLoading('Menganalisa hasil capture..Mohon SABAR menunggu....');
            document.getElementById('results-container').scrollIntoView({ behavior: 'smooth' });

            const tempImageForAnalysis = new Image();
            tempImageForAnalysis.src = `data:${mimeType};base64,${base64Data}`;
            await new Promise(resolve => tempImageForAnalysis.onload = resolve);

            const detections = await faceapi.detectAllFaces(tempImageForAnalysis, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            let prompt;

            if (detections.length > 0) {
                const expression = Object.keys(detections[0].expressions).reduce((a, b) => detections[0].expressions[a] > detections[0].expressions[b] ? a : b);
                prompt = `
        ${pilar2PromptInstruction}
        Anda adalah Sub-Agent Dekomposisi Visual. Tugas Anda mengamati data piksel absolut dan menghindari atribusi emosi manusia yang halusinatif.
        **Konteks Analisa:**
        - Bukti visual empiris telah diberikan.
        - Deteksi subjek (jika manusia): **${detections.length}** entitas.
        - Prediksi ekspresi mikro: **${expression}**.
        
        **INSTRUKSI EKSEKUSI WAJIB (JSON ONLY):**
        **1. Deskripsi Objek (description):** Tuliskan fakta visual empiris. Apa saja objek yang ada? Bagaimana pencahayaan riil? Jangan menggunakan bahasa puitis. Jangan menebak perasaan subjek.
        **2. Dekonstruksi Visual & Spiritual (wisdom):** Jelaskan kondisi riil gambar ini dalam kerangka Sunnatullah. Jika ada manusia, jelaskan interaksi sosialnya dari sudut pandang sosiologi atau fiqh. 
        **3. Rujukan (references):** Sertakan dalil qat'i (Al-Qur'an/Hadis) yang relevan dengan fenomena visual tersebut.
        
        **FORMAT OUTPUT JSON:**
        {"description": "(Hasil Tugas 1)", "wisdom": "(Hasil Tugas 2)", "references": [/* array objek Al-Qur'an/Hadis */], "follow_up_questions": [/* 2 pertanyaan objektif */]}`;
            } else {
                prompt = `
        ${pilar2PromptInstruction}
        Anda adalah Sub-Agent Dekomposisi Visual. Amati gambar dan berikan analisis objektif.
        
        **INSTRUKSI EKSEKUSI WAJIB (JSON ONLY):**
        1.  **description**: Fakta visual objektif. Sebutkan objek material.
        2.  **wisdom**: Analisis filosofis dan dekonstruksi berdasarkan Maqashid Syariah.
        3.  **references**: Sertakan rujukan dalil mutlak.
        
        **FORMAT OUTPUT JSON:**
        {"description": "...", "wisdom": "...", "references": [...], "follow_up_questions": ["..."]}`;
            }

            const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json" } };
            try {
                const resultData = await callGeminiAPI(payload);
                renderImageAnalysis(resultData, `data:${mimeType};base64,${base64Data}`);
            } catch (error) { showError(error.message); }
        };

        uploadBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result.split(',')[1];
                imagePreview.src = reader.result;
                imagePreview.classList.remove('hidden');
                imagePlaceholder.classList.add('hidden');
                analyzeImage(base64Data, file.type);
            };
            reader.readAsDataURL(file);
        });

        if (hasCameraSupport && isSecureContext) {
            cameraBtn.addEventListener('click', () => {
                captureBtn.innerText = "Ambil Foto";
                captureBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                captureBtn.classList.add('bg-red-600', 'hover:bg-red-700');
                captureBtn.onclick = () => {
                    cameraCanvas.width = cameraStream.videoWidth;
                    cameraCanvas.height = cameraStream.videoHeight;
                    cameraCanvas.getContext('2d').drawImage(cameraStream, 0, 0);
                    const imageDataUrl = cameraCanvas.toDataURL('image/jpeg');
                    imagePreview.src = imageDataUrl;
                    imagePreview.classList.remove('hidden');
                    stopCamera();
                    analyzeImage(imageDataUrl.split(',')[1], 'image/jpeg');
                };
                startCamera(currentFacingMode);
            });

            microExpressionBtn.addEventListener('click', () => {
                captureBtn.innerText = "Mulai Analisa";
                captureBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
                captureBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                captureBtn.onclick = () => {
                    if (!isAnalyzingVideo) {
                        isAnalyzingVideo = true;
                        detectedEvents = [];
                        analysisStartTime = Date.now();
                        captureBtn.innerText = "Hasilkan Laporan";
                        captureBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                        captureBtn.classList.add('bg-red-600', 'hover:bg-red-700');
                        analyzeVideoStream();
                    } else {
                        generateMicroExpressionReport();
                    }
                };
                startCamera(currentFacingMode);
            });

            switchCameraBtn.addEventListener('click', () => {
                currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
                startCamera(currentFacingMode);
            });

        } else {
            cameraBtn.classList.add('secure-feature-disabled');
            microExpressionBtn.classList.add('secure-feature-disabled');
        }

        cancelCameraBtn.addEventListener('click', stopCamera);
    },
    settings: function() {
        const panel = document.getElementById('settings-panel');
        if (!panel) return;
        panel.innerHTML = `
                <div class="max-w-xl mx-auto p-6 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
                    <div class="mb-4">
                        <span class="inline-block p-3 bg-emerald-500/20 text-emerald-400 rounded-full">
                            <i class="fas fa-server fa-2x"></i>
                        </span>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Cloud-Hybrid Architecture Aktif</h3>
                    <p class="text-gray-300 text-sm mb-4">
                        API Key dan Vector Database kini dikelola secara otomatis dan aman oleh <strong>Master Agent</strong> di server lokal Anda via Cloudflare Tunnel.
                    </p>
                    <div class="inline-flex items-center space-x-2 bg-gray-900 px-4 py-2 rounded border border-gray-600">
                        <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span class="text-emerald-400 text-sm font-semibold">Terkoneksi ke The Mac Brain</span>
                    </div>
                </div>
        `;
    },
};

const panelInitialized = {};
function switchView(viewName) {
    document.querySelectorAll('.panel').forEach(p => {
        p.classList.remove('panel-active');
        p.style.display = 'none'; 
    });
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
    });

    const navButton = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navButton) {
        navButton.classList.add('active');
    }

    const activePanel = document.getElementById(`${viewName}-panel`);
    if (activePanel) {
        activePanel.classList.add('panel-active');
        activePanel.style.display = 'block'; 

        if (!panelInitialized[viewName]) {
            if (panelInitializers[viewName]) {
                panelInitializers[viewName]();
            }
            panelInitialized[viewName] = true;
        }

        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) { 
            if (panelResultsCache.hasOwnProperty(viewName) && panelResultsCache[viewName]) {
                resultsContainer.innerHTML = panelResultsCache[viewName];
            } else {
                resultsContainer.innerHTML = '';
            }
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFaceApiModels();
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
        mainNav.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem && navItem.dataset.view) {
                switchView(navItem.dataset.view);
            }
        });
    }
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.pagination-btn')) {
                const direction = e.target.dataset.direction;
                if (direction === 'prev') {
                    currentReferencePage = Math.max(0, currentReferencePage - 1);
                } else if (direction === 'next') {
                    currentReferencePage++;
                }
                const wrapper = document.getElementById('references-wrapper');
                if (wrapper) {
                    wrapper.innerHTML = renderReferensi(currentReferences);
                }
                return;
            }
            const madhhabBtn = e.target.closest('.madhhab-btn');
            if (madhhabBtn) {
                const madhhab = madhhabBtn.dataset.madhhab;
                const originalTopic = madhhabBtn.closest('[data-original-topic]').dataset.originalTopic;
                processQuery(`Jelaskan pandangan Mazhab ${madhhab} tentang ${originalTopic} secara mendalam`);
                return;
            }
            const compareBtn = e.target.closest('.compare-all-btn');
            if (compareBtn) {
                const originalTopic = compareBtn.closest('[data-original-topic]').dataset.originalTopic;
                processQuery(`Buat perbandingan ringkas pandangan 4 mazhab (Hanafi, Maliki, Syafi'i, Hanbali) tentang topik: "${originalTopic}". Sajikan dalam format tabel jika memungkinkan.`);
                return;
            }
            if (e.target.closest('#export-btn')) {
                exportResultToPDF();
                return;
            }
            if (e.target.matches('.follow-up-btn')) {
                processQuery(e.target.dataset.followupQuery);
            }
        });
        resultsContainer.addEventListener('submit', (e) => {
            if (e.target.matches('.custom-follow-up-form')) {
                e.preventDefault();
                const input = e.target.querySelector('input[type="text"]');
                if (input && input.value) processQuery(input.value.trim());
            }
        });
    }
    if (SpeechRecognition && isSecureContext) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'id-ID';
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const targetId = recognition.targetInputId;
            const targetInput = document.getElementById(targetId);
            if (targetInput) targetInput.value = transcript;
        };
        recognition.onerror = (event) => { showError(`Error dikte: ${event.error}`); };
        recognition.onend = () => { document.querySelectorAll('.dictation-btn').forEach(btn => btn.classList.remove('recording')); };
        document.body.addEventListener('click', (e) => {
            if (e.target.matches('.dictation-btn') || e.target.closest('.dictation-btn')) {
                const btn = e.target.closest('.dictation-btn');
                recognition.targetInputId = btn.dataset.target;
                btn.classList.add('recording');
                recognition.start();
            }
        });
    } else {
        document.querySelectorAll('.dictation-btn').forEach(btn => {
            btn.classList.add('secure-feature-disabled');
            btn.title = "Fitur dikte memerlukan koneksi aman (HTTPS).";
        });
    }
    
    // Database Al-Qur'an dan Hadis tidak diload di browser (dikelola oleh Backend/Master Agent)
    // untuk mencegah overhead memory (76MB+).
    
    switchView('unified-search');
});
