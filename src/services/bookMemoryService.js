// Book Memory & Persistent OCR Cache Service for ReaWid
// Manages durable, per-book OCR storage, PDF fingerprinting, chapter outline caching,
// and incremental background OCR resumption using IndexedDB and in-memory L1 cache.

import {
  extractBookOutlineIndex,
  buildParagraphMetadataIndex,
  invalidateBookRetrievalCache,
  detectPrintedPageNumber
} from './aiService.js';

const IDB_NAME = 'reawid_book_memory_db';
const IDB_VERSION = 1;
const IDB_STORE_MEMORIES = 'book_memories';
const IDB_INDEX_FINGERPRINT = 'by_fingerprint';

// In-Memory L1 Cache for ultra-fast access and seamless Node.js testing
const l1MemoryCache = new Map();

let idbMemoryPromise = null;

/**
 * Gets or initializes the IndexedDB connection for persistent book memory.
 * Gracefully returns null in environments without window.indexedDB (e.g. Node.js tests).
 */
export function getBookMemoryDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!idbMemoryPromise) {
    idbMemoryPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE_MEMORIES)) {
            const store = db.createObjectStore(IDB_STORE_MEMORIES, { keyPath: 'bookId' });
            store.createIndex(IDB_INDEX_FINGERPRINT, 'pdfFingerprint', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = (err) => {
          console.warn('[BookMemory] IndexedDB open error, falling back to L1 cache:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[BookMemory] IndexedDB init exception:', err);
        resolve(null);
      }
    });
  }

  return idbMemoryPromise;
}

/**
 * Cryptographic & structural PDF fingerprint generator.
 * Computes a SHA-256 hash using samples from the file's start (header),
 * end (trailer/xref), and middle (object stream), combined with file size.
 *
 * @param {Blob|File|ArrayBuffer|Uint8Array} fileOrBuffer
 * @param {number|null} totalPages
 * @returns {Promise<string>}
 */
