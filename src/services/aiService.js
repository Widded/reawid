// AI Vision Service for ReaWid OCR
// Direct integration with Groq and OpenRouter APIs for Vision-to-Text OCR
// Includes Dynamic Server Balancing and Intelligent Auto-Failover

// Active vision model pools ranked by quality and speed
export const VISION_CANDIDATE_POOLS = {
  groq: [
    {
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      name: 'Groq (Qwen 3.8 27B Vision)',
      tier: 'ultra_fast',
      freeTier: true
    }
  ],
  openrouter: [
    {
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash',
      name: 'OpenRouter (Gemini 2.5 Flash)',
      tier: 'smart_flagship',
      freeTier: true
    },
    {
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash-lite',
      name: 'OpenRouter (Gemini 2.5 Flash Lite)',
      tier: 'ultra_fast',
      freeTier: true
    },
    {
      provider: 'openrouter',
      model: 'qwen/qwen2.5-vl-72b-instruct',
      name: 'OpenRouter (Qwen 2.5 VL 72B)',
      tier: 'heavyweight',
      freeTier: true
    },
    {
      provider: 'openrouter',
      model: 'google/gemini-3.1-flash-lite',
      name: 'OpenRouter (Gemini 3.1 Flash Lite)',
      tier: 'next_gen',
      freeTier: true
    }
  ]
};

// Circuit Breaker for overloaded/rate-limited models (key -> { expiresAt, reason })
const congestedModels = new Map();

export function markModelCongested(key, durationMs = 45000, reason = 'Yoğunluk/Kota Sınırı') {
  congestedModels.set(key, { expiresAt: Date.now() + durationMs, reason });
  console.warn(`[AI Router] ⏳ "${key}" geçici olarak meşgul işaretlendi (${Math.round(durationMs / 1000)}s soğuma): ${reason}`);
}

export function isModelCongested(key) {
  const record = congestedModels.get(key);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    congestedModels.delete(key);
    return false;
  }
  return true;
}

export function getCongestionMap() {
  const status = {};
  for (const [key, val] of congestedModels.entries()) {
    if (Date.now() <= val.expiresAt) {
      status[key] = {
        remainingSec: Math.ceil((val.expiresAt - Date.now()) / 1000),
        reason: val.reason
      };
    }
  }
  return status;
}

export function clearCongestionMap() {
  congestedModels.clear();
}

/**
 * Builds candidate list based on user settings, API key availability, and current congestion state
 */
export function buildCandidateList({ provider = 'auto', model = 'auto', groqApiKey = '', openrouterApiKey = '' }) {
  const candidates = [];
  const hasGroq = !!groqApiKey && groqApiKey.trim().length > 0;
  const hasOR = !!openrouterApiKey && openrouterApiKey.trim().length > 0;

  const normalizedProvider = (provider || 'auto').toLowerCase();
  const normalizedModel = (model || 'auto').toLowerCase();

  if (normalizedProvider === 'auto' || normalizedProvider === 'hybrid') {
    // HYBRID AUTO: Best of both worlds
    if (hasGroq) {
      candidates.push(...VISION_CANDIDATE_POOLS.groq);
    }
    if (hasOR) {
      candidates.push(...VISION_CANDIDATE_POOLS.openrouter);
    }
  } else if (normalizedProvider === 'groq') {
    if (hasGroq) {
      if (normalizedModel !== 'auto') {
        const found = VISION_CANDIDATE_POOLS.groq.find(c => c.model === model);
        if (found) candidates.push(found);
      }
      VISION_CANDIDATE_POOLS.groq.forEach(c => {
        if (!candidates.some(existing => existing.model === c.model)) candidates.push(c);
      });
    }
    // Cross-provider backup if Groq is out of capacity
    if (hasOR) {
      candidates.push(...VISION_CANDIDATE_POOLS.openrouter);
    }
  } else if (normalizedProvider === 'openrouter') {
    if (hasOR) {
      if (normalizedModel !== 'auto') {
        const found = VISION_CANDIDATE_POOLS.openrouter.find(c => c.model === model);
        if (found) candidates.push(found);
      }
      VISION_CANDIDATE_POOLS.openrouter.forEach(c => {
        if (!candidates.some(existing => existing.model === c.model)) candidates.push(c);
      });
    }
    // Cross-provider backup if OpenRouter is exhausted
    if (hasGroq) {
      candidates.push(...VISION_CANDIDATE_POOLS.groq);
    }
  }

  // Sort candidates: un-congested candidates first, congested ones at the end
  return candidates.sort((a, b) => {
    const aKey = `${a.provider}:${a.model}`;
    const bKey = `${b.provider}:${b.model}`;
    const aCongested = isModelCongested(aKey);
    const bCongested = isModelCongested(bKey);
    if (aCongested === bCongested) return 0;
    return aCongested ? 1 : -1;
  });
}

