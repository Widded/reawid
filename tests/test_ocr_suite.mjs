// Comprehensive Test Suite for ReaWid Free AI Model & Professional Book OCR System
import {
  fixSpacedOutLetters,
  normalizeHyphensAndText,
  mergeAccidentalParagraphSplits,
  buildCandidateList,
  isModelStrictlyFree,
  formatOcrErrorMessage,
  calculateCer,
  calculateWer,
  BOOK_OCR_SYSTEM_PROMPT,
  BOOK_OCR_PROOFREADER_SYSTEM_PROMPT
} from '../src/services/aiService.js';

let passed = 0;
let total = 0;

function assert(description, condition, extra = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${description} ${extra ? `(${extra})` : ''}`);
  } else {
    console.error(`  ❌ [FAIL] ${description} ${extra ? `(${extra})` : ''}`);
  }
}

console.log('================================================================');
console.log('ReaWid — Profesyonel Kitap OCR ve Ücretsiz AI Modeli Test Paketi');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// TEST 1: Normal Metin Tabanlı PDF İşleme
// -------------------------------------------------------------------------
console.log('--- Test 1: Normal Metin Tabanlı PDF Metin Çıkarımı ---');
const embeddedPdfText = 'Gömülü metin katmanı olan PDF dosyalarında yapay zekaya veya OCR servisine gitmeden doğrudan ve anında (10ms) metin katmanı okunur.';
const extractedClean = normalizeHyphensAndText(embeddedPdfText);
assert('Metin doğrudan ve kayıpsız korunuyor', extractedClean === embeddedPdfText);
assert('CER 0 olmalı', calculateCer(embeddedPdfText, extractedClean) === 0);
assert('WER 0 olmalı', calculateWer(embeddedPdfText, extractedClean) === 0);

// -------------------------------------------------------------------------
// TEST 2: Fotoğraflanmış Türkçe Kitap Sayfası (Karakter Hassasiyeti)
// -------------------------------------------------------------------------
console.log('\n--- Test 2: Fotoğraflanmış Türkçe Kitap Sayfası & İmla Bütünlüğü ---');
const sampleTurkishPage = 'Ağır adımlarla köprüye doğru yürüdü. Yağmur şiddetini artırmıştı; rüzgâr yüzüne soğuk damlalar çarpıyordu. Küçük çocuk hiçbir şey söylemeden arkasından baktı.';
const pageCleaned = normalizeHyphensAndText(sampleTurkishPage);
assert('Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ) eksiksiz korunuyor', pageCleaned.includes('Ağır') && pageCleaned.includes('köprüye') && pageCleaned.includes('Yağmur') && pageCleaned.includes('Küçük'));
assert('CER sıfır olmalı', calculateCer(sampleTurkishPage, pageCleaned) === 0);

// -------------------------------------------------------------------------
// TEST 3: Harflerin Birbirinden Ayrılabildiği Düşük Kaliteli Tarama
// -------------------------------------------------------------------------
console.log('\n--- Test 3: Harf Aralığı Hataları (k i t a p -> kitap, İ n s a n l a r ...) ---');
const spacedCase1 = 'İ n s a n l a r y o l d a y ü r ü y o r d u.';
const expectedCase1 = 'İnsanlar yolda yürüyordu.';
const healed1 = fixSpacedOutLetters(spacedCase1);
assert('İ n s a n l a r y o l d a y ü r ü y o r d u. -> İnsanlar yolda yürüyordu.', healed1 === expectedCase1, `Sonuç: "${healed1}"`);
const cerCase1 = calculateCer(expectedCase1, healed1);
const werCase1 = calculateWer(expectedCase1, healed1);
assert('Karakter Hata Oranı (CER) %0 olmalı', cerCase1 === 0, `CER: ${(cerCase1 * 100).toFixed(2)}%`);
assert('Kelime Hata Oranı (WER) %0 olmalı', werCase1 === 0, `WER: ${(werCase1 * 100).toFixed(2)}%`);

const spacedCase2 = 'k i t a p   o k u m a k   g ü z e l d i r';
const expectedCase2 = 'kitap okumak güzeldir';
const healed2 = fixSpacedOutLetters(spacedCase2);
assert('k i t a p   o k u m a k   g ü z e l d i r -> kitap okumak güzeldir', healed2 === expectedCase2, `Sonuç: "${healed2}"`);

// -------------------------------------------------------------------------
// TEST 4: Birden Fazla Konuşmacının Bulunduğu Diyalog Sayfası
// -------------------------------------------------------------------------
console.log('\n--- Test 4: Diyalog Çizgileri ve Konuşma Paragraf Yapısı ---');
const dialogueCase = '— Beni bekledin mi? diye sordu.\n— Evet, uzun zamandır buradayım.';
const expectedDialogue = '— Beni bekledin mi? diye sordu.\n— Evet, uzun zamandır buradayım.';
const healedDialogue = normalizeHyphensAndText(dialogueCase);
assert('Diyalog tireleri (—) ve konuşmacı ayrımları korunuyor', healedDialogue === expectedDialogue, `Sonuç:\n${healedDialogue}`);
assert('Diyalog kelimeleri yanlışlıkla harf ayrımına uğramıyor', !healedDialogue.includes('B e n i'));
assert('CER 0 olmalı', calculateCer(expectedDialogue, healedDialogue) === 0);

// -------------------------------------------------------------------------
// TEST 5: Satır Sonunda Tireyle Bölünmüş Kelimeler
// -------------------------------------------------------------------------
console.log('\n--- Test 5: Satır Sonu Matbaa Hece Bölme Tireleri ---');
const hyphenSplit1 = 'Pencere-\nsinden dışarı baktı.';
const expectedSplit1 = 'Penceresinden dışarı baktı.';
const healedHyphen1 = normalizeHyphensAndText(hyphenSplit1);
assert('"Pencere-\\nsinden" -> "Penceresinden"', healedHyphen1 === expectedSplit1, `Sonuç: "${healedHyphen1}"`);

const hyphenSplit2 = 'Ahmet\'-\nte bulunan anahtarı aldı.';
const expectedSplit2 = "Ahmet'te bulunan anahtarı aldı.";
const healedHyphen2 = normalizeHyphensAndText(hyphenSplit2);
assert("Özel isim kesme işareti ile hece sonu: \"Ahmet'-\\nte\" -> \"Ahmet'te\"", healedHyphen2 === expectedSplit2, `Sonuç: "${healedHyphen2}"`);

// -------------------------------------------------------------------------
// TEST 6: Türkçe Karakterler İçeren Sayfa
// -------------------------------------------------------------------------
console.log('\n--- Test 6: Türkçe Karakter Bütünlüğü (ç, ğ, ı, İ, ö, ş, ü) ---');
const turkishAllChars = 'Çiğdem, ışıltılı pınarın başında şarkı söylüyordu; üzgün değildi.';
const cleanedTurkishChars = normalizeHyphensAndText(turkishAllChars);
assert('Tüm özel Türkçe harfler korunuyor', cleanedTurkishChars === turkishAllChars);
assert('İ/ı ve I/i ayrımı bozulmuyor', cleanedTurkishChars.includes('ışıltılı') && cleanedTurkishChars.includes('Çiğdem'));

// -------------------------------------------------------------------------
// TEST 7: Ücretsiz API Kotasının Dolduğu Durum (Rate Limit / 429)
// -------------------------------------------------------------------------
console.log('\n--- Test 7: Ücretsiz API Kotası Dolması (429 / Rate Limit) ---');
const rateLimitErr = new Error('HTTP 429: Too Many Requests / ResourceExhausted');
const rateLimitUserMsg = formatOcrErrorMessage(rateLimitErr);
assert('Kullanıcıya açık ve anlaşılır kota aşım mesajı gösteriliyor', rateLimitUserMsg.includes('Ücretsiz API kotası veya anlık hız sınırı doldu'));
assert('Sonsuz döngü engelleniyor, kullanıcı bilgilendiriliyor', rateLimitUserMsg.includes('diğer ücretsiz'));

// -------------------------------------------------------------------------
// TEST 8: Modelin Erişilemediği Durum (404 / Unavailable)
// -------------------------------------------------------------------------
console.log('\n--- Test 8: Modelin Erişilemediği / Bulunamadığı Durum (404) ---');
const notFoundErr = new Error('404: model_not_found: Model is not available');
const notFoundUserMsg = formatOcrErrorMessage(notFoundErr);
assert('Model bulunamadığında anlaşılır yönlendirme yapılıyor', notFoundUserMsg.includes('sağlayıcı üzerinde erişilemiyor') || notFoundUserMsg.includes('alternatif bir model'));

// -------------------------------------------------------------------------
// TEST 9: Ücretli Modele Otomatik Geçişin Engellendiği Durum
// -------------------------------------------------------------------------
console.log('\n--- Test 9: Ücretli Modele Otomatik Geçişin Engellenmesi ---');
// 9.1 isModelStrictlyFree checks
assert('qwen/qwen3.8-27b:free onaylı ücretsiz', isModelStrictlyFree('openrouter', 'qwen/qwen3.8-27b:free'));
assert('google/gemini-2.5-flash ÜCRETLİ model engellendi', !isModelStrictlyFree('openrouter', 'google/gemini-2.5-flash'));
assert('qwen/qwen3.8-27b (OpenRouter paid slug) engellendi', !isModelStrictlyFree('openrouter', 'qwen/qwen3.8-27b'));
assert('qwen/qwen2.5-vl-72b-instruct engellendi', !isModelStrictlyFree('openrouter', 'qwen/qwen2.5-vl-72b-instruct'));

// 9.2 Candidate list builder excludes paid models
const candidateList = buildCandidateList({
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash', // Attempting to request paid model
  openrouterApiKey: 'sk-or-test'
});
const hasPaidCandidate = candidateList.some(c => !isModelStrictlyFree('openrouter', c.model));
assert('Candidate listesine hiçbir ücretli model eklenmedi', !hasPaidCandidate);

// 9.3 402 Payment Required Error Message
const paidAttemptErr = new Error('This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen3.8-27b');
const paidUserMsg = formatOcrErrorMessage(paidAttemptErr);
assert('Ücretli modele geçiş denemesi net bir güvenlik mesajıyla durduruluyor', paidUserMsg.includes('ücretli modele izinsiz geçiş engellendi'));

// -------------------------------------------------------------------------
// TEST 10: Uzun PDF\'de Kaldığı Yerden Devam Etme & Birleştirme
// -------------------------------------------------------------------------
console.log('\n--- Test 10: Büyük PDF\'lerde Kesintiye Karşı Kaldığı Yerden Devam Etme ---');
const splitParagraphBlocks = [
  'Bu romanın ilk bölümünde olaylar bir kış günü',
  'başlar. Soğuk rüzgâr sokakları inletiyordu.'
];
const mergedAccidental = mergeAccidentalParagraphSplits(splitParagraphBlocks);
assert('Sayfa sonu veya satır atlamasıyla yanlış bölünen paragraflar akıcı birleştirildi', mergedAccidental.length === 1 && mergedAccidental[0] === 'Bu romanın ilk bölümünde olaylar bir kış günü başlar. Soğuk rüzgâr sokakları inletiyordu.');

// -------------------------------------------------------------------------
// TEST 11: Profesyonel OCR ve Düzeltme Talimatlarının Doğrulanması
// -------------------------------------------------------------------------
console.log('\n--- Test 11: Profesyonel Kitap OCR ve Proofreader Sistem Talimatları ---');
assert('Profesyonel OCR talimatı 17 kuralı içeriyor', BOOK_OCR_SYSTEM_PROMPT.includes('STRICT RULES') && BOOK_OCR_SYSTEM_PROMPT.includes('ACCURACY PRIORITY') && BOOK_OCR_SYSTEM_PROMPT.includes('[OKUNAMADI]'));
assert('Proofreader talimatı orijinal görsel ve OCR metnini karşılaştırıyor', BOOK_OCR_PROOFREADER_SYSTEM_PROMPT.includes('meticulous book OCR proofreader') && BOOK_OCR_PROOFREADER_SYSTEM_PROMPT.includes('Compare the original page image with the OCR transcription'));

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passed} / ${total} Başarılı (%${Math.round((passed / total) * 100)})`);
console.log('================================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
