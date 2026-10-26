// Storage Service for ReaWid OCR
// Handles API keys, settings, and scan history in localStorage & IndexedDB
// Seamlessly syncs books, reading progress, and notes with Supabase Cloud DB

import {
  supabase,
  syncBookToCloud,
  deleteBookFromCloud,
  syncNoteToCloud,
  deleteNoteFromCloud,
  syncAllWithCloud,
  subscribeAuth,
  getCurrentUser
} from './supabaseService.js';
import {
  fixSpacedOutLetters,
  mergeAccidentalParagraphSplits,
  healTurkishOcrArtifacts,
  normalizeHyphensAndText
} from './aiService.js';

const SETTINGS_KEY = 'reawid_settings_v1';
const HISTORY_KEY = 'reawid_history_v1';
const NOTES_KEY = 'reawid_notes_v2';
const BOOKS_KEY = 'reawid_books_v2';
const CURRENT_BOOK_KEY = 'reawid_current_book_id';
const PURGE_CACHE_KEY = 'reawid_purge_cache_v50';

export const MOCK_BOOK_IDS = new Set([
  'book_insan_ne_ile_yasar',
  'book_sefiller',
  'book_suc_ve_ceza',
  'book_donusum',
  'book_kurk_mantolu_madonna',
  'book_tutunamayanlar'
]);

export const MOCK_TITLES = new Set([
  'İnsan Ne ile Yaşar?',
  'Sefiller',
  'Suç ve Ceza',
  'Dönüşüm',
  'Kürk Mantolu Madonna',
  'Tutunamayanlar'
]);

/* ==========================================================================
   IndexedDB Offline PDF Blob Storage
   ========================================================================== */
const IDB_NAME = 'reawid_pdf_cache';
const IDB_STORE_PDFS = 'pdf_files';
let idbPromise = null;

function getPdfDb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_PDFS)) {
          db.createObjectStore(IDB_STORE_PDFS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return idbPromise;
}

export async function savePdfToIdb(bookId, blobOrBuffer) {
  try {
    const db = await getPdfDb();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_PDFS, 'readwrite');
      tx.objectStore(IDB_STORE_PDFS).put(blobOrBuffer, String(bookId));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('PDF IndexedDB save error:', err);
    return false;
  }
}

export async function getPdfFromIdb(bookId) {
  try {
    const db = await getPdfDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_PDFS, 'readonly');
      const req = tx.objectStore(IDB_STORE_PDFS).get(String(bookId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('PDF IndexedDB get error:', err);
    return null;
  }
}

export async function deletePdfFromIdb(bookId) {
  try {
    const db = await getPdfDb();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_PDFS, 'readwrite');
      tx.objectStore(IDB_STORE_PDFS).delete(String(bookId));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('PDF IndexedDB delete error:', err);
    return false;
  }
}

export async function clearAllPdfsFromIdb() {
  try {
    const db = await getPdfDb();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_PDFS, 'readwrite');
      tx.objectStore(IDB_STORE_PDFS).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('PDF IndexedDB clear error:', err);
    return false;
  }
}

/**
 * Generates an elegant, modern Apple-style SVG book cover thumbnail data URL
 */
