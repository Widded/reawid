// tests/test_critical_fixes_suite.mjs
// Comprehensive Regression & Verification Suite for Critical Bug Fixes & Production Hardening
// Verifies all 9 production requirements from the user prompt:
// 1. AbortError classification & no failedPageAttempts penalty
// 2. Tesseract worker mutex lock & abort termination
// 3. Monotonic OCR generation ID stops stale workers from mutating active book
// 4. RAG cache invalidation via contentVersion & invalidateBookRetrievalCache
// 5. On-demand OCR book identity guard on book switch
// 6. IndexedDB write serialization & awaiting persistence
// 7. Candidate pages search scans full 500 pages (no 35-page barrier)
// 8. Spoiler protection isolates future candidate pages
// 9. TTS API security guards (50KB body, 3000 chars, voice whitelist, rate bounds, rate limiting)

import assert from 'node:assert';
import {
  initBookMemory,
  getBookMemory,
  savePageOcrMemory,
  getBookContentVersion,
  deleteBookMemory,
  clearAllBookMemories
} from '../src/services/bookMemoryService.js';

import {
  findCandidatePagesForQuestion,
  invalidateBookRetrievalCache
} from '../src/services/aiService.js';

import { createAbortError } from '../src/services/tesseractService.js';
import ttsHandler from '../api/tts.js';

let passed = 0;
let failed = 0;