export async function generatePdfFingerprint(fileOrBuffer, totalPages = null) {
  if (!fileOrBuffer) return `pdf_empty_${Date.now()}`;

  try {
    let size = 0;
    let headSlice;
    let tailSlice;
    let midSlice = null;

    if (typeof Blob !== 'undefined' && fileOrBuffer instanceof Blob) {
      size = fileOrBuffer.size;
      const headBlob = fileOrBuffer.slice(0, Math.min(size, 16384));
      const tailBlob = fileOrBuffer.slice(Math.max(0, size - 16384), size);
      const headBuf = await headBlob.arrayBuffer();
      const tailBuf = await tailBlob.arrayBuffer();
      headSlice = new Uint8Array(headBuf);
      tailSlice = new Uint8Array(tailBuf);

      if (size > 65536) {
        const midStart = Math.floor(size / 2) - 4096;
        const midBlob = fileOrBuffer.slice(midStart, midStart + 8192);
        const midBuf = await midBlob.arrayBuffer();
        midSlice = new Uint8Array(midBuf);
      }
    } else {
      // Buffer / ArrayBuffer in Node or Web Worker
      const u8 = fileOrBuffer instanceof Uint8Array
        ? fileOrBuffer
        : new Uint8Array(fileOrBuffer);
      size = u8.byteLength;
      headSlice = u8.subarray(0, Math.min(size, 16384));
      tailSlice = u8.subarray(Math.max(0, size - 16384), size);

      if (size > 65536) {
        const midStart = Math.floor(size / 2) - 4096;
        midSlice = u8.subarray(midStart, midStart + 8192);
      }
    }

    // Combine sampled slices into a single payload
    const totalSampleLen = headSlice.length + tailSlice.length + (midSlice ? midSlice.length : 0);
    const samplePayload = new Uint8Array(totalSampleLen);
    samplePayload.set(headSlice, 0);
    samplePayload.set(tailSlice, headSlice.length);
    if (midSlice) {
      samplePayload.set(midSlice, headSlice.length + tailSlice.length);
    }

    // SHA-256 digest via Web Crypto API (supported in modern browser & Node.js 18+)
    const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
    if (subtle) {
      const hashBuffer = await subtle.digest('SHA-256', samplePayload.buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
      return `pdf_${size}_p${totalPages || 0}_${hashHex}`;
    }

    // Fallback deterministic hash (FNV-1a variant)
    let hash = 0x811c9dc5;
    for (let i = 0; i < samplePayload.length; i += 7) {
      hash ^= samplePayload[i];
      hash = Math.imul(hash, 0x01000193);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `pdf_${size}_p${totalPages || 0}_${hex}`;
  } catch (err) {
    console.warn('[BookMemory] Fingerprint calculation fallback:', err);
    const fallbackSize = fileOrBuffer.size || fileOrBuffer.byteLength || 0;
    return `pdf_${fallbackSize}_p${totalPages || 0}_${Date.now()}`;
  }
}

/**
 * Initializes a new persistent memory record for a book.
 *
 * @param {Object} params
 * @param {string} params.bookId
 * @param {string} params.pdfFingerprint
 * @param {string} [params.title]
 * @param {string} [params.author]
 * @param {number} [params.totalPages]
 * @param {string} [params.cover]
 * @returns {Object} persistentBookMemory
 */
export function initBookMemory({
  bookId,
  pdfFingerprint,
  title = 'Kitap',
  author = 'Kişisel Belge',
  totalPages = 1,
  cover = null
}) {
  const safeTotal = Math.max(1, Number(totalPages) || 1);
  const now = new Date().toISOString();

  const memory = {
    bookId: String(bookId),
    pdfFingerprint: String(pdfFingerprint),
    title: String(title),
    author: String(author),
    totalPages: safeTotal,
    cover: cover || null,
    scannedPages: {},
    failedAttempts: {},
    chapterOutline: '',
    ragIndex: null,
    contentVersion: 1,
    lastOcrDate: null,
    ocrStats: {
      totalPages: safeTotal,
      scannedCount: 0,
      failedCount: 0,
      unscannedCount: safeTotal,
      isComplete: false
    },
    createdAt: now,
    updatedAt: now
  };

  l1MemoryCache.set(memory.bookId, memory);
  persistMemoryToIdb(memory).catch(() => {});
  return memory;
}

// Per-book serialization queue & write coalescing to prevent parallel IndexedDB transaction aborts
const inFlightMemoryWrites = new Set();
const pendingMemoryWrites = new Map(); // bookId -> { memory, resolves: Function[], rejects: Function[] }

/**
 * Persists a full memory record to IndexedDB asynchronously with serialization, write coalescing and quota protection.
 */
export async function persistMemoryToIdb(memory) {
  if (!memory || !memory.bookId) return false;
  const key = String(memory.bookId);

  // If a write is already in flight for this book, coalesce into pending queue.
  // When in-flight transaction completes, it will write the latest memory snapshot once.
  if (inFlightMemoryWrites.has(key)) {
    return new Promise((resolve, reject) => {
      const existing = pendingMemoryWrites.get(key);
      if (existing) {
        existing.memory = memory;
        existing.resolves.push(resolve);
        existing.rejects.push(reject);
      } else {
        pendingMemoryWrites.set(key, {
          memory,
          resolves: [resolve],
          rejects: [reject]
        });
      }
    });
  }

  inFlightMemoryWrites.add(key);

  try {
    const db = await getBookMemoryDb();
    if (!db) return false;

    // Strip internal non-persistent memory caches before saving to IndexedDB
    const toStore = { ...memory };
    delete toStore._scannedSet;
    delete toStore._offsetVotes;
    delete toStore._maxOffsetVotes;

    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE_MEMORIES, 'readwrite');
        tx.onabort = () => {
          const err = tx.error || new Error('IDB transaction aborted');
          reject(err);
        };
        tx.onerror = () => {
          const err = tx.error || new Error('IDB transaction error');
          reject(err);
        };
        tx.oncomplete = () => resolve(true);

        const store = tx.objectStore(IDB_STORE_MEMORIES);
        store.put(toStore);
      } catch (txErr) {
        reject(txErr);
      }
    });
    return true;
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      console.error(`[BookMemory] IndexedDB Depolama Kotası Doldu (QuotaExceededError) [${key}]:`, err);
    } else {
      console.warn(`[BookMemory] IDB save memory warning [${key}]:`, err?.message || err);
    }
    return false;
  } finally {
    inFlightMemoryWrites.delete(key);
    // Execute coalesced write with the latest state if new pages arrived during transaction
    if (pendingMemoryWrites.has(key)) {
      const pending = pendingMemoryWrites.get(key);
      pendingMemoryWrites.delete(key);
      persistMemoryToIdb(pending.memory)
        .then(res => {
          pending.resolves.forEach(r => r(res));
        })
        .catch(err => {
          pending.rejects.forEach(rej => rej(err));
        });
    }
  }
}

