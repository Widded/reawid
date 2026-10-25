// AI Vision Service for ReaWid OCR
// Direct integration with Groq and OpenRouter APIs for Vision-to-Text OCR
// Strictly operates within verified FREE models and tiers.
// Includes Dynamic Server Balancing, Intelligent Auto-Failover, and Two-Stage Proofreading.

// Active vision model pools ranked by quality, speed, and 100% free accessibility
export const VISION_CANDIDATE_POOLS = {
  groq: [
    {
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      name: 'Groq (Qwen 3.8 27B Vision LPU)',
      tier: 'ultra_fast',
      freeTier: true,
      supportsVision: true
    }
  ],
  openrouter: [
    {
      provider: 'openrouter',
      model: 'nvidia/nemotron-3.5-super-vl:free',
      name: 'OpenRouter (Nemotron 3.5 Super VL :free)',
      tier: 'primary_free',
      freeTier: true,
      supportsVision: true
    },
    {
      provider: 'openrouter',
      model: 'google/gemma-4-26b-a4b-it:free',
      name: 'OpenRouter (Gemma 4 26B :free)',
      tier: 'vision_free',
      freeTier: true,
      supportsVision: true
    },
    {
      provider: 'openrouter',
      model: 'dots-studio/dots-3-note-preview:free',
      name: 'OpenRouter (Dots3 Note Preview :free)',
      tier: 'vision_free',
      freeTier: true,
      supportsVision: true
    },
    {
      provider: 'openrouter',
      model: 'google/gemma-4-31b-it:free',
      name: 'OpenRouter (Gemma 4 31B :free)',
      tier: 'vision_free',
      freeTier: true,
      supportsVision: true
    },
    {
      provider: 'openrouter',
      model: 'openrouter/free',
      name: 'OpenRouter (Free Router)',
      tier: 'pool_free',
      freeTier: true,
      supportsVision: true
    }
  ]
};

// Mask API key for secure logging
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

// Strictly verify that a model is in the free tier
export function isModelStrictlyFree(provider, model) {
  if (!model || model === 'auto') return true;
  const p = (provider || '').toLowerCase();
  const m = model.toLowerCase();

  if (p === 'openrouter') {
    return m.endsWith(':free') || m === 'openrouter/free';
  }
  if (p === 'groq') {
    // Groq's developer tier runs on-demand without paid commitments
    return m === 'qwen/qwen3.8-27b';
  }
  return true;
}

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

// Circular in-memory audit log for OCR requests (retains last 200 requests)
const ocrAuditTrail = [];

export function recordOcrAudit({
  documentId = 'single_doc',
  pageNumber = 1,
  provider = 'unknown',
  model = 'unknown',
  durationMs = 0,
  status = 'success', // 'success' | 'failover' | 'error'
  error = null,
  charCount = 0
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    documentId: String(documentId || 'single_doc'),
    pageNumber: Number(pageNumber) || 1,
    provider: String(provider || 'unknown'),
    model: String(model || 'unknown'),
    durationMs: Math.round(durationMs),
    status,
    error: error ? String(error).slice(0, 160) : null,
    charCount: Number(charCount) || 0
  };

  ocrAuditTrail.push(entry);
  if (ocrAuditTrail.length > 200) {
    ocrAuditTrail.shift();
  }

  // Safe console logging without API keys, prompts, or image payloads
  const icon = status === 'success' ? '✅' : (status === 'failover' ? '⚠️' : '❌');
  console.info(
    `[AI OCR Audit] ${icon} Belge: [${entry.documentId}] | Sayfa: [${entry.pageNumber}] | Sağlayıcı: ${entry.provider} | Model: ${entry.model} | Süre: ${entry.durationMs}ms | Durum: ${entry.status}${entry.error ? ` (${entry.error})` : ` (${entry.charCount} kr)`}`
  );

  return entry;
}

export function getOcrAuditTrail() {
  return [...ocrAuditTrail];
}

export function clearOcrAuditTrail() {
  ocrAuditTrail.length = 0;
}


/**
 * Builds candidate list based on user settings, API key availability, and current congestion state.
 * Strictly guarantees that ONLY verified free models are ever included.
 */
