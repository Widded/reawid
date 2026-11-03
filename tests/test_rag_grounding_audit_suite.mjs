// tests/test_rag_grounding_audit_suite.mjs
// REAWID — Kitap İçeriği Anlama ve RAG Doğruluk Denetimi Test Paketi
// Tests 3 different book scenarios across all 5 verification dimensions:
// 1. Event chapter location
// 2. Character behavior
// 3. PDF page vs Printed book page distinction & offset
// 4. Non-existent event refusal ("Bu bilgiyi kitabın taranmış metninde doğrulayamadım.")
// 5. Re-verification challenge (chat history hallucination resistance)

import assert from 'node:assert';
import {
  buildParagraphMetadataIndex,
  multiStageBookRetrieval,
  findCandidatePagesForQuestion,
  prepareBookContext,
  detectPrintedPageNumber,
  verifyAnswerClaims,
  recordRetrievalAudit,
  getRetrievalAuditTrail,
  clearRetrievalAuditTrail
} from '../src/services/aiService.js';

import {
  initBookMemory,
  savePageOcrMemory,
  getBookPageOffset,
  clearAllBookMemories
} from '../src/services/bookMemoryService.js';

let passed = 0;
let failed = 0;

function check(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message} ${details ? `(${details})` : ''}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message} ${details ? `(${details})` : ''}`);
    throw new Error(`Test Failed: ${message} - ${details}`);
  }
}

async function runGroundingSuite() {
  console.log('================================================================');
  console.log('ReaWid — Kitap İçeriği Anlama ve RAG Doğruluk Denetim Test Paketi');
  console.log('================================================================\n');

  await clearAllBookMemories();
  clearRetrievalAuditTrail();

  // ===========================================================================
  // TEST KİTAP 1: Kısa ve Metin Tabanlı PDF (Offset = 0)
  // Tolstoy - İnsan Ne İle Yaşar (15 Sayfa)
  // ===========================================================================
  console.log('--- KİTAP 1: Kısa ve Metin Tabanlı PDF (İnsan Ne İle Yaşar) ---');
  {
    const bookId = 'book_tolstoy_text';
    const bookPages = {
      1: 'BÖLÜM 1\n\nKunduracı Semiyon köyde karısıyla bir evde yaşardı. Bir kürk almak için kasabaya gitti ama yeterli para toplayamadı.',
      2: 'Kasabadan dönerken ayaz çıktı. Semiyon yol kenarındaki şapelin önünde çıplak ve hareketsiz yatan bir adam gördü.',
      3: 'Semiyon önce korktu ve geçip gitmek istedi. Sonra vicdanı elvermedi, geri döndü ve kendi kaftanını çıkarıp adama giydirdi.',
      4: 'Eve vardıklarında karısı Matrena önce çok kızdı. Son ekmeği yabancı birine vermekten yakındı. Ancak adamın çaresiz yüzünü görünce yumuşadı ve sofrayı kurdu.',
      5: 'BÖLÜM 2\n\nYabancı adam adının Mihail olduğunu söyledi ve kunduracının yanında çırak olarak çalışmaya başladı.'
    };

    await initBookMemory({ bookId, pdfFingerprint: 'fp_tolstoy', totalPages: 5 });
    for (const [p, txt] of Object.entries(bookPages)) {
      await savePageOcrMemory(bookId, Number(p), { paragraphs: [txt], rawText: txt });
    }

    // 1.1 Belirli bir olayın hangi bölümde geçtiğini sor
    const ret1 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 5,
      spoilerProtection: false,
      question: 'Semiyon çıplak adamı nerede ve hangi bölümde buldu?'
    });
    check(ret1.evidenceSufficiency.isSufficient, '1.1 Olay için kanıt yeterli bulundu');
    check(ret1.supportingEvidence.some(e => e.pageNumber === 2 && e.text.includes('şapelin önünde')), '1.1 Şapelin önü ve sayfa 2 kanıt olarak bulundu');

    // 1.2 Belirli bir karakterin davranışını sor
    const ret2 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 5,
      spoilerProtection: false,
      question: 'Matrena yabancı adamı görünce ilk başta nasıl davrandı?'
    });
    check(ret2.supportingEvidence.some(e => e.pageNumber === 4 && e.text.includes('çok kızdı')), '1.2 Matrena\'nın ilk tepkisi sayfa 4\'te tespit edildi');

    // 1.3 PDF sayfa numarasını doğrula
    const context1 = prepareBookContext({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 5,
      spoilerProtection: false,
      question: 'Semiyon kaftanını nerede verdi?'
    });
    check(context1.includes('PDF Sayfa 3'), '1.3 PDF Sayfa 3 doğru künye ile bağlama eklendi');

    // 1.4 Kitapta bulunmayan bir olayı sor (Refusal Enforcement)
    const ret4 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 5,
      spoilerProtection: false,
      question: 'Semiyon uzay mekiğiyle Mars gezegenine gitti mi?'
    });
    check(!ret4.evidenceSufficiency.isSufficient, '1.4 Kitapta olmayan olayda isSufficient false olmalı');
    const verify4 = verifyAnswerClaims({
      answer: 'Semiyon Mars gezegenine yolculuk yapmıştır.',
      evidenceParagraphs: ret4.allEvidence,
      isEvidenceSufficient: ret4.evidenceSufficiency.isSufficient
    });
    check(!verify4.isVerified, '1.4 Kaynakta olmayan iddia unverified olarak yakalandı');
    check(verify4.unverifiedClaims.some(c => c.includes('uydurma') || c.includes('Mars') || c.includes('kavram')), '1.4 Uydurma iddia bayrağı eklendi');

    // 1.5 Yeniden doğrulama isteği (Chat history yanıltmasını reddetme)
    const answerWithFakePage = 'Bu olay Sayfa 99 üzerinde anlatılmaktadır.';
    const verify5 = verifyAnswerClaims({
      answer: answerWithFakePage,
      evidenceParagraphs: ret1.supportingEvidence,
      isEvidenceSufficient: true
    });
    check(verify5.unverifiedClaims.some(c => c.includes('Sayfa 99')), '1.5 Kaynakta olmayan Sayfa 99 iddiası yakalandı');
  }

  // ===========================================================================
  // TEST KİTAP 2: OCR Gerektiren Taranmış PDF (Gürültülü Metin & Başlıklar)
  // Dostoyevski - Suç ve Ceza (Taranmış Sayfalar)
  // ===========================================================================
  console.log('\n--- KİTAP 2: OCR Gerektiren Taranmış PDF (Suç ve Ceza) ---');
  {
    const bookId = 'book_dostoyevsky_ocr';
    const bookPages = {
      10: 'BÖLÜM 2\n\nMeyhanede Raskolnikov ile konuşan Marmeladov kızı Sonya\'dan bahsetti.\n-- 10 --',
      11: 'Marmeladov ağlayarak kızının sarı bilet almak zorunda kaldığını anlattı.\n-- 11 --',
      22: 'BÖLÜM 4\n\nRaskolnikov kapıyı çaldı. Alyona İvanovna rehin olarak bir saat aldı.\n-- 22 --',
      23: 'Raskolnikov paltosunun içine diktiği baltayı çıkararak kadının başına vurdu.\n-- 23 --'
    };

    await initBookMemory({ bookId, pdfFingerprint: 'fp_crime_ocr', totalPages: 50 });
    for (const [p, txt] of Object.entries(bookPages)) {
      await savePageOcrMemory(bookId, Number(p), { paragraphs: [txt], rawText: txt });
    }

    // 2.1 Belirli bir olayın hangi bölümde geçtiği
    const ret1 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 50,
      spoilerProtection: false,
      question: 'Raskolnikov tefeci kadını hangi bölümde baltayla vurdu?'
    });
    check(ret1.supportingEvidence.some(e => e.pageNumber === 23 && e.text.includes('baltayı çıkararak')), '2.1 Cinayet sahnesi Sayfa 23 Bölüm 4 olarak bulundu');

    // 2.2 Karakter davranışı (Marmeladov ve sarı bilet)
    const ret2 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 50,
      spoilerProtection: false,
      question: 'Marmeladov meyhanede kızı Sonya hakkında ne anlattı?'
    });
    check(ret2.supportingEvidence.some(e => e.pageNumber === 11 && e.text.includes('sarı bilet')), '2.2 Marmeladov anlatısı Sayfa 11\'de bulundu');

    // 2.3 Sayfa numarası doğrulaması
    const detectedP = detectPrintedPageNumber(bookPages[23]);
    check(detectedP === 23, '2.3 OCR metninden basılı sayfa numarası (23) tespit edildi');

    // 2.4 Kitapta bulunmayan olay
    const ret4 = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 50,
      spoilerProtection: false,
      question: 'Raskolnikov çaldığı paralarla lüks Ferrari spor araba aldı mı?'
    });
    check(!ret4.evidenceSufficiency.isSufficient, '2.4 Ferrari iddiasında kanıt yetersiz bulundu');

    // 2.5 Önceki cevabın yanlış olduğunu belirten sorgu doğrulaması
    const checkCorrection = verifyAnswerClaims({
      answer: 'Cinayet Sayfa 75 üzerinde gerçekleşmiştir.',
      evidenceParagraphs: ret1.supportingEvidence,
      isEvidenceSufficient: true
    });
    check(checkCorrection.unverifiedClaims.some(c => c.includes('Sayfa 75')), '2.5 Yanlış iddia edilen Sayfa 75 reddedildi');
  }

  // ===========================================================================
  // TEST KİTAP 3: Sayfa Numaraları ile PDF Sayfa Numaraları Farklı Olan Kitap (OFFSET)
  // Harry Potter ve Felsefe Taşı (PDF Sayfa 61 == Basılı Kitap Sayfası 45!)
  // ===========================================================================
  console.log('\n--- KİTAP 3: Basılı Sayfa vs PDF Sayfası Offset Problemi (Harry Potter) ---');
  {
    const bookId = 'book_harry_potter_offset';

    // PDF Sayfası 1..16: Kapak, telif, ithaf, içindekiler
    // PDF Sayfa 61: Basılı Sayfa 45 (Bölüm 3 Mektuplar Sahnesi)
    const bookPages = {
      5: 'İÇİNDEKİLER\nBölüm 1 Yaşayan Çocuk ...... 7\nBölüm 2 Yok Olan Cam ...... 21\nBölüm 3 Kimseden Mektup Yok ...... 35\nBölüm 4 Anahtarların Bekçisi ...... 47',
      35: 'BÖLÜM 2\nYOK OLAN CAM\nHarry hayvanat bahçesinde camın yok olduğunu fark etti.\n19', // PDF 35 = Basılı 19
      60: 'BÖLÜM 3\nKİMSEDEN MEKTUP YOK\nBay Dursley kapının altından atılan mektupları yaktı.\n44', // PDF 60 = Basılı 44
      61: 'Pazar günü şömineden yüzlerce mektup fışkırmaya başladı. Bay Dursley aileyi toplayıp evden kaçırdı.\n45', // PDF 61 = Basılı 45
      62: 'Denizin ortasındaki kayalık kulübeye vardılar. Fırtına kulübeyi sarsıyordu.\n46' // PDF 62 = Basılı 46
    };

    // 3.1 Basılı sayfa numarasını tespit et
    const printedOn61 = detectPrintedPageNumber(bookPages[61]);
    check(printedOn61 === 45, '3.1 PDF Sayfa 61 üzerindeki basılı sayfa numarası (45) doğru okundu', `Okunan: ${printedOn61}`);

    // Hafızaya kaydet
    await initBookMemory({ bookId, pdfFingerprint: 'fp_hp_offset', totalPages: 100 });
    for (const [p, txt] of Object.entries(bookPages)) {
      await savePageOcrMemory(bookId, Number(p), { paragraphs: [txt], rawText: txt });
    }

    // 3.2 Consensus Offset Hesaplaması (61 - 45 = 16)
    const detectedOffset = getBookPageOffset(bookId);
    check(detectedOffset === 16, '3.2 Kitabın PDF-Basılı sayfa farkı (offset = 16) başarıyla hesaplandı', `Offset: ${detectedOffset}`);

    // 3.3 İndeksleme ve Provenance Takibi
    const indexed = buildParagraphMetadataIndex({ pagesTextMap: bookPages, bookId });
    const paraOn61 = indexed.find(p => p.pdfPage === 61 && p.text.includes('şömineden'));
    check(paraOn61 && paraOn61.pdfPage === 61 && paraOn61.printedPage === 45, '3.3 Paragraf metadata hem PDF Sayfa (61) hem Basılı Sayfa (45) bilgisini taşıyor');

    // 3.4 Soru: "Filmdeki eve mektupların geldiği sahne kitapta var mı?"
    const ret = multiStageBookRetrieval({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 70,
      spoilerProtection: false,
      question: 'Filmdeki eve mektupların geldiği sahne kitapta var mı?'
    });
    check(ret.evidenceSufficiency.isSufficient, '3.4 Mektuplar sahnesi için yeterli kanıt bulundu');
    check(ret.supportingEvidence.some(e => e.pdfPage === 61), '3.4 Doğru fiziksel sayfa (PDF Sayfa 61) kanıt olarak getirildi');

    // 3.5 Context Oluşturma ve Sayfa Ayrımı
    const context = prepareBookContext({
      pagesTextMap: bookPages,
      bookId,
      currentPage: 70,
      spoilerProtection: false,
      question: 'Filmdeki eve mektupların geldiği sahne kitapta var mı?'
    });
    check(context.includes('PDF Sayfa 61 (Basılı Kitap Sayfası: 45)'), '3.5 Context içinde "PDF Sayfa 61 (Basılı Kitap Sayfası: 45)" ayrımı açıkça gösterildi');

    // 3.6 findCandidatePagesForQuestion ile Offset Destekli Arama
    const mockPdfDoc = {
      numPages: 100,
      async getPage(num) {
        return {
          async getTextContent() {
            if (num === 61) return { items: [{ str: 'şömineden yüzlerce mektup fışkırdı' }] };
            return { items: [{ str: `Sayfa ${num}` }] };
          }
        };
      }
    };

    const outline = bookPages[5];
    const missing = Array.from({ length: 100 }, (_, i) => i + 1).filter(p => !bookPages[p]);
    missing.push(61); // 61 henüz taranmamış farz edelim

    const candidates = await findCandidatePagesForQuestion({
      pdfDoc: mockPdfDoc,
      question: 'Eve mektupların geldiği sahne hangi sayfada?',
      missingPages: missing,
      chapterOutline: outline,
      pageOffset: detectedOffset, // 16 offset verildiğinde
      maxPages: 5
    });

    // 35 + 16 = 51 ile 61 arasındaki aralık taranmalı
    check(candidates.includes(61) || candidates.some(p => p >= 51 && p <= 61), '3.6 Offset farkı sayesinde 35 yerine gerçek PDF aralığı (51-61) hedeflendi', `Adaylar: ${candidates.join(', ')}`);

    // 3.7 İddia Doğrulama: Modelin uydurma "Sayfa 40-46" iddiasının yakalanması
    const hallucinatedAnswer = 'Eve mektupların geldiği sahne 40-46. sayfalarda ve PDF sayfası 44-45 üzerindedir.';
    const verification = verifyAnswerClaims({
      answer: hallucinatedAnswer,
      evidenceParagraphs: ret.supportingEvidence,
      isEvidenceSufficient: true
    });
    check(verification.unverifiedClaims.length > 0, '3.7 Uydurulan "Sayfa 40" veya "Sayfa 44" iddiası kaynakta doğrulanmayan sayfa olarak yakalandı', `Yakalananlar: ${verification.unverifiedClaims.join(', ')}`);

    // 3.8 Telemetry Kayıt ve Görünürlük Kontrolü
    recordRetrievalAudit({
      originalQuestion: 'Filmdeki eve mektupların geldiği sahne kitapta var mı?',
      retrievalQuery: 'Filmdeki eve mektupların geldiği sahne kitapta var mı?',
      pdfPages: [61],
      printedPages: [45],
      scores: [{ page: 61, score: 95 }],
      evidenceTexts: ['şömineden yüzlerce mektup fışkırmaya başladı'],
      contextSentToAi: context,
      aiPageReferences: ['PDF Sayfa 61', 'Basılı Sayfa 45'],
      contextIntegrityVerified: true,
      sufficiencyStatus: 'sufficient'
    });

    const audits = getRetrievalAuditTrail();
    check(audits.length > 0, '3.8 Telemetry kayıtları başarıyla tutuldu');
    const lastAudit = audits[audits.length - 1];
    check(lastAudit.pdfPages.includes(61) && lastAudit.printedPages.includes(45), '3.8 Telemetry verisinde PDF 61 ve Basılı 45 ayrımı korundu');
  }

  console.log('\n================================================================');
  console.log(`Sonuç: ${passed} Başarılı, ${failed} Hatalı (Toplam: ${passed + failed})`);
  console.log('================================================================');
}

runGroundingSuite().catch(err => {
  console.error('\nTest suite genel hata ile sonlandı:', err);
  process.exit(1);
});
