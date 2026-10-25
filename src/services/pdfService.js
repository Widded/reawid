// PDF Handling and Rendering Service using PDF.js
import * as pdfjsLib from 'pdfjs-dist';
import { normalizeHyphensAndText, mergeAccidentalParagraphSplits } from './aiService.js';
import { perfMonitor } from './perfMonitor.js';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  } catch (_) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  }
}

/**
 * Dispose an HTML5 canvas element to immediately free GPU memory and VRAM backing store.
 */
export function disposeCanvas(canvas) {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (_) {}
}

/**
 * Bounded LRU Cache for rendered PDF pages.
 * Prevents re-rendering recently viewed pages (0ms instant page turns)
 * while strictly capping memory footprint and releasing GPU textures upon eviction.
 */
export class PageRenderLruCache {
  constructor(maxEntries = 5) {
    this.maxEntries = maxEntries;
    this.cache = new Map(); // key -> { canvas, width, height, scale, timestamp }
  }

  _makeKey(docFingerprint, pageNum, scale) {
    return `${docFingerprint || 'doc'}_p${pageNum}_s${Math.round(scale * 100) / 100}`;
  }

  has(docFingerprint, pageNum, scale) {
    const key = this._makeKey(docFingerprint, pageNum, scale);
    return this.cache.has(key);
  }

  get(docFingerprint, pageNum, scale) {
    const key = this._makeKey(docFingerprint, pageNum, scale);
    if (!this.cache.has(key)) {
      perfMonitor.recordCacheMiss();
      return null;
    }

    const item = this.cache.get(key);
    // Refresh LRU order: delete and re-insert as most recently used
    this.cache.delete(key);
    this.cache.set(key, item);
    perfMonitor.recordCacheHit();
    return item;
  }

  set(docFingerprint, pageNum, scale, sourceCanvas) {
    if (!sourceCanvas || sourceCanvas.width === 0) return;
    const key = this._makeKey(docFingerprint, pageNum, scale);

    if (this.cache.has(key)) {
      const existing = this.cache.get(key);
      if (existing.canvas && existing.canvas !== sourceCanvas) {
        disposeCanvas(existing.canvas);
      }
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest (least recently used)
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      if (oldest?.canvas) {
        disposeCanvas(oldest.canvas);
      }
      this.cache.delete(oldestKey);
    }

    // Clone into an offline canvas dedicated to cache storage
    let cachedCanvas = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      cachedCanvas = document.createElement('canvas');
      cachedCanvas.width = sourceCanvas.width;
      cachedCanvas.height = sourceCanvas.height;
      const ctx = cachedCanvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0);
      }
    } else {
      cachedCanvas = {
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        getContext: () => ({ drawImage: () => {}, clearRect: () => {} })
      };
    }

    this.cache.set(key, {
      canvas: cachedCanvas,
      width: cachedCanvas.width,
      height: cachedCanvas.height,
      scale,
      timestamp: Date.now()
    });
  }

  clear() {
    for (const [_, item] of this.cache.entries()) {
      if (item?.canvas) {
        disposeCanvas(item.canvas);
      }
    }
    this.cache.clear();
  }
}

export const pdfPageRenderCache = new PageRenderLruCache(5);

/**
 * Load PDF document with on-demand streaming to accelerate initial load time.
 */
export async function loadPdf(fileOrBuffer) {
  let data;
  if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    data = await fileOrBuffer.arrayBuffer();
  } else {
    data = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true,
    disableAutoFetch: true, // Do not fetch all stream pages upfront; load pages on demand
    disableRange: false
  });

  const pdfDoc = await loadingTask.promise;
  return {
    numPages: pdfDoc.numPages,
    pdfDoc
  };
}

/**
 * Direct render to a target canvas with full cancellation support.
 * Eliminates intermediate detached canvas allocations, reducing peak memory by 50%+.
 */
export function renderPdfPageDirect(pdfDoc, pageNumber, targetCanvas, options = {}) {
  const { scale = 2.0, signal } = options;
  let renderTask = null;
  let isCancelled = false;

  const promise = (async () => {
    perfMonitor.trackRenderStart();
    const metricKey = `canvas_render_p${pageNumber}`;
    perfMonitor.start(metricKey);

    try {
      const page = await pdfDoc.getPage(pageNumber);
      if (signal?.aborted || isCancelled) {
        const cancelErr = new Error('RenderCancelled');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      const viewport = page.getViewport({ scale });
      targetCanvas.width = Math.floor(viewport.width);
      targetCanvas.height = Math.floor(viewport.height);

      const ctx = targetCanvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

      if (signal?.aborted || isCancelled) {
        const cancelErr = new Error('RenderCancelled');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          try { renderTask?.cancel(); } catch (_) {}
        }, { once: true });
      }

      await renderTask.promise;
      return targetCanvas;
    } finally {
      perfMonitor.trackRenderEnd();
      perfMonitor.end(metricKey);
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      try { renderTask?.cancel(); } catch (_) {}
    }
  };
}

/**
 * Render a single PDF page onto an HTML5 canvas at high DPI (backward compatible).
 */