/**
 * Normalizes text and cleanly merges words split by end-of-line hyphens (matbaa heceleme çizgisi).
 * Preserves true dialogue dashes (—) and proper hyphenated compounds (Türk-İslam, 1923-1938).
 */
export function normalizeHyphensAndText(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    .replace(/[\u00AD\u200B\uFEFF]/g, '')
    .replace(/\r\n/g, '\n');

  // 1. Standart satır sonu hece bölme tireleri:
  // "kelime-\nhece" veya "kelime–\nhece" -> "kelimehece"
  // "Ahmet'-\nte" -> "Ahmet'te"
  cleaned = cleaned.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)(['’]?)[-–—]\s*\n+\s*[-–—]?\s*([a-zçğıöşü])/gu,
    (match, word, apostrophe, nextLetter) => {
      return `${word}${apostrophe || ''}${nextLetter}`;
    }
  );

  // 2. Özel isim kesme işareti ile satır sonu:
  // "Ahmet'-\nte" veya "Ankara'-\nda" -> "Ahmet'te", "Ankara'da"
  cleaned = cleaned.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)['’][-–—]\s*\n+\s*([a-zçğıöşü])/gu,
    "$1'$2"
  );
  cleaned = cleaned.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*\n+\s*['’][-–—]?\s*([a-zçğıöşü])/gu,
    "$1'$2"
  );

  // 3. OCR / PDF'te tirenin alt satırın başına kaldığı durumlar:
  // "kapı\n-sından" -> "kapısından"
  cleaned = cleaned.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*\n+\s*[-–—]([a-zçğıöşü]+)/gu,
    '$1$2'
  );

  // 4. İki kelime arasında satır sonuna denk gelen gerçek bileşik kelimeler (örn: "Ankara-\nİstanbul")
  // Tireyi koruyarak tek satıra topla: "Ankara-İstanbul"
  cleaned = cleaned.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)[-–—]\s*\n+\s*([A-ZÇĞİÖŞÜ0-9][a-zçğıöşüA-ZÇĞİÖŞÜ0-9]*)/gu,
    '$1-$2'
  );

  return cleaned;
}

export function buildSystemPrompt(options = {}) {
  const strictTurkish = options.strictTurkish !== false;
  const mergeHyphens = options.mergeHyphenatedWords !== false;
  const ignorePageNumbers = options.ignorePageNumbers !== false;
  const preserveFormatting = options.preserveFormatting !== false;

  return `Sen üst düzey bir Türkçe OCR ve Belge Okuma Uzmanısın.
Görseldeki tüm Türkçe yazıları eksiksiz ve sıfır hata ile dijital metne dök.

KURALLAR:
${strictTurkish ? `1. TÜRKÇE KARAKTERLER (ç, ğ, ı, ö, ş, ü, Ç, Ğ, I, İ, Ö, Ş, Ü) HAYATİ ÖNEMDEDİR:
   - Kesinlikle hiçbir Türkçe karakteri İngilizce benzerleriyle (c, g, i, o, s, u) değiştirme veya atlama.
   - Noktalı 'i' ve noktasız 'ı' ayrımına azami dikkat göster (örn: "ışık" kelimesini "isik" yapma; "bilir" kelimesini "bılır" yapma).
   - "değil, çünkü, için, hiçbir, yağmur, doğru, olduğu, büyük, küçük, çocuk, şey, başka, nasıl" gibi Türkçe sözcükleri kusursuz Türkçe imlasıyla yaz.` : ''}
${mergeHyphens ? `2. SATIR SONU HECE BÖLME TİRELERİNİ BİRLEŞTİR:
   - Matbaada satır sonuna sığmayıp tire ile bölünen kelimeleri birleştir (örn: "pencere-" + "sinden" -> "penceresinden"; "yapıl-" + "mıştı" -> "yapılmıştı").
   - Satır sonundaki heceleme tirelerini ASLA konuşma çizgisiyle (diyalog) KARIŞTIRMA! Hece bölünmelerinde tireyi silip kelimeyi birleştir.` : ''}
${ignorePageNumbers ? '3. Tek başına duran sayfa numaralarını veya tekrarlayan başlıkları metne dahil etme.' : ''}
${preserveFormatting ? `4. KİTAP FORMATI VE DİYALOG YAPISI:
   - Paragrafları çift satır boşluğu (\\n\\n) ile ayır.
   - Yalnızca gerçek konuşma cümlelerini (uzun konuşma çizgisi '—' veya tırnak ile başlayıp büyük harfle devam eden kısımları) ayrı bir satır olarak yaz.
   - Satır sonu veya cümle içi hece tirelerini diyalog satırına dönüştürme.` : ''}
5. Selamlama, önsöz veya açıklama yazma. Yalnızca ve doğrudan belgeden okunan metni çıktı ver.`;
}

