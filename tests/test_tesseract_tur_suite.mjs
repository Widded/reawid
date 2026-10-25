// tests/test_tesseract_tur_suite.mjs
// Comprehensive test suite for Tesseract.js Turkish OCR,
// Turkish diacritics & line-end hyphen healing, and engine routing.

import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import {
  normalizeHyphensAndText,
  healTurkishOcrArtifacts,
  calculateCer,
  calculateWer
} from '../src/services/aiService.js';
import { extractPdfPageText } from '../src/services/pdfService.js';
import { DEFAULT_SETTINGS } from '../src/services/storageService.js';

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${description} ${details ? `(${details})` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${description} ${details ? `(${details})` : ''}`);
  }
}

console.log('================================================================');
console.log('ReaWid — Tesseract Türkçe OCR & İmla Düzeltme Test Paketi');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. KULLANICI HATALARI İYİLEŞTİRME VE REGRESYON TESTLERİ
// -----------------------------------------------------------------------------
console.log('--- 1. Bildirilen 7 Somut Hata İyileştirme Testleri ---');

// Hata 1: yay1mlanan -> yayımlanan (Rakam 1'in ı/i ile karışması)
const case1 = normalizeHyphensAndText('Romanları 40 dilde yay1mlanan yazar.');
assert('yay1mlanan -> yayımlanan düzeltildi', case1.includes('yayımlanan'), `Sonuç: "${case1}"`);
assert('40 sayısı bozulmadı', case1.includes('40'));

// Hata 2: Ziilfii -> Zülfü
const case2 = normalizeHyphensAndText('Ömer Ziilfii Livaneli');
assert('Ziilfii -> Zülfü düzeltildi', case2.includes('Zülfü'), `Sonuç: "${case2}"`);

// Hata 3: dogdu -> doğdu
const case3 = normalizeHyphensAndText('1946 yılında dogdu.');
assert('dogdu -> doğdu düzeltildi', case3.includes('doğdu'), `Sonuç: "${case3}"`);
assert('1946 yılı korundu', case3.includes('1946'));

// Hata 4: miizik -> müzik
const case4 = normalizeHyphensAndText('felsefe ve miizik eğitimi gördü.');
assert('miizik -> müzik düzeltildi', case4.includes('müzik'), `Sonuç: "${case4}"`);

// Hata 5: siirgiinde -> sürgünde
const case5 = normalizeHyphensAndText('11 yıl siirgiinde yaşadı.');
assert('siirgiinde -> sürgünde düzeltildi', case5.includes('sürgünde'), `Sonuç: "${case5}"`);
assert('11 sayısı korundu', case5.includes('11'));

// Hata 6: Stock- holm'de -> Stockholm'de
const case6 = normalizeHyphensAndText('Stock- holm\'de felsefe okudu.');
assert('Stock- holm\'de -> Stockholm\'de birleştirildi', case6.includes("Stockholm'de"), `Sonuç: "${case6}"`);

// Hata 7: Meh- ta -> Mehta
const case7 = normalizeHyphensAndText('Zubin Meh- ta gibi şeflerce yönetildi.');
assert('Meh- ta -> Mehta birleştirildi', case7.includes('Mehta'), `Sonuç: "${case7}"`);

// -----------------------------------------------------------------------------
// 2. SAYISAL DEĞERLER VE TARİHLERİN KORUNMASI
// -----------------------------------------------------------------------------
console.log('\n--- 2. Sayısal Değerler, Tarihler ve Roman Rakamları Koruması ---');
const numbersText = '1946 yılında, 11 yıl sürgünde, 30\'dan fazla ödül, 2002-2006 yılları arasında, 1. Bölüm, 2013\'ün en çok okunanı.';
const healedNumbers = normalizeHyphensAndText(numbersText);
assert('1946 korundu', healedNumbers.includes('1946'));
assert('11 korundu', healedNumbers.includes('11'));
assert("30'dan korundu", healedNumbers.includes("30'dan"));
assert('2002-2006 korundu', healedNumbers.includes('2002-2006'));
assert('1. Bölüm korundu', healedNumbers.includes('1. Bölüm'));
assert("2013'ün korundu", healedNumbers.includes("2013'ün"));

// -----------------------------------------------------------------------------
// 3. TESSERACT.JS TÜRKÇE MOTORU GERÇEK GÖRSEL TESTİ
// -----------------------------------------------------------------------------
console.log('\n--- 3. Tesseract.js Türkçe Motoru (Gerçek Sayfa Görseli) ---');
const imagePath = 'C:/Users/harun/.gemini/antigravity-ide/brain/6799ec5d-0248-46ba-9da5-95f7fa9a6d7b/.user_uploaded/media_1792963411285.png';

const GROUND_TRUTH = `Romanları 40 dilde yayımlanan Ömer Zülfü Livaneli, 1946 yılında doğdu. Ankara'da Maarif Koleji'nde okudu, Stockholm'de felsefe ve müzik eğitimi gördü.
1972 yılında fikirlerinden dolayı askeri cezaevinde yattı, 11 yıl sürgünde yaşadı.
Harvard ve Princeton gibi saygın üniversitelerde konferanslar ve dersler veren, romanları, fikirleri ve müziği ile dünya basınında övgülerle karşılanan bir sanatçı olan Livaneli, edebiyat, müzik ve sinema alanlarında 30'dan fazla ulusal ve uluslararası ödül sahibi.
Livaneli, 1999 yılında San Remo'da En İyi Besteci ödülüne layık görüldü. Müzik eserleri Londra, Moskova, Berlin, Atina, İzmir senfoni orkestraları tarafından icra edildi ve Zubin Mehta, Simeon Kogan gibi şeflerce yönetildi.
Türkiye dışında Çin Halk Cumhuriyeti, İspanya, Kore ve Almanya'da da çok satanlar arasına giren romanlarıyla, Balkan Edebiyat Ödülü'ne, ABD'de Barnes & Noble Büyük Yazar Ödülü'ne, İtalya ve Fransa'da Yılın Kitabı Ödülü'ne, Türkiye'de ise Yunus Nadi Ödülü'ne ve Orhan Kemal Roman Armağanı'na layık görüldü. Kardeşimin Hikâyesi 2013'ün en çok okunan romanı oldu. ABD'de Missouri Üniversitesi, romanlarını ders kitabı olarak okuttu.
Livaneli, dünya kültür ve barışına yaptığı katkılardan ötürü 1996 yılında Paris'te UNESCO tarafından Büyükelçilikle onurlandırıldı ve Genel Direktör danışmanlığına atandı. 2016 yılında UNESCO elçiliğinden istifa etti.
2002-2006 yılları arasında TBMM'de ve Avrupa Konseyi'nde`;

if (fs.existsSync(imagePath)) {
  const t0 = Date.now();
  const worker = await createWorker('tur', 1, {
    corePath: path.resolve('node_modules/tesseract.js-core/tesseract-core-simd.wasm.js')
  });

  const res = await worker.recognize(imagePath);
  const elapsed = Date.now() - t0;
  await worker.terminate();

  const rawText = res.data.text.trim();
  const cleanedText = normalizeHyphensAndText(rawText);

  assert('Tesseract çalıştı ve metin döndürdü', rawText.length > 200, `${rawText.length} karakter`);
  assert('Tesseract güven skoru %80 üzerinde', res.data.confidence >= 80, `%${res.data.confidence}`);

  // CER & WER hesaplamaları
  const cer = calculateCer(GROUND_TRUTH, cleanedText);
  const wer = calculateWer(GROUND_TRUTH, cleanedText);

  assert('Kelimeler hatasız tanındı (WER <= %2)', wer <= 0.02, `WER: ${(wer * 100).toFixed(2)}%`);
  assert('Karakter doğruluğu yüksek (CER <= %3)', cer <= 0.03, `CER: ${(cer * 100).toFixed(2)}%`);
  assert('İşlem süresi makul (< 4000ms)', elapsed < 4000, `${elapsed}ms`);

  // Ham metin ile temizlenmiş metnin ayrımı
  assert('Ham metin satır sonu hece tirelerini koruyor', rawText.includes('Stock-') || rawText.includes('Meh-'));
  assert('Temizlenmiş metin hecelemeleri birleştirdi', cleanedText.includes("Stockholm'de") && cleanedText.includes('Mehta'));
} else {
  console.warn('Görsel dosyası bulunamadı, Tesseract testi atlandı.');
}

// -----------------------------------------------------------------------------
// 4. PDF GÖMÜLÜ METİN BOZUKLUK VE MOJIBAKE KONTROLÜ
// -----------------------------------------------------------------------------
console.log('\n--- 4. Gömülü PDF Metin Doğrulama ve Güvenli Fallback ---');

// Mock PDF doc with (cid:xxx) font error
const corruptedDoc = {
  getPage: async () => ({
    getTextContent: async () => ({
      items: [
        { str: 'Bu sayfada (cid:102)(cid:111)(cid:114) font hatası var.', transform: [1, 0, 0, 1, 10, 100] }
      ]
    })
  })
};

const corruptedResult = await extractPdfPageText(corruptedDoc, 1);
assert('(cid:xxx) içeren bozuk font metni reddedildi (OCR fallback)', corruptedResult === null);

// -----------------------------------------------------------------------------
// 5. OCR MOTOR AYARI VE STRATEJİSİ
// -----------------------------------------------------------------------------
console.log('\n--- 5. OCR Motoru Seçim Ayarları ---');
assert('DEFAULT_SETTINGS içinde ocrEngine tanımlı', 'ocrEngine' in DEFAULT_SETTINGS);
assert("Varsayılan motor 'auto' olmalı", DEFAULT_SETTINGS.ocrEngine === 'auto');

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passed} Başarılı, ${failed} Hatalı (${passed + failed} Toplam Test)`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
