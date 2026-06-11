// js/ui-render.js

function renderMicroExpressionReport(data, frameDataUrl) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    const referensiHtml = renderReferensi(data.references);
    const followUpHtml = renderFollowUpQuestions(data.follow_up_questions);
    const reportHTML = `
        <div class="bg-gray-800/50 p-6 md:p-8 rounded-lg border border-sky-700 animate-fade-in">

            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mr-3 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.522 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                    </svg>
                    <span>Laporan Analisis Video</span>
                </h2>

                <div class="flex items-start gap-3">
                    <img src="${frameDataUrl}" alt="Hasil Capture Video" class="w-32 h-auto rounded-lg shadow-lg flex-shrink-0">
                    <button id="export-btn" class="p-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0" title="Unduh Laporan sebagai PDF">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>
            </div>

            <div id="exportable-content">
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-sky-400 border-b border-sky-400/20 pb-2 mb-3">Deskripsi Visual Sinematik</h3>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">${data.visual_description || 'Tidak ada deskripsi visual.'}</p>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-sky-400 border-b border-sky-400/20 pb-2 mb-3">Analisa Emosi & Perenungan</h3>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">${data.emotion_analysis || 'Tidak ada analisis emosi.'}</p>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-sky-400 border-b border-sky-400/20 pb-2 mb-3">Hikmah & Nasihat Islami</h3>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">${data.contextual_wisdom || 'Tidak ada hikmah yang bisa diambil.'}</p>
                </div>

                <div id="references-wrapper">${referensiHtml}</div>

                ${followUpHtml}
            </div>

        </div>
        `;

    resultsContainer.innerHTML = reportHTML;
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
    // Simpan hasil ke cache setelah dirender
    panelResultsCache['image'] = resultsContainer.innerHTML;
}

function showLoading(message, targetId = 'results-container') {
    const container = document.getElementById(targetId);
    if (container) {
        container.innerHTML = `<div class="flex flex-col justify-center items-center p-8 text-center"><svg class="animate-spin h-12 w-12 text-emerald-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="text-lg text-gray-400">${message}</p></div>`;
    }
}

function showError(message, targetId = 'results-container') {
    const container = document.getElementById(targetId);
    if (container) {
        container.innerHTML = `<div class="bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700 text-center"><h3 class="font-bold">Terjadi Kesalahan</h3><p>${message}</p></div>`;
    }
}

async function exportResultToPDF() {
    const exportButton = document.getElementById('export-btn');
    const contentToExport = document.getElementById('exportable-content');

    if (!contentToExport) {
        showError("Tidak ada konten untuk diekspor.");
        return;
    }
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        showError("Library PDF belum termuat, coba lagi sesaat.");
        return;
    }

    if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = 'Mengekspor...';
    }

    // Buka semua elemen <details> agar kontennya terlihat
    const detailsElements = contentToExport.querySelectorAll('details');
    const originalStates = [];
    detailsElements.forEach(details => {
        originalStates.push(details.open);
        details.open = true;
    });

    // Beri sedikit waktu agar browser selesai merender konten yang baru dibuka
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        // [PERUBAHAN UTAMA] Memberi tahu html2canvas ukuran eksplisit
        const canvas = await html2canvas(contentToExport, {
            scale: 2,
            backgroundColor: '#1f2937',
            width: contentToExport.scrollWidth,
            height: contentToExport.scrollHeight,
            windowWidth: contentToExport.scrollWidth,
            windowHeight: contentToExport.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Tambahkan halaman pertama
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Tambahkan halaman berikutnya jika konten lebih panjang dari satu halaman
        while (heightLeft > 0) {
            position = position - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const today = new Date().toISOString().slice(0, 10);
        pdf.save(`Kajian-Nur-${today}.pdf`);

    } catch (error) {
        console.error("Gagal ekspor ke PDF:", error);
        showError("Terjadi kesalahan saat membuat file PDF.");
    } finally {
        // Kembalikan tombol dan elemen <details> ke kondisi semula
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
        }
        detailsElements.forEach((details, index) => {
            details.open = originalStates[index];
        });
    }
}

function getHadithBadge(grade) {
    if (!grade) return '';
    grade = grade.toLowerCase();
    if (grade === 'sahih') return `<span class="ml-2 text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">Sahih</span>`;
    if (grade === 'hasan') return `<span class="ml-2 text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-yellow-600 bg-yellow-200">Hasan</span>`;
    return '';
}

const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
};

function renderMadhhabAnalysis(originalTopic) {
    const madhhabs = ['Hanafi', 'Maliki', 'Syafi\'i', 'Hanbali'];
    let buttonsHtml = madhhabs.map(m => `<button class="madhhab-btn text-left text-sm bg-gray-700 hover:bg-gray-600 text-emerald-300 px-4 py-2 rounded-lg transition-colors" data-madhhab="${m}">${m}</button>`).join('');
    buttonsHtml += `<button class="compare-all-btn text-left text-sm bg-teal-700 hover:bg-teal-600 text-white font-bold px-4 py-2 rounded-lg transition-colors">Bandingkan Semua</button>`;
    return `<div class="mt-8 pt-6 border-t border-gray-700" data-original-topic="${originalTopic}"><h3 class="text-lg font-semibold text-white mb-4">Analisa Lintas Mazhab</h3><div class="flex flex-wrap gap-3">${buttonsHtml}</div></div>`;
}

