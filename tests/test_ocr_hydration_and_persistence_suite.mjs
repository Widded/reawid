// Test Suite: ReaWid OCR Hydration, Persistence, and Storage Merge Suite
// Validates all 6 specific scenarios for:
// 1. OCR tamamlanır, PWA kapatılır ve açılır: Sayfa tekrar OCR edilmemeli.
// 2. OCR devam ederken PWA kapatılır: Yarım kalan sayfa yeniden denenmeli.
// 3. OCR tamamlanırken sayfa ilerlemesi kaydedilir: OCR metni kaybolmamalı.
// 4. Birden fazla kitapta kayıtlar birbirine karışmamalı.
// 5. IndexedDB'de bulunan ama LocalStorage'da bulunmayan sayfalar geri yüklenmeli.
// 6. LocalStorage'da bulunan ama IndexedDB'de bulunmayan geçerli sayfalar korunmalı.

import assert from 'node:assert';

// Setup Mock Environment for Browser Globals before importing services
if (!globalThis.localStorage) {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
}

if (!globalThis.window) {
  globalThis.window = {
    localStorage: globalThis.localStorage
  };
}

const {
  saveBook,
  getBooks,
  getBookById,
  updateBookPageParagraphs,
  updateBookProgress,
  debouncedSaveBooks,
  flushPendingStorageWrites,
  setCurrentBook
} = await import('../src/services/storageService.js');

const {
  savePageOcrMemory,
  getBookMemory,
  clearAllBookMemories,
  loadOrInitializeBookMemory,
  hydrateBookFromMemory,
  getNextTargetPage,
  getMissingOrFailedPages
} = await import('../src/services/bookMemoryService.js');

let passedCount = 0;
let totalCount = 0;

