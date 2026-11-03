// Automated Test Suite: ReaWid Persistent Book Memory & OCR Cache
// Verifies all 6 core test scenarios required for Persistent Book Memory

import assert from 'node:assert';
import {
  generatePdfFingerprint,
  initBookMemory,
  getBookMemory,
  findBookMemoryByFingerprint,
  savePageOcrMemory,
  getMissingOrFailedPages,
  hydrateBookFromMemory,
  loadOrInitializeBookMemory,
  deleteBookMemory,
  clearAllBookMemories,
  getOrBuildBookRagIndex
} from '../src/services/bookMemoryService.js';

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('--- REAWID PERSISTENT BOOK MEMORY & OCR CACHE SUITE ---');
  console.log('======================================================\n');

  // Test setup
  await clearAllBookMemories();

  // --------------------------------------------------------------------------
  // TEST 1: Kitap açılır, 50 sayfa OCR yapılır, çıkılır ve tekrar açılır:
  // 50 sayfa yeniden OCR edilmemeli.
  // --------------------------------------------------------------------------
  await runTest('Test 1: 50 sayfa OCR yapılıp çıkıldığında ve tekrar açıldığında sayfalar yeniden taranmamalı', async () => {
    const bookId = 'book_test_1';
    const fakePdfBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const fingerprint = await generatePdfFingerprint(fakePdfBytes, 50);

    const initialBook = {
      id: bookId,
      title: 'Nutuk',
      author: 'Mustafa Kemal Atatürk',
      totalPages: 50,
      pdfFingerprint: fingerprint,
      pageParagraphs: {}
    };

    // 1. Kitap açılır ve initialize edilir
    const initResult = await loadOrInitializeBookMemory(initialBook, fakePdfBytes);
    assert.strictEqual(initResult.scannedCount, 0, 'Başlangıçta 0 sayfa taranmış olmalı');

    // 2. 50 sayfa taranır ve kalıcı hafızaya yazılır
    for (let p = 1; p <= 50; p++) {
      await savePageOcrMemory(bookId, p, {
        paragraphs: [`Sayfa ${p} paragraf 1 metni.`, `Sayfa ${p} paragraf 2 metni.`],
        rawText: `Sayfa ${p} paragraf 1 metni.\n\nSayfa ${p} paragraf 2 metni.`,
        ocrStatus: 'completed'
      });
    }

    // 3. Kitaptan "çıkılır" (yeni bir oturum veya taze kitap nesnesi simülasyonu)
    const freshBookSession = {
      id: bookId,
      title: 'Nutuk',
      author: 'Mustafa Kemal Atatürk',
      totalPages: 50,
      pdfFingerprint: fingerprint,
      pageParagraphs: {} // Boş bellek ile açılıyor
    };

    // 4. Kitap tekrar açılır
    const reopenResult = await loadOrInitializeBookMemory(freshBookSession, fakePdfBytes);

    assert.strictEqual(reopenResult.isPreloaded, true, 'Önceden taranmış veriler tanınmalı');
    assert.strictEqual(reopenResult.scannedCount, 50, 'Tüm 50 sayfa taranmış olarak gelmeli');
    assert.strictEqual(reopenResult.missingCount, 0, 'Hiçbir sayfa eksik olmamalı');
    assert.strictEqual(freshBookSession.pageParagraphs[1].length, 2, '1. sayfa paragrafları hidrate edilmiş olmalı');
    assert.strictEqual(freshBookSession.pageParagraphs[50].length, 2, '50. sayfa paragrafları hidrate edilmiş olmalı');

    // 5. Yeniden OCR kontrolü: getMissingOrFailedPages sıfır eksik sayfa dönmeli
    const missingCheck = getMissingOrFailedPages(freshBookSession, 50);
    assert.strictEqual(missingCheck.missingPages.length, 0, 'Yeniden taranacak eksik sayfa OLMAMALI');
    assert.strictEqual(missingCheck.isComplete, true, 'Tarama tamamlandı durumunda olmalı');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Kitapta 50 sayfa taranmış, 20 sayfa taranmamışsa (Toplam 70)
  // yalnızca eksik 20 sayfa işlenmeli.
  // --------------------------------------------------------------------------
  await runTest('Test 2: 50 sayfa taranmış, 20 sayfa taranmamışsa yalnızca eksik 20 sayfa işlenmeli', async () => {
    const bookId = 'book_test_2';
    const fakePdfBytes = new Uint8Array([20, 21, 22, 23, 24, 25]);
    const fingerprint = await generatePdfFingerprint(fakePdfBytes, 70);

    const book = {
      id: bookId,
      title: '70 Sayfalık Kitap',
      totalPages: 70,
      pdfFingerprint: fingerprint,
      pageParagraphs: {}
    };

    await loadOrInitializeBookMemory(book, fakePdfBytes);

    // İlk 50 sayfa taranıyor (sayfa 1..50)
    for (let p = 1; p <= 50; p++) {
      await savePageOcrMemory(bookId, p, {
        paragraphs: [`Sayfa ${p} içeriği.`],
        ocrStatus: 'completed'
      });
    }

    // Eksik sayfaları sorgula
    const status = getMissingOrFailedPages(book, 70);
    assert.strictEqual(status.scannedCount, 50, '50 sayfa taranmış olmalı');
    assert.strictEqual(status.missingCount, 20, 'Tam olarak 20 sayfa eksik olmalı');
    assert.deepStrictEqual(
      status.missingPages,
      Array.from({ length: 20 }, (_, i) => i + 51),
      'Eksik sayfalar yalnızca 51..70 arası olmalı'
    );

    // Taranmış 50 sayfa asla missingPages içinde bulunmamalı
    for (let p = 1; p <= 50; p++) {
      assert.strictEqual(status.missingPages.includes(p), false, `Sayfa ${p} eksik listesinde olmamalı`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Aynı isimli iki farklı PDF birbirinin hafızasını kullanmamalı.
  // --------------------------------------------------------------------------
  await runTest('Test 3: Aynı isimli ancak farklı içerikli iki PDF birbirinin hafızasını kullanmamalı', async () => {
    const commonTitle = 'Kullanici_Klavuzu.pdf';

    // PDF A: Versiyon 1
    const pdfBytesA = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const fingerprintA = await generatePdfFingerprint(pdfBytesA, 10);
    const bookA = {
      id: 'book_user_manual_v1',
      title: commonTitle,
      totalPages: 10,
      pdfFingerprint: fingerprintA,
      pageParagraphs: {}
    };

    // PDF B: Versiyon 2 (farklı baytlar, farklı içerik)
    const pdfBytesB = new Uint8Array([99, 88, 77, 66, 55, 44, 33, 22]);
    const fingerprintB = await generatePdfFingerprint(pdfBytesB, 10);
    const bookB = {
      id: 'book_user_manual_v2',
      title: commonTitle,
      totalPages: 10,
      pdfFingerprint: fingerprintB,
      pageParagraphs: {}
    };

    assert.notStrictEqual(fingerprintA, fingerprintB, 'İki farklı PDF farklı fingerprint üretmeli');

    // A kitabını kaydet ve sayfa 1'e özel metin ekle
    await loadOrInitializeBookMemory(bookA, pdfBytesA);
    await savePageOcrMemory(bookA.id, 1, {
      paragraphs: ['Versiyon 1 özel dokümantasyonu.'],
      ocrStatus: 'completed'
    });

    // B kitabını kaydet ve sayfa 1'e farklı metin ekle
    await loadOrInitializeBookMemory(bookB, pdfBytesB);
    await savePageOcrMemory(bookB.id, 1, {
      paragraphs: ['Versiyon 2 güncel revizyon dokümantasyonu.'],
      ocrStatus: 'completed'
    });

    // İki kitabın hafızalarını bağımsız sorgula
    const memoryA = await getBookMemory(bookA.id, fingerprintA);
    const memoryB = await getBookMemory(bookB.id, fingerprintB);

    assert.strictEqual(memoryA.scannedPages[1].paragraphs[0], 'Versiyon 1 özel dokümantasyonu.');
    assert.strictEqual(memoryB.scannedPages[1].paragraphs[0], 'Versiyon 2 güncel revizyon dokümantasyonu.');

    // B kitabının fingerprinti ile A'nın verisini almaya çalışırsak güvenlik reddi (null) gelmeli
    const crossCheck = await getBookMemory(bookA.id, fingerprintB);
    assert.strictEqual(crossCheck, null, 'Uyuşmayan fingerprint eski veriyi ifşa etmemeli/karıştırmamalı');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Uygulama kapatılıp açıldığında OCR verileri korunmalı.
  // --------------------------------------------------------------------------
  await runTest('Test 4: Oturum kapanıp açıldığında (bellek sıfırlandığında) veriler kalıcı depodan geri yüklenmeli', async () => {
    const bookId = 'book_session_test';
    const pdfBytes = new Uint8Array([5, 10, 15, 20, 25, 30]);
    const fingerprint = await generatePdfFingerprint(pdfBytes, 5);

    const book = {
      id: bookId,
      title: 'Kalıcı Kitap',
      totalPages: 5,
      pdfFingerprint: fingerprint,
      pageParagraphs: {}
    };

    await loadOrInitializeBookMemory(book, pdfBytes);
    await savePageOcrMemory(bookId, 1, {
      paragraphs: ['Sayfa 1 kalıcı test metni.'],
      ocrStatus: 'completed'
    });
    await savePageOcrMemory(bookId, 2, {
      paragraphs: ['Sayfa 2 kalıcı test metni.'],
      ocrStatus: 'completed'
    });

    // Uygulama kapanışını simüle et: yeni bir nesne ile bellek boşken sorgula
    const reopenedBook = {
      id: bookId,
      title: 'Kalıcı Kitap',
      totalPages: 5,
      pageParagraphs: {} // Tamamen boş
    };

    const res = await loadOrInitializeBookMemory(reopenedBook, pdfBytes);
    assert.strictEqual(res.isPreloaded, true);
    assert.strictEqual(res.scannedCount, 2);
    assert.strictEqual(reopenedBook.pageParagraphs[1][0], 'Sayfa 1 kalıcı test metni.');
    assert.strictEqual(reopenedBook.pageParagraphs[2][0], 'Sayfa 2 kalıcı test metni.');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Daha önce oluşturulan bölüm dizini ve RAG indeksleri yeniden kullanılmalı.
  // --------------------------------------------------------------------------
  await runTest('Test 5: Daha önce oluşturulan bölüm dizini ve RAG indeksleri yeniden kullanılmalı', async () => {
    const bookId = 'book_rag_reuse_test';
    const pdfBytes = new Uint8Array([111, 222, 123, 45, 67]);
    const fingerprint = await generatePdfFingerprint(pdfBytes, 3);

    const memory = initBookMemory({
      bookId,
      pdfFingerprint: fingerprint,
      totalPages: 3
    });

    // Sayfa ekle
    await savePageOcrMemory(bookId, 1, {
      paragraphs: ['BÖLÜM 1: Giriş ve Başlangıç', 'Bu birinci bölümün ilk paragrafıdır.'],
      ocrStatus: 'completed'
    });
    await savePageOcrMemory(bookId, 2, {
      paragraphs: ['BÖLÜM 2: Gelişme Evresi', 'Bu ikinci bölümün gelişme paragrafıdır.'],
      ocrStatus: 'completed'
    });

    const pagesMap = {
      1: ['BÖLÜM 1: Giriş ve Başlangıç', 'Bu birinci bölümün ilk paragrafıdır.'],
      2: ['BÖLÜM 2: Gelişme Evresi', 'Bu ikinci bölümün gelişme paragrafıdır.']
    };

    // 1. RAG İndeksini ilk kez oluştur
    const index1 = getOrBuildBookRagIndex(memory, pagesMap);
    assert(Array.isArray(index1) && index1.length > 0, 'RAG indeksi üretilmeli');

    // 2. İkinci çağrıda aynı önbelleğe alınmış indeks dönmeli (re-build edilmeden)
    const index2 = getOrBuildBookRagIndex(memory, pagesMap);
    assert.strictEqual(index1, index2, 'RAG indeksi önbellekten doğrudan referansla dönmeli');

    // 3. Bölüm dizini de memory üzerinde saklanmalı
    assert(memory.chapterOutline && memory.chapterOutline.length > 0, 'Bölüm dizini otomatik oluşturulmalı');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Eski kitap verileri bozulmadan yeni OCR sonuçları eklenebilmeli &
  // Başarısız OCR denemesi başarılı sayfayı ASLA ezmemeli.
  // --------------------------------------------------------------------------
  await runTest('Test 6: Eski veriler bozulmadan yeni sayfalar eklenmeli ve başarısız denemeler başarılı sayfayı ezmemeli', async () => {
    const bookId = 'book_incremental_test';
    const pdfBytes = new Uint8Array([7, 14, 21, 28, 35]);
    const fingerprint = await generatePdfFingerprint(pdfBytes, 10);

    await loadOrInitializeBookMemory({ id: bookId, totalPages: 10, pdfFingerprint: fingerprint }, pdfBytes);

    // 1. Sayfa 1 ve 2 başarıyla taranır
    await savePageOcrMemory(bookId, 1, {
      paragraphs: ['Kritik önemli Sayfa 1 bilgisi.'],
      ocrStatus: 'completed'
    });
    await savePageOcrMemory(bookId, 2, {
      paragraphs: ['Sayfa 2 bilgisi.'],
      ocrStatus: 'completed'
    });

    // 2. Yeni sayfa 3 eklenir (sayfa 1 ve 2 bozulmamalı)
    await savePageOcrMemory(bookId, 3, {
      paragraphs: ['Sayfa 3 bilgisi.'],
      ocrStatus: 'completed'
    });

    let currentMem = await getBookMemory(bookId);
    assert.strictEqual(currentMem.scannedPages[1].paragraphs[0], 'Kritik önemli Sayfa 1 bilgisi.');
    assert.strictEqual(currentMem.scannedPages[2].paragraphs[0], 'Sayfa 2 bilgisi.');
    assert.strictEqual(currentMem.scannedPages[3].paragraphs[0], 'Sayfa 3 bilgisi.');

    // 3. KRİTİK GÜVENLİK TESTİ: Sayfa 1 için arka planda başarısız bir OCR denemesi gelirse,
    // önceden taranmış başarılı verinin üzerine 'failed' YAZILMAMALIDIR!
    await savePageOcrMemory(bookId, 1, {
      paragraphs: [],
      ocrStatus: 'failed',
      error: 'Geçici ağ veya LLM zaman aşımı'
    });

    currentMem = await getBookMemory(bookId);
    assert.strictEqual(currentMem.scannedPages[1].ocrStatus, 'completed', 'Başarılı sayfa başarısız deneme ile ezilmemeli');
    assert.strictEqual(currentMem.scannedPages[1].paragraphs[0], 'Kritik önemli Sayfa 1 bilgisi.', 'Paragraflar korunmalı');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Tarama tamamlanmadan uygulama kapanırsa tamamlanmış sayfalar korunmalı.
  // --------------------------------------------------------------------------
  await runTest('Test 7: Tarama yarıda kesilip uygulama kapandığında tamamlanan sayfalar eksiksiz korunmalı', async () => {
    const bookId = 'book_interrupted_scan';
    const pdfBytes = new Uint8Array([12, 24, 36, 48, 60]);
    const fingerprint = await generatePdfFingerprint(pdfBytes, 10);

    // 10 sayfalık kitap
    const book = { id: bookId, totalPages: 10, pdfFingerprint: fingerprint, pageParagraphs: {} };
    await loadOrInitializeBookMemory(book, pdfBytes);

    // Sayfa 1, 2, 3, 4 taranıyor, sonra aniden kapanıyor
    for (let p = 1; p <= 4; p++) {
      await savePageOcrMemory(bookId, p, {
        paragraphs: [`Yarıda kesilen kitap sayfa ${p}`],
        ocrStatus: 'completed'
      });
    }

    // Yeniden açılış simülasyonu
    const freshBook = { id: bookId, totalPages: 10, pdfFingerprint: fingerprint, pageParagraphs: {} };
    const reopen = await loadOrInitializeBookMemory(freshBook, pdfBytes);

    assert.strictEqual(reopen.scannedCount, 4, 'Tamamlanan 4 sayfa eksiksiz korunmalı');
    assert.strictEqual(reopen.missingCount, 6, 'Kalan 6 sayfa eksik olarak listelenmeli');
    assert.deepStrictEqual(reopen.missingPages, [5, 6, 7, 8, 9, 10], 'Eksik sayfalar 5..10 olmalı');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Hafıza silme ve temizleme işlemleri güvenli çalışmalı.
  // --------------------------------------------------------------------------
  await runTest('Test 8: Kitap hafızası silindiğinde (deleteBookMemory) kayıt temizlenmeli', async () => {
    const bookId = 'book_delete_test';
    const pdfBytes = new Uint8Array([8, 16, 32, 64]);
    const fingerprint = await generatePdfFingerprint(pdfBytes, 4);

    await loadOrInitializeBookMemory({ id: bookId, totalPages: 4, pdfFingerprint: fingerprint }, pdfBytes);
    await savePageOcrMemory(bookId, 1, { paragraphs: ['Silinecek metin'], ocrStatus: 'completed' });

    assert.notStrictEqual(await getBookMemory(bookId), null);

    const deleted = await deleteBookMemory(bookId);
    assert.strictEqual(deleted, true);

    const check = await getBookMemory(bookId);
    assert.strictEqual(check, null, 'Silinen kitabın hafızası boş olmalı');
  });

  console.log('\n======================================================');
  console.log(`Persistent Book Memory Test Sonucu: ${passedTests}/${totalTests} BAŞARILI`);
  console.log('======================================================\n');
}

runAllTests().catch((err) => {
  console.error('\nTest Koşusu Başarısız Oldu:', err);
  process.exit(1);
});