function renderFollowUpQuestions(questions) {
    if (!questions || questions.length === 0) return '';
    const buttonsHtml = questions.map(q => `<button class="follow-up-btn text-left text-sm bg-gray-700 hover:bg-gray-600 text-emerald-300 px-4 py-2 rounded-lg transition-colors" data-followup-query="${q}">${q}</button>`).join('');
    const customQuestionForm = `<form class="custom-follow-up-form mt-4 flex gap-2"><input type="text" placeholder="Ajukan pertanyaanmu sendiri..." class="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"><button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors">ASK</button></form>`;
    return `<div class="mt-8 pt-6 border-t border-gray-700"><h3 class="text-lg font-semibold text-white mb-4">Lanjutkan Diskusi:</h3><div class="flex flex-wrap gap-3">${buttonsHtml}</div>${customQuestionForm}</div>`;
}

function renderReferensi(references) {
    if (!references || references.length === 0) return '';
    const quranRefs = references.filter(ref => ref.type && ref.type.toLowerCase() === 'quran');
    const hadithRefs = references.filter(ref => ref.type && ref.type.toLowerCase() === 'hadith');
    let referencesHtml = '';

    if (quranRefs.length > 0) {
        referencesHtml += `<h3 class="text-xl font-semibold text-white border-b-2 border-emerald-500/50 pb-2 mb-4">Rujukan Al-Qur'an</h3>`;
        quranRefs.forEach(ref => {
            const tafsirHtml = (ref.tafsir && ref.tafsir.content) ? `<details class="mt-3"><summary>Tafsir (dari ${ref.tafsir.source || 'sumber terpercaya'})</summary><div><p class="text-gray-300 whitespace-pre-wrap">${ref.tafsir.content}</p></div></details>` : '';
            const asbabHtml = (ref.asbabun_nuzul && ref.asbabun_nuzul.content) ? `<details class="mt-2"><summary>Asbabun Nuzul (dari ${ref.asbabun_nuzul.source || 'sumber terpercaya'})</summary><div><p class="text-gray-300 whitespace-pre-wrap">${ref.asbabun_nuzul.content}</p></div></details>` : '';
            referencesHtml += `<div class="bg-gray-900 p-4 rounded-md border-l-4 border-green-500 mb-4">
                            <div class="flex items-center mb-2"><span class="inline-block px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-300">Quran</span>${ref.reference_text ? `<span class="ml-2 text-xs font-semibold text-gray-400">${ref.reference_text}</span>` : ''}</div>
                            <p class="text-gray-300 text-right whitespace-pre-wrap text-lg font-arabic mb-2">${ref.text || ''}</p>
                            <p class="text-gray-400 italic whitespace-pre-wrap">"${ref.translation || ''}"</p>
                            ${tafsirHtml}${asbabHtml}</div>`;
        });
    }

    if (hadithRefs.length > 0) {
        const totalHadithPages = Math.ceil(hadithRefs.length / REFERENCES_PER_PAGE_HADITH);
        const startIdx = currentReferencePage * REFERENCES_PER_PAGE_HADITH;
        const endIdx = startIdx + REFERENCES_PER_PAGE_HADITH;
        const hadithsToShow = hadithRefs.slice(startIdx, endIdx);
        referencesHtml += `<h3 class="text-xl font-semibold text-white border-b-2 border-emerald-500/50 pb-2 mt-6 mb-4">Rujukan Hadis</h3>`;
        hadithsToShow.forEach(ref => {
            const badge = getHadithBadge(ref.grade);
            const escapedArabicText = escapeHtml(ref.text || '');
            const escapedTranslationText = escapeHtml(ref.translation || '');
            const escapedSourceText = escapeHtml(ref.source || '');

            referencesHtml += `<div class="bg-gray-900 p-4 rounded-md border-l-4 border-yellow-500 mb-4">
                            <div class="flex items-center mb-2"><span class="inline-block px-2 py-1 text-xs font-bold rounded bg-yellow-500/20 text-yellow-300">Hadith</span>${badge}</div>
                            <p class="text-gray-300 text-right whitespace-pre-wrap mb-2 font-arabic">${escapedArabicText}</p>
                            <p class="text-gray-400 italic whitespace-pre-wrap">"${escapedTranslationText}"</p>
                            <p class="text-right text-xs text-gray-500 mt-2">${escapedSourceText}</p></div>`;
        });
        
        if (totalHadithPages > 1) {
            referencesHtml += `<div class="flex justify-center items-center space-x-4 mt-4">`;
            if (currentReferencePage > 0) {
                referencesHtml += `<button class="pagination-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors" data-direction="prev">&lt; Prev</button>`;
            }
            referencesHtml += `<span class="text-gray-400">Halaman ${currentReferencePage + 1} dari ${totalHadithPages}</span>`;
            if (currentReferencePage < totalHadithPages - 1) {
                referencesHtml += `<button class="pagination-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors" data-direction="next">Next &gt;</button>`;
            }
            referencesHtml += `</div>`;
        }
    }
    return referencesHtml;
}

