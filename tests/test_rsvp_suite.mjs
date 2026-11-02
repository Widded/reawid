// test_rsvp_suite.mjs
// Unit tests for RSVP Speed Reader & Bionic ORP word decomposition
import { calculateOrpIndex, splitWordForRsvp, extractWordsForRsvp } from '../src/services/readerFormatter.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('ReaWid — RSVP Hızlı Okuyucu (Biyonik Kelime Akışı) Test Paketi');
console.log('================================================================\n');

console.log('--- 1. ORP (Optimal Recognition Point) İndeks Testleri ---');
assert(calculateOrpIndex('o') === 0, '1 harfli kelime ORP indeksi 0 olmalı');
assert(calculateOrpIndex('ve') === 1, '2 harfli kelime ORP indeksi 1 olmalı');
assert(calculateOrpIndex('bir') === 1, '3 harfli kelime ORP indeksi 1 olmalı');
assert(calculateOrpIndex('kapı') === 1, '4 harfli kelime ORP indeksi 1 olmalı');
assert(calculateOrpIndex('odada') === 1, '5 harfli kelime ORP indeksi 1 olmalı');
assert(calculateOrpIndex('yavaşça') === 2, '7 harfli kelime ORP indeksi 2 olmalı');
assert(calculateOrpIndex('kitaplar') === 2, '8 harfli kelime ORP indeksi 2 olmalı');
assert(calculateOrpIndex('fısıltıyla') === 3, '10 harfli kelime ORP indeksi 3 olmalı');
assert(calculateOrpIndex('gerçekleştirilemeyebilir') === 4, '14+ harfli kelime ORP indeksi 4 olmalı');

console.log('\n--- 2. splitWordForRsvp Parçalama Testleri ---');
{
  const r = splitWordForRsvp('bir');
  assert(r.left === 'b' && r.orp === 'i' && r.right === 'r', `bir -> ${JSON.stringify(r)}`);
}

{
  const r = splitWordForRsvp('fısıltıyla.');
  assert(r.left === 'fıs' && r.orp === 'ı' && r.right === 'ltıyla.', `fısıltıyla. -> ${JSON.stringify(r)}`);
  assert(r.right.endsWith('.'), 'Noktalama işareti sağ parçada korunmalı');
}

{
  const r = splitWordForRsvp('— Sakin');
  assert(r.left === '— S' && r.orp === 'a' && r.right === 'kin', `— Sakin -> ${JSON.stringify(r)}`);
}

{
  const r = splitWordForRsvp('“Geldim!”');
  assert(r.orp === 'l' && r.right.includes('!'), `“Geldim!” -> ${JSON.stringify(r)}`);
}

console.log('\n--- 3. extractWordsForRsvp Metin Parçalama Testleri ---');
{
  const text = 'Yavaşça kapıyı araladı. — İçeride kimse yoktu, dedi.';
  const words = extractWordsForRsvp(text);
  assert(words.length === 7, `Kelime sayısı doğru olmalı (beklenen: 7, alınan: ${words.length})`);
  assert(words[0] === 'Yavaşça', 'İlk kelime doğru');
  assert(words[3] === '— İçeride', 'Diyalog çizgisi kelimeyle birleştirilmeli');
  assert(words[6] === 'dedi.', 'Son kelime doğru');
}

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passed} Başarılı, ${failed} Başarısız`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
