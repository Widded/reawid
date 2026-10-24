// Storage Service for ReaWid OCR
// Handles API keys, settings, and scan history in localStorage & IndexedDB

const SETTINGS_KEY = 'reawid_settings_v1';
const HISTORY_KEY = 'reawid_history_v1';

// Read environment variables (supports both VITE_ and EXPO_PUBLIC_ prefixes)
const ENV_ACTIVE_PROVIDER = (import.meta.env.VITE_OCR_PROVIDER || import.meta.env.EXPO_PUBLIC_OCR_PROVIDER || 'auto').toLowerCase();
const ENV_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const ENV_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '';
const ENV_GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || import.meta.env.EXPO_PUBLIC_GROQ_MODEL || 'auto';
const ENV_OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'auto';

export const DEFAULT_SETTINGS = {
  activeProvider: ENV_ACTIVE_PROVIDER, // 'auto' | 'openrouter' | 'groq'
  groqApiKey: ENV_GROQ_KEY,
  groqModel: ENV_GROQ_MODEL,
  openrouterApiKey: ENV_OPENROUTER_KEY,
  openrouterModel: ENV_OPENROUTER_MODEL,
  temperature: 0.1,
  strictTurkish: true,
  mergeHyphenatedWords: true,
  ignorePageNumbers: true,
  preserveFormatting: true,
  renderDpi: 2.0 // PDF render scale for ultra sharpness
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

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);

    // Auto-migrate old decommissioned models stored in localStorage
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

    // If migration happened, persist updated settings
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

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Geçmiş okunurken hata:', err);
    return [];
  }
}

export function saveHistoryItem(item) {
  try {
    const history = getHistory();
    const newItem = {
      id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      title: item.title || 'Tarama #' + (history.length + 1),
      sourceType: item.sourceType || 'image', // 'image' | 'camera' | 'pdf'
      text: item.text || '',
      thumbnail: item.thumbnail || '', // small base64
      provider: item.provider || 'groq',
      model: item.model || '',
      wordCount: (item.text || '').trim().split(/\s+/).filter(Boolean).length,
      charCount: (item.text || '').length
    };
    // Keep last 30 scans
    const updated = [newItem, ...history].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return newItem;
  } catch (err) {
    console.error('Geçmiş kaydedilirken hata:', err);
    return null;
  }
}

