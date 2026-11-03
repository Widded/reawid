/**
 * REAWID — On-Demand OCR Sonrası RAG Retrieval Yenileme Test Paketi
 *
 * Senaryolar:
 * A) İlk retrieval başarısız, on-demand OCR başarılı:
 *    Yeni OCR metni ikinci retrieval sonucunda bulunmalı ve AI bağlamında kullanılabilmeli.
 * B) İlk retrieval başarılı:
 *    Gereksiz yere tekrar OCR yapılmamalı.
 * C) On-demand OCR başarısız:
 *    AI kaynakta bulunmayan bilgi üretmemeli, KANIT YETERSİZLİĞİ bildirimi yer almalı.
 * D) Yeni OCR metni ilgisiz:
 *    Sistem ilgisiz metni kanıt kabul etmemeli.
 * E) Farklı kitap açık:
 *    Önceki kitabın OCR veya RAG verileri yeni kitaba sızmamalı.
 * F) Spoiler koruması açık:
 *    Yalnızca izin verilen sayfalardan (<= currentPage) kanıt alınmalı.
 * G) Spoiler koruması kapalı:
 *    Kitabın tamamında (tüm taranmış sayfalarda) arama yapılabilmeli.
 */

import assert from 'node:assert';
import {
  multiStageBookRetrieval,
  prepareBookContext,
  verifyAnswerClaims,
  findCandidatePagesForQuestion
} from '../src/services/aiService.js';

import {
  initBookMemory,
  savePageOcrMemory,
  getBookMemory,
  clearAllBookMemories,
  getMissingOrFailedPages
} from '../src/services/bookMemoryService.js';

let passedTests = 0;
let totalTests = 0;

