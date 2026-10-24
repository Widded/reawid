// Turkish Text-to-Speech (TTS) Service using Web Speech API

let currentUtterance = null;
let voicesLoaded = false;
let turkishVoices = [];

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  turkishVoices = voices.filter(v => v.lang.startsWith('tr'));
  voicesLoaded = true;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakText(text, { rate = 1.0, onStart, onEnd, onError } = {}) {
  if (!isTtsSupported()) {
    throw new Error('Tarayıcınız sesli okumayı desteklemiyor.');
  }

  stopSpeech();

  if (!text || text.trim() === '') return;

  loadVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  utterance.rate = rate;

  if (turkishVoices.length > 0) {
    utterance.voice = turkishVoices[0];
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function pauseSpeech() {
  if (isTtsSupported() && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech() {
  if (isTtsSupported() && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

export function stopSpeech() {
  if (isTtsSupported()) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking() {
  return isTtsSupported() && window.speechSynthesis.speaking;
}