export function deleteHistoryItem(id) {
  try {
    const history = getHistory();
    const filtered = history.filter((x) => x.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Kayıt silinirken hata:', err);
    return [];
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/* ==========================================================================
   Book Library & Reading Progress Service
   ========================================================================== */
const BOOKS_KEY = 'reawid_books_v2';
const CURRENT_BOOK_KEY = 'reawid_current_book_id';

export const INITIAL_BOOKS = [
  {
    id: 'book_insan_ne_ile_yasar',
    title: 'İnsan Ne ile Yaşar?',
    author: 'Lev Tolstoy',
    cover: '/cover-1.jpg',
    totalPages: 218,
    currentPage: 142,
    progress: 42,
    date: '15 Ekim 2025',
    isCurrent: true,
    chapter: '3. Bölüm',
    status: 'okunanlar',
    chapterSubtitle: '3. Bölüm · 142 / 218 sayfa',
    realPageImage: '/real-page-insan-ne-ile-yasar.svg',
    pageParagraphs: {
      3: [
        "İnsan, yalnızca ekmekle değil, aynı zamanda sevgi, umut ve anlamla da yaşar. Hayatın gerçek değeri, insanın kalbinde taşıdığı iyiliktedir.",
        "Bazen en küçük bir iyilik, bir insanın tüm hayatını değiştirebilir. Çünkü insan, ancak başkaları için bir şeyler yaptığında gerçek anlamda var olur.",
        "İyilik, farkında olmadan da olsa bir ışık gibi yayılır ve bir gün mutlaka karşılık bulur. Bu yüzden, insan yalnızca kendisi için değil, çevresindeki herkes için de yaşamalıdır."
      ],
      142: [
        "Simon kunduracı kulübesine doğru ağır adımlarla yürürken, içindeki ses ona merhametin kapılarını ardına kadar açmasını söylüyordu. Soğuk rüzgâr dalları savururken, insanın içindeki ateş hiç sönmeyecekti.",
        "Sevgi nerede ise Tanrı da oradadır. İnsanoğlu hayatı boyunca neyin peşinden koşarsa koşsun, hakiki huzuru yalnızca başkalarına faydalı olduğunda bulur."
      ]
    },
    content: `BÖLÜM 1

# İnsan Ne ile Yaşar?

İnsan, yalnızca ekmekle değil, aynı zamanda sevgi, umut ve anlamla da yaşar. Hayatın gerçek değeri, insanın kalbinde taşıdığı iyiliktedir.`
  },
  {
    id: 'book_sefiller',
    title: 'Sefiller',
    author: 'Victor Hugo',
    cover: '/cover-3.svg',
    totalPages: 286,
    currentPage: 52,
    progress: 18,
    date: '10 Ekim 2025',
    isCurrent: false,
    chapter: '1. Bölüm',
    status: 'okunanlar',
    chapterSubtitle: '1. Bölüm · 52 / 286 sayfa',
    content: `# Sefiller
*Victor Hugo*

## Bölüm 1: Jean Valjean ve Piskopos

1815 yılında Charles-François-Bienvenu Myriel, Digne Piskoposu idi. Yaklaşık yetmiş beş yaşlarında bir ihtiyardı; 1806'dan beri bu mevkide bulunuyordu. Piskopos kapısını asla kilitlemezdi; evine gelen her yoksul, her yabancı içeri kabul edilirdi.`
  },
  {
    id: 'book_suc_ve_ceza',
    title: 'Suç ve Ceza',
    author: 'Fyodor Dostoyevski',
    cover: '/cover-2.svg',
    totalPages: 612,
    currentPage: 0,
    progress: 0,
    date: '12 Ekim 2025',
    isCurrent: false,
    chapter: '-',
    status: 'okunacaklar',
    chapterSubtitle: '- / 612 sayfa',
    content: `# Suç ve Ceza
*Fyodor Dostoyevski*

## Bölüm 1: Petersburg ve Raskolnikov

Temmuz başında, son derece sıcak bir günün akşamüstü, S. sokağındaki daracık odasından çıkan bir genç, ağır ağır K. köprüsüne doğru yürüdü.`
  },
  {
    id: 'book_donusum',
    title: 'Dönüşüm',
    author: 'Franz Kafka',
    cover: '/cover-4.svg',
    totalPages: 189,
    currentPage: 68,
    progress: 36,
    date: '8 Ekim 2025',
    isCurrent: false,
    chapter: '4. Bölüm',
    status: 'okunanlar',
    chapterSubtitle: '4. Bölüm · 68 / 189 sayfa',
    content: `# Dönüşüm
*Franz Kafka*

## Bölüm 1: Gregor Samsa

Gregor Samsa bir sabah huzursuz düşlerden uyandığında, kendini yatağında devasa bir böceğe dönüşmüş olarak buldu.`
  },
  {
    id: 'book_kurk_mantolu_madonna',
    title: 'Kürk Mantolu Madonna',
    author: 'Sabahattin Ali',
    cover: '/cover-5.svg',
    totalPages: 243,
    currentPage: 28,
    progress: 12,
    date: '5 Ekim 2025',
    isCurrent: false,
    chapter: '2. Bölüm',
    status: 'okunanlar',
    chapterSubtitle: '2. Bölüm · 28 / 243 sayfa',
    content: `# Kürk Mantolu Madonna
*Sabahattin Ali*

## Bölüm 1: Raif Efendi

Şimdiye kadar tesadüf ettiğim insanlardan bir tanesi benim üzerimde belki en büyük tesiri yapmıştır. Aradan seneler geçtiği halde bu tesir zerre kadar azalmadı.`
  },
  {
    id: 'book_tutunamayanlar',
    title: 'Tutunamayanlar',
    author: 'Oğuz Atay',
    cover: '/cover-6.svg',
    totalPages: 287,
    currentPage: 0,
    progress: 0,
    date: '1 Ekim 2025',
    isCurrent: false,
    chapter: '-',
    status: 'okunacaklar',
    chapterSubtitle: '- / 287 sayfa',
    content: `# Tutunamayanlar
*Oğuz Atay*

## Birinci Bölüm: Turgut Özben

Olay, bir akşamüstü Turgut Özben'in Selim Işık'ın intihar ettiğini öğrenmesiyle başlar. Selim, hayatı boyunca tutunmaya çalışan ama başaramayan bir ruhtur.`
  }
];

export function getBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    if (!raw) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
      return INITIAL_BOOKS;
    }
    const books = JSON.parse(raw);
    if (!Array.isArray(books) || books.length === 0) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
      return INITIAL_BOOKS;
    }
    return books;
  } catch (err) {
    console.error('Kitaplar okunurken hata:', err);
    return INITIAL_BOOKS;
  }
}

export function saveBook(book) {
  try {
    const books = getBooks();
    const existingIndex = books.findIndex(b => b.id === book.id);
    if (existingIndex >= 0) {
      books[existingIndex] = { ...books[existingIndex], ...book };
    } else {
      books.unshift(book);
    }
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
    return book;
  } catch (err) {
    console.error('Kitap kaydedilirken hata:', err);
    return null;
  }
}

export function getCurrentBook() {
  const books = getBooks();
  const currentId = localStorage.getItem(CURRENT_BOOK_KEY);
  if (currentId) {
    const found = books.find(b => b.id === currentId);
    if (found) return found;
  }
  const current = books.find(b => b.isCurrent);
  return current || books[0];
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
    const updated = books.map(b => {
      if (b.id === bookId) {
        return {
          ...b,
          progress: Math.min(100, Math.max(0, Math.round(progressPercent))),
          currentPage: currentPage || b.currentPage,
          isCurrent: true
        };
      }
      return { ...b, isCurrent: false };
    });
    localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
    localStorage.setItem(CURRENT_BOOK_KEY, bookId);
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
    return true;
  } catch (err) {
    console.error('Kitap silinirken hata:', err);
    return false;
  }
}

export function updateBookPageParagraphs(bookId, pageNum, paragraphs) {
  try {
    const books = getBooks();
    const updated = books.map(b => {
      if (b.id === bookId) {
        const pageParagraphs = { ...(b.pageParagraphs || {}), [pageNum]: paragraphs };
        return {
          ...b,
          pageParagraphs
        };
      }
      return b;
    });
    localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Sayfa paragrafları kaydedilirken hata:', err);
    return false;
  }
}


