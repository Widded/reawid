// test_sentence_tts_suite.mjs
// Verification suite for sentence-level segmentation & tap-to-read TTS formatting
import { splitIntoSentences, formatBookHtml } from '../src/services/readerFormatter.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('ReaWid — Cümle Bölümleme & Dokun-Dinle (TTS) Test Paketi');
console.log('================================================================\n');

console.log('--- 1. Üç Nokta (...) ve Tek Karakter Elipsis (…) Testleri ---');
{
  const text = 'Yavaşça kapıyı araladı... İçeride kimse yoktu.';
  const sentences = splitIntoSentences(text);
  assert(sentences.length === 2, `Üç nokta 2 cümleye ayrılmalı (beklenen: 2, alınan: ${sentences.length})`);
  assert(sentences[0] === 'Yavaşça kapıyı araladı...', `İlk cümle üç noktayı korumalı: "${sentences[0]}"`);
  assert(sentences[1] === 'İçeride kimse yoktu.', `İkinci cümle temiz olmalı: "${sentences[1]}"`);
}

{
  const text = 'Bunu hiç beklemiyordu… Derin bir nefes alıp geriye yaslandı.';
  const sentences = splitIntoSentences(text);
  assert(sentences.length === 2, `Unicode tek karakter üç nokta (…) 2 cümleye ayrılmalı`);
  assert(sentences[0] === 'Bunu hiç beklemiyordu…', `İlk cümle elipsisi korumalı: "${sentences[0]}"`);
}

console.log('\n--- 2. Kısaltmaların (Dr., Prof., vs., vb.) Bölünmeme Testleri ---');
{
  const text = 'Dr. Ahmet Bey ve Prof. Mehmet Bey dün akşam geldiler. Saat dokuzda toplantı yapıldı.';
  const sentences = splitIntoSentences(text);
  assert(sentences.length === 2, `Kısaltmalar cümle bölmemeli (beklenen: 2, alınan: ${sentences.length})`);
  assert(sentences[0].includes('Dr. Ahmet') && sentences[0].includes('Prof. Mehmet'), `Kısaltmalar cümle içinde korunmalı`);
}

{
  const text = 'Elma, armut, muz vb. meyveler sepetteydi. Çocuklar hepsini afiyetle yedi.';
  const sentences = splitIntoSentences(text);
  assert(sentences.length === 2, `"vb." kısaltması cümleyi bölmemeli (beklenen: 2, alınan: ${sentences.length})`);
}

console.log('\n--- 3. Ünlem, Soru İşareti ve Tırnak İçi Cümle Testleri ---');
{
  const text = 'Nereye gidiyorsun? Hemen buraya dön! Yoksa fena olur.';
  const sentences = splitIntoSentences(text);
  assert(sentences.length === 3, `Soru işareti ve ünlem cümleleri ayırmalı (beklenen: 3, alınan: ${sentences.length})`);
}

console.log('\n--- 4. formatBookHtml ile data-sentence-idx Entegrasyon Testi ---');
{
  const paragraphs = [
    'Birinci cümlenin başı. İkinci cümle burada devam ediyor...',
    '— Sakin ol, dedi fısıltıyla. — Her şey yoluna girecek.'
  ];

  const html = formatBookHtml(paragraphs, { enabled: true });
  assert(html.includes('data-sentence-idx="0"'), `İlk cümle data-sentence-idx="0" etiketine sahip olmalı`);
  assert(html.includes('data-sentence-idx="1"'), `İkinci cümle data-sentence-idx="1" etiketine sahip olmalı`);
  assert(html.includes('reader-sentence'), `reader-sentence CSS sınıfı eklenmiş olmalı`);
  assert(!html.includes('undefined'), `HTML içinde hiçbir "undefined" bulunmamalı`);
}

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passed} Başarılı, ${failed} Başarısız (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