export function generateBookCoverSvg(title = 'Kitap', author = 'ReaWid') {
  const safeTitle = String(title || 'Kitap').replace(/[<>&"]/g, '').substring(0, 32);
  const safeAuthor = String(author || 'Kişisel Belge').replace(/[<>&"]/g, '').substring(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" width="200" height="280">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1f1f23"/>
        <stop offset="100%" stop-color="#09090b"/>
      </linearGradient>
      <linearGradient id="s" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="100%" stop-color="transparent"/>
      </linearGradient>
    </defs>
    <rect width="200" height="280" rx="8" fill="url(#g)"/>
    <rect x="0" y="0" width="14" height="280" rx="4" fill="url(#s)"/>
    <rect x="18" y="16" width="164" height="248" rx="6" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle cx="100" cy="80" r="28" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <path d="M88 72h24M88 80h24M88 88h16" stroke="#64d2ff" stroke-width="2" stroke-linecap="round"/>
    <text x="100" y="142" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="600" text-anchor="middle">${safeTitle}</text>
    <text x="100" y="166" fill="#8e8e93" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="11" text-anchor="middle">${safeAuthor}</text>
    <text x="100" y="244" fill="#48484a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="8.5" letter-spacing="1.5" text-anchor="middle">REAWID READER</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Read environment variables (supports both VITE_ and EXPO_PUBLIC_ prefixes)
const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const ENV_ACTIVE_PROVIDER = (metaEnv.VITE_OCR_PROVIDER || metaEnv.EXPO_PUBLIC_OCR_PROVIDER || 'auto').toLowerCase();
const ENV_GROQ_KEY = metaEnv.VITE_GROQ_API_KEY || metaEnv.EXPO_PUBLIC_GROQ_API_KEY || '';
const ENV_OPENROUTER_KEY = metaEnv.VITE_OPENROUTER_API_KEY || metaEnv.EXPO_PUBLIC_OPENROUTER_API_KEY || '';
const ENV_GROQ_MODEL = metaEnv.VITE_GROQ_MODEL || metaEnv.EXPO_PUBLIC_GROQ_MODEL || 'auto';
const ENV_OPENROUTER_MODEL = metaEnv.VITE_OPENROUTER_MODEL || metaEnv.EXPO_PUBLIC_OPENROUTER_MODEL || 'auto';

export const DEFAULT_SETTINGS = {
  // Reading & Display Experience
  defaultTheme: 'koyu', // 'koyu' | 'acik' | 'sepya'
  defaultFont: 'serif', // 'serif' | 'sans' | 'mono'
  defaultFontSize: 'xl', // 'sm' | 'md' | 'lg' | 'xl'
  defaultLineHeight: 'standard', // 'tight' | 'standard' | 'wide'
  defaultMargin: 'standard', // 'narrow' | 'standard' | 'wide'
  autoNightMode: true,
  keepScreenAwake: true, // Screen Wake Lock API for uninterrupted reading
  autoPrefetch: true, // Background next-page preloading
  mergeHyphenatedWords: true, // Matbaa tirelerini birleştir
  ignorePageNumbers: true, // Sayfa numaralarını ve başlıkları gizle
  smartDialogueFormatting: true, // Konuşma ve diyalogları kitaptaki gibi biçimlendir
  swipePageNavigation: true, // Sağa ve sola kaydırarak sayfa değiştirme
  ttsSpeed: 1.0, // 0.8, 1.0, 1.25, 1.5
  offlineCache: true, // Çevrimdışı sayfa önbelleği
  renderDpi: 2.0, // PDF render scale for ultra sharpness
  ocrEngine: 'auto', // 'auto' | 'tesseract' | 'vision_ai'

  // Silent AI Engine (auto from .env)
  activeProvider: ENV_ACTIVE_PROVIDER,
  groqApiKey: ENV_GROQ_KEY,
  groqModel: ENV_GROQ_MODEL,
  openrouterApiKey: ENV_OPENROUTER_KEY,
  openrouterModel: ENV_OPENROUTER_MODEL,
  temperature: 0.05,
  strictTurkish: true,
  preserveFormatting: true
};

export const AVAILABLE_MODELS = {
  auto: [
    {
      id: 'auto',
      name: 'Akıllı Dinamik Yönlendirme (Yalnızca Ücretsiz Modeller)',
      badge: 'Otomatik Geçiş',
      desc: 'Yalnızca doğrulanmış ücretsiz vision modellerini kullanır. Kota aşımında veya yoğunlukta diğer ücretsiz modele geçer, asla ücretli modele aktarmaz.'
    }
  ],
  groq: [
    {
      id: 'auto',
      name: 'Groq Akıllı Otomatik (Ücretsiz LPU)',
      badge: 'Otomatik',
      desc: 'Groq LPU vision modelleri arasında dinamik seçim yapar, yoğunlukta OpenRouter ücretsiz havuzuna aktarır.'
    },
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B Vision (Groq LPU)',
      badge: 'Ücretsiz LPU',
      desc: 'Groq LPU üzerinde çalışan çok modlu vision modeli. Yıldırım hızında Türkçe OCR.'
    }
  ],
  openrouter: [
    {
      id: 'auto',
      name: 'OpenRouter Ücretsiz Dinamik Yönlendirme',
      badge: 'Otomatik',
      desc: 'Yalnızca doğrulanmış ücretsiz (:free) modeller arasında geçiş yapar. Ücretli modellere asla geçmez.'
    },
    {
      id: 'qwen/qwen3.8-27b:free',
      name: 'Qwen 3.8 27B Vision (OpenRouter :free)',
      badge: 'İlk Tercih',
      desc: 'OpenRouter ücretsiz Qwen 3.8 vision modeli. Türkçe karakter ve diyalog hassasiyeti yüksek.'
    },
    {
      id: 'nvidia/nemotron-3.5-super-vl:free',
      name: 'Nemotron 3.5 Super VL (:free)',
      badge: 'Ücretsiz Vision',
      desc: 'NVIDIA 1M context çok modlu ücretsiz görme ve doküman okuma modeli.'
    },
    {
      id: 'google/gemma-4-26b-a4b-it:free',
      name: 'Google Gemma 4 26B (:free)',
      badge: 'Ücretsiz Vision',
      desc: 'Google çok modlu görsel girdi destekleyen ücretsiz model.'
    },
    {
      id: 'openrouter/free',
      name: 'OpenRouter Free Models Router',
      badge: 'Ücretsiz Havuz',
      desc: 'OpenRouter çoklu ücretsiz model yönlendiricisi.'
    }
  ]
};

const DEPRECATED_GROQ_MODELS = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];
const DEPRECATED_OR_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.2-11b-vision-instruct',
  'mistralai/pixtral-12b',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-3.1-flash-lite',
  'qwen/qwen2.5-vl-72b-instruct',
  'qwen/qwen3-vl-30b-a3b-instruct'
];

// Comprehensive purge of legacy mock data and stale caches stored in client devices
function cleanLegacyMockDataOnce() {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawBooks = localStorage.getItem(BOOKS_KEY);
    if (rawBooks) {
      const parsed = JSON.parse(rawBooks);
      if (Array.isArray(parsed)) {
        const cleanBooks = parsed.filter(b => b && b.id && !MOCK_BOOK_IDS.has(b.id) && !MOCK_TITLES.has(b.title));
        localStorage.setItem(BOOKS_KEY, JSON.stringify(cleanBooks));
      }
    }

    const currentId = localStorage.getItem(CURRENT_BOOK_KEY);
    if (currentId && MOCK_BOOK_IDS.has(currentId)) {
      localStorage.removeItem(CURRENT_BOOK_KEY);
    }

    if (!localStorage.getItem(PURGE_CACHE_KEY)) {
      const mockNoteIds = new Set(['note_1', 'note_2', 'note_3']);
      const rawNotes = localStorage.getItem(NOTES_KEY);
      if (rawNotes) {
        const parsed = JSON.parse(rawNotes);
        if (Array.isArray(parsed)) {
          const cleanNotes = parsed.filter(n => !mockNoteIds.has(n.id));
          localStorage.setItem(NOTES_KEY, JSON.stringify(cleanNotes));
        }
      }

      // Purge temporary session & history storage
      sessionStorage.clear();
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem('reawid_mock_cleaned_v1');
      localStorage.removeItem('reawid_mock_cleaned_v2');

      // Purge old HTTP / PWA cache storage
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key !== 'reawid-cloud-v50') {
              caches.delete(key);
            }
          });
        }).catch(() => {});
      }

      // Automatically purge legacy OCR page caches from previously loaded books
      // This forces the newly improved v50 OCR engine to re-scan cleanly on mobile/web
      const rawBooks = localStorage.getItem(BOOKS_KEY);
      if (rawBooks) {
        try {
          const parsedBooks = JSON.parse(rawBooks);
          if (Array.isArray(parsedBooks)) {
            const clearedBooks = parsedBooks.map(b => ({
              ...b,
              pageParagraphs: {} // Purge corrupted old OCR text
            }));
            localStorage.setItem(BOOKS_KEY, JSON.stringify(clearedBooks));
          }
        } catch (_) {}
      }

      localStorage.setItem(PURGE_CACHE_KEY, 'true');
    }
  } catch (err) {
    console.warn('Mock cleanup error:', err);
  }
}
cleanLegacyMockDataOnce();

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);

    let groqModel = parsed.groqModel || DEFAULT_SETTINGS.groqModel;
    if (DEPRECATED_GROQ_MODELS.includes(groqModel)) {
      groqModel = 'qwen/qwen3.8-27b';
    }

    let openrouterModel = parsed.openrouterModel || DEFAULT_SETTINGS.openrouterModel;
    if (DEPRECATED_OR_MODELS.includes(openrouterModel) || !openrouterModel.endsWith(':free') && openrouterModel !== 'openrouter/free' && openrouterModel !== 'auto') {
      openrouterModel = 'qwen/qwen3.8-27b:free';
    }

    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      groqApiKey: ENV_GROQ_KEY || parsed.groqApiKey || DEFAULT_SETTINGS.groqApiKey,
      openrouterApiKey: ENV_OPENROUTER_KEY || parsed.openrouterApiKey || DEFAULT_SETTINGS.openrouterApiKey,
      activeProvider: parsed.activeProvider || DEFAULT_SETTINGS.activeProvider,
      groqModel,
      openrouterModel
    };

    if (parsed.groqModel !== groqModel || parsed.openrouterModel !== openrouterModel) {
      saveSettings(updatedSettings);
    }

    return updatedSettings;
  } catch (err) {
    console.error('Ayarlar okunurken hata:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Ayarlar kaydedilirken hata:', err);
    return false;
  }
}