/**
 * Flushes any pending coalesced IndexedDB memory writes immediately (e.g. on unload/book switch).
 */
export async function flushPendingMemoryWrites(bookId) {
  if (!bookId) return;
  const key = String(bookId);
  if (pendingMemoryWrites.has(key)) {
    const pending = pendingMemoryWrites.get(key);
    pendingMemoryWrites.delete(key);
    try {
      const res = await persistMemoryToIdb(pending.memory);
      pending.resolves.forEach(r => r(res));
    } catch (err) {
      pending.rejects.forEach(rej => rej(err));
    }
  }
}

/**
 * Retrieves the persistent book memory by bookId.
 * Optionally validates against expectedFingerprint. If the fingerprint does not match,
 * returns null to prevent stale/corrupted OCR cross-contamination.
 *
 * @param {string} bookId
 * @param {string|null} [expectedFingerprint]
 * @returns {Promise<Object|null>}
 */
export async function getBookMemory(bookId, expectedFingerprint = null) {
  if (!bookId) return null;
  const key = String(bookId);

  // 1. Check L1 Memory Cache
  let memory = l1MemoryCache.get(key) || null;

  // 2. Fetch from IndexedDB if not in L1
  if (!memory) {
    try {
      const db = await getBookMemoryDb();
      if (db) {
        memory = await new Promise((resolve) => {
          const tx = db.transaction(IDB_STORE_MEMORIES, 'readonly');
          const req = tx.objectStore(IDB_STORE_MEMORIES).get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (memory) {
          l1MemoryCache.set(key, memory);
        }
      }
    } catch (err) {
      console.warn('[BookMemory] IDB get error:', err);
    }
  }

  if (!memory) return null;

  // 3. Security Check: Validate fingerprint if provided
  if (expectedFingerprint && memory.pdfFingerprint && memory.pdfFingerprint !== expectedFingerprint) {
    console.warn(`[BookMemory] Fingerprint mismatch for ${bookId}: expected ${expectedFingerprint}, found ${memory.pdfFingerprint}`);
    return null;
  }

  return memory;
}

/**
 * Finds an existing book memory by its PDF fingerprint.
 * Enables automatic resume even if the user opens the same PDF with a new session.
 *
 * @param {string} pdfFingerprint
 * @returns {Promise<Object|null>}
 */
export async function findBookMemoryByFingerprint(pdfFingerprint) {
  if (!pdfFingerprint) return null;

  // Check L1 cache
  for (const mem of l1MemoryCache.values()) {
    if (mem.pdfFingerprint === pdfFingerprint) {
      return mem;
    }
  }

  // Check IndexedDB index
  try {
    const db = await getBookMemoryDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_MEMORIES, 'readonly');
      const store = tx.objectStore(IDB_STORE_MEMORIES);
      if (store.indexNames.contains(IDB_INDEX_FINGERPRINT)) {
        const index = store.index(IDB_INDEX_FINGERPRINT);
        const req = index.get(pdfFingerprint);
        req.onsuccess = () => {
          const result = req.result || null;
          if (result) {
            l1MemoryCache.set(result.bookId, result);
          }
          resolve(result);
        };
        req.onerror = () => resolve(null);
      } else {
        // Fallback scan if index is missing
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const found = all.find(m => m.pdfFingerprint === pdfFingerprint) || null;
          if (found) l1MemoryCache.set(found.bookId, found);
          resolve(found);
        };
        req.onerror = () => resolve(null);
      }
    });
  } catch (err) {
    console.warn('[BookMemory] findByFingerprint error:', err);
    return null;
  }
}

