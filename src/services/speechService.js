// ReaWid Turkish Text-to-Speech (TTS) Service
// Powered by Microsoft Edge Neural Voices (Ahmet & Emel) with seamless Web Speech API offline fallback.
// Solves robotic voice artifacts and eliminates the Chromium 15-second speech freeze bug.

export const AVAILABLE_TTS_VOICES = [
  { id: 'tr-TR-AhmetNeural', name: 'Ahmet (Doğal Erkek)', gender: 'male', desc: 'Derin, sakin, kitap ve roman anlatımına uygun stüdyo tonu' },
  { id: 'tr-TR-EmelNeural', name: 'Emel (Doğal Kadın)', gender: 'female', desc: 'Akıcı, berrak, roman ve makale okumaya uygun stüdyo tonu' }
];

let currentAudio = null;
let currentAudioUrl = null;
let currentUtterance = null;
let activeAbortController = null;
let isFetchingAudio = false;
let reusableAudioEl = null;
let currentAdvanceTimer = null;

const audioBlobCache = new Map();
const MAX_CACHE_SIZE = 40;

function getCacheKey(text, voice, rate) {
  return `${voice}|${rate}|${text}`;
}

function getTtsAudioElement() {
  if (!reusableAudioEl && typeof Audio !== 'undefined') {
    reusableAudioEl = new Audio();
    reusableAudioEl.preload = 'auto';
  }
  return reusableAudioEl;
}

let turkishWebVoices = [];
let voicesLoaded = false;

function loadWebVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  turkishWebVoices = voices.filter(v => v.lang.startsWith('tr') || v.lang.includes('TR'));
  voicesLoaded = true;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadWebVoices();
  window.speechSynthesis.onvoiceschanged = loadWebVoices;
}

export function isTtsSupported() {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || 'speechSynthesis' in window);
}

/**
 * Clean and normalize text before reading aloud
 */
export function cleanTextForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Remove isolated page headers like "16 | Sokak Nöbetçileri"
    .replace(/^\s*\d+\s*[|•-]\s*.*$/gm, '')
    // Remove quote tags or HTML leftovers
    .replace(/<[^>]+>/g, '')
    // Expand abbreviations for natural speech
    .replace(/\bvs\./gi, 've benzeri')
    .replace(/\bvb\./gi, 've benzerleri')
    .replace(/\bDr\./g, 'Doktor')
    .replace(/\bProf\./g, 'Profesör')
    // Remove dialogue dashes at the start of the sentence (prevents leading speech hesitation)
    .replace(/^[—–―-]\s*/, '')
    // Em-dash inside sentence pause normalization
    .replace(/[—–]/g, ', ')
    .trim();
}

/**
 * Pre-fetches neural TTS audio for a sentence in the background.
 * Ensures zero-latency gapless playback between sentences.
 */
export function prefetchSpeech(text, {
  voice = 'tr-TR-AhmetNeural',
  rate = 1.0
} = {}) {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return Promise.resolve(null);

  const key = getCacheKey(cleaned, voice, rate);
  if (audioBlobCache.has(key)) {
    return audioBlobCache.get(key);
  }

  while (audioBlobCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = audioBlobCache.keys().next().value;
    audioBlobCache.delete(oldestKey);
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleaned,
          voice,
          rate
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch (err) {
      audioBlobCache.delete(key);
      return null;
    }
  })();

  audioBlobCache.set(key, promise);
  return promise;
}

/**
 * Speak text using HTML5 Audio streamed from Microsoft Edge Neural TTS
 */
async function speakWithEdgeTts(text, {
  voice = 'tr-TR-AhmetNeural',
  rate = 1.0,
  onStart,
  onEnd,
  onError
} = {}) {
  activeAbortController = new AbortController();
  isFetchingAudio = true;

  const key = getCacheKey(text, voice, rate);
  let blobPromise = audioBlobCache.get(key);
  if (!blobPromise) {
    blobPromise = prefetchSpeech(text, { voice, rate });
  }

  let blob = null;
  try {
    blob = await blobPromise;
  } catch (_) {
    blob = null;
  }

  isFetchingAudio = false;

  if (activeAbortController?.signal?.aborted) return;

  if (!blob) {
    throw new Error('TTS ses verisi alınamadı');
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }

  currentAudioUrl = URL.createObjectURL(blob);
  const audioEl = getTtsAudioElement();
  audioEl.src = currentAudioUrl;
  audioEl.playbackRate = 1.0;
  currentAudio = audioEl;

  if (currentAdvanceTimer) {
    clearTimeout(currentAdvanceTimer);
    currentAdvanceTimer = null;
  }

  let endTriggered = false;
  function triggerEnd() {
    if (endTriggered) return;
    endTriggered = true;
    if (currentAdvanceTimer) {
      clearTimeout(currentAdvanceTimer);
      currentAdvanceTimer = null;
    }
    audioEl.ontimeupdate = null;
    audioEl.onended = null;
    audioEl.onerror = null;
    onEnd?.();
  }

  audioEl.onplay = () => {
    onStart?.();
    // Schedule advance right as the last word completes, trimming the trailing silent MP3 padding
    if (audioEl.duration && audioEl.duration > 0.35) {
      const earlyCutMs = Math.min(180, Math.max(90, Math.round(audioEl.duration * 50)));
      const delay = Math.max(0, (audioEl.duration * 1000) - earlyCutMs);
      if (currentAdvanceTimer) clearTimeout(currentAdvanceTimer);
      currentAdvanceTimer = setTimeout(triggerEnd, delay);
    }
  };

  audioEl.ontimeupdate = () => {
    if (audioEl.duration && audioEl.duration > 0.35) {
      const remaining = audioEl.duration - audioEl.currentTime;
      if (remaining <= 0.12) {
        triggerEnd();
      }
    }
  };

  audioEl.onended = () => {
    triggerEnd();
  };

  audioEl.onerror = (err) => {
    console.warn('[Speech Service] Audio playback error:', err);
    triggerEnd();
    onError?.(err);
  };

  await currentAudio.play();
}