/* ==========================================================================
   Notes, Bookmarks & Highlights Service (Notlarım & Alıntılar)
   ========================================================================== */
export const INITIAL_NOTES = []; // Zero mock data

export function getNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const notes = JSON.parse(raw);
    if (!Array.isArray(notes)) return [];
    return notes;
  } catch (err) {
    console.error('Notlar okunurken hata:', err);
    return [];
  }
}

export function saveNote(note) {
  try {
    const notes = getNotes();
    const newNote = {
      id: note.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      bookId: note.bookId || '',
      bookTitle: note.bookTitle || 'Kişisel Belge',
      bookAuthor: note.bookAuthor || '',
      pageNumber: Number(note.pageNumber) || 1,
      type: note.type || 'quote', // 'quote' | 'note' | 'bookmark'
      text: note.text || '',
      userNote: note.userNote || '',
      createdAt: note.createdAt || Date.now(),
      dateFormatted: note.dateFormatted || new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
    };
    const updated = [newNote, ...notes.filter(n => n.id !== newNote.id)];
    localStorage.setItem(NOTES_KEY, JSON.stringify(updated));

    // Background cloud sync
    syncNoteToCloud(newNote).catch(() => {});

    return newNote;
  } catch (err) {
    console.error('Not kaydedilirken hata:', err);
    return null;
  }
}

