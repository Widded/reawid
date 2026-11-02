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
function cleanTextForSpeech(text) {
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
    // Em-dash pause normalization
    .replace(/[—–]/g, ', ')
    .trim();
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

  // Prime an audio instance synchronously in user click gesture context for iOS/Android
  const audioEl = new Audio();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice,
        rate
      }),
      signal: activeAbortController.signal
    });

    if (!res.ok) {
      throw new Error(`TTS sunucu hatası (HTTP ${res.status})`);
    }

    const blob = await res.blob();
    isFetchingAudio = false;

    if (activeAbortController?.signal?.aborted) return;

    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }

    currentAudioUrl = URL.createObjectURL(blob);
    audioEl.src = currentAudioUrl;
    audioEl.playbackRate = 1.0;
    currentAudio = audioEl;

    currentAudio.onplay = () => {
      onStart?.();
    };

    currentAudio.onended = () => {
      stopSpeech();
      onEnd?.();
    };

    currentAudio.onerror = (err) => {
      console.warn('[Speech Service] Audio playback error:', err);
      stopSpeech();
      onError?.(err);
    };

    await currentAudio.play();
  } catch (err) {
    isFetchingAudio = false;
    if (err.name === 'AbortError') return;
    throw err;
  }
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
