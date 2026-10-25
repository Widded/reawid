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

const SETTINGS_KEY = 'reawid_settings_v1';
const HISTORY_KEY = 'reawid_history_v1';
const NOTES_KEY = 'reawid_notes_v2';
const BOOKS_KEY = 'reawid_books_v2';
const CURRENT_BOOK_KEY = 'reawid_current_book_id';
const PURGE_CACHE_KEY = 'reawid_purge_cache_v25';

// Read environment variables (supports both VITE_ and EXPO_PUBLIC_ prefixes)
const ENV_ACTIVE_PROVIDER = (import.meta.env.VITE_OCR_PROVIDER || import.meta.env.EXPO_PUBLIC_OCR_PROVIDER || 'auto').toLowerCase();
const ENV_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const ENV_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '';
const ENV_GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || import.meta.env.EXPO_PUBLIC_GROQ_MODEL || 'auto';
const ENV_OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'auto';

export const DEFAULT_SETTINGS = {
  // Reading & Display Experience
  defaultTheme: 'koyu', // 'koyu' | 'acik' | 'sepya'
  defaultFont: 'serif', // 'serif' | 'sans' | 'mono'
  defaultFontSize: 'xl', // 'sm' | 'md' | 'lg' | 'xl'
  autoNightMode: true,
  keepScreenAwake: true, // Screen Wake Lock API for uninterrupted reading
  autoPrefetch: true, // Background next-page preloading
  mergeHyphenatedWords: true, // Matbaa tirelerini birleştir
  ignorePageNumbers: true, // Sayfa numaralarını ve başlıkları gizle
  ttsSpeed: 1.0, // 0.8, 1.0, 1.25, 1.5
  offlineCache: true, // Çevrimdışı sayfa önbelleği
  renderDpi: 2.0, // PDF render scale for ultra sharpness

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
      name: 'Akıllı Dinamik Yönlendirme (Önerilen)',
      badge: 'Otomatik Geçiş',
      desc: 'En güçlü ve en hızlı free/aktif modeli seçer. Model yoğunsa veya limit aşılırsa otomatik diğerine geçer.'
    }
  ],
  groq: [
    {
      id: 'auto',
      name: 'Groq Akıllı Otomatik (Hızlı + Yedekli)',
      badge: 'Otomatik',
      desc: 'Groq LPU modelleri arasında dinamik seçim yapar, yoğunlukta yedek modele veya OpenRouter\'a aktarır.'
    },
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B Vision (Groq LPU)',
      badge: 'Tavsiye Edilen',
      desc: 'Groq LPU üzerinde çalışan en güncel çok modlu vision modeli. Yıldırım hızında Türkçe OCR.'
    }
  ],
  openrouter: [
    {
      id: 'auto',
      name: 'OpenRouter Akıllı Yönlendirme (Otomatik Yedekleme)',
      badge: 'Otomatik',
      desc: 'En kaliteli modeller arasında (Gemini 2.5 Flash, Flash Lite, Qwen 2.5 VL) sunucu durumuna göre dinamik geçiş yapar.'
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (Google)',
      badge: 'Tavsiye Edilen',
      desc: 'Yeni nesil Google Vision AI, harika Türkçe karakter hassasiyeti ve hızlı analiz.'
    },
    {
      id: 'google/gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite (Google)',
      badge: 'Ekonomik & Hızlı',
      desc: 'Çok sayfalı kitap taramaları için süper hızlı ve maliyet dostu akıllı OCR.'
    },
    {
      id: 'google/gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite (Google)',
      badge: 'Yeni Nesil',
      desc: 'Google\'ın en güncel optimize görme ve doküman okuma mimarisi.'
    },
    {
      id: 'qwen/qwen2.5-vl-72b-instruct',
      name: 'Qwen 2.5 VL 72B Instruct',
      badge: 'Ağır Siklet',
      desc: 'Görsel doküman okumada ve yıpranmış kitap sayfalarında dünyanın en yetenekli açık modellerinden.'
    },
    {
      id: 'qwen/qwen3-vl-30b-a3b-instruct',
      name: 'Qwen 3 VL 30B Instruct',
      badge: 'Qwen 3',
      desc: 'Gelişmiş görsel okuma, tablo çözümleme ve çok dilli analiz yeteneği.'
    }
  ]
};

const DEPRECATED_GROQ_MODELS = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];
const DEPRECATED_OR_MODELS = ['google/gemini-2.0-flash-001', 'google/gemini-flash-1.5', 'meta-llama/llama-3.2-11b-vision-instruct', 'mistralai/pixtral-12b'];

// Comprehensive purge of legacy mock data and stale caches stored in client devices
function cleanLegacyMockDataOnce() {
  try {
    if (!localStorage.getItem(PURGE_CACHE_KEY)) {
      const mockBookIds = new Set([
        'book_insan_ne_ile_yasar',
        'book_sefiller',
        'book_suc_ve_ceza',
        'book_donusum',
        'book_kurk_mantolu_madonna',
        'book_tutunamayanlar'
      ]);
      const rawBooks = localStorage.getItem(BOOKS_KEY);
      if (rawBooks) {
        const parsed = JSON.parse(rawBooks);
        if (Array.isArray(parsed)) {
          const cleanBooks = parsed.filter(b => !mockBookIds.has(b.id));
          localStorage.setItem(BOOKS_KEY, JSON.stringify(cleanBooks));
        }
      }

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
            if (key !== 'reawid-cloud-v25') {
              caches.delete(key);
            }
          });
        }).catch(() => {});
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
    if (DEPRECATED_OR_MODELS.includes(openrouterModel)) {
      openrouterModel = 'google/gemini-2.5-flash';
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
    return books;
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
    const found = books.find(b => b.id === currentId);
    if (found) return found;
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

    // Background cloud sync
    deleteBookFromCloud(bookId).catch(() => {});

    return true;
  } catch (err) {
    console.error('Kitap silinirken hata:', err);
    return false;
  }
}

export function updateBookPageParagraphs(bookId, pageNum, paragraphs) {
  try {
    const books = getBooks();
    let updatedBook = null;
    const updated = books.map(b => {
      if (b.id === bookId) {
        const pageParagraphs = { ...(b.pageParagraphs || {}), [pageNum]: paragraphs };
        updatedBook = {
          ...b,
          pageParagraphs
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

    // 3. Purge caches
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

// Backward-compatibility stubs
export const getHistory = () => [];
export const saveHistoryItem = () => null;
export const deleteHistoryItem = () => [];
export const clearHistory = () => true;