export function deleteNote(id) {
  try {
    const notes = getNotes();
    const filtered = notes.filter((x) => x.id !== id);
    localStorage.setItem(NOTES_KEY, JSON.stringify(filtered));

    // Background cloud sync
    deleteNoteFromCloud(id).catch(() => {});

    return filtered;
  } catch (err) {
    console.error('Not silinirken hata:', err);
    return [];
  }
}

export function clearNotes() {
  try {
    localStorage.removeItem(NOTES_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/* ==========================================================================
   Book Library & Reading Progress Service
   ========================================================================== */
export const INITIAL_BOOKS = []; // Zero mock data

export function getBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    if (!raw) return [];
    const books = JSON.parse(raw);
    if (!Array.isArray(books)) return [];
    let cacheUpdated = false;
    const cleanBooks = books
      .filter(b => b && b.id && !MOCK_BOOK_IDS.has(b.id) && !MOCK_TITLES.has(b.title))
      .map(b => {
        // Auto-heal legacy cached page paragraphs: fix spaced letters, restore hyphens, and heal Turkish OCR artifacts
        if (b.pageParagraphs && typeof b.pageParagraphs === 'object') {
          let bookModified = false;
          const healedPages = {};
          for (const [pNum, paras] of Object.entries(b.pageParagraphs)) {
            if (Array.isArray(paras)) {
              const cleanedList = paras.map(p => (typeof p === 'string' ? normalizeHyphensAndText(p) : p));
              const merged = mergeAccidentalParagraphSplits(cleanedList);
              healedPages[pNum] = merged;
              bookModified = true;
            } else if (typeof paras === 'string') {
              const cleaned = normalizeHyphensAndText(paras);
              const split = cleaned.split(/\r?\n\n+/);
              const merged = mergeAccidentalParagraphSplits(split);
              healedPages[pNum] = merged;
              bookModified = true;
            } else {
              healedPages[pNum] = paras;
            }
          }
          if (bookModified) {
            b.pageParagraphs = healedPages;
            cacheUpdated = true;
          }
        }
        return b;
      });

    if (cacheUpdated) {
      try {
        localStorage.setItem(BOOKS_KEY, JSON.stringify(cleanBooks));
      } catch (_) {}
    }

    return cleanBooks;
  } catch (err) {
    console.error('Kitaplar okunurken hata:', err);
    return [];
  }
}

export function saveBook(book) {
  try {
    const books = getBooks();
    const existingIndex = books.findIndex(b => b.id === book.id);
    let updatedBook;
    if (existingIndex >= 0) {
      updatedBook = { ...books[existingIndex], ...book };
      books[existingIndex] = updatedBook;
    } else {
      updatedBook = { ...book };
      books.unshift(updatedBook);
    }
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));

    // Background cloud sync
    syncBookToCloud(updatedBook).catch(() => {});

    return updatedBook;
  } catch (err) {
    console.error('Kitap kaydedilirken hata:', err);
    return null;
  }
}