export function buildCandidateList({ provider = 'auto', model = 'auto', groqApiKey = '', openrouterApiKey = '' }) {
  const candidates = [];
  const hasGroq = !!groqApiKey && groqApiKey.trim().length > 0;
  const hasOR = !!openrouterApiKey && openrouterApiKey.trim().length > 0;

  const normalizedProvider = (provider || 'auto').toLowerCase();
  const normalizedModel = (model || 'auto').toLowerCase();

  if (normalizedProvider === 'auto' || normalizedProvider === 'hybrid') {
    // HYBRID AUTO: Fast Groq LPU first, then OpenRouter free vision pool
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
    // Cross-provider backup to OpenRouter FREE tier if Groq is out of capacity
    if (hasOR) {
      candidates.push(...VISION_CANDIDATE_POOLS.openrouter);
    }
  } else if (normalizedProvider === 'openrouter') {
    if (hasOR) {
      if (normalizedModel !== 'auto') {
        // Enforce :free requirement
        const safeModel = normalizedModel.endsWith(':free') || normalizedModel === 'openrouter/free'
          ? model
          : `${model}:free`;
        const found = VISION_CANDIDATE_POOLS.openrouter.find(c => c.model === safeModel || c.model === model);
        if (found) {
          candidates.push(found);
        } else if (safeModel.endsWith(':free')) {
          candidates.push({
            provider: 'openrouter',
            model: safeModel,
            name: `OpenRouter (${safeModel})`,
            tier: 'custom_free',
            freeTier: true,
            supportsVision: true
          });
        }
      }
      VISION_CANDIDATE_POOLS.openrouter.forEach(c => {
        if (!candidates.some(existing => existing.model === c.model)) candidates.push(c);
      });
    }
    // Cross-provider backup to Groq FREE LPU if OpenRouter is exhausted
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
 * Common Turkish lexicon for dictionary-assisted word segmentation
 */
const TURKISH_LEXICON = new Set([
  'insan', 'insanlar', 'insanın', 'insana', 'insanda', 'insandan',
  'yol', 'yola', 'yolun', 'yolda', 'yoldan', 'yollar', 'yollarda',
  'yürüyor', 'yürüyordu', 'yürüdü', 'yürümek', 'yürüdüm', 'yürüdük',
  'kitap', 'kitaplar', 'kitapta', 'kitaptan', 'kitabı', 'kitabın',
  'okumak', 'okuyor', 'okuyordu', 'okudu', 'okudum',
  'güzel', 'güzeldir', 'güzellik',
  'bir', 'bu', 've', 'için', 'ile', 'de', 'da', 'ne', 'gibi', 'çok', 'daha', 'kadar', 'en',
  'ben', 'sen', 'o', 'biz', 'siz', 'onlar', 'bana', 'bunu', 'buna', 'onu', 'ona', 'tüm',
  'baktı', 'baktım', 'dedi', 'sordu', 'sordum', 'gitti', 'geldi', 'gördü', 'gördüm',
  'ev', 'evde', 'eve', 'evden', 'evler', 'kapı', 'kapıda', 'kapıyı', 'kapıdan',
  'çocuk', 'çocuklar', 'kadın', 'adam', 'yaşlı', 'genç', 'küçük', 'büyük',
  'gün', 'gece', 'zaman', 'sabah', 'akşam', 'artık', 'şimdi', 'sonra', 'önce',
  'çünkü', 'fakat', 'ancak', 'belki', 'doğru', 'yanlış', 'nasıl', 'neden', 'niçin',
  'bekledin', 'bekledi', 'beklemek', 'bekliyor', 'bekliyordu', 'mi', 'mı', 'mu', 'mü',
  'diye', 'öyle', 'şöyle', 'böyle', 'orada', 'burada', 'başlangıç', 'bölüm',
  'başladı', 'bitirdi', 'anladı', 'anlattı', 'durdu', 'oturdu', 'kalktı', 'biliyordu', 'bilmiyordu'
]);

function isKnownTurkishWord(word) {
  if (!word) return false;
  const w = word.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i');
  if (TURKISH_LEXICON.has(w)) return true;
  if (w.length < 2) return ['o', 'e', 'a'].includes(w);

  const suffixes = [
    'lardan', 'lerden', 'larında', 'lerinde',
    'lar', 'ler', 'dan', 'den', 'tan', 'ten', 'da', 'de', 'ta', 'te',
    'yordu', 'yordun', 'yordular', 'yor', 'dı', 'di', 'du', 'dü', 'tı', 'ti', 'tu', 'tü',
    'mış', 'miş', 'muş', 'müş', 'sa', 'se', 'ca', 'ce',
    'ım', 'im', 'um', 'üm', 'ın', 'in', 'un', 'ün', 'ı', 'i', 'u', 'ü', 'a', 'e'
  ];
  for (const suf of suffixes) {
    if (w.length > suf.length + 1 && w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      if (TURKISH_LEXICON.has(stem)) return true;
    }
  }
  return false;
}

/**
 * DP word segmentation for continuous letter sequences without spaces
 */
function segmentCompoundLetters(str) {
  if (!str) return null;
  const n = str.length;
  const dp = Array(n + 1).fill(null);
  dp[0] = [];

  for (let i = 0; i < n; i++) {
    if (dp[i] === null) continue;
    for (let j = i + 1; j <= n; j++) {
      const sub = str.slice(i, j);
      if (isKnownTurkishWord(sub)) {
        if (dp[j] === null || dp[i].length + 1 < dp[j].length) {
          dp[j] = [...dp[i], sub];
        }
      }
    }
  }

  if (dp[n] && dp[n].length > 0) {
    return dp[n].join(' ');
  }
  return null;
}

/**
 * Heals OCR or PDF extraction artifacts where words were split letter-by-letter with spaces
 * e.g. "İ n s a n l a r y o l d a y ü r ü y o r d u." -> "İnsanlar yolda yürüyordu."
 * e.g. "— Beni bekledin mi? diye sordu." -> "— Beni bekledin mi? diye sordu."
 */
export function fixSpacedOutLetters(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Normalize all Unicode whitespace variations (NBSP, thin space, zero-width, em/en space) to standard space
  let s = text
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u00AD\u200B\uFEFF]/g, '');

  // 2. Fix spaces around Turkish apostrophes (e.g. "Ahmet ' in" -> "Ahmet'in", "Türkiye ' deki" -> "Türkiye'deki")
  s = s.replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s+(['’])\s*([a-zçğıöşüA-ZÇĞİÖŞÜ])/gu, "$1'$3");
  s = s.replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*(['’])\s+([a-zçğıöşüA-ZÇĞİÖŞÜ])/gu, "$1'$3");

  // 3. Multi-space word separation healing:
  // In PDF/OCR spaced-out text, words are separated by 2 or more spaces (or tabs),
  // while individual letters within a word are separated by a single space.
  // e.g. "b u   b i r   k i t a p t ı r" -> "bu bir kitaptır"
  const multiSpaceRegex = /( {2,}|\t+)/;
  if (multiSpaceRegex.test(s)) {
    const tokens = s.split(multiSpaceRegex);
    const healedTokens = tokens.map(token => {
      if (multiSpaceRegex.test(token)) return ' ';
      const trimmed = token.trim();
      if (!trimmed) return token;

      const parts = trimmed.split(/ +/);
      if (parts.length >= 2) {
        const singleCharParts = parts.filter(p => p.length === 1 && /^[a-zçğıöşüA-ZÇĞİÖŞÜ0-9.,!?;:'"()—–-]$/i.test(p));
        const ratio = singleCharParts.length / parts.length;
        if (ratio >= 0.7 && parts.every(p => p.length <= 2)) {
          const combined = parts.join('');
          if (/^[IVXLCDM]+$/i.test(combined)) return trimmed;
          return parts.reduce((acc, curr) => {
            if (!acc) return curr;
            if (/^[.,!?;:)”’"»]/.test(curr)) return acc + curr;
            if (/^[“‘(«]/.test(acc.slice(-1))) return acc + curr;
            return acc + curr;
          }, '');
        }
      }
      return token;
    });
    s = healedTokens.join('');
  }

  // 4. In-sentence healing for letter-by-letter spaced sequences:
  // e.g. "İ n s a n l a r y o l d a y ü r ü y o r d u"
  s = s.replace(
    /(?:^|(?<=[\s"“«(—–]))([a-zçğıöşüA-ZÇĞİÖŞÜ](?: [a-zçğıöşüA-ZÇĞİÖŞÜ])+)(?=[\s"”»).,!?;:—–]|$)/giu,
    (match) => {
      const stripped = match.replace(/ /g, '');
      if (/^[IVXLCDM]+$/.test(stripped)) {
        return match;
      }
      // If sequence contains 4 or more single letters, check Turkish dictionary segmentation first!
      if (match.split(' ').length >= 4) {
        const segmented = segmentCompoundLetters(stripped);
        if (segmented) return segmented;
      }
      return stripped;
    }
  );

  // 5. Clean up any leftover duplicate spaces while preserving intentional newlines
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/ (?=\n)/g, '').replace(/(?<=\n) /g, '');

  return s;
}

/**
 * Linguistic & Morpheme Healing Engine for Turkish Book OCR
 * Resolves split suffixes, letter artifacts, merged compounds, and OCR glyph confusions:
 * e.g. "bir başkası n yaşamı nı anlatı yor" -> "bir başkasının yaşamını anlatıyor"
 * e.g. "tutarsı z bulduğum da" -> "tutarsız bulduğumda"
 * e.g. "b_ana" -> "bana"
 * e.g. "şaşkı nlık ları" -> "şaşkınlıkları"
 * e.g. "gelgitlerhakkı nda" -> "gelgitler hakkında"
 * e.g. "görmüş türri" -> "görmüştüm"
 */
export function healTurkishOcrArtifacts(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text;

  // 1. Remove stray OCR artifacts inside words:
  // e.g. "b_ana" -> "bana", "k_itap" -> "kitap", "g|eldi" -> "geldi", "s~öz" -> "söz"
  s = s.replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ0-9])[_|~`^]([a-zçğıöşüA-ZÇĞİÖŞÜ0-9])/gu, '$1$2');

  // 2. Fix OCR visual confusion of 'm' misrecognized as 'ri', 'rri', 'rn':
  // e.g. "görmüş türri" -> "görmüştüm", "yapmış tırri" -> "yapmıştım", "gitmiş tirri" -> "gitmiştim"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]+(?:mış|miş|muş|müş))\s+t([ıituü])(?:rri|rn|ri)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2t$3m'
  );

  // 3. Fix split past perfect verbs with separate 'tüm/tım/tim/tum':
  // e.g. "görmüş tüm" -> "görmüştüm", "yapmış tım" -> "yapmıştım"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]+(?:mış|miş|muş|müş))\s+(t[ıituü]m)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // 4. Bound suffix reconnection:
  // a) Single letter non-words: 'z' (from -sız/-siz)
  // e.g. "tutarsı z" -> "tutarsız", "anlamsı z" -> "anlamsız", "sessı z" -> "sessiz"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]+[sş][ıiuü])\s+z(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2z'
  );

  // b) "başkası n" -> "başkasının" or "başkasın"
  s = s.replace(
    /(^|[^\p{L}\p{N}])başkası\s+n\s+(?=[a-zçğıöşüA-ZÇĞİÖŞÜ]+)/giu,
    '$1başkasının '
  );
  s = s.replace(
    /(^|[^\p{L}\p{N}])başkası\s+n(?=[^\p{L}\p{N}]|$)/giu,
    '$1başkasın'
  );

  // c) Suffixes "-nı", "-ni", "-nu", "-nü":
  // In Turkish, 'nı', 'ni', 'nu', 'nü' are never standalone words (always accusative/possessive suffixes)
  // e.g. "yaşamı nı" -> "yaşamını", "kapısı nı" -> "kapısını", "yolu nu" -> "yolunu"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{2,}[ıiuüa-e])\s+(n[ıiuü])(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // d) Continuous verb suffix "-yor", "-yordu", "-yordun", "-yormuş":
  // In Turkish, 'yor' is never a standalone word (always verb suffix -ıyor/-iyor)
  // e.g. "anlatı yor" -> "anlatıyor", "bakı yor" -> "bakıyor", "görü yor" -> "görüyor", "geli yor" -> "geliyor"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{2,}[ıiuüa-e])\s+(yor(?:du[kmn]?|muş|lar)?)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // e) Suffixes "-nlık", "-nlik", "-nluk", "-nlük":
  // In Turkish, 'nlık' is never a standalone word
  // e.g. "şaşkı nlık" -> "şaşkınlık", "yalnı zlık" -> "yalnızlık"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{2,}[ıiuü])\s+(nl[ıiuü]k)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // f) Attached plural suffix after '-lık/-lik':
  // e.g. "şaşkınlık ları" -> "şaşkınlıkları", "hastalık ları" -> "hastalıkları"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{2,}l[ıiuü]k)\s+(lar[ıi]|ler[ıi])(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // g) Suffix "-nda", "-nde", "-ndan", "-nden":
  // In Turkish, 'nda' / 'nde' is never a standalone word
  // e.g. "hakkı nda" -> "hakkında", "arasında", "yanında"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{2,}[ıiuüa-e])\s+(nd[ae][nm]?)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // h) Participle locative "-duğum da", "-diğim de", "-dığında":
  // e.g. "bulduğum da" -> "bulduğumda", "gördüğüm de" -> "gördüğümde", "baktığım da" -> "baktığımda"
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]+(?:d[ıiuü][kğ][ıiuü]m|d[ıiuü][kğ][ıiuü]n|d[ıiuü][kğ][ıiuü]|d[ıiuü][kğ][ıiuü]m[ıiuü]z|d[ıiuü][kğ][ıiuü]n[ıiuü]z))\s+(d[ae])(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2$3'
  );

  // 5. Separate erroneously merged compound words:
  // e.g. "gelgitlerhakkı" or "gelgitlerhakkında" -> "gelgitler hakkında"
  // When a full plural noun ending in '-ler' / '-lar' is followed by a known noun root without space
  s = s.replace(
    /(^|[^\p{L}\p{N}])([a-zçğıöşüA-ZÇĞİÖŞÜ]{3,}(?:ler|lar))(hakkı(?:nda)?|için|ile|gibi|kadar|sonra|önce|ve|diye)(?=[^\p{L}\p{N}]|$)/giu,
    '$1$2 $3'
  );

  // 6. Safe healing for digit '1' misrecognized as dotless 'ı' or 'i' inside words:
  // e.g. "yay1mlanan" -> "yayımlanan", "k1tap" -> "kitap", "b1r" -> "bir"
  // Strictly preserves standalone numbers ("1946", "11", "1.", "1'inci", etc.)
  s = s.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ])1([a-zçğıöşüA-ZÇĞİÖŞÜ])/gu,
    (match, before, after) => {
      const matchIndex = s.indexOf(match);
      const precedingText = s.slice(Math.max(0, matchIndex - 12), matchIndex + 1);
      const vowels = precedingText.match(/[aıoueiöüAIOUEİÖÜ]/gu);
      const lastVowel = vowels ? vowels[vowels.length - 1].toLowerCase() : '';
      const isFrontVowel = ['e', 'i', 'ö', 'ü'].includes(lastVowel);
      return `${before}${isFrontVowel ? 'i' : 'ı'}${after}`;
    }
  );

  // 7. Safe healing for double 'ii' OCR confusion for 'ü' (umlaut dots read as 'ii'):
  // e.g. "Ziilfii" -> "Zülfü", "miizik" -> "müzik", "siirgiinde" -> "sürgünde", "tiim" -> "tüm"
  s = s.replace(/(^|[^\p{L}\p{N}])([zZ])iilf(ii|u|ü)?(?=[^\p{L}\p{N}]|$)/gu, '$1$2ülfü');
  s = s.replace(/(^|[^\p{L}\p{N}])m[iı]{2}z[iı]k([a-zçğıöşü]*)/giu, '$1müzik$2');
  s = s.replace(/(^|[^\p{L}\p{N}])s[iı]{2}rg[iı]{2}n([a-zçğıöşü]*)/giu, '$1sürgün$2');
  s = s.replace(/(^|[^\p{L}\p{N}])([tT])[iı]{2}m(?=[^\p{L}\p{N}]|$)/gu, '$1$2üm');
  s = s.replace(/(^|[^\p{L}\p{N}])([gG])[iı]{2}z(el|ellik)([a-zçğıöşü]*)/giu, '$1$2üz$3$4');
  s = s.replace(/(^|[^\p{L}\p{N}])([bB])[iı]{2}y([uü]k)([a-zçğıöşü]*)/giu, '$1$2üy$3$4');
  s = s.replace(/(^|[^\p{L}\p{N}])([kK])[iı]{2}ç([uü]k)([a-zçğıöşü]*)/giu, '$1$2üç$3$4');
  s = s.replace(/(^|[^\p{L}\p{N}])([gG])[iı]{2}ç(l[uü]|s[uü]z)?(?=[^\p{L}\p{N}]|$)/giu, '$1$2üç$3');
  s = s.replace(/(^|[^\p{L}\p{N}])([dD])[iı]{2}ş([uü]n)([a-zçğıöşü]*)/giu, '$1$2üş$3$4');
  s = s.replace(/(^|[^\p{L}\p{N}])([gG])[iı]{2}r(d[uü]|m[uü]ş|en)([a-zçğıöşü]*)/giu, '$1$2ür$3$4');
  s = s.replace(/(^|[^\p{L}\p{N}])([yY])[iı]{2}r([uü]y)([a-zçğıöşü]*)/giu, '$1$2ür$3$4');

  // 8. Safe contextual fix for OCR dropped breve on "doğdu":
  // e.g. "1946 yılında dogdu" -> "1946 yılında doğdu"
  s = s.replace(/(^|[^\p{L}\p{N}])([dD])ogdu(k|m|n|lar)?(?=[^\p{L}\p{N}]|$)/gu, '$1$2oğdu$3');

  // 9. Common Turkish proper nouns and cities with lost diacritics:
  // e.g. "Omer Zülfü" -> "Ömer Zülfü", "Omer Ziilfii" -> "Ömer Zülfü"
  s = s.replace(/(^|[^\p{L}\p{N}])Omer(?=\s+[Zz][üi]lf[üi]|\s+Seyfettin|\s+Livaneli)/gu, '$1Ömer');
  s = s.replace(/(^|[^\p{L}\p{N}])Ispanya(['’][a-zçğıöşü]+)?(?=[^\p{L}\p{N}]|$)/gu, '$1İspanya$2');
  s = s.replace(/(^|[^\p{L}\p{N}])Italya(['’][a-zçğıöşü]+)?(?=[^\p{L}\p{N}]|$)/gu, '$1İtalya$2');
  s = s.replace(/(^|[^\p{L}\p{N}])Izmir(['’][a-zçğıöşü]+)?(?=[^\p{L}\p{N}]|$)/gu, '$1İzmir$2');
  s = s.replace(/(^|[^\p{L}\p{N}])En\s+Iyi(?=[^\p{L}\p{N}]|$)/gu, '$1En İyi');

  // 10. Split words due to line breaks where the hyphen was lost/converted to space:
  // e.g. "Stock holm'de" -> "Stockholm'de", "Meh ta" -> "Mehta", "Bal kan" -> "Balkan"
  // "Ya zar" -> "Yazar", "ötü rü" -> "ötürü", "ede biyat" -> "edebiyat", "mille tvekili" -> "milletvekili"
  s = s.replace(/(^|[^\p{L}\p{N}])Stock\s+holm(['’][a-zçğıöşü]+)?(?=[^\p{L}\p{N}]|$)/giu, '$1Stockholm$2');
  s = s.replace(/(^|[^\p{L}\p{N}])(Zubin\s+)?Meh\s+ta(?=[^\p{L}\p{N}]|$)/giu, '$1$2Mehta');
  s = s.replace(/(^|[^\p{L}\p{N}])Bal\s+kan(?=[^\p{L}\p{N}]|$)/giu, '$1Balkan');
  s = s.replace(/(^|[^\p{L}\p{N}])(Büyük\s+)?Ya\s+zar(?=[^\p{L}\p{N}]|$)/giu, '$1$2Yazar');
  s = s.replace(/(^|[^\p{L}\p{N}])ötü\s+rü(?=[^\p{L}\p{N}]|$)/giu, '$1ötürü');
  s = s.replace(/(^|[^\p{L}\p{N}])ede\s+biyat(?=[^\p{L}\p{N}]|$)/giu, '$1edebiyat');
  s = s.replace(/(^|[^\p{L}\p{N}])mille\s+tvekil(i|liği|lik)?(?=[^\p{L}\p{N}]|$)/giu, '$1milletvekil$2');

  return s;
}

/**
 * Normalizes text and cleanly merges words split by end-of-line hyphens (matbaa heceleme çizgisi).
 * Preserves true dialogue dashes (—) and proper hyphenated compounds (Türk-İslam, 1923-1938).
 */
export function normalizeHyphensAndText(text, options = {}) {
  if (!text || typeof text !== 'string') return '';
  const mergeHyphens = options.mergeHyphens !== false;

  let cleaned = text
    .replace(/[\u00AD\u200B\uFEFF]/g, '')
    .replace(/\r\n/g, '\n');

  if (mergeHyphens) {
    // 1. Satır sonu hece bölme tireleri: "kelime-\nhece" -> "kelimehece"
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)(['’]?)[-–—]\s*\n+\s*[-–—]?\s*([a-zçğıöşü])/gu,
      (match, word, apostrophe, nextLetter) => `${word}${apostrophe || ''}${nextLetter}`
    );

    // 2. Özel isim kesme işareti ile satır sonu: "Ahmet'-\nte" -> "Ahmet'te"
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)['’][-–—]\s*\n+\s*([a-zçğıöşü])/gu,
      "$1'$2"
    );
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*\n+\s*['’][-–—]?\s*([a-zçğıöşü])/gu,
      "$1'$2"
    );

    // 3. OCR / PDF'te tire alt satırın başına kaymışsa: "kapı\n-sından" -> "kapısından"
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*\n+\s*[-–—]([a-zçğıöşü]+)/gu,
      '$1$2'
    );

    // 4. Hece bölme tiresi ardında boşluk olan durumlar (OCR satır birleştirmesi):
    // e.g. "Stock- holm'de" -> "Stockholm'de", "Meh- ta" -> "Mehta", "Bal- kan" -> "Balkan", "Ya- zar" -> "Yazar", "ötü- rü" -> "ötürü"
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s*[-–]\s+([a-zçğıöşü]+(?:['’][a-zçğıöşü]+)?)/gu,
      '$1$2'
    );

    // 5. Aynı satırda OCR hece bölünmesi (Yalnızca ASCII tire '-' ve doğrulanmış Türkçe ekler için!)
    // Asla diyalog veya parantez em-dash (—) ya da en-dash (–) tirelerine dokunulmaz!
    const TURKISH_BOUND_SUFFIXES = /^(sinden|sinde|sından|sında|lerine|lerinde|lerinden|lerini|larına|larında|larından|larını|leriyle|larıyla|lerin|ların|deki|daki|lerle|larla|dendir|dandır|miştir|mıştır|ecektir|acaktır|dıkça|dikçe|liğine|lığına|likten|lıktan)$/i;

    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)(['’]?)-\s+([a-zçğıöşü]{3,})/gu,
      (match, word, apostrophe, suffix) => {
        if (TURKISH_BOUND_SUFFIXES.test(suffix)) {
          return `${word}${apostrophe || ''}${suffix}`;
        }
        return match;
      }
    );
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)\s+-([a-zçğıöşü]{3,})/gu,
      (match, word, suffix) => {
        if (TURKISH_BOUND_SUFFIXES.test(suffix)) {
          return `${word}${suffix}`;
        }
        return match;
      }
    );

    // 6. Satır sonundaki gerçek bileşik kelimeler (örn: "Ankara-\nİstanbul" -> "Ankara-İstanbul")
    cleaned = cleaned.replace(
      /([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)[-–—]\s*\n+\s*([A-ZÇĞİÖŞÜ0-9][a-zçğıöşüA-ZÇĞİÖŞÜ0-9]*)/gu,
      '$1-$2'
    );
  }

  // 7. Harf harf ayrılmış kelimelerdeki yapay boşlukları birleştir
  cleaned = fixSpacedOutLetters(cleaned);

  // 8. Türkçe morfolojik ek ve OCR harf ayrışma hatalarını iyileştir
  cleaned = healTurkishOcrArtifacts(cleaned);

  return cleaned;
}

/**
 * Merges paragraphs and lines that were accidentally split mid-sentence or mid-word
 * due to PDF extraction leading thresholds or line-wrap hyphens.
 */
export function mergeAccidentalParagraphSplits(blocks) {
  if (!blocks || !blocks.length) return [];
  const merged = [];

  function isDialogueTurn(s) {
    if (!s) return false;
    const str = s.trim();
    if (/^[—–―]\s*[A-ZÇĞİÖŞÜ0-9"“«]/.test(str)) return true;
    if (/^-\s+[A-ZÇĞİÖŞÜ0-9"“«]/.test(str)) return true;
    if (/^[“"«][A-ZÇĞİÖŞÜ0-9—–]/.test(str)) return true;
    return false;
  }

  for (let i = 0; i < blocks.length; i++) {
    const rawBlock = typeof blocks[i] === 'string' ? blocks[i].trim() : '';
    if (!rawBlock) continue;

    if (merged.length === 0) {
      merged.push(rawBlock);
      continue;
    }

    const prevIdx = merged.length - 1;
    const prev = merged[prevIdx].trim();
    const curr = rawBlock;

    const prevEndsWithHyphen = /[-–—]$/.test(prev);
    const prevEndsWithSentencePunct = /[.!?…]["”»]?$/.test(prev);
    const currIsDialogue = isDialogueTurn(curr);
    const currStartsLower = /^[a-zçğıöşü]/u.test(curr);

    const shouldMerge = prevEndsWithHyphen || (!prevEndsWithSentencePunct && !currIsDialogue) || currStartsLower;

    if (shouldMerge) {
      if (prevEndsWithHyphen) {
        const base = prev.replace(/[-–—]+$/, '');
        if (currStartsLower) {
          const firstWordMatch = curr.match(/^([a-zçğıöşüA-ZÇĞİÖŞÜ0-9']+)(.*)$/su);
          if (firstWordMatch) {
            merged[prevIdx] = base + firstWordMatch[1] + firstWordMatch[2];
          } else {
            merged[prevIdx] = base + curr;
          }
        } else {
          merged[prevIdx] = base + '-' + curr;
        }
      } else {
        merged[prevIdx] = prev + ' ' + curr;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Professional Book OCR System Prompt
 * Strictly enforces book structure, dialogue dashes, punctuation, and Turkish characters.
 */
export const BOOK_OCR_SYSTEM_PROMPT = `You are a professional book OCR and transcription system.

Transcribe the text in the provided book page image as accurately as possible. The source may be a printed book, a scanned page, or a photograph of a page.

STRICT RULES:

1. Preserve the exact words, spelling, punctuation, capitalization, and original language.
2. Never insert spaces between individual letters or suffixes of a word. For example, 'k i t a p' must be 'kitap'; 'tutarsız' must never be 'tutarsı z'; 'yaşamını' must never be 'yaşamı nı'; 'anlatıyor' must never be 'anlatı yor'; 'şaşkınlıkları' must never be 'şaşkı nlık ları'.
3. Preserve correct word boundaries. Do not merge separate words (e.g. 'gelgitler hakkında', not 'gelgitlerhakkı nda') and do not split one word into multiple words.
4. Preserve the original paragraph boundaries and reading order.
5. Preserve dialogue formatting. Keep dialogue dashes such as '—' or '–' when they appear in the source. Do not replace them with hyphens or remove them.
6. Start a new paragraph when a new speaker begins, if the source formatting indicates a new paragraph.
7. Preserve quotation marks, apostrophes, ellipses, commas, periods, question marks, exclamation marks, and other visible punctuation.
8. Preserve all language-specific characters, including Turkish letters: ç, ğ, ı, İ, ö, ş, ü.
9. Do not translate, paraphrase, summarize, rewrite, modernize, or stylistically improve the text.
10. Do not invent missing words or infer text that cannot be read confidently.
11. If a word or passage is genuinely unreadable, mark only that part as [OKUNAMADI].
12. Do not include explanations, headings, introductions, Markdown formatting, or comments that are not present in the source.
13. Do not add page numbers unless they are part of the actual page text.
14. Do not remove repeated words or unusual grammatical constructions merely because they seem incorrect.
15. Handle line breaks carefully. A line ending caused by page layout is not automatically a paragraph break. Rejoin words split by a printed line-end hyphen only when the original word can be determined confidently.
16. Preserve chapter headings, section headings, indents where representable, and other meaningful book structure.
17. Do not insert stray underscores or scan artifacts inside words (e.g. write 'bana', not 'b_ana'). Carefully distinguish 'm' from 'ri' or 'rn' (e.g. write 'görmüştüm', not 'görmüş türri').
18. If the page is blank, has no readable text, or contains only illustrations, graphics, or cover art without book text, output ONLY: [SAYFADA METİN YOK]. Never invent stories, conversations, or text from memory.
19. Never carry over or blend text from previously processed pages or other books. Every page image must be transcribed in absolute isolation based solely on visible pixels.
20. Output only the transcribed text.

ACCURACY PRIORITY:
Correct word recognition and faithful reproduction of the original text are more important than producing elegant or fluent prose.`;

/**
 * Second-stage Book OCR Proofreading Prompt
 */
export const BOOK_OCR_PROOFREADER_SYSTEM_PROMPT = `You are a meticulous book OCR proofreader.

Compare the original page image with the OCR transcription. Correct only errors that are demonstrably supported by the image.

Focus on:
- Erroneously split Turkish suffixes and letters (e.g. 'tutarsı z' -> 'tutarsız', 'yaşamı nı' -> 'yaşamını', 'anlatı yor' -> 'anlatıyor', 'şaşkı nlık ları' -> 'şaşkınlıkları', 'hakkı nda' -> 'hakkında').
- Stray scan artifacts or underscores inside words (e.g. 'b_ana' -> 'bana').
- Confused 'm' vs 'ri'/'rri'/'rn' glyphs (e.g. 'görmüş türri' -> 'görmüştüm').
- Accidentally merged words (e.g. 'gelgitlerhakkı nda' -> 'gelgitler hakkında').
- Missing or misplaced dialogue dashes ('—' or '–').
- Incorrect paragraph boundaries and reading order.
- Misrecognized Turkish characters (ç, ğ, ı, İ, ö, ş, ü).
- Missing or duplicated punctuation.
- Words incorrectly split at line endings.

Do not paraphrase or rewrite the author's text. Do not improve grammar or style. Do not guess unreadable words. Preserve all correctly transcribed text.

Return only the corrected transcription.`;

/**
 * Checks if OCR output has suspicious quality markers that justify a targeted 2nd pass proofreading
 */
export function isSuspiciousOcrText(text) {
  if (!text || typeof text !== 'string') return false;
  // 1. Unreadable markers
  if (text.includes('[OKUNAMADI]')) return true;
  // 2. Contains sequences of single letters separated by space
  if (/(?:^|\s)[a-zçğıöşüA-ZÇĞİÖŞÜ]\s[a-zçğıöşüA-ZÇĞİÖŞÜ]\s[a-zçğıöşüA-ZÇĞİÖŞÜ]/iu.test(text)) return true;
  // 3. Repeated unknown glyphs or underscores inside words
  if (/\?{3,}|\[\?+\]|([a-zçğıöşüA-ZÇĞİÖŞÜ])_[a-zçğıöşüA-ZÇĞİÖŞÜ]/iu.test(text)) return true;
  // 4. Split suffixes after Turkish vowels: e.g. "ı z", "ı nı", "ı yor", "ı nda"
  if (/[ıiuü]\s+(?:z|nı|ni|nu|nü|yor|nda|nde|nlık|nlik)\b/iu.test(text)) return true;
  return false;
}

/**
 * User-friendly Turkish error message formatter for all OCR failure modes
 */
export function formatOcrErrorMessage(err) {
  const msg = err?.message || String(err || '');

  if (err?.name === 'AbortError' || msg.includes('durduruldu') || msg.includes('iptal')) {
    return 'İşlem durduruldu.';
  }

  // 1. Paid model / billing attempt block
  if (msg.includes('402') || msg.includes('Payment Required') || msg.includes('unavailable for free') || msg.includes('paid version') || msg.includes('ücretli')) {
    return 'Seçilen model ücretsiz kullanım sınırında değil veya ücret gerektiriyor. ReaWid güvenlik politikası gereği ücretli modele izinsiz geçiş engellendi. Lütfen Ayarlar\'dan ücretsiz bir model seçin.';
  }

  // 2. Free quota / Rate limit
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('ResourceExhausted')) {
    return 'Ücretsiz API kotası veya anlık hız sınırı doldu. Bir süre bekleyip tekrar deneyin veya Ayarlar\'dan diğer ücretsiz sağlayıcıyı seçin.';
  }

  // 3. Invalid API key / Auth
  if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Unauthorized') || msg.includes('User not found')) {
    return 'API anahtarı geçersiz veya eksik. Lütfen Ayarlar bölümünden geçerli bir API anahtarı girin.';
  }

  // 4. Model not found or unavailable
  if (msg.includes('404') || msg.includes('model_not_found') || msg.includes('does not exist')) {
    return 'Belirtilen ücretsiz model şu anda sağlayıcı üzerinde erişilemiyor. Lütfen Ayarlar\'dan alternatif bir model seçin.';
  }

  // 5. Vision / Image not supported
  if (msg.includes('not supported') && (msg.includes('image') || msg.includes('vision') || msg.includes('modality'))) {
    return 'Seçilen model görsel girdi (Vision) desteklemiyor. Lütfen görsel girdi destekleyen bir model seçin.';
  }

  // 6. Timeout
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('Zaman aşımı')) {
    return 'İstek zaman aşımına uğradı. Sunucu yanıt vermedi, lütfen bağlantınızı kontrol edip tekrar deneyin.';
  }

  // 7. Network / Offline
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Ağ bağlantı') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'İnternet bağlantısı kesildi. Lütfen ağ bağlantınızı kontrol edin.';
  }

  // 8. Empty OCR
  if (msg.includes('boş metin') || msg.includes('empty')) {
    return 'Görselden okunabilir bir metin çıkarılamadı. Sayfa boş veya taranan görsel çok karanlık/bulanık olabilir.';
  }

  return `OCR Hatası: ${msg}`;
}

/**
 * Perform OCR with dynamic model routing, intelligent auto-failover, and targeted proofreading.
 * Strictly operates on FREE models.
 */
export async function performOcr({
  imageBase64, // 'data:image/jpeg;base64,...'
  provider = 'auto',
  apiKey,
  groqApiKey,
  openrouterApiKey,
  model = 'auto',
  documentId = 'single_doc',
  pageNumber = 1,
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

  const systemPrompt = BOOK_OCR_SYSTEM_PROMPT;

  // Normalize base64 data URL
  let imageUrl = imageBase64;
  if (!imageUrl.startsWith('data:')) {
    imageUrl = `data:image/jpeg;base64,${imageUrl}`;
  }

  const userPrompt = "Transcribe the text in the provided book page image strictly following all the rules. Output only the transcribed text.";

  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateKey = `${candidate.provider}:${candidate.model}`;
    const candApiKey = candidate.provider === 'groq' ? actualGroqKey : actualORKey;

    if (!candApiKey || !candApiKey.trim()) continue;

    if (signal?.aborted) {
      throw new DOMException('OCR işlemi kullanıcı tarafından durduruldu', 'AbortError');
    }

    const candStartTime = Date.now();

    try {
      console.info(`[AI Router] Deneniyor: ${candidate.name} (Ücretsiz Model) | Belge: ${documentId} | Sayfa: ${pageNumber}...`);
      let resultText = '';

      if (candidate.provider === 'groq') {
        resultText = await callGroqVision({
          apiKey: candApiKey,
          model: candidate.model,
          systemPrompt,
          userPrompt,
          imageUrl,
          temperature: options.temperature ?? 0.05,
          signal
        });
      } else {
        resultText = await callOpenRouterVision({
          apiKey: candApiKey,
          model: candidate.model,
          systemPrompt,
          userPrompt,
          imageUrl,
          temperature: options.temperature ?? 0.05,
          signal
        });
      }

      if (!resultText || resultText.trim().length === 0) {
        throw new Error('Modelden boş metin yanıtı döndü');
      }

      const elapsedMs = Date.now() - candStartTime;

      // Success! Clear cooldown for this candidate
      congestedModels.delete(candidateKey);

      // Record successful OCR audit log
      recordOcrAudit({
        documentId,
        pageNumber,
        provider: candidate.provider,
        model: candidate.model,
        durationMs: elapsedMs,
        status: 'success',
        charCount: resultText.length
      });

      if (onModelSuccess) {
        onModelSuccess({
          model: candidate.model,
          provider: candidate.provider,
          name: candidate.name,
          documentId,
          pageNumber,
          durationMs: elapsedMs
        });
      }

      // Handle blank page detection immediately without running linguistic healing
      if (resultText.trim() === '[SAYFADA METİN YOK]') {
        const verifiableResult = new String('[SAYFADA METİN YOK]');
        verifiableResult.text = '[SAYFADA METİN YOK]';
        verifiableResult.rawText = '[SAYFADA METİN YOK]';
        verifiableResult.cleanedText = '[SAYFADA METİN YOK]';
        verifiableResult.isBlank = true;
        verifiableResult.documentId = String(documentId || 'single_doc');
        verifiableResult.pageNumber = Number(pageNumber) || 1;
        verifiableResult.provider = candidate.provider;
        verifiableResult.model = candidate.model;
        verifiableResult.selectedModel = model;
        verifiableResult.actualModel = candidate.model;
        verifiableResult.durationMs = elapsedMs;
        return verifiableResult;
      }

      // Targeted Stage 2: Proofreading if suspicious artifacts are detected
      const shouldProofread = options.enableProofreading === true ||
        (options.autoProofread !== false && isSuspiciousOcrText(resultText));

      if (shouldProofread && !signal?.aborted) {
        try {
          console.info(`[AI Proofreader] Şüpheli sayfa yapısı tespit edildi, 2. aşama kontrolü yapılıyor (${candidate.name})...`);
          const proofreadUserPrompt = `ORIGINAL OCR TRANSCRIPTION:\n${resultText}\n\nINSTRUCTION: Compare the original book page image with this transcription. Correct any OCR mistakes according to the rules. Return only the final corrected transcription.`;

          let corrected = '';
          if (candidate.provider === 'groq') {
            corrected = await callGroqVision({
              apiKey: candApiKey,
              model: candidate.model,
              systemPrompt: BOOK_OCR_PROOFREADER_SYSTEM_PROMPT,
              userPrompt: proofreadUserPrompt,
              imageUrl,
              temperature: 0.05,
              signal
            });
          } else {
            corrected = await callOpenRouterVision({
              apiKey: candApiKey,
              model: candidate.model,
              systemPrompt: BOOK_OCR_PROOFREADER_SYSTEM_PROMPT,
              userPrompt: proofreadUserPrompt,
              imageUrl,
              temperature: 0.05,
              signal
            });
          }

          if (corrected && corrected.trim().length > 0) {
            // Strict validation: Do not overwrite if second stage text is severely truncated or hallucinating
            const origLen = resultText.length;
            const corrLen = corrected.trim().length;
            const ratio = corrLen / Math.max(1, origLen);
            if (ratio >= 0.70 && ratio <= 1.30) {
              console.info(`[AI Proofreader] 2. aşama düzeltmesi başarıyla uygulandı (${origLen} -> ${corrLen} kr).`);
              resultText = corrected.trim();
            } else {
              console.warn(`[AI Proofreader] 2. aşama çıktısı şüpheli oranda farklı (${origLen} -> ${corrLen} kr, oran: ${ratio.toFixed(2)}), orijinal metin korundu.`);
            }
          }
        } catch (proofErr) {
          console.warn('[AI Proofreader] İkinci aşama kontrolü atlandı (hata koruması):', proofErr.message);
        }
      }

      // Preserve pristine raw AI output before post-processing
      const rawAiOutput = resultText;

      // Metin temizleme: Harf boşluklarını ve tireleri güvenli biçimde normalize et
      const cleanedText = normalizeHyphensAndText(rawAiOutput, {
        mergeHyphens: options.mergeHyphenatedWords !== false
      });

      // Calculate Character Error Rate between raw and cleaned text
      const cleanCer = calculateCer(rawAiOutput, cleanedText);
      if (cleanCer > 0.15) {
        console.warn(`[AI OCR Clean Warning] Sayfa ${pageNumber}: Temizleme işlemi metni %${(cleanCer * 100).toFixed(1)} oranında değiştirdi. Ham çıktı güvenceye alındı.`);
      }

      // Attach verification metadata and raw text to returned string instance for application-side validation
      const verifiableResult = new String(cleanedText);
      verifiableResult.text = cleanedText;
      verifiableResult.rawText = rawAiOutput;
      verifiableResult.cleanedText = cleanedText;
      verifiableResult.cleanCer = cleanCer;
      verifiableResult.hasModifications = (rawAiOutput !== cleanedText);
      verifiableResult.documentId = String(documentId || 'single_doc');
      verifiableResult.pageNumber = Number(pageNumber) || 1;
      verifiableResult.provider = candidate.provider;
      verifiableResult.model = candidate.model;
      verifiableResult.selectedModel = model;
      verifiableResult.actualModel = candidate.model;
      verifiableResult.durationMs = elapsedMs;

      return verifiableResult;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        throw err;
      }

      lastError = err;
      const elapsedMs = Date.now() - candStartTime;
      const isRateLimitOrOverload = 
        err.message?.includes('429') ||
        err.message?.includes('rate limit') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('503') ||
        err.message?.includes('502') ||
        err.message?.includes('504') ||
        err.message?.includes('capacity') ||
        err.message?.includes('No provider');

      const nextCandidate = candidates[i + 1];

      // Record audit for failed/failover attempt
      recordOcrAudit({
        documentId,
        pageNumber,
        provider: candidate.provider,
        model: candidate.model,
        durationMs: elapsedMs,
        status: nextCandidate ? 'failover' : 'error',
        error: err.message
      });

      // Put model in temporary circuit breaker cooldown
      markModelCongested(
        candidateKey,
        isRateLimitOrOverload ? 60000 : 30000,
        isRateLimitOrOverload ? '429 Rate Limit / Sunucu Yoğunluğu' : err.message
      );

      if (nextCandidate) {
        console.warn(`[AI Router] [Uyarı] ${candidate.name} yoğun veya hata verdi (${err.message}). Sıradaki ücretsiz model ${nextCandidate.name} deneniyor... (Belge: ${documentId}, Sayfa: ${pageNumber})`);
        if (onModelFallback) {
          onModelFallback({
            from: candidate.name,
            to: nextCandidate.name,
            reason: isRateLimitOrOverload ? 'Sunucu yoğun' : 'Hata oluştu',
            error: err.message,
            documentId,
            pageNumber
          });
        }
      }
    }
  }

  throw new Error(formatOcrErrorMessage(lastError));
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
    const err = new Error(errMsg);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text.trim();
}

/**
 * Call OpenRouter Vision API with strict free-model guarantee
 */
async function callOpenRouterVision({ apiKey, model, systemPrompt, userPrompt, imageUrl, temperature, signal }) {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  // Strict safeguard: Reject any non-free model from being queried
  if (!isModelStrictlyFree('openrouter', model)) {
    throw new Error(`Ücretli model ("${model}") kullanımı güvenlik politikası gereği engellendi. Yalnızca ücretsiz (:free) modeller kullanılır.`);
  }

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
    include_reasoning: false,
    // OpenRouter safeguard: Do NOT allow automatic fallbacks to paid upstream models!
    provider: {
      allow_fallbacks: false
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': typeof window !== 'undefined' ? (window.location.origin || 'https://reawid.app') : 'https://reawid.app',
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
        const rawMsg = errData.error.message;
        if (response.status === 402 || rawMsg.includes('paid version') || rawMsg.includes('unavailable for free')) {
          errMsg = 'Seçilen model ücretsiz olarak kullanılamıyor. Güvenlik politikası gereği ücretli modele izinsiz geçiş engellendi.';
        } else {
          errMsg += `: ${rawMsg}`;
        }
      }
    } catch (_) {
      const errText = await response.text();
      if (errText) errMsg += `: ${errText}`;
    }
    const err = new Error(errMsg);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const choiceMsg = data?.choices?.[0]?.message;
  let text = choiceMsg?.content || '';
  // Fallback if model placed output in reasoning field
  if (!text && choiceMsg?.reasoning) {
    text = choiceMsg.reasoning;
  }
  return text.trim();
}

/**
 * Levenshtein distance metric calculation for Character Error Rate (CER) and Word Error Rate (WER)
 */
export function calculateLevenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculate Character Error Rate (CER)
 */
export function calculateCer(reference, hypothesis) {
  if (!reference && !hypothesis) return 0;
  if (!reference) return 1;
  const refChars = Array.from(reference);
  const hypChars = Array.from(hypothesis);
  const dist = calculateLevenshteinDistance(refChars, hypChars);
  return dist / Math.max(1, refChars.length);
}

/**
 * Calculate Word Error Rate (WER)
 */
export function calculateWer(reference, hypothesis) {
  if (!reference && !hypothesis) return 0;
  if (!reference) return 1;
  const refWords = reference.trim().split(/\s+/).filter(Boolean);
  const hypWords = hypothesis.trim().split(/\s+/).filter(Boolean);
  const dist = calculateLevenshteinDistance(refWords, hypWords);
  return dist / Math.max(1, refWords.length);
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
      const orRes = await testApiConnection('openrouter', orKey, 'qwen/qwen3.8-27b:free');
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
      const testModel = (model && model !== 'auto') ? model : 'qwen/qwen3.8-27b:free';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': typeof window !== 'undefined' ? (window.location.origin || 'https://reawid.app') : 'https://reawid.app',
          'X-Title': 'ReaWid OCR PWA'
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
          provider: { allow_fallbacks: false }
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
    temperature: 0.05
  };

  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? (window.location.origin || 'https://reawid.app') : 'https://reawid.app';
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
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? (window.location.origin || 'https://reawid.app') : 'https://reawid.app';
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
