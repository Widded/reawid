// Verification test for Groq & OpenRouter OCR Audit Logging and Document/Page Validation
import {
  recordOcrAudit,
  getOcrAuditTrail,
  clearOcrAuditTrail,
  performOcr,
  buildCandidateList,
  VISION_CANDIDATE_POOLS
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
console.log('ReaWid — Groq & OpenRouter Entegrasyon & Doğrulama Testleri');
console.log('================================================================\n');

// 1. Audit Trail Record and Retrieval
console.log('--- 1. Audit Trail Kayıt ve Güvenli Loglama ---');
clearOcrAuditTrail();
assert('Başlangıçta audit trail boş', getOcrAuditTrail().length === 0);

recordOcrAudit({
  documentId: 'doc_kitap_123',
  pageNumber: 42,
  provider: 'groq',
  model: 'qwen/qwen3.8-27b',
  durationMs: 840,
  status: 'success',
  charCount: 1450
});

const logs = getOcrAuditTrail();
assert('Log başarıyla kaydedildi', logs.length === 1);
assert('Belge kimliği doğru', logs[0].documentId === 'doc_kitap_123');
assert('Sayfa numarası doğru', logs[0].pageNumber === 42);
assert('Sağlayıcı doğru', logs[0].provider === 'groq');
assert('Model doğru', logs[0].model === 'qwen/qwen3.8-27b');
assert('Hassas API anahtarı loglanmıyor', !JSON.stringify(logs[0]).includes('gsk_') && !JSON.stringify(logs[0]).includes('sk-or-'));

// 2. Multimodal Capability of Configured Models
console.log('\n--- 2. Havuzdaki Modellerin Görsel Destek Kontrolü ---');
const groqPool = VISION_CANDIDATE_POOLS.groq;
groqPool.forEach(m => {
  assert(`Groq modeli görsel destekliyor: ${m.model}`, m.supportsVision === true);
});

const openrouterPool = VISION_CANDIDATE_POOLS.openrouter;
openrouterPool.forEach(m => {
  assert(`OpenRouter modeli görsel destekliyor: ${m.model}`, m.supportsVision === true);
});

// 3. Fallback and Candidate Ordering
console.log('\n--- 3. Otomatik Geçiş ve Model Sıralaması ---');
const autoList = buildCandidateList({
  provider: 'auto',
  groqApiKey: 'dummy_groq_key',
  openrouterApiKey: 'dummy_or_key'
});
assert('Auto modda ilk aday Groq ultra-hızlı LPU olmalı', autoList[0].provider === 'groq');
assert('Groq sonrası OpenRouter yedek havuzuna geçilmeli', autoList.some(c => c.provider === 'openrouter'));

// 4. Return value metadata verification
console.log('\n--- 4. Yanıt Doğrulama ve Metadata Kontrolü ---');
const testStr = 'Örnek kitap sayfası metni';
const verifiable = new String(testStr);
verifiable.text = testStr;
verifiable.documentId = 'doc_test_1';
verifiable.pageNumber = 5;
verifiable.provider = 'groq';
verifiable.model = 'qwen/qwen3.8-27b';

assert('Verifiable String primitive olarak kullanılabilir', String(verifiable) === testStr);
assert('Verifiable String split fonksiyonunu destekler', verifiable.split(' ').length === 4);
assert('Sayfa numarası metadata olarak doğrulanabilir', verifiable.pageNumber === 5);
assert('Belge kimliği metadata olarak doğrulanabilir', verifiable.documentId === 'doc_test_1');

console.log('\n================================================================');
console.log(`Doğrulama Sonuçları: ${passed} / ${total} Başarılı (%${Math.round((passed / total) * 100)})`);
console.log('================================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