export function getCurrentBook() {
  const books = getBooks();
  if (!books || books.length === 0) return null;
  const currentId = localStorage.getItem(CURRENT_BOOK_KEY);
  if (currentId) {
    if (MOCK_BOOK_IDS.has(currentId)) {
      localStorage.removeItem(CURRENT_BOOK_KEY);
    } else {
      const found = books.find(b => b.id === currentId);
      if (found) return found;
    }
  }
  const current = books.find(b => b.isCurrent);
  return current || books[0] || null;
}

export function setCurrentBook(bookId) {
  try {
    localStorage.setItem(CURRENT_BOOK_KEY, bookId);
    const books = getBooks();
    const updated = books.map(b => ({
      ...b,
      isCurrent: b.id === bookId
    }));
    localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    return false;
  }
}

export function updateBookProgress(bookId, progressPercent, currentPage) {
  try {
    const books = getBooks();
    let updatedBook = null;
    const updated = books.map(b => {
      if (b.id === bookId) {
        updatedBook = {
          ...b,
          progress: Math.min(100, Math.max(0, Math.round(progressPercent))),
          currentPage: currentPage || b.currentPage,
          isCurrent: true
        };
        return updatedBook;
      }
      return { ...b, isCurrent: false };
    });
    localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
    localStorage.setItem(CURRENT_BOOK_KEY, bookId);

    // Background cloud sync
    if (updatedBook) {
      syncBookToCloud(updatedBook).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('İlerleme güncellenirken hata:', err);
    return false;
  }
}

export function getBookById(id) {
  const books = getBooks();
  return books.find(b => b.id === id) || null;
}

export function deleteBook(bookId) {
  try {
    const books = getBooks();
    const filtered = books.filter(b => b.id !== bookId);
    localStorage.setItem(BOOKS_KEY, JSON.stringify(filtered));

    // Delete cached PDF blob from IndexedDB
    deletePdfFromIdb(bookId).catch(() => {});

    // Background cloud sync
    deleteBookFromCloud(bookId).catch(() => {});

    return true;
  } catch (err) {
    console.error('Kitap silinirken hata:', err);
    return false;
  }
}

export function updateBookPageParagraphs(bookId, pageNum, paragraphs, rawText = null) {
  try {
    const books = getBooks();
    let updatedBook = null;
    const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [paragraphs];

    const updated = books.map(b => {
      if (b.id === bookId) {
        const pageParagraphs = { ...(b.pageParagraphs || {}), [pageNum]: safeParagraphs };
        const pageRawTexts = rawText
          ? { ...(b.pageRawTexts || {}), [pageNum]: rawText }
          : (b.pageRawTexts || {});
        updatedBook = {
          ...b,
          pageParagraphs,
          pageRawTexts
        };
        return updatedBook;
      }
      return b;
    });
    localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));

    // Background cloud sync
    if (updatedBook) {
      syncBookToCloud(updatedBook).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('Sayfa paragrafları kaydedilirken hata:', err);
    return false;
  }
}