/**
 * Saves or updates a single page's OCR memory atomically.
 *
 * RULES:
 * 1. An already 'completed' page with valid paragraphs is NEVER overwritten by a 'failed' attempt.
 * 2. Successful OCR clears previous failure records for that page.
 * 3. Immediately updates ocrStats, lastOcrDate, and chapterOutline.
 * 4. Persists to both L1 cache and IndexedDB to guarantee crash-resilience.
 *
 * @param {string} bookId
 * @param {number} pageNumber
 * @param {Object} pageData
 * @param {string[]} pageData.paragraphs
 * @param {string} [pageData.rawText]
 * @param {'completed'|'failed'|'in_progress'} pageData.ocrStatus
 * @param {string} [pageData.ocrEngine]
 * @param {string|null} [pageData.error]
 * @returns {Promise<Object>} Updated book memory
 */
export async function savePageOcrMemory(bookId, pageNumber, pageData) {
  const pNum = Number(pageNumber);
  if (!bookId || isNaN(pNum) || pNum < 1) return null;

  let memory = await getBookMemory(bookId);
  if (!memory) {
    memory = initBookMemory({
      bookId,
      pdfFingerprint: `pdf_auto_${Date.now()}`,
      totalPages: pNum
    });
  }

  if (!memory.scannedPages) memory.scannedPages = {};
  if (!memory.failedAttempts) memory.failedAttempts = {};

  const existingPage = memory.scannedPages[pNum];
  const incomingStatus = (pageData && pageData.ocrStatus) || 'completed';
  const incomingParagraphs = Array.isArray(pageData)
    ? pageData
    : (Array.isArray(pageData?.paragraphs)
        ? pageData.paragraphs
        : (pageData?.paragraphs ? [String(pageData.paragraphs)] : []));

  // Rule: Do not overwrite an already completed page with a failed status
  if (
    existingPage &&
    existingPage.ocrStatus === 'completed' &&
    Array.isArray(existingPage.paragraphs) &&
    existingPage.paragraphs.length > 0 &&
    incomingStatus === 'failed'
  ) {
    // Preserve existing valid page
    return memory;
  }

  const now = Date.now();
  const rawPageText = pageData.rawText || incomingParagraphs.join('\n\n');
  const detectedPrinted = detectPrintedPageNumber(rawPageText);

  // 1. Incremental Scanned Set Tracking
  if (!memory._scannedSet) {
    memory._scannedSet = new Set();
    if (memory.scannedPages) {
      for (const [k, v] of Object.entries(memory.scannedPages)) {
        if (v && v.ocrStatus === 'completed' && Array.isArray(v.paragraphs) && v.paragraphs.length > 0) {
          memory._scannedSet.add(Number(k));
        }
      }
    }
  }

  if (incomingStatus === 'completed' && incomingParagraphs.length > 0) {
    memory.scannedPages[pNum] = {
      pageNumber: pNum,
      pdfPage: pNum,
      printedPage: detectedPrinted,
      paragraphs: incomingParagraphs,
      rawText: rawPageText,
      ocrStatus: 'completed',
      ocrEngine: pageData.ocrEngine || 'auto',
      timestamp: now,
      error: null
    };
    memory._scannedSet.add(pNum);
    delete memory.failedAttempts[pNum];
    memory.lastOcrDate = new Date(now).toISOString();
  } else if (incomingStatus === 'failed') {
    const currentFails = (memory.failedAttempts[pNum] || 0) + 1;
    memory.failedAttempts[pNum] = currentFails;
    memory._scannedSet.delete(pNum);

    memory.scannedPages[pNum] = {
      pageNumber: pNum,
      pdfPage: pNum,
      printedPage: detectedPrinted,
      paragraphs: [],
      rawText: '',
      ocrStatus: 'failed',
      ocrEngine: pageData.ocrEngine || 'auto',
      timestamp: now,
      error: pageData.error || 'OCR işlemi başarısız oldu'
    };
  } else {
    // in_progress or metadata update
    memory.scannedPages[pNum] = {
      pageNumber: pNum,
      pdfPage: pNum,
      printedPage: detectedPrinted,
      paragraphs: incomingParagraphs,
      rawText: pageData.rawText || '',
      ocrStatus: incomingStatus,
      ocrEngine: pageData.ocrEngine || 'auto',
      timestamp: now,
      error: pageData.error || null
    };
    if (incomingParagraphs.length > 0) {
      memory._scannedSet.add(pNum);
    }
  }

  // 2. Incremental Consensus Page Offset
  if (!memory._offsetVotes) {
    memory._offsetVotes = new Map();
    memory._maxOffsetVotes = 0;
    if (memory.scannedPages) {
      for (const [pStr, pageObj] of Object.entries(memory.scannedPages)) {
        const p = Number(pStr);
        const pr = pageObj?.printedPage;
        if (typeof pr === 'number' && p >= pr) {
          const diff = p - pr;
          const votes = (memory._offsetVotes.get(diff) || 0) + 1;
          memory._offsetVotes.set(diff, votes);
          if (votes > memory._maxOffsetVotes) {
            memory._maxOffsetVotes = votes;
            memory.pageOffset = diff;
          }
        }
      }
    }
  }

  if (typeof detectedPrinted === 'number' && pNum >= detectedPrinted) {
    const diff = pNum - detectedPrinted;
    const votes = (memory._offsetVotes.get(diff) || 0) + 1;
    memory._offsetVotes.set(diff, votes);
    if (votes > (memory._maxOffsetVotes || 0)) {
      memory._maxOffsetVotes = votes;
      memory.pageOffset = diff;
    }
  }

  // 3. Incremental Total & Statistics
  const total = Math.max(memory.totalPages || 1, pNum);
  memory.totalPages = total;

  const scannedCount = memory._scannedSet.size;
  const failedCount = Object.keys(memory.failedAttempts || {}).length;
  const unscannedCount = Math.max(0, total - scannedCount);
  const isComplete = (scannedCount >= total && total > 0);

  memory.ocrStats = {
    totalPages: total,
    scannedCount,
    failedCount,
    unscannedCount,
    isComplete
  };
  memory.updatedAt = new Date(now).toISOString();

  // 4. Content Version & RAG Cache Invalidation (Once per page)
  memory.contentVersion = (memory.contentVersion || 0) + 1;
  memory.ragIndex = null;
  invalidateBookRetrievalCache(memory.bookId);

  // 5. Incremental Chapter Outline Extraction (Targeted & Scalable)
  const hasHeadingIndicators = pNum <= 25 || /(?:içindekiler|bölüm\s*\d+|sayfa\s*\d+|chapter\s*\d+)/i.test(rawPageText);
  if (!memory.chapterOutline || hasHeadingIndicators || isComplete) {
    try {
      const simpleMap = {};
      for (const p of memory._scannedSet) {
        if (p <= 35 || isComplete) {
          simpleMap[p] = memory.scannedPages[p]?.paragraphs;
        }
      }
      memory.chapterOutline = extractBookOutlineIndex(simpleMap);
    } catch (_) {}
  }

  // Commit to L1 cache & wait for IndexedDB persistence
  l1MemoryCache.set(memory.bookId, memory);
  await persistMemoryToIdb(memory);

  return memory;
}

