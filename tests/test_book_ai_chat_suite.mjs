import assert from 'node:assert/strict';
import {
  prepareBookContext,
  askBookAi,
  extractBookAiAnswer,
  extractBookOutlineIndex,
  retrieveRelevantPages,
  extractEvidenceParagraphs
} from '../src/services/aiService.js';

console.log('================================================================');
console.log('ReaWid — Yapay Zeka Kitap Sohbet Asistanı Test Paketi');
console.log('================================================================\n');

let passedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`     Hata: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`     Hata: ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. prepareBookContext Testleri
console.log('--- 1. prepareBookContext & Spoiler Koruması Testleri ---');

const mockPages = {
  1: 'Raskolnikov odasından çıktı ve Petersburg sokaklarında yürümeye başladı.',
  2: 'Tefeci kocakarı Alyona Ivanovna\'nın evine gitti.',
  3: 'Meyhanede Marmeladov ile tanıştı.',
  4: 'Luzhin\'in evlilik mektubu Raskolnikov\'un eline ulaştı.',
  5: 'Cinayet planı zihninde şekillenmeye başladı.',
  6: 'Cinayet işlendi ve kanıtlar saklandı.',
  7: 'Polis müfettişi Porfiri Petroviç sorguya başladı.',
  8: 'Raskolnikov suçunu itiraf etti ve Sibirya\'ya sürüldü.'
};

runTest('Spoiler ON: Bulunulan sayfanın (Sayfa 4) ilerisindeki sayfalar elenmeli', () => {
  const ctx = prepareBookContext({
    pagesTextMap: mockPages,
    currentPage: 4,
    spoilerProtection: true
  });
  assert.ok(ctx.includes('[Sayfa 1]'), 'Sayfa 1 bulunmalı');
  assert.ok(ctx.includes('[Sayfa 4]'), 'Sayfa 4 bulunmalı');
  assert.ok(!ctx.includes('[Sayfa 5]'), 'Sayfa 5 elenmeli (spoiler)');
  assert.ok(!ctx.includes('[Sayfa 8]'), 'Sayfa 8 elenmeli (spoiler)');
  assert.ok(!ctx.includes('Sibirya'), 'Sonuç bilgisi elenmeli');
});

runTest('Spoiler OFF: Tüm sayfalar dahil edilmeli', () => {
  const ctx = prepareBookContext({
    pagesTextMap: mockPages,
    currentPage: 4,
    spoilerProtection: false
  });
  assert.ok(ctx.includes('[Sayfa 1]'), 'Sayfa 1 bulunmalı');
  assert.ok(ctx.includes('[Sayfa 4]'), 'Sayfa 4 bulunmalı');
  assert.ok(ctx.includes('[Sayfa 5]'), 'Sayfa 5 bulunmalı');
  assert.ok(ctx.includes('[Sayfa 8]'), 'Sayfa 8 bulunmalı');
  assert.ok(ctx.includes('Sibirya'), 'Bitiş bilgisi bulunmalı');
});

runTest('Boş veya tanımsız sayfalar için güvenli boş dize dönmeli', () => {
  assert.equal(prepareBookContext({ pagesTextMap: {} }), '');
  assert.equal(prepareBookContext({ pagesTextMap: null }), '');
});

runTest('Dizi (array of paragraphs) formatındaki sayfa paragrafları düzgün birleştirilmeli', () => {
  const ctx = prepareBookContext({
    pagesTextMap: { 1: ['Paragraf 1', 'Paragraf 2'] },
    currentPage: 1,
    spoilerProtection: true
  });
  assert.ok(ctx.includes('Paragraf 1\n\nParagraf 2'));
});

runTest('Karakter sınırı (maxCharLimit) aşıldığında akıllı budama yapılmalı', () => {
  const longMap = {};
  for (let i = 1; i <= 20; i++) {
    longMap[i] = `Sayfa ${i} içerik metni. `.repeat(40);
  }
  const ctx = prepareBookContext({
    pagesTextMap: longMap,
    currentPage: 20,
    spoilerProtection: false,
    maxCharLimit: 1000
  });
  assert.ok(ctx.length <= 1500, 'Bağlam bütçesi aşılmamalı');
  assert.ok(ctx.includes('[Sayfa 1]'), 'Açılış sayfaları korunmalı');
  assert.ok(ctx.includes('[Sayfa 20]'), 'En son sayfa korunmalı');
});

runTest('extractBookOutlineIndex: Bölüm başlıklarını ve sayfa numaralarını doğru çıkarmalı', () => {
  const structuredPages = {
    1: 'İÇİNDEKİLER\nBölüm 1.....Sayfa 4\nBölüm 2.....Sayfa 18',
    4: 'BÖLÜM 1: Başlangıç Noktası\nUzun bir yolculuk başladı.',
    18: 'Bölüm 2: Karşılaşma\nYolcular bir handa mola verdi.'
  };
  const outline = extractBookOutlineIndex(structuredPages);
  assert.ok(outline.includes('[Sayfa 1]: İÇİNDEKİLER'));
  assert.ok(outline.includes('[Sayfa 4]: BÖLÜM 1: Başlangıç Noktası'));
  assert.ok(outline.includes('[Sayfa 18]: Bölüm 2: Karşılaşma'));
});