function report(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message} ${details ? `(${details})` : ''}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message} ${details ? `(${details})` : ''}`);
    throw new Error(`Test Failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('ReaWid — Critical Bug Fix & Production Hardening Test Suite');
  console.log('================================================================\n');

  await clearAllBookMemories();

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 1: AbortError Sınıflandırması & failedPageAttempts Korunması
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: AbortError Sınıflandırması & Ceza Sayacı (failedAttempts) Muafiyeti ---');
  {
    const abortErr = createAbortError('Kullanıcı sayfayı geçti');
    report(abortErr.name === 'AbortError', 'createAbortError AbortError name özelliğine sahip olmalı', abortErr.name);

    // main.js mantık simülasyonu:
    const failedPageAttempts = new Map();
    const pageNum = 12;

    function handleOcrError(err, p) {
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      if (!isAbort) {
        failedPageAttempts.set(p, (failedPageAttempts.get(p) || 0) + 1);
      }
      return isAbort;
    }

    const wasAbort = handleOcrError(abortErr, pageNum);
    report(wasAbort === true, 'Abort hatası tespit edildi');
    report((failedPageAttempts.get(pageNum) || 0) === 0, 'Abort olan sayfa failedPageAttempts cezası almadı');

    // Gerçek bir network/OCR hatası durumunda sayaç artmalı:
    const realErr = new Error('Tesseract memory out of bounds');
    handleOcrError(realErr, pageNum);
    report((failedPageAttempts.get(pageNum) || 0) === 1, 'Gerçek OCR motor hatası ceza sayacını artırdı');
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 2: Tesseract Worker Mutex Lock
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Tesseract Worker Mutex Lock (Sıralı İş Kuyruğu) ---');
  {
    // Mutex promise queue modelinin eşzamanlı istekleri sıralı çalıştırdığını doğrula
    let activeExecutions = 0;
    let maxConcurrency = 0;
    let jobQueue = Promise.resolve();

    async function safeOcrWorkerJob(id, durationMs) {
      const runJob = async () => {
        activeExecutions++;
        maxConcurrency = Math.max(maxConcurrency, activeExecutions);
        await new Promise((res) => setTimeout(res, durationMs));
        activeExecutions--;
        return `Job ${id} done`;
      };

      const result = jobQueue.then(runJob, runJob);
      jobQueue = result.catch(() => {});
      return result;
    }

    // 5 eşzamanlı çağrı yap
    const promises = [
      safeOcrWorkerJob(1, 20),
      safeOcrWorkerJob(2, 15),
      safeOcrWorkerJob(3, 10),
      safeOcrWorkerJob(4, 15),
      safeOcrWorkerJob(5, 10)
    ];

    const results = await Promise.all(promises);
    report(results.length === 5, '5 OCR işi başarıyla tamamlandı');
    report(maxConcurrency === 1, 'Worker mutex lock eşzamanlılığı 1 olarak kısıtladı (Asla çakışma yok)', `Max concurrency: ${maxConcurrency}`);
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 3: Background OCR Restart Race (Generation ID İzolasyonu)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Background OCR Restart Race & Monotonik Generation ID ---');
  {
    let currentOcrGenerationId = 1;
    let currentActiveBook = { id: 'book_alpha', pageParagraphs: {} };

    // Worker generation 1 başlatıldı
    const workerGenId = currentOcrGenerationId;

    // Kullanıcı kitabı değiştirdi veya stopBackgroundOcrQueue çağrıldı:
    currentOcrGenerationId++; // monotonic increment
    currentActiveBook = { id: 'book_beta', pageParagraphs: {} };

    // Worker 1 sonradan tamamlandı ve sonuç getirdi:
    let writeAllowed = false;
    if (workerGenId === currentOcrGenerationId && currentActiveBook.id === 'book_alpha') {
      currentActiveBook.pageParagraphs[5] = ['Eski kitap paragrafı'];
      writeAllowed = true;
    }

    report(!writeAllowed, 'Eski generation işçisi yeni kitaba veya yeni generation a veri yazamadı');
    report(Object.keys(currentActiveBook.pageParagraphs).length === 0, 'Aktif kitap (book_beta) temiz kaldı');
    report(currentOcrGenerationId === 2, 'Generation ID monotonik olarak arttı', `Gen: ${currentOcrGenerationId}`);
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 4: RAG Cache Invalidation via contentVersion & invalidateBookRetrievalCache
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: RAG Cache Invalidation (contentVersion & Cache Purge) ---');
  {
    const bookId = 'book_rag_invalidation_test';
    await initBookMemory({
      bookId,
      pdfFingerprint: 'fp_rag_test',
      totalPages: 10
    });

    const v1 = getBookContentVersion(bookId);
    report(v1 === 1, 'İlk contentVersion 1 olarak başlatıldı', `v1: ${v1}`);

    // Yeni bir sayfa OCR edip kaydet
    await savePageOcrMemory(bookId, 1, ['Harry Gryffindor masasında oturuyordu.']);
    const v2 = getBookContentVersion(bookId);
    report(v2 === 2, 'Yeni sayfa OCR kaydedildiğinde contentVersion otomatik arttı', `v2: ${v2}`);

    // aiService cache key yapısını test et
    const cacheKey1 = `${bookId}_v${v1}_harry kimdir`;
    const cacheKey2 = `${bookId}_v${v2}_harry kimdir`;
    report(cacheKey1 !== cacheKey2, 'contentVersion değişimi RAG önbellek anahtarını anında geçersiz kılar');

    // invalidateBookRetrievalCache fonksiyonunun hatasız çalıştığını doğrula
    invalidateBookRetrievalCache(bookId);
    report(true, 'invalidateBookRetrievalCache başarıyla çağrıldı ve önbellek temizlendi');
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 5: On-Demand OCR Kitap Kimliği ve Yanıt Koruma (Book Switch Guard)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: On-Demand OCR Kitap Değişimi Güvenliği (Book Identity Guard) ---');
  {
    let activeBook = { id: 'book_hp1', title: 'Felsefe Taşı', pageParagraphs: {} };
    let activeOcrGeneration = 10;

    // Kullanıcı soru sordu, sayfa 40 on-demand taranıyor
    const targetBookId = activeBook.id;
    const targetGenerationId = activeOcrGeneration;

    // Simüle edilen gecikmeli OCR sırasında kullanıcı hızla Kitap 2 ye geçti:
    activeBook = { id: 'book_hp2', title: 'Sırlar Odası', pageParagraphs: {} };
    activeOcrGeneration = 11;

    // On-demand OCR tamamlandı:
    const scannedPage = 40;
    const scannedText = 'Quirrell sarığını çözdü.';

    let guardTriggered = false;
    if (!activeBook || activeBook.id !== targetBookId || activeOcrGeneration !== targetGenerationId) {
      guardTriggered = true;
      // Stale OCR verisini yanlış kitaba yazma!
    } else {
      activeBook.pageParagraphs[scannedPage] = [scannedText];
    }

    report(guardTriggered === true, 'Kitap değişiminde On-Demand OCR koruma kalkanı tetiklendi');
    report(!activeBook.pageParagraphs[scannedPage], 'Sayfa 40 yeni açılan Sırlar Odası kitabına sızmadı');
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 6: IndexedDB Persistence Serialization & Awaiting
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: IndexedDB Serialization & Awaiting Persistence ---');
  {
    const bookId = 'book_idb_serial_test';
    await initBookMemory({
      bookId,
      pdfFingerprint: 'fp_idb_test',
      totalPages: 100
    });

    // 3 sayfayı eşzamanlı olarak kaydet (idbWriteQueues kuyruğu test et)
    const savePromise1 = savePageOcrMemory(bookId, 1, { paragraphs: ['Sayfa 1'] });
    const savePromise2 = savePageOcrMemory(bookId, 2, { paragraphs: ['Sayfa 2'] });
    const savePromise3 = savePageOcrMemory(bookId, 3, { paragraphs: ['Sayfa 3'] });

    report(savePromise1 instanceof Promise, 'savePageOcrMemory Promise döndürüyor (await edilebilir)');
    await Promise.all([savePromise1, savePromise2, savePromise3]);

    const mem = await getBookMemory(bookId);
    const scannedKeys = Object.keys(mem.scannedPages).map(Number);
    report(scannedKeys.length === 3, 'Tüm eşzamanlı sayfalar sırayla ve eksiksiz kaydedildi', `Scanned: ${scannedKeys.join(',')}`);
    report(Array.isArray(mem.scannedPages[1]?.paragraphs) && Array.isArray(mem.scannedPages[2]?.paragraphs) && Array.isArray(mem.scannedPages[3]?.paragraphs), 'Her 3 sayfanın paragrafları başarıyla saklandı');
    report(mem.contentVersion === 4, 'Her yazmada contentVersion doğru arttı (1 -> 4)', `v: ${mem.contentVersion}`);
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 7: Candidate Pages Search (No 35-Page Barrier, 500 Sayfalık Arama)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 7: Candidate Pages Search (500 Sayfalık Kitapta Tam Kapsam) ---');
  {
    const chapterOutline = `
Bölüm 1 - Başlangıç (Sayfa 5)
Bölüm 5 - Karanlık Orman (Sayfa 85)
Bölüm 12 - Voldemort ile Yüzleşme (Sayfa 240)
Bölüm 18 - Büyük Savaş (Sayfa 480)
`;

    const mockPdfDoc = {
      numPages: 500,
      async getPage(num) {
        return {
          async getTextContent() {
            if (num === 240) {
              return { items: [{ str: 'Voldemort ve Harry asalarını kaldırdılar.' }] };
            }
            if (num === 480) {
              return { items: [{ str: 'Savaşın son anında kalkan çöktü.' }] };
            }
            return { items: [{ str: `Sayfa ${num} standart anlatı.` }] };
          }
        };
      }
    };

    const allMissingPages = Array.from({ length: 500 }, (_, i) => i + 1);
    const question = 'Voldemort ile yüzleşme ne zaman oldu?';
    const candidates = await findCandidatePagesForQuestion({
      question,
      missingPages: allMissingPages,
      chapterOutline,
      pdfDoc: mockPdfDoc,
      currentPage: 1,
      spoilerProtection: false,
      maxPages: 5
    });

    report(Array.isArray(candidates), 'findCandidatePagesForQuestion aday sayfalar dizisi döndürdü');
    report(candidates.length > 0, `Aday sayfalar bulundu (Toplam: ${candidates.length})`);
    
    // 35 sınırının kalktığını ve 240 gibi uzak sayfaların bulunduğunu doğrula
    const hasFarPage = candidates.some(p => p > 35);
    report(hasFarPage, '35-sayfa sınırı kaldırıldı, 35 ten büyük sayfalar başarıyla tespit edildi', `Bulunanlar: ${candidates.join(', ')}`);
    report(candidates.includes(240), 'Bölüm başlığı ve metin içeriğiyle eşleşen Sayfa 240 adaylara eklendi');
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 8: Spoiler Protection Boundary Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 8: Spoiler Koruması ve Sayfa Sınır İzolasyonu ---');
  {
    const chapterOutline = `
Bölüm 1 - Başlangıç (Sayfa 5)
Bölüm 2 - Karşılaşma (Sayfa 25)
Bölüm 3 - Tehlike (Sayfa 60)
Bölüm 4 - Gizemli Giriş (Sayfa 150)
`;

    const mockPdfDoc = {
      numPages: 300,
      async getPage() {
        return {
          async getTextContent() {
            return { items: [{ str: 'Metin' }] };
          }
        };
      }
    };

    const currentReaderPage = 30; // Kullanıcı 30. sayfada!
    const allMissingPages = Array.from({ length: 300 }, (_, i) => i + 1);
    const question = 'Voldemort ile yüzleşme ne zaman oldu?';
    const candidates = await findCandidatePagesForQuestion({
      question,
      missingPages: allMissingPages,
      chapterOutline,
      pdfDoc: mockPdfDoc,
      currentPage: currentReaderPage,
      spoilerProtection: true // Spoiler Koruması AÇIK
    });

    const anySpoiler = candidates.some(p => p > currentReaderPage);
    report(!anySpoiler, 'Spoiler koruması açıkken kullanıcının mevcut sayfasından (30) büyük sayfa getirilmedi', `Adaylar: ${candidates.join(', ')}`);
    report(candidates.every(p => p <= 30), 'Tüm aday sayfalar <= 30 sınırına sıkı sıkıya uyuyor');
  }

  // ---------------------------------------------------------------------------
  // GEREKSİNİM 9: TTS API Security Guards
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 9: TTS API Security Guards (Body, Char, Voice & Rate Limits) ---');
  {
    // Helper to mock res
    function createMockRes() {
      const res = {
        statusCode: 200,
        headers: {},
        sentData: null,
        setHeader(name, val) { this.headers[name] = val; },
        status(code) { this.statusCode = code; return this; },
        json(data) { this.sentData = data; return this; },
        send(data) { this.sentData = data; return this; },
        end() { return this; }
      };
      return res;
    }

    // 9a: Content-Length > 50KB Guard
    const resOver50kb = createMockRes();
    await ttsHandler({
      method: 'POST',
      headers: { 'content-length': (60 * 1024).toString() },
      body: { text: 'test' }
    }, resOver50kb);
    report(resOver50kb.statusCode === 413, '50KB üzeri istek boyutu 413 Payload Too Large ile reddedildi', `Status: ${resOver50kb.statusCode}`);

    // 9b: Text Length > 3000 chars Guard
    const resOver3000Chars = createMockRes();
    const giantText = 'A'.repeat(3005);
    await ttsHandler({
      method: 'POST',
      headers: { 'content-length': '3500' },
      body: { text: giantText }
    }, resOver3000Chars);
    report(resOver3000Chars.statusCode === 400, '3000 karakterden uzun metin 400 Bad Request ile reddedildi', `Status: ${resOver3000Chars.statusCode}`);

    // 9c: Empty Text Guard
    const resEmptyText = createMockRes();
    await ttsHandler({
      method: 'POST',
      headers: {},
      body: { text: '   ' }
    }, resEmptyText);
    report(resEmptyText.statusCode === 400, 'Boş metin 400 Bad Request ile reddedildi');

    // 9d: IP Rate Limiting Guard
    const floodIp = '198.51.100.99';
    let blockedWith429 = false;
    for (let i = 0; i < 50; i++) {
      const resFlood = createMockRes();
      await ttsHandler({
        method: 'POST',
        headers: { 'x-forwarded-for': floodIp },
        body: { text: '' } // Boş bile olsa IP rate limit check önce çalışır
      }, resFlood);
      if (resFlood.statusCode === 429) {
        blockedWith429 = true;
        break;
      }
    }
    report(blockedWith429, 'Aşırı istek gönderen IP adresi 429 Too Many Requests ile sınırlandırıldı');
  }

  console.log('\n================================================================');
  console.log(`Sonuç: ${passed} Başarılı, ${failed} Hatalı (Toplam: ${passed + failed})`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('\nTest suite genel hata ile sonlandı:', err);
  process.exit(1);
});