/**
 * Calculates missing, scanned, and failed pages for a book memory.
 *
 * @param {Object} memoryOrBook
 * @param {number|null} [explicitTotalPages]
 * @returns {{ scannedPages: number[], missingPages: number[], failedPages: number[], isComplete: boolean, scannedCount: number, missingCount: number }}
 */
export function getMissingOrFailedPages(memoryOrBook, explicitTotalPages = null) {
  let target = memoryOrBook;
  if (typeof memoryOrBook === 'string') {
    target = l1MemoryCache.get(memoryOrBook) || null;
  } else if (memoryOrBook?.id && !memoryOrBook.scannedPages && l1MemoryCache.has(memoryOrBook.id)) {
    target = l1MemoryCache.get(memoryOrBook.id);
  } else if (memoryOrBook?.bookId && !memoryOrBook.scannedPages && l1MemoryCache.has(memoryOrBook.bookId)) {
    target = l1MemoryCache.get(memoryOrBook.bookId);
  }

  const total = Math.max(1, explicitTotalPages || target?.totalPages || memoryOrBook?.totalPages || 1);
  const scannedPages = [];
  const missingPages = [];
  const failedPages = [];

  const pagesMap = target?.scannedPages || memoryOrBook?.scannedPages || {};
  const paragraphsMap = target?.pageParagraphs || memoryOrBook?.pageParagraphs || {};
  const failedAttempts = target?.failedAttempts || memoryOrBook?.failedAttempts || {};

  for (let p = 1; p <= total; p++) {
    const pageRec = pagesMap[p];
    const paras = (pageRec && pageRec.paragraphs) || paragraphsMap[p];

    const hasValidParagraphs = Array.isArray(paras) && paras.length > 0 && paras.some(t => String(t || '').trim().length > 0);
    const isCompleted = pageRec ? pageRec.ocrStatus === 'completed' : hasValidParagraphs;

    if (isCompleted && hasValidParagraphs) {
      scannedPages.push(p);
    } else if (pageRec && pageRec.ocrStatus === 'failed') {
      failedPages.push(p);
      missingPages.push(p);
    } else if (failedAttempts[p] && failedAttempts[p] >= 2) {
      failedPages.push(p);
      missingPages.push(p);
    } else {
      missingPages.push(p);
    }
  }

  const isComplete = (scannedPages.length === total && total > 0);

  return {
    scannedPages,
    missingPages,
    failedPages,
    isComplete,
    scannedCount: scannedPages.length,
    missingCount: missingPages.length
  };
}

