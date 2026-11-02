import assert from 'node:assert/strict';
import { prepareBookContext, askBookAi } from '../src/services/aiService.js';

console.log('================================================================');
console.log('ReaWid — Yapay Zeka Kitap Sohbet Asistanı Test Paketi');
console.log('================================================================\n');

let passedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Hata: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
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

console.log('\n================================================================');
console.log(`Test Sonuçları: ${passedCount} Başarılı`);
console.log('================================================================\n');
