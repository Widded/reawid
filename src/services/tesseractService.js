// Tesseract.js Turkish OCR Service for ReaWid
// Provides client-side, 100% free, offline-capable Turkish OCR.
// Features lazy-loaded singleton worker, progress telemetry, memory safety, and graceful failover.

import { normalizeHyphensAndText, healTurkishOcrArtifacts } from './aiService.js';
import { perfMonitor } from './perfMonitor.js';

let tesseractWorker = null;
let isInitializing = false;
let currentInitPromise = null;
let lastWorkerActiveTime = Date.now();
let isProcessingQueue = false;

// Auto-terminate worker after 5 minutes of idle to free up ~40MB WebAssembly memory
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let idleTimer = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    terminateTesseractWorker().catch(() => {});
  }, IDLE_TIMEOUT_MS);
}

/**
 * Initializes and caches the singleton Tesseract worker with Turkish ('tur') language data.
 * Safe against concurrent callers (returns the same pending initialization promise).
 */
export async function getOrInitTesseractWorker(onProgress = null) {
  resetIdleTimer();
  if (tesseractWorker) return tesseractWorker;

  if (isInitializing && currentInitPromise) {
    return currentInitPromise;
  }

  isInitializing = true;
  currentInitPromise = (async () => {
    const t0 = performance.now();
    try {
      console.info('[Tesseract Service] Türkçe Tesseract OCR worker başlatılıyor...');

      // Dynamic import to keep main bundle size light and fast
      const { createWorker } = await import('tesseract.js');

      const worker = await createWorker('tur', 1, {
        logger: (m) => {
          if (onProgress && typeof onProgress === 'function') {
            try {
              onProgress({
                status: m.status,
                progress: typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0
              });
            } catch (_) {}
          }
        }
      });

      tesseractWorker = worker;
      const elapsed = Math.round(performance.now() - t0);
      console.info(`[Tesseract Service] ✅ Türkçe OCR motoru başarıyla yüklendi (${elapsed}ms).`);
      return tesseractWorker;
    } catch (err) {
      console.error('[Tesseract Service] Türkçe dil verisi veya Worker başlatılamadı:', err);
      tesseractWorker = null;
      throw new Error(`Tesseract Türkçe dil modeli başlatılamadı: ${err.message || 'Ağ hatası veya CDN erişilemiyor'}`);
    } finally {
      isInitializing = false;
      currentInitPromise = null;
    }
  })();

  return currentInitPromise;
}

/**
 * Gracefully terminates the worker and frees all WebAssembly memory.
 */
export async function terminateTesseractWorker() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (tesseractWorker) {
    try {
      console.info('[Tesseract Service] Tesseract worker belleği serbest bırakılıyor (terminate)...');
      const worker = tesseractWorker;
      tesseractWorker = null;
      await worker.terminate();
    } catch (err) {
      console.warn('[Tesseract Service] Worker sonlandırma uyarısı:', err);
    }
  }
}

/**
 * Performs Turkish OCR on an image source (base64 string, HTMLImageElement, or Canvas)
 * Returns structured result with rawText, cleanedText, confidence score, and metrics.
 */
export async function performTesseractOcr({
  imageSource, // data:image/jpeg;base64... or canvas or image path
  documentId = 'doc',
  pageNumber = 1,
  options = {},
  signal = null,
  onProgress = null
}) {
  resetIdleTimer();
  const startTime = performance.now();
  perfMonitor.trackOcrStart();
  const metricKey = `tesseract_p${pageNumber}`;
  perfMonitor.start(metricKey);

  // Simple serial queue lock to prevent unconstrained parallel OCR workers
  while (isProcessingQueue) {
    if (signal?.aborted) {
      perfMonitor.trackOcrEnd();
      perfMonitor.end(metricKey);
      throw new Error('İşlem kullanıcı tarafından durduruldu.');
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  isProcessingQueue = true;

  try {
    if (signal?.aborted) {
      throw new Error('İşlem kullanıcı tarafından durduruldu.');
    }

    const worker = await getOrInitTesseractWorker(onProgress);

    if (signal?.aborted) {
      throw new Error('İşlem kullanıcı tarafından durduruldu.');
    }

    const recognizeRes = await worker.recognize(imageSource);
    const durationMs = Math.round(performance.now() - startTime);

    const rawText = (recognizeRes?.data?.text || '').trim();
    const confidence = Math.round(recognizeRes?.data?.confidence || 0);

    // Run linguistic healing and end-of-line hyphen restoration
    const cleanedText = normalizeHyphensAndText(rawText, {
      mergeHyphens: options.mergeHyphenatedWords !== false
    });

    const isBlank = rawText.length === 0 || rawText === '[SAYFADA METİN YOK]';

    // Build verifiable result wrapper preserving pristine raw text
    const verifiableResult = new String(cleanedText);
    verifiableResult.text = cleanedText;
    verifiableResult.rawText = rawText;
    verifiableResult.cleanedText = cleanedText;
    verifiableResult.confidence = confidence;
    verifiableResult.durationMs = durationMs;
    verifiableResult.documentId = String(documentId || 'doc');
    verifiableResult.pageNumber = Number(pageNumber) || 1;
    verifiableResult.engine = 'tesseract';
    verifiableResult.provider = 'tesseract';
    verifiableResult.model = 'tesseract-tur';
    verifiableResult.isBlank = isBlank;

    console.info(
      `[Tesseract OCR] ✅ Belge: [${documentId}] | Sayfa: [${pageNumber}] | Süre: ${durationMs}ms | Güven: %${confidence} | Karakter: ${cleanedText.length}`
    );

    return verifiableResult;
  } catch (err) {
    console.error(`[Tesseract OCR] Sayfa ${pageNumber} işlenirken hata:`, err);
    throw err;
  } finally {
    isProcessingQueue = false;
    perfMonitor.trackOcrEnd();
    perfMonitor.end(metricKey);
    resetIdleTimer();
  }
}
