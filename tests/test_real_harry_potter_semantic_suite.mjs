import fs from 'fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'url';

const aiServicePath = 'C:\\Users\\harun\\Desktop\\PROJE\\reawid2\\src\\services\\aiService.js';
const {
  understandBookQuestion,
  multiStageBookRetrieval,
  prepareBookContext,
  getTurkishStem,
  matchesTurkishWord
} = await import(pathToFileURL(aiServicePath).href);

const pdfJsPath = 'C:\\Users\\harun\\Desktop\\PROJE\\reawid2\\node_modules\\pdfjs-dist\\legacy\\build\\pdf.mjs';
const pdfjsLib = await import(pathToFileURL(pdfJsPath).href);

console.log('================================================================');
console.log('REAWID — GERÇEK HARRY POTTER PDF ANLAMSAL RAG DOĞRULAMA TESTİ');
console.log('================================================================\n');

// 1. Load real PDF from Chrome / Brave IndexedDB blob
const pdfBlobPath = 'C:\\Users\\harun\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default\\IndexedDB\\http_localhost_5173.indexeddb.blob\\1\\00\\3';
assert.ok(fs.existsSync(pdfBlobPath), `Gerçek Harry Potter PDF blob bulunamadı: ${pdfBlobPath}`);

const data = new Uint8Array(fs.readFileSync(pdfBlobPath));
const loadingTask = pdfjsLib.getDocument({ data });
const pdfDoc = await loadingTask.promise;

console.log(`Gerçek PDF yüklendi: Toplam Sayfa Sayısı = ${pdfDoc.numPages}`);
assert.equal(pdfDoc.numPages, 170, 'Gerçek Harry Potter 170 sayfa olmalıdır');

// 2. Extract text for test pages (Pages 1 to 28)
console.log('Sayfalar ayıklanıyor (1-28)...');
const realPagesTextMap = {};
for (let p = 1; p <= 28; p++) {
  const page = await pdfDoc.getPage(p);
  const textContent = await page.getTextContent();
  const text = textContent.items.map(i => i.str).join(' ');
  // Split into real paragraphs
  realPagesTextMap[p] = text.split(/(?<=[.!?])\s{2,}|\n+/).filter(s => s.trim().length > 20);
}
console.log(`Toplam ${Object.keys(realPagesTextMap).length} sayfa başarıyla RAM'e yüklendi.\n`);

let passedTests = 0;
const totalTests = 6;