export async function renderPdfPageToCanvas(pdfDoc, pageNumber, scale = 2.0) {
  const canvas = document.createElement('canvas');
  const direct = renderPdfPageDirect(pdfDoc, pageNumber, canvas, { scale });
  await direct.promise;
  return canvas;
}

/**
 * Render PDF page directly to base64 JPEG with immediate memory release.
 */
export async function renderPdfPageToBase64(pdfDoc, pageNumber, scale = 2.0) {
  const canvas = await renderPdfPageToCanvas(pdfDoc, pageNumber, scale);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  disposeCanvas(canvas);
  return dataUrl;
}

/**
 * Generate lightweight page thumbnails for PDF page selector
 */
export async function renderPdfThumbnails(pdfDoc, onThumbnailReady) {
  const numPages = pdfDoc.numPages;
  for (let i = 1; i <= numPages; i++) {
    const canvas = await renderPdfPageToCanvas(pdfDoc, i, 0.4);
    const thumbData = canvas.toDataURL('image/jpeg', 0.7);
    disposeCanvas(canvas);
    if (onThumbnailReady) {
      onThumbnailReady({ pageNum: i, thumbnail: thumbData, totalPages: numPages });
    }
  }
}

/**
 * Fast extract embedded text content from a PDF page (10-20ms).
 * Correctly preserves any length of genuine embedded text (>= 1 character).
 */
export async function extractPdfPageText(pdfDoc, pageNumber) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let lastY = null;
    let lastX = null;
    let lastWidth = 0;
    let text = '';

    for (const item of textContent.items) {
      if (!item.str) continue;
      const currentX = item.transform ? item.transform[4] : null;
      const currentY = item.transform ? item.transform[5] : null;
      const itemWidth = item.width || 0;

      if (lastY !== null && currentY !== null) {
        const deltaY = Math.abs(currentY - lastY);
        const fontSize = Math.max(9, Math.abs(item.height || (item.transform ? item.transform[3] : 12)));

        if (deltaY > Math.max(26, fontSize * 1.85)) {
          // Gerçek paragraf boşluğu
          if (!text.endsWith('\n\n')) text += '\n\n';
        } else if (deltaY > 3.5) {
          // Aynı paragraf içi satır sonu
          if (!text.endsWith('\n')) text += '\n';
        } else if (lastX !== null && currentX !== null) {
          // Aynı satır: Öğeler arasındaki yatay mesafeyi hesapla
          const gap = currentX - (lastX + lastWidth);
          const fontSize = Math.max(9, Math.abs(item.height || (item.transform ? item.transform[3] : 12)));
          const avgCharWidth = itemWidth > 0 ? (itemWidth / Math.max(1, item.str.length)) : (fontSize * 0.45);

          // İki bitişik öğe tek harf ise (ayrık glif dizilimi) veya ek glifi ise, kelime boşluğu için net aralık gerekir
          const isSingleCharTransition = (item.str.trim().length === 1 && text.trim().slice(-1).length === 1);
          const isSuffixGlyph = /^(z|n|m|k|t|nı|ni|nu|nü|nda|nde|ndan|nden|yor|yordu|nlık|nlik|nluk|nlük|lık|lik|luk|lük|sız|siz|suz|süz)$/i.test(item.str.trim());
          const minWordGap = (isSingleCharTransition || isSuffixGlyph)
            ? Math.max(5.2, fontSize * 0.44)
            : Math.max(3.6, Math.min(fontSize * 0.30, avgCharWidth * 0.52));

          if (gap >= minWordGap && !text.endsWith(' ') && !item.str.startsWith(' ')) {
            text += ' ';
          }
        }
      }

      text += item.str;
      lastX = currentX;
      lastY = currentY;
      lastWidth = itemWidth;
    }

    let clean = text.trim();
    if (clean.length > 0) {
      // Satır sonu kesme ve heceleme tirelerini birleştir
      clean = normalizeHyphensAndText(clean);

      // Türkçe Karakter Bütünlüğü Kontrolü (sadece uzun metinlerde doğrula)
      if (clean.length > 25) {
        const turkishKeywordRegex = /\b(degil|icin|cunku|oldugu|birkac|simdi|sey|kucuk|buyuk|hicbir|yagmur|dogru|goster|sag|dusun|kitap|yazik|yapil|gore|birlikte)\b/i;
        const turkishSpecificCount = (clean.match(/[çğışöüÇĞİÖŞÜ]/g) || []).length;

        if (turkishKeywordRegex.test(clean) && turkishSpecificCount < 2) {
          console.warn(`[PDF Engine] Sayfa ${pageNumber} gömülü metninde Türkçe karakter kaybı tespit edildi (eski/bozuk OCR katmanı). Vision AI ile taranıyor.`);
          return null;
        }
      }

      const rawParagraphs = clean
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      const paragraphs = mergeAccidentalParagraphSplits(rawParagraphs);
      if (paragraphs.length > 0) return paragraphs;
      return [clean];
    }
  } catch (err) {
    console.warn(`Sayfa ${pageNumber} metin katmanı okunamadı:`, err);
  }
  return null;
}