/**
 * Hydrates an in-memory book object with persistent memory.
 * Transfers pageParagraphs, rawText, outline, and stats.
 *
 * @param {Object} book
 * @param {Object} memory
 * @returns {Object} Hydrated book
 */
export function hydrateBookFromMemory(book, memory) {
  if (!book || !memory) return book;

  if (!book.pageParagraphs) book.pageParagraphs = {};
  if (!book.pageRawTexts) book.pageRawTexts = {};

  const scannedPages = memory.scannedPages || {};
  for (const [pStr, pageData] of Object.entries(scannedPages)) {
    const pNum = Number(pStr);
    if (pageData && pageData.ocrStatus === 'completed' && Array.isArray(pageData.paragraphs)) {
      book.pageParagraphs[pNum] = pageData.paragraphs;
      if (pageData.rawText) {
        book.pageRawTexts[pNum] = pageData.rawText;
      }
    }
  }

  if (memory.chapterOutline) {
    book.chapterOutline = memory.chapterOutline;
  }
  if (memory.pdfFingerprint) {
    book.pdfFingerprint = memory.pdfFingerprint;
  }
  if (memory.totalPages) {
    book.totalPages = Math.max(book.totalPages || 1, memory.totalPages);
  }
  if (memory.lastOcrDate) {
    book.lastOcrDate = memory.lastOcrDate;
  }

  return book;
}

/**
 * Master loader: Checks fingerprint, loads persistent memory, hydrates book,
 * and reports preloaded status.
 *
 * @param {Object} book
 * @param {Blob|File|ArrayBuffer|null} [fileOrBuffer]
 * @returns {Promise<{ memory: Object, isPreloaded: boolean, scannedCount: number, missingCount: number }>}
 */
