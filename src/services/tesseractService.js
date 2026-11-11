// Tesseract.js Turkish OCR Service for ReaWid
// Provides client-side, 100% free, offline-capable Turkish OCR.
// Features lazy-loaded singleton worker, progress telemetry, memory safety, and graceful failover.

import { normalizeHyphensAndText, healTurkishOcrArtifacts } from './aiService.js';
import { perfMonitor } from './perfMonitor.js';
import { preprocessImageForOcr } from './imageProcessor.js';
import { simd } from 'wasm-feature-detect';

let tesseractWorker = null;
let isInitializing = false;
let currentInitPromise = null;
let lastWorkerActiveTime = Date.now();
let ocrJobQueue = Promise.resolve();

/**
 * Creates a standardized AbortError recognized by modern DOM and Node.js environments.
 */
export function createAbortError(message = 'İşlem kullanıcı tarafından durduruldu.') {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

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

      // tesseract.js 7'nin relaxedsimd çekirdeği, float (tessdata_best) modeliyle
      // "missing function: DotProductSSE" hatası verip anında abort ediyor.
      // SIMD çekirdeğini açıkça seçerek bu hatayı atlıyoruz.
      // shortcut: çekirdek sürümü tesseract.js-core 7.0.0'a sabit; paket güncellenince güncelle.
      const simdSupported = await simd();
      const coreFile = simdSupported
        ? 'tesseract-core-simd-lstm.wasm.js'
        : 'tesseract-core-lstm.wasm.js';

      const workerPromise = createWorker('tur', 1, {
        // tessdata_best, hızlı modelden belirgin şekilde daha doğru sonuç verir.
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
        corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/${coreFile}`,
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

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tesseract Türkçe modeli yüklenirken zaman aşımına uğradı (45s).')), 45000)
      );

      const worker = await Promise.race([workerPromise, timeoutPromise]);

      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '3',
          preserve_interword_spaces: '1'
        });
      } catch (paramErr) {
        console.warn('[Tesseract Service] Parametre ayarlama uyarısı:', paramErr);
      }

      tesseractWorker = worker;
      const elapsed = Math.round(performance.now() - t0);
      console.info(`[Tesseract Service] [OK] Türkçe OCR motoru başarıyla yüklendi (${elapsed}ms).`);
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

  if (signal?.aborted) {
    perfMonitor.trackOcrEnd();
    perfMonitor.end(metricKey);
    throw createAbortError();
  }

  // Strict serial queue lock to prevent unconstrained parallel OCR workers from colliding
  const previousJob = ocrJobQueue;
  let releaseJobLock;
  ocrJobQueue = new Promise((resolve) => {
    releaseJobLock = resolve;
  });

  try {
    // Wait until previous OCR job finishes completely
    await previousJob;

    if (signal?.aborted) {
      throw createAbortError();
    }

    const worker = await getOrInitTesseractWorker(onProgress);

    if (signal?.aborted) {
      throw createAbortError();
    }

    // Kitap sayfalarında tek sütun modu (PSM 6) küçük/bitişik yazılarda
    // varsayılan otomatik moddan (PSM 3) belirgin şekilde daha iyi sonuç verir.
    const primaryPsm = options.pageSegMode || '3';
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: primaryPsm,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
    } catch (paramErr) {
      console.warn('[Tesseract Service] Sayfa parametreleri uygulanamadı:', paramErr);
    }

    // 1. Akıllı Kontrast Germe & Gri Tonlama (Preserve smooth letter contours for LSTM)
    let processedSource = imageSource;
    if (options.preprocess !== false && typeof document !== 'undefined') {
      try {
        processedSource = await preprocessImageForOcr(imageSource, {
          mode: options.preprocessMode || 'contrast_stretch'
        });
      } catch (prepErr) {
        console.warn('[Tesseract Service] Ön işleme atlandı, ham görsel deneniyor:', prepErr);
        processedSource = imageSource;
      }
    }

    if (signal?.aborted) {
      throw createAbortError();
    }

    // Abort listener for active worker recognition
    let abortListener = null;
    const abortPromise = new Promise((_, reject) => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }
      if (signal && typeof signal.addEventListener === 'function') {
        abortListener = () => reject(createAbortError());
        signal.addEventListener('abort', abortListener, { once: true });
      }
    });

    const recognizePromise = worker.recognize(processedSource);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract sayfa tanıma zaman aşımına uğradı (40s).')), 40000)
    );

    let recognizeRes;
    try {
      recognizeRes = await Promise.race([recognizePromise, abortPromise, timeoutPromise]);
    } catch (raceErr) {
      if (raceErr.name === 'AbortError' || (raceErr.message && raceErr.message.includes('zaman aşımına'))) {
        // Halt and terminate busy worker so cancelled WebAssembly computation does not corrupt next job
        await terminateTesseractWorker().catch(() => {});
      }
      throw raceErr;
    } finally {
      if (signal && abortListener && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', abortListener);
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    let rawText = (recognizeRes?.data?.text || '').trim();
    let confidence = Math.round(recognizeRes?.data?.confidence || 0);

    // 2. İki Aşamalı Akıllı Fallback (Two-Pass OCR):
    if (confidence < 62 && options.twoPass !== false && typeof document !== 'undefined' && !signal?.aborted) {
      try {
        // İlk geçiş tek sütun (PSM 6) idiyse, ikinci geçişte otomatik düzen (PSM 3) dene.
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: primaryPsm === '6' ? '3' : '6',
            preserve_interword_spaces: '1'
          });
        } catch (_) {}
        const pass2Source = await preprocessImageForOcr(imageSource, { mode: 'adaptive_threshold' });
        const pass2Promise = worker.recognize(pass2Source);
        const pass2Timeout = new Promise((_, r) => setTimeout(() => r(new Error('Pass 2 timeout')), 25000));
        
        let pass2Res;
        try {
          pass2Res = await Promise.race([pass2Promise, abortPromise, pass2Timeout]);
        } catch (pass2RaceErr) {
          if (pass2RaceErr.name === 'AbortError') {
            await terminateTesseractWorker().catch(() => {});
            throw pass2RaceErr;
          }
        }

        if (pass2Res) {
          const pass2Text = (pass2Res?.data?.text || '').trim();
          const pass2Conf = Math.round(pass2Res?.data?.confidence || 0);

          if (pass2Conf > confidence || (pass2Text.length > rawText.length * 1.3 && pass2Conf >= 45)) {
            console.info(`[Tesseract OCR] [Adaptive] İkinci aşama (Adaptive Thresholding) daha başarılı sonuç verdi (%${pass2Conf} vs %${confidence}).`);
            rawText = pass2Text;
            confidence = pass2Conf;
          }
        }
      } catch (pass2Err) {
        if (pass2Err.name === 'AbortError') throw pass2Err;
        console.warn('[Tesseract OCR] İkinci aşama uyarısı:', pass2Err?.message);
      }
    }

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
      `[Tesseract OCR] [OK] Belge: [${documentId}] | Sayfa: [${pageNumber}] | Süre: ${durationMs}ms | Güven: %${confidence} | Karakter: ${cleanedText.length}`
    );

    return verifiableResult;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(`[Tesseract OCR] Sayfa ${pageNumber} işlenirken hata:`, err);
    }
    throw err;
  } finally {
    if (releaseJobLock) releaseJobLock();
    perfMonitor.trackOcrEnd();
    perfMonitor.end(metricKey);
    resetIdleTimer();
  }
}