/**
 * Perform OCR with dynamic model routing and intelligent auto-failover
 */
export async function performOcr({
  imageBase64, // 'data:image/jpeg;base64,...'
  provider = 'auto',
  apiKey,
  groqApiKey,
  openrouterApiKey,
  model = 'auto',
  options = {},
  signal,
  onModelFallback,
  onModelSuccess
}) {
  const actualGroqKey = groqApiKey || (provider === 'groq' ? apiKey : '') || (import.meta.env.VITE_GROQ_API_KEY || '');
  const actualORKey = openrouterApiKey || (provider === 'openrouter' ? apiKey : '') || (import.meta.env.VITE_OPENROUTER_API_KEY || '');

  const candidates = buildCandidateList({
    provider,
    model,
    groqApiKey: actualGroqKey,
    openrouterApiKey: actualORKey
  });

  if (candidates.length === 0) {
    throw new Error('Kullanılabilir bir AI API anahtarı bulunamadı. Lütfen Ayarlar bölümünden Groq veya OpenRouter anahtarınızı girin.');
  }

  const systemPrompt = buildSystemPrompt(options);

  // Normalize base64 data URL
  let imageUrl = imageBase64;
  if (!imageUrl.startsWith('data:')) {
    imageUrl = `data:image/jpeg;base64,${imageUrl}`;
  }

  const userPrompt = "Bu görseldeki Türkçe metni hiçbir Türkçe karakteri (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü) atlamadan, kelimesi kelimesine ve eksiksiz olarak metne dök.";

  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateKey = `${candidate.provider}:${candidate.model}`;
    const candApiKey = candidate.provider === 'groq' ? actualGroqKey : actualORKey;

    if (!candApiKey || !candApiKey.trim()) continue;

    if (signal?.aborted) {
      throw new DOMException('OCR işlemi kullanıcı tarafından durduruldu', 'AbortError');
    }

    try {
      console.info(`[AI Router] Deneniyor: ${candidate.name}...`);
      let resultText = '';

      if (candidate.provider === 'groq') {
        resultText = await callGroqVision({
          apiKey: candApiKey,
          model: candidate.model,
          systemPrompt,
          userPrompt,
          imageUrl,
          temperature: options.temperature ?? 0.1,
          signal
        });
      } else {
        resultText = await callOpenRouterVision({
          apiKey: candApiKey,
          model: candidate.model,
          systemPrompt,
          userPrompt,
          imageUrl,
          temperature: options.temperature ?? 0.1,
          signal
        });
      }

      if (!resultText || resultText.trim().length === 0) {
        throw new Error('Modelden boş metin yanıtı döndü');
      }

      // Success! Clear any cooldown for this candidate
      congestedModels.delete(candidateKey);

      if (onModelSuccess) {
        onModelSuccess({
          model: candidate.model,
          provider: candidate.provider,
          name: candidate.name
        });
      }

      if (options.mergeHyphenatedWords !== false) {
        resultText = normalizeHyphensAndText(resultText);
      }

      return resultText;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        throw err;
      }

      lastError = err;
      const isRateLimitOrOverload = 
        err.message?.includes('429') ||
        err.message?.includes('rate limit') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('503') ||
        err.message?.includes('502') ||
        err.message?.includes('504') ||
        err.message?.includes('capacity') ||
        err.message?.includes('No provider');

      // Put model in temporary circuit breaker cooldown
      markModelCongested(
        candidateKey,
        isRateLimitOrOverload ? 60000 : 30000,
        isRateLimitOrOverload ? '429 Rate Limit / Sunucu Yoğunluğu' : err.message
      );

      const nextCandidate = candidates[i + 1];
      if (nextCandidate) {
        console.warn(`[AI Router] [Uyarı] ${candidate.name} yoğun veya hata verdi (${err.message}). Sıradaki model ${nextCandidate.name} devreye alınıyor...`);
        if (onModelFallback) {
          onModelFallback({
            from: candidate.name,
            to: nextCandidate.name,
            reason: isRateLimitOrOverload ? 'Sunucu yoğun' : 'Hata oluştu',
            error: err.message
          });
        }
      }
    }
  }

  throw new Error(`Tüm AI modelleri denendi fakat yanıt alınamadı. Son hata: ${lastError?.message || 'Bilinmeyen hata'}`);
}

/**
 * Call Groq Vision API
 */