/**
 * Fallback: Speak text using browser Web Speech API with sentence chunking
 * (prevents the infamous Chromium 15-second cutoff bug)
 */
function speakWithWebSpeech(text, {
  voice = 'tr-TR-AhmetNeural',
  rate = 1.0,
  onStart,
  onEnd,
  onError
} = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new Error('Tarayıcınız sesli okumayı desteklemiyor.');
  }

  loadWebVoices();

  // Find best available Turkish voice (prefer Natural/Online/Google/Apple voices)
  let chosenVoice = null;
  const wantFemale = voice === 'tr-TR-EmelNeural';

  if (turkishWebVoices.length > 0) {
    const naturalVoices = turkishWebVoices.filter(v =>
      v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || v.name.includes('Apple')
    );

    if (wantFemale) {
      chosenVoice = naturalVoices.find(v => /emel|kadın|female|yelda/i.test(v.name)) ||
                    turkishWebVoices.find(v => /emel|kadın|female|yelda/i.test(v.name)) ||
                    naturalVoices[0] ||
                    turkishWebVoices[0];
    } else {
      chosenVoice = naturalVoices.find(v => /ahmet|erkek|male|cem/i.test(v.name)) ||
                    turkishWebVoices.find(v => /ahmet|erkek|male|cem/i.test(v.name)) ||
                    naturalVoices[0] ||
                    turkishWebVoices[0];
    }
  }

  // Chunk by sentences to avoid Chromium 15s freeze
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    onEnd?.();
    return;
  }

  let currentIndex = 0;

  function speakNext() {
    if (currentIndex >= sentences.length) {
      stopSpeech();
      onEnd?.();
      return;
    }

    const currentSentence = sentences[currentIndex++];
    const utterance = new SpeechSynthesisUtterance(currentSentence);
    utterance.lang = 'tr-TR';
    utterance.rate = rate;
    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onend = () => {
      speakNext();
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('[Web Speech API Error]:', e);
      onError?.(e);
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  onStart?.();
  speakNext();
}

/**
 * Main public entry point: Speak text with Edge Neural TTS and automatic Web Speech fallback
 */
export async function speakText(text, {
  voice = 'tr-TR-AhmetNeural',
  rate = 1.0,
  onEngineSelected,
  onStart,
  onEnd,
  onError
} = {}) {
  stopSpeech();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  try {
    // 1. Primary: High-fidelity Microsoft Edge Neural Voice
    await speakWithEdgeTts(cleaned, {
      voice,
      rate,
      onStart: () => {
        onEngineSelected?.('edge');
        onStart?.();
      },
      onEnd,
      onError
    });
  } catch (err) {
    console.warn('[Speech Service] Edge TTS kullanılamadı, Web Speech API fallback devreye giriyor:', err.message);
    onEngineSelected?.('fallback', err);
    try {
      // 2. Fallback: Local browser Web Speech API
      speakWithWebSpeech(cleaned, {
        voice,
        rate,
        onStart,
        onEnd,
        onError
      });
    } catch (fallbackErr) {
      console.error('[Speech Service] Tüm TTS motorları başarısız oldu:', fallbackErr);
      onError?.(fallbackErr);
    }
  }
}

export function pauseSpeech() {
  if (currentAdvanceTimer) {
    clearTimeout(currentAdvanceTimer);
    currentAdvanceTimer = null;
  }
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  } else if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech() {
  if (currentAudio && currentAudio.paused) {
    currentAudio.play().catch(() => {});
  } else if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
  }
}

export function stopSpeech() {
  if (currentAdvanceTimer) {
    clearTimeout(currentAdvanceTimer);
    currentAdvanceTimer = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  isFetchingAudio = false;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.ontimeupdate = null;
    currentAudio = null;
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking() {
  if (isFetchingAudio) return true;
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return true;
  return false;
}