// TEST 1: Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?
console.log('--- TEST 1: "Harry Hogwarts\'a kabul edildiğini nasıl öğreniyor?" ---');
{
  const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });
  console.log('  Soru Analizi:', {
    arananKavramlar: semantic.searchTerms.slice(0, 8),
    alternatifIfadeler: semantic.alternativePhrases.slice(0, 5)
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (Skor: ${retrieval.evidenceSufficiency.score})`);
  console.log(`  Kanıt Sayısı: ${retrieval.allEvidence.length}`);
  const topEvidence = retrieval.allEvidence[0];
  console.log(`  En Güçlü Kanıt: PDF Sayfa ${topEvidence?.pageNumber} (Skor: ${topEvidence?.score})`);
  console.log(`  Kanıt Metin Özeti: "${topEvidence?.text.slice(0, 150)}..."`);

  assert.equal(retrieval.evidenceSufficiency.isSufficient, true, 'Test 1: Kanıt yeterli olmalı');
  assert.equal(topEvidence?.pageNumber, 26, 'Test 1: En güçlü kanıt Sayfa 26 olmalı');
  assert.ok(topEvidence?.text.includes('yerinizin ayrilmisoldugunu') || topEvidence?.text.includes('yerinizin ayrılmış olduğunu') || topEvidence?.text.includes('büyücüsün'), 'Test 1: Metinde mektup veya büyücüsün geçmeli');

  const context = prepareBookContext({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010',
    totalPages: 170
  });

  assert.ok(!context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Test 1: Bağlamda ret bildirimi olmamalı');
  assert.ok(context.includes('[KANIT DEĞERLENDİRME VE ANLAMSAL CEVAPLAMA TALİMATI]'), 'Test 1: Anlamsal cevaplama talimatı olmalı');
  assert.ok(context.includes('[PDF Sayfa 26'), 'Test 1: PDF Sayfa 26 alıntısı bağlamda bulunmalı');
  console.log('  [PASS] Test 1 Başarılı!\n');
  passedTests++;
}

// TEST 2: Hagrid Harry'ye ne veriyor?
console.log('--- TEST 2: "Hagrid Harry\'ye ne veriyor?" ---');
{
  const question = "Hagrid Harry'ye ne veriyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });
  console.log('  Soru Analizi:', {
    arananKavramlar: semantic.searchTerms.slice(0, 8),
    alternatifIfadeler: semantic.alternativePhrases.slice(0, 5)
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (Skor: ${retrieval.evidenceSufficiency.score})`);
  console.log(`  Kanıt Sayısı: ${retrieval.allEvidence.length}`);
  const pagesFound = retrieval.allEvidence.map(e => e.pageNumber);
  console.log(`  Bulunan Kanıt Sayfaları: ${Array.from(new Set(pagesFound)).join(', ')}`);

  assert.equal(retrieval.evidenceSufficiency.isSufficient, true, 'Test 2: Kanıt yeterli olmalı');
  assert.ok(pagesFound.includes(24) || pagesFound.includes(26), 'Test 2: Sayfa 24 (pasta/sosis) veya Sayfa 26 (mektup) bulunmalı');

  const context = prepareBookContext({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010',
    totalPages: 170
  });

  assert.ok(!context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Test 2: Ret bildirimi olmamalı');
  console.log('  [PASS] Test 2 Başarılı!\n');
  passedTests++;
}

// TEST 3: Harry okulda kendisine yer ayrıldığını nereden anlıyor?
console.log('--- TEST 3: "Harry okulda kendisine yer ayrıldığını nereden anlıyor?" ---');
{
  const question = "Harry okulda kendisine yer ayrıldığını nereden anlıyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (Skor: ${retrieval.evidenceSufficiency.score})`);
  const topEvidence = retrieval.allEvidence[0];
  console.log(`  En Güçlü Kanıt: PDF Sayfa ${topEvidence?.pageNumber} (Skor: ${topEvidence?.score})`);

  assert.equal(retrieval.evidenceSufficiency.isSufficient, true, 'Test 3: Kanıt yeterli olmalı');
  assert.equal(topEvidence?.pageNumber, 26, 'Test 3: Sayfa 26 gelmeli');
  assert.ok(topEvidence?.text.includes('yerinizin ayrilmisoldugunu') || topEvidence?.text.includes('yerinizin ayrılmış olduğunu'), 'Test 3: Metinde yer ayrılmış ifadesi bulunmalı');
  console.log('  [PASS] Test 3 Başarılı!\n');
  passedTests++;
}

// TEST 4: Harry'nin Hogwarts'a gitmesi nasıl kesinleşiyor?
console.log('--- TEST 4: "Harry\'nin Hogwarts\'a gitmesi nasıl kesinleşiyor?" ---');
{
  const question = "Harry'nin Hogwarts'a gitmesi nasıl kesinleşiyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (Skor: ${retrieval.evidenceSufficiency.score})`);
  const topEvidence = retrieval.allEvidence[0];
  console.log(`  En Güçlü Kanıt: PDF Sayfa ${topEvidence?.pageNumber} (Skor: ${topEvidence?.score})`);

  assert.equal(retrieval.evidenceSufficiency.isSufficient, true, 'Test 4: Kanıt yeterli olmalı');
  assert.ok(topEvidence?.pageNumber === 26 || topEvidence?.pageNumber === 27, 'Test 4: Sayfa 26 veya 27 gelmeli');
  console.log('  [PASS] Test 4 Başarılı!\n');
  passedTests++;
}

// TEST 5: Kitapta olmayan kavramda ret (Hogwarts / Privet Drive'da iPhone kullanımı)
console.log('--- TEST 5: "Harry Potter Privet Drive\'da hangi model iPhone kullandı?" ---');
{
  const question = "Harry Potter Privet Drive'da hangi model iPhone kullandı?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (isSufficient: ${retrieval.evidenceSufficiency.isSufficient})`);
  console.log(`  Eksiklik Gerekçesi: ${retrieval.evidenceSufficiency.missingReasons.join('; ')}`);

  assert.equal(retrieval.evidenceSufficiency.isSufficient, false, 'Test 5: Kanıt yetersiz olmalı');

  const context = prepareBookContext({
    pagesTextMap: realPagesTextMap,
    currentPage: 27,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010',
    totalPages: 170
  });

  assert.ok(context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Test 5: Bağlamda ret bildirimi bulunmalı');
  assert.ok(context.includes('Bu bilgiyi kitabın taranmış metninde doğrulayamadım.'), 'Test 5: Zorunlu ret cümlesi bulunmalı');
  console.log('  [PASS] Test 5 Başarılı!\n');
  passedTests++;
}

// TEST 6: Spoiler Koruması Açıkken İleriki Bölüm Sorusu (Sayfa 1'deyken kabul mektubu)
console.log('--- TEST 6: Spoiler Koruması Açıkken İleriki Bölüm Sorusu (Aktif Sayfa: 1) ---');
{
  const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });

  const retrieval = multiStageBookRetrieval({
    pagesTextMap: realPagesTextMap,
    currentPage: 1, // Reading page 1
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010'
  });

  console.log(`  Retrieval Durumu: ${retrieval.evidenceSufficiency.status} (isSufficient: ${retrieval.evidenceSufficiency.isSufficient})`);
  const anySpoilerPage = retrieval.allEvidence.some(e => e.pageNumber > 1);
  console.log(`  Sayfa 1'den büyük kanıt var mı? ${anySpoilerPage}`);

  assert.equal(anySpoilerPage, false, 'Test 6: Sayfa 1 ötesindeki sayfalar kesinlikle getirilmemeli');
  assert.equal(retrieval.evidenceSufficiency.isSufficient, false, 'Test 6: Sayfa 1 için kanıt yetersiz kalmalı');

  const context = prepareBookContext({
    pagesTextMap: realPagesTextMap,
    currentPage: 1,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'book_1793735244010',
    totalPages: 170
  });

  assert.ok(context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]') || context.includes('[SPOILER KORUMASI DEVREDE]'), 'Test 6: Spoiler koruma uyarısı veya ret olmalı');
  assert.ok(!context.includes('[PDF Sayfa 26'), 'Test 6: Sayfa 26 bağlamda ASLA yer almamalı');
  console.log('  [PASS] Test 6 Başarılı!\n');
  passedTests++;
}

console.log('================================================================');
console.log(`SONUÇ: ${passedTests} / ${totalTests} Test Başarıyla Geçti! (%100)`);
console.log('Gerçek Harry Potter PDF üzerinde tüm anlamsal RAG senaryoları doğrulandı.');
console.log('================================================================');