runTest('retrieveRelevantPages: Soruya en uygun sayfaları doğru puanlayıp cımbızlamalı', () => {
  const testBook = {
    1: 'Karakter kasabaya ulaştı ve atını bağladı.',
    2: 'Meyhanede eski bir dostla karşılaştı.',
    3: 'BÖLÜM 3: Gece Vakti\nCinayet gece yarısı eski kilisede işlendi.',
    4: 'Sabah olduğunda polis dedektifi olay yerine geldi.'
  };
  const retrieved = retrieveRelevantPages({
    pagesTextMap: testBook,
    eligiblePages: [1, 2, 3, 4],
    question: 'Cinayet nerede işlendi?'
  });
  assert.ok(retrieved.length > 0, 'En az 1 alakalı sayfa dönmeli');
  assert.equal(retrieved[0].page, 3, 'Sayfa 3 cinayet kelimesi nedeniyle 1. sırada olmalı');
});

runTest('extractEvidenceParagraphs: Soruya en doğrudan kanıt olan paragrafları ayıklamalı', () => {
  const pages = [
    {
      page: 7,
      text: 'Büyük Salonda açılış ziyafeti başladı.\n\nHarry başını kaldırdığında Profesör Snape ile göz göze geldi. Tam o anda alnındaki yara izinde keskin bir acı hissetti.\n\nMasadaki yemekler nefisti.'
    }
  ];
  const ev = extractEvidenceParagraphs(pages, 'Harry yara izi Snape acı');
  assert.ok(ev.length > 0, 'Kanıt paragrafı bulunmalı');
  assert.ok(ev[0].text.includes('yara izinde keskin bir acı'), 'Doğru paragraf seçilmeli');
});

runTest('prepareBookContext (RAG): Soru verildiğinde kitap haritası ve ilgili sayfayı bağlama eklemeli', () => {
  const testBook = {
    1: 'BÖLÜM 1\nAli sabah uyandı.',
    2: 'Ali kahvaltı yaptı.',
    3: 'BÖLÜM 2: Gizemli Mektup\nAli postaneye gidip mührü kırılmış mektubu aldı.'
  };
  const ctx = prepareBookContext({
    pagesTextMap: testBook,
    currentPage: 3,
    spoilerProtection: false,
    question: 'Mektup nerede alındı?'
  });
  assert.ok(ctx.includes('KİTAP HARİTASI VE BÖLÜM DİZİNİ'), 'Kitap haritası bulunmalı');
  assert.ok(ctx.includes('BÖLÜM 2: Gizemli Mektup'), 'Bölüm başlığı haritada yer almalı');
  assert.ok(ctx.includes('SORUYLA İLGİLİ KİTAPTAN CIMBIZLANAN SAYFALAR'), 'Cımbızlanan sayfa bloğu olmalı');
  assert.ok(ctx.includes('Sayfa 3'), 'Mektubun geçtiği 3. sayfa cımbızlanmalı');
});

// 2. askBookAi Doğrulama & Hata Yönetimi Testleri
console.log('\n--- 2. askBookAi Parametre ve Hata Yönetimi Testleri ---');

runAsyncTest('Boş soru gönderilirse hata fırlatmalı', async () => {
  await assert.rejects(
    async () => {
      await askBookAi({ question: '   ' });
    },
    { message: 'Soru metni boş olamaz.' }
  );
});

runAsyncTest('API anahtarı bulunmadığında kullanıcı dostu Türkçe hata mesajı vermeli', async () => {
  await assert.rejects(
    async () => {
      await askBookAi({
        question: 'Raskolnikov kim?',
        settings: { groqApiKey: '', openrouterApiKey: '' }
      });
    },
    (err) => err.message.includes('ücretsiz Groq veya OpenRouter API anahtarınızı girin')
  );
});

// 3. extractBookAiAnswer & Düşünme Modelleri / Boş Yanıt Yönetimi Testleri
console.log('\n--- 3. extractBookAiAnswer & Düşünme / Boş Yanıt Yönetimi Testleri ---');

runTest('Standart içerik başarıyla ayıklanmalı', () => {
  const data = { choices: [{ message: { content: '  Bu bir romandır.  ' } }] };
  assert.equal(extractBookAiAnswer(data), 'Bu bir romandır.');
});

runTest('<think> etiketli yanıtlarda düşünme süreci atılmalı ve nihai metin alınmalı', () => {
  const data = {
    choices: [{
      message: {
        content: '<think>\nKullanıcı 25. sayfayı soruyor. Kuralları kontrol ediyorum...\n</think>\nSayfa 25 henüz okunmadı.'
      }
    }]
  };
  assert.equal(extractBookAiAnswer(data), 'Sayfa 25 henüz okunmadı.');
});

runTest('Sadece <think> bloğu olan (cevapsız) yanıtlarda boş dönmeli (kullanıcıya sızmamalı)', () => {
  const data = {
    choices: [{
      message: {
        content: '<think>\nSadece iç düşünme yapıldı ama kullanıcıya cevap verilmedi.\n</think>'
      }
    }]
  };
  assert.equal(extractBookAiAnswer(data), '');
});

runTest('Kapanmamış <think> etiketinde yarım kalan düşünce kullanıcıya basılmamalı', () => {
  const data = {
    choices: [{
      message: {
        content: '<think>\nToken bittiği için düşünce yarım kaldı...'
      }
    }]
  };
  assert.equal(extractBookAiAnswer(data), '');
});

runTest('Content boşken dahili reasoning alanı kullanıcıya doğrudan sızdırılmamalı', () => {
  const data = { choices: [{ message: { content: '', reasoning: 'Internal thinking process.' } }] };
  assert.equal(extractBookAiAnswer(data), '');
});

runTest('Boş veya geçersiz yanıtlarda güvenli boş dize dönmeli', () => {
  assert.equal(extractBookAiAnswer(null), '');
  assert.equal(extractBookAiAnswer({}), '');
  assert.equal(extractBookAiAnswer({ choices: [] }), '');
  assert.equal(extractBookAiAnswer({ choices: [{ message: { content: '   ' } }] }), '');
});

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passedCount} Başarılı`);
console.log('================================================================\n');