export async function loadOrInitializeBookMemory(book, fileOrBuffer = null) {
  if (!book) throw new Error('Kitap nesnesi gereklidir.');

  let fingerprint = book.pdfFingerprint || null;
  if (!fingerprint && fileOrBuffer) {
    fingerprint = await generatePdfFingerprint(fileOrBuffer, book.totalPages);
    book.pdfFingerprint = fingerprint;
  }

  // 1. Try fetching by bookId
  let memory = await getBookMemory(book.id, fingerprint);

  // 2. If not found by bookId, search by fingerprint to preserve data from prior sessions
  if (!memory && fingerprint) {
    const existing = await findBookMemoryByFingerprint(fingerprint);
    if (existing) {
      memory = existing;
      // Link this bookId to the existing memory
      memory.bookId = String(book.id);
      l1MemoryCache.set(book.id, memory);
      persistMemoryToIdb(memory).catch(() => {});
    }
  }

  // 3. If still no memory, initialize fresh record
  if (!memory) {
    memory = initBookMemory({
      bookId: book.id,
      pdfFingerprint: fingerprint || `pdf_unknown_${Date.now()}`,
      title: book.title,
      author: book.author,
      totalPages: book.totalPages || 1,
      cover: book.cover
    });
  }

  // 4. Hydrate existing in-memory pageParagraphs into memory if present
  if (book.pageParagraphs && typeof book.pageParagraphs === 'object') {
    let hasNewPages = false;
    for (const [pStr, paras] of Object.entries(book.pageParagraphs)) {
      const pNum = Number(pStr);
      if (Array.isArray(paras) && paras.length > 0 && !memory.scannedPages[pNum]) {
        memory.scannedPages[pNum] = {
          pageNumber: pNum,
          paragraphs: paras,
          rawText: Array.isArray(paras) ? paras.join('\n\n') : String(paras),
          ocrStatus: 'completed',
          ocrEngine: 'cached',
          timestamp: Date.now(),
          error: null
        };
        hasNewPages = true;
      }
    }
    if (hasNewPages) {
      persistMemoryToIdb(memory).catch(() => {});
    }
  }

  // 5. Hydrate book from memory
  hydrateBookFromMemory(book, memory);

  const missingStats = getMissingOrFailedPages(memory, book.totalPages);
  const isPreloaded = missingStats.scannedCount > 0;

  return {
    memory,
    isPreloaded,
    scannedCount: missingStats.scannedCount,
    missingCount: missingStats.missingCount,
    missingPages: missingStats.missingPages,
    scannedPages: missingStats.scannedPages
  };
}

/**
 * Gets the current monotonically increasing content version of a book.
 * Used for RAG retrieval cache invalidation.
 */
export function getBookContentVersion(bookId) {
  if (!bookId) return 0;
  const mem = l1MemoryCache.get(String(bookId));
  return mem ? (mem.contentVersion || 1) : 1;
}

/**
 * Deletes persistent book memory by bookId.
 *
 * @param {string} bookId
 * @returns {Promise<boolean>}
 */
export async function deleteBookMemory(bookId) {
  if (!bookId) return false;
  const key = String(bookId);

  l1MemoryCache.delete(key);
  invalidateBookRetrievalCache(key);

  try {
    const db = await getBookMemoryDb();
    if (!db) return true;

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_MEMORIES, 'readwrite');
      tx.objectStore(IDB_STORE_MEMORIES).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[BookMemory] delete error:', err);
    return false;
  }
}

/**
 * Clears all persistent book memories (Cache purge / Reset).
 *
 * @returns {Promise<boolean>}
 */
export async function clearAllBookMemories() {
  l1MemoryCache.clear();
  invalidateBookRetrievalCache();

  try {
    const db = await getBookMemoryDb();
    if (!db) return true;

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_MEMORIES, 'readwrite');
      tx.objectStore(IDB_STORE_MEMORIES).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[BookMemory] clearAll error:', err);
    return false;
  }
}