/* ==========================================================================
   Supabase Cloud Sync Trigger
   ========================================================================== */
export async function syncLocalWithCloudDb() {
  const localBooks = getBooks();
  const localNotes = getNotes();
  const res = await syncAllWithCloud(localBooks, localNotes);
  if (res.synced && Array.isArray(res.books) && Array.isArray(res.notes)) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(res.books));
    localStorage.setItem(NOTES_KEY, JSON.stringify(res.notes));
  }
  return res;
}

// Automatically sync when user logs in or auth state changes
subscribeAuth((user) => {
  if (user) {
    syncLocalWithCloudDb().catch(err => {
      console.warn('Auto sync on auth change warning:', err);
    });
  }
});

// Data Export & Import (Yedekleme ve Geri Yükleme)
export function exportAllData() {
  return JSON.stringify({
    version: 'reawid_v2',
    timestamp: Date.now(),
    books: getBooks(),
    notes: getNotes(),
    settings: getSettings()
  }, null, 2);
}

export function importAllData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.books && Array.isArray(parsed.books)) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(parsed.books));
    }
    if (parsed.notes && Array.isArray(parsed.notes)) {
      localStorage.setItem(NOTES_KEY, JSON.stringify(parsed.notes));
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      saveSettings(parsed.settings);
    }
    // Sync newly imported data to Supabase
    syncLocalWithCloudDb().catch(() => {});
    return { success: true, message: 'Yedek başarıyla içe aktarıldı ve buluta eşitlendi!' };
  } catch (err) {
    return { success: false, message: 'Geçersiz yedek dosyası formatı.' };
  }
}

export function clearAppCache() {
  try {
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      }).catch(() => {});
    }
    return true;
  } catch (_) {
    return false;
  }
}

export async function resetAllAppData() {
  try {
    // 1. Wipe local books, notes and reading state
    localStorage.setItem(BOOKS_KEY, JSON.stringify([]));
    localStorage.setItem(NOTES_KEY, JSON.stringify([]));
    localStorage.removeItem(CURRENT_BOOK_KEY);
    localStorage.removeItem(HISTORY_KEY);
    sessionStorage.clear();

    // 2. If logged in, wipe Supabase remote data
    const user = getCurrentUser ? getCurrentUser() : null;
    if (user && supabase) {
      await supabase.from('books').delete().eq('user_id', user.id);
      await supabase.from('notes').delete().eq('user_id', user.id);
    }

    // 3. Clear IndexedDB PDF blobs
    await clearAllPdfsFromIdb().catch(() => {});

    // 4. Purge caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    return { success: true };
  } catch (err) {
    console.error('Reset all data error:', err);
    return { success: false, error: err };
  }
}

export function clearBookOcrCache(bookId) {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    if (!raw) return false;
    const books = JSON.parse(raw);
    if (!Array.isArray(books)) return false;
    const target = books.find(b => b.id === bookId);
    if (target) {
      target.pageParagraphs = {};
      target.currentPage = 1;
      target.progress = 0;
      localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
      return true;
    }
    return false;
  } catch (err) {
    console.warn('clearBookOcrCache error:', err);
    return false;
  }
}

// Backward-compatibility stubs
export const getHistory = () => [];
export const saveHistoryItem = () => null;
export const deleteHistoryItem = () => [];
export const clearHistory = () => true;