async function callGroqVision({ apiKey, model, systemPrompt, userPrompt, imageUrl, temperature, signal }) {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    temperature: temperature,
    max_tokens: 2048
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errMsg = `Groq API Hatası (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errMsg += `: ${errData.error.message}`;
      }
    } catch (_) {
      const errText = await response.text();
      if (errText) errMsg += `: ${errText}`;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text.trim();
}

/**
 * Call OpenRouter Vision API
 */
async function callOpenRouterVision({ apiKey, model, systemPrompt, userPrompt, imageUrl, temperature, signal }) {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  const payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    temperature: temperature,
    max_tokens: 2048,
    provider: {
      allow_fallbacks: true
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': window.location.origin || 'https://reawid.app',
      'X-Title': 'ReaWid OCR PWA'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errMsg = `OpenRouter API Hatası (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errMsg += `: ${errData.error.message}`;
      }
    } catch (_) {
      const errText = await response.text();
      if (errText) errMsg += `: ${errText}`;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text.trim();
}

/**
 * Test API connection with a minimal text ping
 */
export async function testApiConnection(provider, apiKey, model, extraKeys = {}) {
  const normProvider = (provider || 'auto').toLowerCase();

  if (normProvider === 'auto') {
    const groqKey = extraKeys.groqApiKey || (apiKey && apiKey.startsWith('gsk_') ? apiKey : '');
    const orKey = extraKeys.openrouterApiKey || (apiKey && apiKey.startsWith('sk-or-') ? apiKey : '');

    const results = [];
    if (groqKey) {
      const gRes = await testApiConnection('groq', groqKey, 'qwen/qwen3.8-27b');
      results.push(`Groq: ${gRes.success ? 'Aktif' : 'Hata: ' + gRes.message}`);
    }
    if (orKey) {
      const orRes = await testApiConnection('openrouter', orKey, 'google/gemini-2.5-flash');
      results.push(`OpenRouter: ${orRes.success ? 'Aktif' : 'Hata: ' + orRes.message}`);
    }

    if (results.length === 0) {
      return { success: false, message: 'Test edilecek geçerli bir Groq veya OpenRouter API anahtarı bulunamadı.' };
    }

    const allOk = results.every(r => r.includes('Aktif'));
    return { success: allOk, message: results.join(' | ') };
  }

  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'API anahtarı boş bırakılamaz.' };
  }

  try {
    if (normProvider === 'groq') {
      const testModel = (model && model !== 'auto') ? model : 'qwen/qwen3.8-27b';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5
        })
      });
      if (res.ok) {
        return { success: true, message: `Groq bağlantısı başarılı! Model: ${testModel}` };
      }
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err?.error?.message || `Bağlantı hatası: HTTP ${res.status}` };
    } else if (normProvider === 'openrouter') {
      const testModel = (model && model !== 'auto') ? model : 'google/gemini-2.5-flash';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': window.location.origin || 'https://reawid.app',
          'X-Title': 'ReaWid OCR PWA'
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5
        })
      });
      if (res.ok) {
        return { success: true, message: `OpenRouter bağlantısı başarılı! Model: ${testModel}` };
      }
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err?.error?.message || `Bağlantı hatası: HTTP ${res.status}` };
    }
    return { success: false, message: 'Bilinmeyen sağlayıcı' };
  } catch (err) {
    return { success: false, message: err.message || 'Ağ bağlantı hatası oluştu' };
  }
}

/**
 * AI Tool: Polish / Fix Turkish spelling, punctuation, and hyphen artifacts
 */
export async function polishTurkishText({ text, provider, apiKey, model }) {
  if (!text || text.trim() === '') return '';

  const systemPrompt = `Sen profesyonel bir Türkçe dilbilimci ve imla düzeltmenisin.
Sana verilen metin taranmış bir kitaptan veya belgeden OCR ile çıkarılmıştır.
Görevin:
1. Türkçe imla, noktalama ve yazım hatalarını düzeltmek.
2. Varsa kalmış satır sonu kelime bölünmelerini veya harf bozulmalarını toparlamak.
3. TÜRKÇE KARAKTERLERİ (ç, ğ, ı, ö, ş, ü, Ç, Ğ, I, İ, Ö, Ş, Ü) KUSURSUZ KORUMAK.
4. Metnin orijinal anlamını, cümle yapısını ve anlatımını ASLA DEĞİŞTİRMEMEK.
5. Yalnızca düzeltilmiş metni çıktı vermek. Giriş/çıkış açıklaması yapmamak.`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.1
  };

  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'https://reawid.app';
    headers['X-Title'] = 'ReaWid OCR PWA';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Düzeltme hatası (HTTP ${res.status})`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || text).trim();
}

/**
 * AI Tool: Translate text to another language
 */
export async function translateText({ text, targetLanguage, provider, apiKey, model }) {
  if (!text || text.trim() === '') return '';

  const systemPrompt = `You are a professional literary and document translator.
Translate the following Turkish text faithfully and accurately into ${targetLanguage}.
Maintain the original paragraph structure, tone, and formatting.
Output ONLY the translated text without introductory or concluding remarks.`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.2
  };

  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'https://reawid.app';
    headers['X-Title'] = 'ReaWid OCR PWA';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Çeviri hatası (HTTP ${res.status})`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || text).trim();
}