/**
 * Gets or computes the cached RAG paragraph metadata index for a book.
 * Reuses the precomputed index unless new pages have been scanned.
 *
 * @param {Object} memory
 * @param {Object} pagesTextMap
 * @param {Set<number>} [activePages]
 * @param {Map<number, any>} [failedPages]
 * @returns {Array<Object>}
 */
export function getOrBuildBookRagIndex(memory, pagesTextMap, activePages = new Set(), failedPages = new Map()) {
  if (memory && Array.isArray(memory.ragIndex) && memory.ragIndex.length > 0) {
    return memory.ragIndex;
  }

  const freshIndex = buildParagraphMetadataIndex({
    pagesTextMap,
    bookId: memory?.bookId || 'book',
    activePages,
    failedPages
  });

  if (memory) {
    memory.ragIndex = freshIndex;
  }

  return freshIndex;
}

/**
 * Calculates the next target page to scan for continuous background OCR,
 * adhering to the strict priority order:
 * 1. priorityQueue (jumped pages / on-demand AI requests)
 * 2. currentReaderPage
 * 3. currentReaderPage + 1, + 2 (reading prefetch window)
 * 4. currentReaderPage - 1 (quick flip-back window)
 * 5. Forward sweep from currentReaderPage + 3 to totalPages
 * 6. Backward sweep from 1 to currentReaderPage - 2
 *
 * Returns null ONLY when all pages across the entire book are scanned or reached max failures.
 */
export function getNextTargetPage({
  totalPages = 1,
  pageParagraphs = {},
  currentReaderPage = 1,
  priorityQueue = [],
  activePages = new Set(),
  failedAttempts = new Map(),
  maxFailures = 3
}) {
  const isPageDone = (p) => {
    const paras = pageParagraphs ? pageParagraphs[p] : null;
    return Array.isArray(paras) && paras.length > 0;
  };
  const isCandidateValid = (p) => {
    const fails = failedAttempts instanceof Map ? (failedAttempts.get(p) || 0) : (failedAttempts[p] || 0);
    return p >= 1 && p <= totalPages && !isPageDone(p) && !activePages.has(p) && fails < maxFailures;
  };

  // 1. Priority queue (highest priority)
  while (priorityQueue.length > 0) {
    const candidate = priorityQueue.shift();
    if (isCandidateValid(candidate)) {
      return candidate;
    }
  }

  const readerPage = currentReaderPage || 1;

  // 2. Current visible page
  if (isCandidateValid(readerPage)) {
    return readerPage;
  }

  // 3. Next 2 pages ahead
  for (let offset = 1; offset <= 2; offset++) {
    const nextP = readerPage + offset;
    if (isCandidateValid(nextP)) {
      return nextP;
    }
  }

  // 4. Previous 1 page
  const prevP = readerPage - 1;
  if (isCandidateValid(prevP)) {
    return prevP;
  }

  // 5. Forward sweep from readerPage + 3 to totalPages
  for (let p = readerPage + 3; p <= totalPages; p++) {
    if (isCandidateValid(p)) {
      return p;
    }
  }

  // 6. Backward sweep from 1 to readerPage - 2
  for (let p = 1; p < readerPage - 1; p++) {
    if (isCandidateValid(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Returns the detected page offset (pdfPage - printedPage) for a given book.
 *
 * @param {string} bookId
 * @returns {number|null} Offset or null if not yet determined
 */
export function getBookPageOffset(bookId) {
  if (!bookId) return null;
  const memory = l1MemoryCache.get(String(bookId));
  return typeof memory?.pageOffset === 'number' ? memory.pageOffset : null;
}

/**
 * Estimates the physical PDF sheet number corresponding to a printed page number.
 *
 * @param {string} bookId
 * @param {number} printedPage
 * @returns {number|null}
 */
export function estimatePdfPageFromPrinted(bookId, printedPage) {
  const p = Number(printedPage);
  if (isNaN(p) || p <= 0) return null;
  const offset = getBookPageOffset(bookId);
  return typeof offset === 'number' ? p + offset : p;
}