async function runScenario(scenarioNum, title, fn) {
  totalCount++;
  console.log(`\n======================================================`);
  console.log(`SENARYO ${scenarioNum}: ${title}`);
  console.log(`======================================================`);
  try {
    await fn();
    passedCount++;
    console.log(`>>> SONUÇ: BAŞARILI ✓`);
  } catch (err) {
    console.error(`>>> SONUÇ: BAŞARISIZ ✗`);
    console.error(`    Hata: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('REAWID OCR PERSISTENCE & HYDRATION REGRESSION SUITE BAŞLATILIYOR...\n');

  // Reset clean state
  localStorage.clear();
  await clearAllBookMemories();

  // --------------------------------------------------------------------------
  // Senaryo 1: OCR tamamlanır, PWA kapatılır ve açılır: Sayfa tekrar OCR edilmemeli.
  // --------------------------------------------------------------------------
  await runScenario(1, 'OCR tamamlanır, PWA kapatılır ve açılır: Sayfa tekrar OCR edilmemeli', async () => {
    const bookId = 'book_pers_1';
    const book = {
      id: bookId,
      title: 'Gerçek Kitap 1 (Kafka)',
      author: 'Franz Kafka',
      totalPages: 10,
      currentPage: 1,
      isPdf: true,
      pdfFingerprint: 'fp_pers_1',
      pageParagraphs: {}
    };

    saveBook(book);
    await loadOrInitializeBookMemory(book);

    // Sayfa 1 OCR tamamlandı ve kaydedildi
    const p1Paras = ['Gregor Samsa bir sabah bunaltıcı düşlerden uyandığında...'];
    updateBookPageParagraphs(bookId, 1, p1Paras, p1Paras.join('\n\n'));
    await savePageOcrMemory(bookId, 1, {
      pageNumber: 1,
      paragraphs: p1Paras,
      rawText: p1Paras.join('\n\n'),
      ocrStatus: 'completed'
    });
    flushPendingStorageWrites();

    // PWA kapatıldı (tüm RAM nesneleri sıfırlandı), yeniden açıldı
    const freshBook = getBookById(bookId);
    assert(freshBook, 'Kitap LocalStorage/RAM üzerinden bulunmalı');

    const mem = await getBookMemory(bookId, freshBook.pdfFingerprint);
    assert(mem, 'Book Memory IndexedDB üzerinden yüklenmeli');

    // Hydration çalışır
    hydrateBookFromMemory(freshBook, mem);

    assert(freshBook.pageParagraphs[1], 'Sayfa 1 paragrafları dolu olmalı');
    assert.strictEqual(freshBook.pageParagraphs[1][0], p1Paras[0]);

    // getNextTargetPage kontrol edilir: Sayfa 1 tamamlandığı için ASLA Sayfa 1 seçilmemeli!
    const targetPage = getNextTargetPage({
      totalPages: 10,
      pageParagraphs: freshBook.pageParagraphs,
      currentReaderPage: 1
    });

    assert.notStrictEqual(targetPage, 1, 'Sayfa 1 zaten tamamlandığı için tekrar OCR edilmemeli');
    assert.strictEqual(targetPage, 2, 'Sayfa 1 tamam olduğu için bir sonraki hedef sayfa 2 olmalı');
  });

  // --------------------------------------------------------------------------
  // Senaryo 2: OCR devam ederken PWA kapatılır: Yarım kalan sayfa yeniden denenmeli.
  // --------------------------------------------------------------------------
  await runScenario(2, 'OCR devam ederken PWA kapatılır: Yarım kalan sayfa yeniden denenmeli', async () => {
    const bookId = 'book_pers_2';
    const book = {
      id: bookId,
      title: 'Gerçek Kitap 2 (Dostoyevski)',
      author: 'Fyodor Dostoyevski',
      totalPages: 10,
      currentPage: 3,
      isPdf: true,
      pdfFingerprint: 'fp_pers_2',
      pageParagraphs: {}
    };

    saveBook(book);
    await loadOrInitializeBookMemory(book);

    // Sayfa 1 ve 2 başarıyla bitti
    updateBookPageParagraphs(bookId, 1, ['Sayfa 1 metni']);
    await savePageOcrMemory(bookId, 1, { pageNumber: 1, paragraphs: ['Sayfa 1 metni'], ocrStatus: 'completed' });
    updateBookPageParagraphs(bookId, 2, ['Sayfa 2 metni']);
    await savePageOcrMemory(bookId, 2, { pageNumber: 2, paragraphs: ['Sayfa 2 metni'], ocrStatus: 'completed' });

    // Sayfa 3 taranırken PWA kapandı (metin oluşmadı veya yarım/başarısız kaldı)
    await savePageOcrMemory(bookId, 3, {
      pageNumber: 3,
      paragraphs: [],
      ocrStatus: 'failed',
      error: 'Uygulama arka planda kapandı'
    });
    flushPendingStorageWrites();

    // PWA yeniden açıldı
    const freshBook = getBookById(bookId);
    const mem = await getBookMemory(bookId, freshBook.pdfFingerprint);
    hydrateBookFromMemory(freshBook, mem);

    // Sayfa 3 tamamlanmış sayılmamalı
    assert(!freshBook.pageParagraphs[3] || freshBook.pageParagraphs[3].length === 0, 'Sayfa 3 paragrafları boş olmalı');

    // Missing pages kontrolü
    const missingInfo = getMissingOrFailedPages(freshBook, 10);
    assert(missingInfo.missingPages.includes(3), 'Yarım kalan sayfa 3 missingPages içinde yer almalı');

    // getNextTargetPage Sayfa 3'ü hedeflemeli (çünkü okuyucu şu an sayfa 3'te ve sayfa 3 eksik)
    const targetPage = getNextTargetPage({
      totalPages: 10,
      pageParagraphs: freshBook.pageParagraphs,
      currentReaderPage: 3
    });

    assert.strictEqual(targetPage, 3, 'Kaldığı ve yarım kalan sayfa 3 yeniden denenmeli');
  });

  // --------------------------------------------------------------------------
  // Senaryo 3: OCR tamamlanırken sayfa ilerlemesi kaydedilir: OCR metni kaybolmamalı.
  // --------------------------------------------------------------------------
  await runScenario(3, 'OCR tamamlanırken sayfa ilerlemesi kaydedilir: OCR metni kaybolmamalı', async () => {
    const bookId = 'book_pers_3';
    const book = {
      id: bookId,
      title: 'Gerçek Kitap 3 (Sabahattin Ali)',
      author: 'Sabahattin Ali',
      totalPages: 20,
      currentPage: 1,
      progress: 5,
      isPdf: true,
      pdfFingerprint: 'fp_pers_3',
      pageParagraphs: {}
    };

    saveBook(book);

    // 1. OCR sayfa 5'i güncelliyor (debounced 800ms)
    const p5Paras = ['Şimdiye kadar tesadüf ettiğim insanlardan bir tanesi...'];
    updateBookPageParagraphs(bookId, 5, p5Paras, p5Paras.join('\n\n'));

    // 2. Henüz 800ms dolmadan hemen arkasından kullanıcı sayfa çevirdi ve progress güncellendi (400ms debounce)
    updateBookProgress(bookId, 25, 5);

    // 3. getBooks() çağrıldığında pending latestBooksToSave içerisindeki sayfa 5 paragrafları KORUNMALI!
    const booksNow = getBooks();
    const targetBook = booksNow.find(b => b.id === bookId);

    assert(targetBook, 'Kitap getBooks() içinde bulunmalı');
    assert.strictEqual(targetBook.progress, 25, 'İlerleme %25 olarak güncellenmiş olmalı');
    assert.strictEqual(targetBook.currentPage, 5, 'Geçerli sayfa 5 olmalı');
    assert(targetBook.pageParagraphs && targetBook.pageParagraphs[5], 'Sayfa 5 paragrafları ilerleme kaydıyla EZİLMEMELİ!');
    assert.strictEqual(targetBook.pageParagraphs[5][0], p5Paras[0], 'Sayfa 5 metni birebir korunmalı');

    // Flush yapıldığında localStorage'a da doğru yazılmalı
    flushPendingStorageWrites();
    const rawLocal = JSON.parse(localStorage.getItem('reawid_books_v2'));
    const savedLocalBook = rawLocal.find(b => b.id === bookId);
    assert(savedLocalBook.pageParagraphs && savedLocalBook.pageParagraphs[5], 'LocalStorage içinde de Sayfa 5 metni korunmalı');
  });

  // --------------------------------------------------------------------------
  // Senaryo 4: Birden fazla kitapta kayıtlar birbirine karışmamalı.
  // --------------------------------------------------------------------------
  await runScenario(4, 'Birden fazla kitapta kayıtlar birbirine karışmamalı', async () => {
    const bookA = {
      id: 'book_A',
      title: 'Kitap A',
      totalPages: 10,
      pdfFingerprint: 'fp_A',
      pageParagraphs: {}
    };
    const bookB = {
      id: 'book_B',
      title: 'Kitap B',
      totalPages: 10,
      pdfFingerprint: 'fp_B',
      pageParagraphs: {}
    };

    saveBook(bookA);
    saveBook(bookB);
    await loadOrInitializeBookMemory(bookA);
    await loadOrInitializeBookMemory(bookB);

    // Kitap A için sayfa 1
    updateBookPageParagraphs('book_A', 1, ['Kitap A Sayfa 1 metni']);
    await savePageOcrMemory('book_A', 1, { pageNumber: 1, paragraphs: ['Kitap A Sayfa 1 metni'], ocrStatus: 'completed' });

    // Kitap B için sayfa 2
    updateBookPageParagraphs('book_B', 2, ['Kitap B Sayfa 2 metni']);
    await savePageOcrMemory('book_B', 2, { pageNumber: 2, paragraphs: ['Kitap B Sayfa 2 metni'], ocrStatus: 'completed' });

    flushPendingStorageWrites();

    const memA = await getBookMemory('book_A');
    const memB = await getBookMemory('book_B');

    // Başka kitaba ait Book Memory yükleme testi (Kitap A'ya yanlışlıkla MemB verilirse reddetmeli)
    const testBookA = getBookById('book_A');
    hydrateBookFromMemory(testBookA, memB); // Wrong memory!

    assert(!testBookA.pageParagraphs[2], 'Kitap B nin belleği Kitap A ya YÜKLENMEMELİ!');
    assert(testBookA.pageParagraphs[1], 'Kitap A nın kendi sayfası korunmalı');

    // Doğru bellek yüklenmeli
    hydrateBookFromMemory(testBookA, memA);
    assert.strictEqual(testBookA.pageParagraphs[1][0], 'Kitap A Sayfa 1 metni');
    assert(!testBookA.pageParagraphs[2], 'Kitap A da sayfa 2 olmamalı');

    const testBookB = getBookById('book_B');
    hydrateBookFromMemory(testBookB, memB);
    assert.strictEqual(testBookB.pageParagraphs[2][0], 'Kitap B Sayfa 2 metni');
    assert(!testBookB.pageParagraphs[1], 'Kitap B de sayfa 1 olmamalı');
  });

  // --------------------------------------------------------------------------
  // Senaryo 5: IndexedDB'de bulunan ama LocalStorage'da bulunmayan sayfalar geri yüklenmeli.
  // --------------------------------------------------------------------------
  await runScenario(5, 'IndexedDB\'de bulunan ama LocalStorage\'da bulunmayan sayfalar geri yüklenmeli', async () => {
    const bookId = 'book_pers_5';
    const book = {
      id: bookId,
      title: 'Gerçek Kitap 5 (Oguz Atay)',
      author: 'Oğuz Atay',
      totalPages: 15,
      pdfFingerprint: 'fp_pers_5',
      pageParagraphs: {
        1: ['Sadece Sayfa 1 LocalStorage da var']
      }
    };

    saveBook(book);
    await loadOrInitializeBookMemory(book);
    flushPendingStorageWrites();

    // IndexedDB'de ise Sayfa 1 ve Sayfa 7 kayıtlı
    await savePageOcrMemory(bookId, 1, { pageNumber: 1, paragraphs: ['Sayfa 1 IDB metni'], ocrStatus: 'completed' });
    await savePageOcrMemory(bookId, 7, { pageNumber: 7, paragraphs: ['Sayfa 7 IDB metni: Turgut Özben...'], ocrStatus: 'completed' });

    const currentBook = getBookById(bookId);
    assert(!currentBook.pageParagraphs[7], 'Başlangıçta LocalStorage da sayfa 7 yok');

    const mem = await getBookMemory(bookId, book.pdfFingerprint);
    hydrateBookFromMemory(currentBook, mem);

    assert(currentBook.pageParagraphs[7], 'IndexedDB deki sayfa 7 başarıyla geri yüklenmeli');
    assert.strictEqual(currentBook.pageParagraphs[7][0], 'Sayfa 7 IDB metni: Turgut Özben...');
  });

  // --------------------------------------------------------------------------
  // Senaryo 6: LocalStorage'da bulunan ama IndexedDB'de bulunmayan geçerli sayfalar korunmalı.
  // --------------------------------------------------------------------------
  await runScenario(6, 'LocalStorage\'da bulunan ama IndexedDB\'de bulunmayan geçerli sayfalar korunmalı', async () => {
    const bookId = 'book_pers_6';
    const book = {
      id: bookId,
      title: 'Gerçek Kitap 6 (Yasar Kemal)',
      author: 'Yaşar Kemal',
      totalPages: 10,
      pdfFingerprint: 'fp_pers_6',
      pageParagraphs: {
        4: ['Sayfa 4 LocalStorage da mevcut ve geçerli']
      }
    };

    saveBook(book);
    await loadOrInitializeBookMemory(book);
    flushPendingStorageWrites();

    // IndexedDB'de bu kitap için henüz bellek oluşturuldu ama sayfa 4 yok
    const mem = await loadOrInitializeBookMemory({ id: bookId, title: 'İnce Memed', totalPages: 10, pdfFingerprint: 'fp_pers_6' });

    const currentBook = getBookById(bookId);
    assert(currentBook.pageParagraphs[4], 'LocalStorage da sayfa 4 mevcut');

    hydrateBookFromMemory(currentBook, mem.memory);

    // Sayfa 4 yok olmamalı, korunmalı ve IndexedDB belleğine de yazılmalı
    assert(currentBook.pageParagraphs[4], 'LocalStorage daki sayfa 4 hydration sonrası KORUNMALI');
    assert.strictEqual(currentBook.pageParagraphs[4][0], 'Sayfa 4 LocalStorage da mevcut ve geçerli');
    assert(mem.memory.scannedPages[4], 'IndexedDB belleğine sayfa 4 aktarılmış olmalı');
    assert.strictEqual(mem.memory.scannedPages[4].ocrStatus, 'completed');
  });

  console.log(`\n======================================================`);
  console.log(`TÜM SENARYOLAR BAŞARIYLA TAMAMLANDI: ${passedCount}/${totalCount}`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Test hatası:', err);
  process.exit(1);
});