function renderSearchResults(data, status = 'verified') {
    let displaySummary = data.summary;
    if (typeof data.summary !== 'string') {
        console.warn("WARN: data.summary bukan string, mencoba JSON.stringify:", data.summary);
        displaySummary = JSON.stringify(data.summary, null, 2); 
    }

    let displayReferences = data.references;
    if (Array.isArray(data.references)) {
        displayReferences = data.references.map(ref => {
            if (typeof ref !== 'object' || ref === null) {
                console.warn("WARN: Item referensi bukan objek/null, mencoba konversi:", ref);
                return { type: "Unknown", text_arabic: "", text_translation: JSON.stringify(ref), source: "Parsed Error" };
            }
            return {
                id: ref.id || null,
                type: ref.type || "Unknown",
                source: ref.source || ref.reference_text || "", 
                reference_text: ref.reference_text || ref.source || "", 
                text: ref.text || ref.text_arabic || "", 
                translation: ref.translation || ref.text_translation || "", 
                grade: ref.grade || "", 
                tafsir: ref.tafsir || null, 
                asbabun_nuzul: ref.asbabun_nuzul || null 
            };
        });
    } else {
        console.warn("WARN: data.references bukan array, mencoba konversi:", data.references);
        displayReferences = [];
        if (data.references) { 
            displayReferences.push({ type: "Error", text_translation: JSON.stringify(data.references), source: "API Format Error" });
        }
    }

    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;

    currentReferences = displayReferences || []; 
    currentReferencePage = 0;
    const referensiHtml = renderReferensi(currentReferences); 
    const madhhabHtml = renderMadhhabAnalysis(data.query);
    const followUpHtml = renderFollowUpQuestions(data.follow_up_questions);
    let borderColorClass = '';
    let statusLabel = '';
    let statusIcon = '';
    if (status === 'verified') {
        borderColorClass = 'border-green-700';
        statusLabel = "Terverifikasi dari Sumber Primer (Al-Qur'an & Hadis)";
        statusIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else if (status === 'generative') {
        borderColorClass = 'border-yellow-600';
        statusLabel = 'Analisis Generatif oleh AI (Membutuhkan Verifikasi Ahli & Dalil Utama)';
        statusIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
    }
    const resultHTML = `<div class="flex justify-start mb-6">
                            <div class="bg-gray-800/80 p-6 rounded-xl border ${borderColorClass} shadow-lg shadow-black/20 w-full animate-fade-in">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-grow">
                                        <div class="flex items-center text-sm font-semibold mb-3 text-gray-400">
                                            ${statusIcon}
                                            <span class="uppercase tracking-wider text-xs">${statusLabel}</span>
                                         </div>
                                    </div>
                                    <button class="export-btn flex-shrink-0 ml-4 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded transition-colors flex items-center">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>PDF</span>
                                    </button>
                                </div>
                                <div class="exportable-content prose prose-invert max-w-none">
                                    <p class="text-gray-200 mb-6 whitespace-pre-wrap leading-relaxed">${displaySummary}</p> 
                                    <div class="references-wrapper">${referensiHtml}</div>
                                </div>
                                ${madhhabHtml}
                                ${followUpHtml}
                            </div>
                        </div>`;
    resultsContainer.insertAdjacentHTML('beforeend', resultHTML);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    panelResultsCache['unified-search'] = resultsContainer.innerHTML;
}

function renderImageAnalysis(data, imageSrc) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    const referensiHtml = renderReferensi(data.references);
    const followUpHtml = renderFollowUpQuestions(data.follow_up_questions);
    const resultHTML = `<div class="bg-gray-800/50 p-8 rounded-lg border border-gray-700 animate-fade-in w-full max-w-full">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-grow">
                                        <h2 class="text-2xl font-bold text-white flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mr-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span>Tafsir & Hikmah Visual</span>
                                        </h2>
                                    </div>
                                    <button id="export-btn" class="flex-shrink-0 ml-4 px-3 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors flex items-center">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>PDF</span>
                                    </button>
                                </div>
                                <div id="exportable-content">
                                    <div class="grid grid-cols-1 gap-8">
                                        <div class="space-y-4">
                                            <div>
                                                <h3 class="text-lg font-semibold text-emerald-400">Deskripsi Gambar</h3>
                                                <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">${data.description}</p>
                                            </div>
                                            <div>
                                                <h3 class="text-lg font-semibold text-emerald-400">Pelajaran & Hikmah</h3>
                                                <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">${data.wisdom}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-8">${referensiHtml}</div>
                                </div>
                                ${followUpHtml}
                            </div>`;
    resultsContainer.innerHTML = resultHTML;
    panelResultsCache['image'] = resultsContainer.innerHTML; 
}