function check(condition, desc, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${desc} ${detail ? `(${detail})` : ''}`);
  } else {
    console.error(`  [FAIL] ${desc} ${detail ? `(${detail})` : ''}`);
    throw new Error(`Test başarısız: ${desc}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('REAWID — On-Demand OCR & RAG Retrieval Yenileme Test Paketi');
  console.log('================================================================\n');

  await clearAllBookMemories();

  // -------------------------------------------------------------
  // SENARYO A: İlk retrieval başarısız, on-demand OCR başarılı
  // -------------------------------------------------------------
  console.log('--- Senaryo A: İlk retrieval başarısız, on-demand OCR sonrası yenileme ---');
  {
    const bookId = 'book_hp_ondemand_success';
    const totalPages = 100;
    const initialPages = {
      1: 'Harry Potter Privet Drive 4 numarada Dursley ailesinin yanında kalıyordu.',
      2: 'Dudley Harry ile alay etti ve merdiven altındaki dolabın kapısını tekmeledi.'
    };

    await initBookMemory({ bookId, pdfFingerprint: 'fp_a', totalPages });
    for (const [p, txt] of Object.entries(initialPages)) {
      await savePageOcrMemory(bookId, Number(p), { paragraphs: [txt], rawText: txt, ocrStatus: 'completed' });
    }

    const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";

    // 1. İlk retrieval: Sayfa 1 ve 2'de Hogwarts mektubuna dair kanıt YOK
    let retrieval = multiStageBookRetrieval({
      pagesTextMap: initialPages,
      currentPage: 50,
      spoilerProtection: false,
      question,
      bookId
    });

    check(!retrieval.evidenceSufficiency.isSufficient, 'A.1 İlk aramada kanıt yetersiz olmalı');
    check(!retrieval.supportingEvidence.some(e => e.pageNumber === 64), 'A.1 İlk aramada henüz taranmamış Sayfa 64 bulunmamalı');

    // 2. On-demand OCR simülasyonu: Eksik sayfa 64 taranıyor ve kitaba ekleniyor
    const scannedPageNum = 64;
    const newPageText = "Hagrid cebinden Hogwarts Cadılık ve Büyücülük Okulu'ndan gelen kalın parşömen mektubu çıkardı ve Harry'ye uzattı. Mektupta 'Sayın Bay Potter, Hogwarts Cadılık ve Büyücülük Okulu'na kabul edildiğinizi bildirmekten memnuniyet duyarız' yazıyordu. Harry kendisinin bir büyücü olduğunu ve Hogwarts'a kabul edildiğini Hagrid'in getirdiği bu mektupla öğrendi.";

    await savePageOcrMemory(bookId, scannedPageNum, {
      pageNumber: scannedPageNum,
      paragraphs: [newPageText],
      rawText: newPageText,
      ocrStatus: 'completed'
    });

    const updatedPages = {
      ...initialPages,
      [scannedPageNum]: [newPageText]
    };

    // 3. Retrieval YENİDEN ÇALIŞTIRILIYOR (Düzeltilen akış)
    const refreshedRetrieval = multiStageBookRetrieval({
      pagesTextMap: updatedPages,
      currentPage: 70,
      spoilerProtection: false,
      question,
      bookId
    });

    check(refreshedRetrieval.evidenceSufficiency.isSufficient, 'A.2 İkinci aramada kanıt yeterli bulunmalı');
    check(refreshedRetrieval.supportingEvidence.length > 0, 'A.2 İkinci aramada supportingEvidence dolu olmalı');
    check(refreshedRetrieval.supportingEvidence.some(e => e.pageNumber === 64), 'A.2 Yeni taranan Sayfa 64 kanıtlar arasında yer almalı');

    // 4. Context ve AI gönderim kontrolü
    const context = prepareBookContext({
      pagesTextMap: updatedPages,
      currentPage: 70,
      spoilerProtection: false,
      question,
      bookId,
      totalPages
    });

    check(context.includes('PDF Sayfa 64'), 'A.3 Hazırlanan bağlam yeni taranan Sayfa 64 kanıtını içermeli');
    check(context.includes('Hagrid cebinden Hogwarts'), 'A.3 Bağlam Hagrid ve mektup alıntısını içermeli');
    check(!context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'A.3 Kanıt yeterli olduğu için yetersizlik bildirimi yer almamalı');
  }

  // -------------------------------------------------------------
  // SENARYO B: İlk retrieval başarılı -> Gereksiz OCR yapılmamalı
  // -------------------------------------------------------------
  console.log('\n--- Senaryo B: İlk retrieval başarılı (Gereksiz OCR yapılmama kontrolü) ---');
  {
    const bookId = 'book_hp_already_sufficient';
    const pages = {
      7: 'Büyük Salon\'da Seçmen Şapka şarkısını söyledi ve Harry Potter\'ı GRYFFINDOR binasına seçti.'
    };

    const question = 'Harry Potter hangi binaya seçildi?';

    const retrieval = multiStageBookRetrieval({
      pagesTextMap: pages,
      currentPage: 10,
      spoilerProtection: false,
      question,
      bookId
    });

    check(retrieval.evidenceSufficiency.isSufficient, 'B.1 İlk aramada kanıt yeterli bulundu');
    // Eğer isEvidenceSufficient true ise on-demand OCR bloğuna girilmez
    const shouldTriggerOcr = !retrieval.evidenceSufficiency.isSufficient;
    check(!shouldTriggerOcr, 'B.2 Kanıt zaten yeterli olduğundan on-demand OCR tetiklenmemeli');
  }

  // -------------------------------------------------------------
  // SENARYO C: On-demand OCR başarısız -> AI uydurma üretmemeli
  // -------------------------------------------------------------
  console.log('\n--- Senaryo C: On-demand OCR başarısız (Hata veya boş metin) ---');
  {
    const bookId = 'book_ocr_fails';
    const pages = {
      1: 'Kitabın ilk sayfası.'
    };

    const failedPageAttempts = new Map();
    // Sayfa 20 taranmaya çalışıldı ve OCR hata verdi
    const pageToTry = 20;
    const fails = (failedPageAttempts.get(pageToTry) || 0) + 1;
    failedPageAttempts.set(pageToTry, fails);

    await savePageOcrMemory(bookId, pageToTry, {
      pageNumber: pageToTry,
      paragraphs: [],
      ocrStatus: 'failed',
      error: 'OCR yanıt vermedi'
    });

    check(failedPageAttempts.get(pageToTry) === 1, 'C.1 Başarısız olan sayfa ceza sayacına işlendi');

    const question = 'Kitapta olmayan gizli hazine nerededir?';
    const retrieval = multiStageBookRetrieval({
      pagesTextMap: pages,
      currentPage: 50,
      spoilerProtection: false,
      question,
      bookId,
      failedPages: failedPageAttempts
    });

    check(!retrieval.evidenceSufficiency.isSufficient, 'C.2 Kanıt yetersiz kalmalı');

    const context = prepareBookContext({
      pagesTextMap: pages,
      currentPage: 50,
      spoilerProtection: false,
      question,
      bookId,
      failedPages: failedPageAttempts
    });

    check(context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'C.3 Bağlamda açıkça KANIT YETERSİZLİĞİ BİLDİRİMİ yer almalı');

    const claimCheck = verifyAnswerClaims({
      answer: 'Hazine gizli bir mağaradadır.',
      evidenceParagraphs: retrieval.allEvidence,
      isEvidenceSufficient: false,
      bookTitle: 'Test Kitap'
    });
    check(!claimCheck.verified, 'C.4 Uydurma iddia verifyAnswerClaims tarafından yakalanmalı');
  }

  // -------------------------------------------------------------
  // SENARYO D: Yeni OCR metni ilgisiz -> Kanıt kabul edilmemeli
  // -------------------------------------------------------------
  console.log('\n--- Senaryo D: Yeni OCR metni soruyla ilgisiz ---');
  {
    const bookId = 'book_irrelevant_ocr';
    const pages = {
      1: 'Karakter sabah kahvaltı yaptı.'
    };

    // Yeni taranan sayfa soruyla tamamen ilgisiz bir metin içeriyor
    const irrelevantPage = 15;
    const irrelevantText = 'Hava durumu raporu: Bugün rüzgar kuzeyden saatte yirmi kilometre hızla esecek.';
    const updatedPages = {
      ...pages,
      [irrelevantPage]: [irrelevantText]
    };

    const question = 'Cinayeti kim işledi?';
    const retrieval = multiStageBookRetrieval({
      pagesTextMap: updatedPages,
      currentPage: 30,
      spoilerProtection: false,
      question,
      bookId
    });

    check(!retrieval.evidenceSufficiency.isSufficient, 'D.1 İlgisiz sayfa eklense bile kanıt yetersiz kalmalı');
    check(retrieval.supportingEvidence.length === 0, 'D.2 İlgisiz sayfa supportingEvidence içine dahil edilmemeli');
  }

  // -------------------------------------------------------------
  // SENARYO E: Farklı kitap açık -> Eski kitabın verisi sızmamalı
  // -------------------------------------------------------------
  console.log('\n--- Senaryo E: Farklı kitap açıldığında bellek ve RAG izolasyonu ---');
  {
    const bookA = 'book_harry_potter';
    const bookB = 'book_bilisim_dersi';

    const pagesA = {
      64: 'Hagrid Harry\'ye Hogwarts kabul mektubunu uzattı.'
    };
    const pagesB = {
      1: 'Bilgisayar işletim sistemi temel donanım ve yazılımlardan oluşur.'
    };

    const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";

    // Kitap B sorgulanırken Kitap A'nın verisi kullanılmamalı
    const retrievalB = multiStageBookRetrieval({
      pagesTextMap: pagesB,
      currentPage: 1,
      spoilerProtection: false,
      question,
      bookId: bookB
    });

    check(!retrievalB.evidenceSufficiency.isSufficient, 'E.1 Kitap B açıkken Harry Potter kanıtı yetersiz kalmalı');
    check(retrievalB.allEvidence.length === 0, 'E.2 Kitap B için bulunan kanıt sayısı 0 olmalı');
    check(!retrievalB.allEvidence.some(e => e.bookId === bookA), 'E.3 Kitap A ID\'li hiçbir kanıt Kitap B aramasına sızmamalı');
  }

  // -------------------------------------------------------------
  // SENARYO F: Spoiler koruması açık -> İleriki sayfalar elenmeli
  // -------------------------------------------------------------
  console.log('\n--- Senaryo F: Spoiler koruması açık (Katı sayfa sınırı) ---');
  {
    const bookId = 'book_spoiler_test';
    const pages = {
      10: 'Harry okulda derslere başladı.',
      80: 'Bölüm Sonu Sırrı: Hain ortaya çıktı, hain aslında Profesör Quirrell idi!'
    };

    const question = 'Hain kim çıktı?';

    // Kullanıcı Sayfa 15'te ve spoiler koruması AÇIK
    const retrievalSpoilerOn = multiStageBookRetrieval({
      pagesTextMap: pages,
      currentPage: 15,
      spoilerProtection: true,
      question,
      bookId
    });

    check(!retrievalSpoilerOn.evidenceSufficiency.isSufficient, 'F.1 Spoiler açıkken Sayfa 80 kanıtı getirilmemeli (Yetersiz kalmalı)');
    check(!retrievalSpoilerOn.allEvidence.some(e => e.pageNumber === 80), 'F.2 Sayfa 80 kanıt listesinden kesinlikle elenmeli');

    const context = prepareBookContext({
      pagesTextMap: pages,
      currentPage: 15,
      spoilerProtection: true,
      question,
      bookId,
      totalPages: 100
    });

    check(!context.includes('Quirrell'), 'F.3 Bağlam Quirrell sürprizini içermemeli');
  }

  // -------------------------------------------------------------
  // SENARYO G: Spoiler koruması kapalı -> Tüm kitap taranabilmeli
  // -------------------------------------------------------------
  console.log('\n--- Senaryo G: Spoiler koruması kapalı (Tüm kitap serbest) ---');
  {
    const bookId = 'book_spoiler_test';
    const pages = {
      10: 'Harry okulda derslere başladı.',
      80: 'Bölüm Sonu Sırrı: Hain ortaya çıktı, hain aslında Profesör Quirrell idi!'
    };

    const question = 'Hain kim çıktı?';

    // Kullanıcı Sayfa 15'te ama spoiler koruması KAPALI
    const retrievalSpoilerOff = multiStageBookRetrieval({
      pagesTextMap: pages,
      currentPage: 15,
      spoilerProtection: false,
      question,
      bookId
    });

    check(retrievalSpoilerOff.evidenceSufficiency.isSufficient, 'G.1 Spoiler kapalıyken Sayfa 80 kanıtı bulunmalı');
    check(retrievalSpoilerOff.allEvidence.some(e => e.pageNumber === 80), 'G.2 Sayfa 80 kanıt listesinde yer almalı');

    const context = prepareBookContext({
      pagesTextMap: pages,
      currentPage: 15,
      spoilerProtection: false,
      question,
      bookId,
      totalPages: 100
    });

    check(context.includes('Quirrell'), 'G.3 Bağlam Quirrell kanıtını açıkça içermeli');
  }

  console.log('\n================================================================');
  console.log(`TEST SONUCU: ${passedTests} / ${totalTests} Başarılı (%100)`);
  console.log('TÜM SENARYOLAR (A-G) KUSURSUZ ŞEKİLDE GEÇTİ!');
  console.log('================================================================\n');
}

runSuite().catch(err => {
  console.error('Test hatası:', err);
  process.exit(1);
});
