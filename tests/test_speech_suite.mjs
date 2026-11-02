// Unit and Regression Tests for ReaWid Neural TTS Engine
import assert from 'assert';
import { EdgeTTS } from '@andresaya/edge-tts';
import { AVAILABLE_TTS_VOICES, isTtsSupported } from '../src/services/speechService.js';
import { DEFAULT_SETTINGS } from '../src/services/storageService.js';

console.log('================================================================');
console.log('ReaWid — Microsoft Edge Neural TTS & Seslendirme Test Paketi');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Hata: ${err.message}`);
  }
}

async function itAsync(title, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Hata: ${err.message}`);
  }
}

async function runSuite() {
  console.log('--- 1. Ses Motoru & Ayar Tanımları ---');
  it('AVAILABLE_TTS_VOICES içinde Ahmet ve Emel sesleri tanımlı olmalı', () => {
    assert(AVAILABLE_TTS_VOICES.length >= 2, 'En az 2 ses tanımlı olmalı');
    const ahmet = AVAILABLE_TTS_VOICES.find(v => v.id === 'tr-TR-AhmetNeural');
    const emel = AVAILABLE_TTS_VOICES.find(v => v.id === 'tr-TR-EmelNeural');
    assert(ahmet, 'Ahmet neural sesi tanımlı olmalı');
    assert(emel, 'Emel neural sesi tanımlı olmalı');
  });

  it('DEFAULT_SETTINGS içinde varsayılan ses tr-TR-AhmetNeural olmalı', () => {
    assert.strictEqual(DEFAULT_SETTINGS.ttsVoice, 'tr-TR-AhmetNeural');
  });

  it('DEFAULT_SETTINGS içinde varsayılan hız 1.0 olmalı', () => {
    assert.strictEqual(DEFAULT_SETTINGS.ttsSpeed, 1.0);
  });

  console.log('\n--- 2. Edge Neural TTS Sentezleme & Ses Kalitesi ---');
  await itAsync('Ahmet Neural sesi ile Türkçe metin başarıyla MP3 olarak üretilmeli', async () => {
    const tts = new EdgeTTS();
    const res = await tts.generate('Merhaba, bu bir Türkçe ses testidir.', 'tr-TR-AhmetNeural');
    assert(res && res.audio, 'Ses verisi dönmeli');
    assert(res.audio.length > 5000, `Ses boyutu yeterli olmalı (Mevcut: ${res.audio.length} byte)`);
  });

  await itAsync('Emel Neural sesi ile Türkçe metin başarıyla MP3 olarak üretilmeli', async () => {
    await new Promise(r => setTimeout(r, 600));
    const tts = new EdgeTTS();
    const res = await tts.generate('Romanın ilk cümlesi burada başlıyor.', 'tr-TR-EmelNeural');
    assert(res && res.audio, 'Ses verisi dönmeli');
    assert(res.audio.length > 5000, `Ses boyutu yeterli olmalı (Mevcut: ${res.audio.length} byte)`);
  });

  await itAsync('Hız çarpanı (+20%) ses formatını bozmadan işlenmeli', async () => {
    await new Promise(r => setTimeout(r, 600));
    const tts = new EdgeTTS();
    const res = await tts.generate('Hızlı okuma testi.', 'tr-TR-AhmetNeural', { rate: '+20%' });
    assert(res && res.audio, 'Hızlandırılmış ses dönmeli');
    assert(res.audio.length > 2000, 'Hızlandırılmış ses boyutu geçerli olmalı');
  });

  console.log('\n================================================================');
  console.log(`Test Sonuçları: ${passedTests} / ${totalTests} Başarılı (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(console.error);
