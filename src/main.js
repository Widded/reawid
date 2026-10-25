// Reawid - Apple Minimalist Main Orchestrator
import { marked } from 'marked';
import confetti from 'canvas-confetti';

import {
  getSettings,
  saveSettings,
  getNotes,
  saveNote,
  deleteNote,
  clearNotes,
  exportAllData,
  importAllData,
  clearAppCache,
  getBooks,
  saveBook,
  getCurrentBook,
  setCurrentBook,
  updateBookProgress,
  updateBookPageParagraphs,
  getBookById,
  deleteBook,
  getHistory,
  saveHistoryItem,
  AVAILABLE_MODELS
} from './services/storageService.js';

import {
  performOcr,
  testApiConnection
} from './services/aiService.js';

import {
  loadImage,
  fileToBase64,
  processImage,
  createThumbnail
} from './services/imageProcessor.js';

import {
  loadPdf,
  renderPdfPageToCanvas,
  renderPdfThumbnails,
  extractPdfPageText
} from './services/pdfService.js';

import {
  speakText,
  stopSpeech,
  isSpeaking,
  isTtsSupported
} from './services/speechService.js';

import {
  copyToClipboard
} from './services/exportService.js';

/* ==========================================================================
   Application State
   ========================================================================== */
let appSettings = getSettings();
let currentActiveBook = null;
let currentReaderPage = 3;
let currentTotalPages = 218;
let currentReaderTheme = 'koyu';
let currentReaderFontSize = 'xl'; // 'sm' | 'md' | 'lg' | 'xl'
let currentReaderLineHeight = 'standard'; // 'tight' | 'standard' | 'wide'
let currentReaderFont = 'serif'; // 'serif' | 'sans' | 'mono'
let currentReaderMargin = 'standard'; // 'narrow' | 'standard' | 'wide'
let currentCompareZoom = 1.0;
let isBookmarked = false;

let currentImageRaw = null;
let currentProcessedImage = null;
let currentRotation = 0;
let currentContrast = 1.0;
let isGrayscale = false;
let isBinarized = false;

let currentPdfDoc = null;
let currentPdfNumPages = 0;
let selectedPdfPage = 1;
let currentPdfPagesMap = {}; // Maps pageNum -> array of paragraphs
let pdfBatchStartPage = 1;
let pdfBatchEndPage = 1;
let pdfBatchRangeMode = 'all'; // 'all' | 'first5' | 'single' | 'custom'

// Background & Priority OCR Engine State
let isBackgroundOcrActive = false;
let priorityPageQueue = []; // Array of page numbers requested with top priority
const activeAnalyzingPages = new Set(); // Pages currently in-flight across parallel workers
const activeWorkerControllers = new Map(); // workerId -> { controller, pageNum }

let lastOcrResult = '';
let isOcrRunning = false;
let abortController = null;
let deferredPrompt = null;

// Kitaplığım (My Library) State
let currentLibraryFilter = 'all'; // 'all' | 'okunanlar' | 'okunacaklar' | 'donusturuluyor'
let currentLibrarySort = 'default'; // 'default' | 'name' | 'progress' | 'date'
let currentLibrarySearchQuery = '';
let activeCardActionBookId = null;
let previousActiveTab = 'home';

// Notlarım (My Notes) State & System State
let currentNotesFilter = 'all'; // 'all' | 'quote' | 'note' | 'bookmark'
let currentNotesSearchQuery = '';
let currentNoteModalType = 'note'; // 'note' | 'quote' | 'bookmark'
let wakeLockSentinel = null;

/* ==========================================================================
   DOM Elements
   ========================================================================== */
const el = {
  // Screens
  homeView: document.getElementById('homeView'),
  libraryViewScreen: document.getElementById('libraryViewScreen'),
  notesViewScreen: document.getElementById('notesViewScreen'),
  settingsViewScreen: document.getElementById('settingsViewScreen'),
  inAppReaderView: document.getElementById('inAppReaderView'),
  conversionModal: document.getElementById('conversionModal'),
  toastContainer: document.getElementById('toastContainer'),

  // Kitaplığım (My Library) Elements
  btnLibraryHeaderSearch: document.getElementById('btnLibraryHeaderSearch'),
  btnLibraryHeaderMore: document.getElementById('btnLibraryHeaderMore'),
  libraryHeaderMenu: document.getElementById('libraryHeaderMenu'),
  librarySearchInput: document.getElementById('librarySearchInput'),
  btnClearLibrarySearch: document.getElementById('btnClearLibrarySearch'),
  libraryFilterPills: document.getElementById('libraryFilterPills'),
  btnLibrarySort: document.getElementById('btnLibrarySort'),
  libraryBooksList: document.getElementById('libraryBooksList'),
  btnLibraryFab: document.getElementById('btnLibraryFab'),
  bookCardActionSheet: document.getElementById('bookCardActionSheet'),
  actionSheetBookTitle: document.getElementById('actionSheetBookTitle'),
  btnCloseCardActionSheet: document.getElementById('btnCloseCardActionSheet'),
  sheetBtnOpenReader: document.getElementById('sheetBtnOpenReader'),
  sheetBtnCompare: document.getElementById('sheetBtnCompare'),
  sheetBtnToggleReadStatus: document.getElementById('sheetBtnToggleReadStatus'),
  sheetToggleReadLabel: document.getElementById('sheetToggleReadLabel'),
  sheetBtnDeleteBook: document.getElementById('sheetBtnDeleteBook'),
  popoverLibrarySortDate: document.getElementById('popoverLibrarySortDate'),
  popoverLibrarySortName: document.getElementById('popoverLibrarySortName'),
  popoverLibrarySortProgress: document.getElementById('popoverLibrarySortProgress'),

  // Header
  btnProfile: document.getElementById('btnProfile'),

  // Main Action Cards
  btnNewBookCard: document.getElementById('btnNewBookCard'),
  btnExtractTextCard: document.getElementById('btnExtractTextCard'),
  btnOcrCard: document.getElementById('btnOcrCard'),

  // Devam Eden Kitap
  cardContinueBook: document.getElementById('cardContinueBook'),
  currentBookCover: document.getElementById('currentBookCover'),
  currentBookTitle: document.getElementById('currentBookTitle'),
  currentBookAuthor: document.getElementById('currentBookAuthor'),
  currentBookProgressFill: document.getElementById('currentBookProgressFill'),
  currentBookProgressLabel: document.getElementById('currentBookProgressLabel'),
  btnViewAllContinue: document.getElementById('btnViewAllContinue'),

  // Son Kitaplar
  recentBooksList: document.getElementById('recentBooksList'),
  btnViewAllRecent: document.getElementById('btnViewAllRecent'),

  // Storage Card
  cardStorageUsage: document.getElementById('cardStorageUsage'),
  storageUsageText: document.getElementById('storageUsageText'),

  // Bottom Navigation
  navHome: document.getElementById('navHome'),
  navLibrary: document.getElementById('navLibrary'),
  navNotes: document.getElementById('navNotes'),
  navSettings: document.getElementById('navSettings'),

  // Hidden Inputs
  fileInputPdf: document.getElementById('fileInputPdf'),
  fileInputPhoto: document.getElementById('fileInputPhoto'),

  // Reader Elements
  btnCloseReader: document.getElementById('btnCloseReader'),
  readerHeaderTitle: document.getElementById('readerHeaderTitle'),
  readerHeaderAuthor: document.getElementById('readerHeaderAuthor'),
  readerBgOcrPill: document.getElementById('readerBgOcrPill'),
  readerBgOcrDot: document.getElementById('readerBgOcrDot'),
  readerBgOcrText: document.getElementById('readerBgOcrText'),
  btnReaderBookmark: document.getElementById('btnReaderBookmark'),
  bookmarkIconSvg: document.getElementById('bookmarkIconSvg'),
  btnReaderCompare: document.getElementById('btnReaderCompare'),
  btnReaderAppearance: document.getElementById('btnReaderAppearance'),
  btnReaderSearch: document.getElementById('btnReaderSearch'),
  btnReaderMore: document.getElementById('btnReaderMore'),
  readerMoreMenu: document.getElementById('readerMoreMenu'),
  popoverOpenAppearance: document.getElementById('popoverOpenAppearance'),
  popoverAddBookmark: document.getElementById('popoverAddBookmark'),
  popoverAddNote: document.getElementById('popoverAddNote'),
  popoverCopyText: document.getElementById('popoverCopyText'),
  popoverShareText: document.getElementById('popoverShareText'),
  popoverOpenPdf: document.getElementById('popoverOpenPdf'),
  readerSearchBar: document.getElementById('readerSearchBar'),
  readerSearchInput: document.getElementById('readerSearchInput'),
  btnCloseReaderSearch: document.getElementById('btnCloseReaderSearch'),
  readerContentScroll: document.getElementById('readerContentScroll'),
  readerArticleBody: document.getElementById('readerArticleBody'),
  readerChapterBadge: document.getElementById('readerChapterBadge'),
  readerArticleTitle: document.getElementById('readerArticleTitle'),
  readerParagraphsContainer: document.getElementById('readerParagraphsContainer'),
  readerPageSlider: document.getElementById('readerPageSlider'),
  btnReaderPrevPage: document.getElementById('btnReaderPrevPage'),
  btnReaderNextPage: document.getElementById('btnReaderNextPage'),
  readerPageIndicator: document.getElementById('readerPageIndicator'),
  btnToggleSettings: document.getElementById('btnToggleSettings'),
  readerSettingsBackdrop: document.getElementById('readerSettingsBackdrop'),
  readerSettingsPanel: document.getElementById('readerSettingsPanel'),
  btnCloseSettingsPanel: document.getElementById('btnCloseSettingsPanel'),
  fontSizeSelector: document.getElementById('fontSizeSelector'),
  lineHeightSelector: document.getElementById('lineHeightSelector'),
  btnFontPicker: document.getElementById('btnFontPicker'),
  currentFontLabel: document.getElementById('currentFontLabel'),
  themeSwatchesRow: document.getElementById('themeSwatchesRow'),
  marginSelector: document.getElementById('marginSelector'),
  toggleNightMode: document.getElementById('toggleNightMode'),

  // Comparison Screen Elements
  comparisonViewModal: document.getElementById('comparisonViewModal'),
  btnCloseComparison: document.getElementById('btnCloseComparison'),
  comparePageTitle: document.getElementById('comparePageTitle'),
  compareBookSub: document.getElementById('compareBookSub'),
  btnModeSplit: document.getElementById('btnModeSplit'),
  btnModeOriginal: document.getElementById('btnModeOriginal'),
  btnModeDigital: document.getElementById('btnModeDigital'),
  comparisonWorkspace: document.getElementById('comparisonWorkspace'),
  realBookPageImg: document.getElementById('realBookPageImg'),
  realBookPageCanvas: document.getElementById('realBookPageCanvas'),
  btnZoomOriginalIn: document.getElementById('btnZoomOriginalIn'),
  btnZoomOriginalReset: document.getElementById('btnZoomOriginalReset'),
  btnZoomOriginalOut: document.getElementById('btnZoomOriginalOut'),
  btnCopyCompareText: document.getElementById('btnCopyCompareText'),
  compareDigitalContent: document.getElementById('compareDigitalContent'),
  btnComparePrev: document.getElementById('btnComparePrev'),
  btnCompareNext: document.getElementById('btnCompareNext'),
  comparePageNumBadge: document.getElementById('comparePageNumBadge'),

  // Conversion Sheet Elements
  conversionSheetTitle: document.getElementById('conversionSheetTitle'),
  btnCloseConversion: document.getElementById('btnCloseConversion'),
  activePreviewImg: document.getElementById('activePreviewImg'),
  scanningLaser: document.getElementById('scanningLaser'),
  processingOverlay: document.getElementById('processingOverlay'),
  processingStatusText: document.getElementById('processingStatusText'),
  btnRotate90: document.getElementById('btnRotate90'),
  btnContrastFilter: document.getElementById('btnContrastFilter'),
  btnBinarizeFilter: document.getElementById('btnBinarizeFilter'),
  btnResetFilters: document.getElementById('btnResetFilters'),
  selectModel: document.getElementById('selectModel'),
  btnStartOcr: document.getElementById('btnStartOcr'),
  btnStartOcrText: document.getElementById('btnStartOcrText'),
  btnPdfBatchOcr: document.getElementById('btnPdfBatchOcr'),
  pdfBatchBtnText: document.getElementById('pdfBatchBtnText'),
  btnAbortOcr: document.getElementById('btnAbortOcr'),
  ocrProgressBox: document.getElementById('ocrProgressBox'),
  ocrProgressBar: document.getElementById('ocrProgressBar'),
  ocrProgressPercent: document.getElementById('ocrProgressPercent'),
  ocrProgressPages: document.getElementById('ocrProgressPages'),
  pdfPagesContainer: document.getElementById('pdfPagesContainer'),
  pdfFileName: document.getElementById('pdfFileName'),
  pdfPageCountBadge: document.getElementById('pdfPageCountBadge'),
  pdfRangeChips: document.getElementById('pdfRangeChips'),
  chipRangeAll: document.getElementById('chipRangeAll'),
  chipRangeFirst5: document.getElementById('chipRangeFirst5'),
  chipRangeSingle: document.getElementById('chipRangeSingle'),
  chipRangeCustom: document.getElementById('chipRangeCustom'),
  pdfCustomRangeBox: document.getElementById('pdfCustomRangeBox'),
  inputPdfStart: document.getElementById('inputPdfStart'),
  inputPdfEnd: document.getElementById('inputPdfEnd'),
  btnApplyCustomRange: document.getElementById('btnApplyCustomRange'),
  pdfThumbnailsStrip: document.getElementById('pdfThumbnailsStrip'),

  // OCR Results in Sheet
  resultSection: document.getElementById('resultSection'),
  resultPagesBadge: document.getElementById('resultPagesBadge'),
  viewFormatted: document.getElementById('viewFormatted'),
  rawTextarea: document.getElementById('rawTextarea'),
  btnCopyText: document.getElementById('btnCopyText'),
  btnSaveToLibrary: document.getElementById('btnSaveToLibrary'),

  // Notes View Screen Elements
  btnNotesNewNote: document.getElementById('btnNotesNewNote'),
  notesSearchInput: document.getElementById('notesSearchInput'),
  btnClearNotesSearch: document.getElementById('btnClearNotesSearch'),
  notesFilterPills: document.getElementById('notesFilterPills'),
  notesCountBadge: document.getElementById('notesCountBadge'),
  notesListContainer: document.getElementById('notesListContainer'),

  // Settings View Screen Elements
  settingsThemeSelector: document.getElementById('settingsThemeSelector'),
  badgeCurrentTheme: document.getElementById('badgeCurrentTheme'),
  settingsFontSelector: document.getElementById('settingsFontSelector'),
  setWakeLock: document.getElementById('setWakeLock'),
  setAutoNightMode: document.getElementById('setAutoNightMode'),
  setAutoPrefetch: document.getElementById('setAutoPrefetch'),
  setMergeHyphens: document.getElementById('setMergeHyphens'),
  setIgnorePageNums: document.getElementById('setIgnorePageNums'),
  badgeTtsSpeed: document.getElementById('badgeTtsSpeed'),
  settingsTtsSelector: document.getElementById('settingsTtsSelector'),
  setOfflineCache: document.getElementById('setOfflineCache'),
  btnExportData: document.getElementById('btnExportData'),
  btnImportData: document.getElementById('btnImportData'),
  fileInputBackup: document.getElementById('fileInputBackup'),
  btnClearCache: document.getElementById('btnClearCache'),

  // Add Note Modal Elements
  addNoteModal: document.getElementById('addNoteModal'),
  addNoteModalTitle: document.getElementById('addNoteModalTitle'),
  addNoteBookTag: document.getElementById('addNoteBookTag'),
  btnCloseNoteModal: document.getElementById('btnCloseNoteModal'),
  noteQuotePreviewBox: document.getElementById('noteQuotePreviewBox'),
  noteQuotePreviewText: document.getElementById('noteQuotePreviewText'),
  noteModalTypeChips: document.getElementById('noteModalTypeChips'),
  inputUserNote: document.getElementById('inputUserNote'),
  btnCancelNoteModal: document.getElementById('btnCancelNoteModal'),
  btnSaveNoteSubmit: document.getElementById('btnSaveNoteSubmit'),

  // PWA
  btnPwaInstall: document.getElementById('btnPwaInstall')
};

/* ==========================================================================
   PWA Native Zoom Lock (Prevent Double-Tap & Pinch Zooming)
   ========================================================================== */
function preventPwaZooming() {
  // 1. Prevent Safari iOS gesture zoom events (pinch-to-zoom)
  const blockGesture = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
    document.addEventListener(name, blockGesture, { passive: false });
  });

  // 2. Prevent multi-finger pinch zoom on touchscreens
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // 3. Prevent Trackpad & Mouse Ctrl/Cmd + Wheel pinch-to-zoom
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // 4. Prevent Ctrl/Cmd + Plus/Minus/Zero keyboard zoom shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });

  // 5. Prevent double-click zooming without blocking button clicks
  document.addEventListener('dblclick', (e) => {
    const target = e.target;
    const isInput = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
    if (!isInput) {
      e.preventDefault();
    }
  }, { passive: false });
}

/* ==========================================================================
   Initialization
   ========================================================================== */
function init() {
  try { preventPwaZooming(); } catch (e) { console.warn('PWA zoom lock error:', e); }
  try { setupPwa(); } catch (e) { console.warn('PWA setup error:', e); }
  try { renderHomeScreen(); } catch (e) { console.error('renderHomeScreen error:', e); }
  try { renderLibraryScreen(); } catch (e) { console.error('renderLibraryScreen error:', e); }
  try { populateModelSelect(); } catch (e) { console.warn('populateModelSelect error:', e); }
  try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error:', e); }
  try { setupFileHandlingLaunchQueue(); } catch (e) { console.warn('File queue error:', e); }

  // Handle global paste (Ctrl+V)
  window.addEventListener('paste', handleGlobalPaste);
}

/* ==========================================================================
   Home Screen Rendering
   ========================================================================== */
function renderHomeScreen() {
  // 1. Render Devam Eden Kitap
  const currentBook = getCurrentBook();
  currentActiveBook = currentBook;

  if (currentBook) {
    el.currentBookCover.src = currentBook.cover || '/cover-1.jpg';
    el.currentBookTitle.textContent = currentBook.title;
    el.currentBookAuthor.textContent = currentBook.author;
    const progress = currentBook.progress || 0;
    el.currentBookProgressFill.style.width = `${progress}%`;
    el.currentBookProgressLabel.textContent = `%${progress}`;
  }

  // 2. Render Son Kitaplar
  const allBooks = getBooks();
  el.recentBooksList.innerHTML = '';

  // Exclude current book or show latest 3 other books
  const recentBooks = allBooks.slice(0, 3);

  recentBooks.forEach((book, index) => {
    const row = document.createElement('div');
    row.className = 'book-row-item';
    row.innerHTML = `
      <img src="${book.cover || '/cover-1.jpg'}" alt="${book.title}" class="book-row-cover">
      <div class="book-row-info">
        <h4 class="book-row-title">${book.title}</h4>
        <p class="book-row-author">${book.author}</p>
        <span class="book-row-meta">${book.date || 'Ekim 2025'} · ${book.totalPages || 120} sayfa</span>
      </div>
      <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;

    row.addEventListener('click', () => {
      openBookInReader(book);
    });

    el.recentBooksList.appendChild(row);

    // Add hairline divider if not last item
    if (index < recentBooks.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'book-row-divider';
      el.recentBooksList.appendChild(divider);
    }
  });

  // Calculate simulated storage based on books & notes
  const allNotes = getNotes ? getNotes() : [];
  const approxMb = (allBooks.length * 0.4 + allNotes.length * 0.05 + 2.1).toFixed(1);
  if (el.storageUsageText) {
    el.storageUsageText.textContent = `${approxMb} GB / 10 GB`;
  }
}

/* ==========================================================================
   Kitaplığım (My Library) Controller
   ========================================================================== */
function renderLibraryScreen() {
  if (!el.libraryBooksList) return;

  let books = getBooks();

  // 1. Search Query Filter
  if (currentLibrarySearchQuery) {
    const q = currentLibrarySearchQuery.toLowerCase();
    books = books.filter(b => 
      b.title.toLowerCase().includes(q) || 
      (b.author && b.author.toLowerCase().includes(q))
    );
  }

  // 2. Status / Category Filter Tabs
  if (currentLibraryFilter === 'okunanlar') {
    books = books.filter(b => (b.progress > 0 && b.progress < 100) || b.status === 'okunanlar');
  } else if (currentLibraryFilter === 'okunacaklar') {
    books = books.filter(b => b.progress === 0 || b.status === 'okunacaklar');
  } else if (currentLibraryFilter === 'donusturuluyor') {
    books = books.filter(b => b.status === 'donusturuluyor');
  }

  // 3. Sorting
  if (currentLibrarySort === 'name') {
    books.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  } else if (currentLibrarySort === 'progress') {
    books.sort((a, b) => (b.progress || 0) - (a.progress || 0));
  } else if (currentLibrarySort === 'date') {
    books.sort((a, b) => (b.currentPage || 0) - (a.currentPage || 0));
  }

  el.libraryBooksList.innerHTML = '';

  if (books.length === 0) {
    el.libraryBooksList.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-tertiary);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 44px; height: 44px; margin: 0 auto 12px; display: block; opacity: 0.5;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p style="font-size: 14px; margin: 0; color: #ffffff; font-weight: 500;">Kitap Bulunamadı</p>
        <p style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">Filtreyi veya arama terimini değiştirmeyi deneyin.</p>
      </div>
    `;
    return;
  }

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'library-book-card';
    card.dataset.bookId = book.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const progress = book.progress || 0;
    const subtitle = book.chapterSubtitle || (book.chapter && book.chapter !== '-' ? `${book.chapter} · ${book.currentPage || 1} / ${book.totalPages} sayfa` : `- / ${book.totalPages} sayfa`);

    card.innerHTML = `
      <img src="${book.cover || '/cover-1.jpg'}" alt="${book.title} Kapağı" class="library-book-cover" loading="lazy">
      <div class="library-book-details">
        <h3 class="library-book-title">${book.title}</h3>
        <p class="library-book-author">${book.author}</p>
        <div class="library-progress-row">
          <div class="library-progress-track">
            <div class="library-progress-fill" style="width: ${progress}%;"></div>
          </div>
          <span class="library-progress-label">%${progress}</span>
        </div>
        <span class="library-book-status">${subtitle}</span>
      </div>
      <div class="library-card-actions">
        <svg class="library-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <button class="library-card-more-btn" data-more-id="${book.id}" aria-label="Diğer İşlemler">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="1.8"></circle>
            <circle cx="19" cy="12" r="1.8"></circle>
            <circle cx="5" cy="12" r="1.8"></circle>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.library-card-more-btn')) return;
      openBookInReader(book);
    });

    const moreBtn = card.querySelector('.library-card-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookCardActionSheet(book);
      });
    }

    el.libraryBooksList.appendChild(card);
  });
}

function openBookCardActionSheet(book) {
  if (!book || !el.bookCardActionSheet) return;
  activeCardActionBookId = book.id;
  if (el.actionSheetBookTitle) {
    el.actionSheetBookTitle.textContent = book.title;
  }
  if (el.sheetToggleReadLabel) {
    el.sheetToggleReadLabel.textContent = book.progress >= 100 ? 'Okunmadı Olarak İşaretle' : 'Okundu Olarak İşaretle';
  }
  el.bookCardActionSheet.classList.remove('hidden');
}

function closeBookCardActionSheet() {
  if (el.bookCardActionSheet) {
    el.bookCardActionSheet.classList.add('hidden');
    activeCardActionBookId = null;
  }
}

function toggleLibraryHeaderMenu() {
  if (el.libraryHeaderMenu) {
    el.libraryHeaderMenu.classList.toggle('hidden');
  }
}

function closeLibraryHeaderMenu() {
  if (el.libraryHeaderMenu) {
    el.libraryHeaderMenu.classList.add('hidden');
  }
}

/* ==========================================================================
   In-App Reader Engine (Apple Books Style)
   ========================================================================== */
function openBookInReader(book, targetPage = null) {
  if (!book) return;
  currentActiveBook = book;
  setCurrentBook(book.id);

  currentTotalPages = book.totalPages || 1;
  if (targetPage !== null && targetPage !== undefined) {
    currentReaderPage = Math.max(1, Math.min(currentTotalPages, Number(targetPage)));
  } else {
    currentReaderPage = book.currentPage || (book.id === 'book_insan_ne_ile_yasar' ? 3 : 1);
  }

  el.readerHeaderTitle.textContent = book.title;
  if (el.readerHeaderAuthor) el.readerHeaderAuthor.textContent = book.author || 'Kişisel Belge';

  // Configure Page Slider
  el.readerPageSlider.min = '1';
  el.readerPageSlider.max = String(currentTotalPages);
  el.readerPageSlider.value = String(currentReaderPage);

  // Render Page Content
  renderReaderPage(currentReaderPage);

  // Apply Theme & Typography Preferences from Settings
  if (appSettings.defaultTheme) currentReaderTheme = appSettings.defaultTheme;
  if (appSettings.defaultFont) currentReaderFont = appSettings.defaultFont;
  applyReaderTheme(currentReaderTheme);
  applyReaderTypography();

  // Screen Wake Lock request
  requestWakeLock();

  // Display Reader Screen
  el.inAppReaderView.classList.remove('hidden');
  closeMoreMenu();
  closeReaderSearch();
  closeSettingsSheet();
  closeBookCardActionSheet();
}

function closeReader() {
  stopSpeech();
  releaseWakeLock();
  el.inAppReaderView.classList.add('hidden');
  closeComparisonView();
  closeMoreMenu();
  closeReaderSearch();
  closeSettingsSheet();
  closeBookCardActionSheet();

  switchBottomTab(previousActiveTab || 'home');
}

function renderReaderPage(pageNum) {
  currentReaderPage = Math.max(1, Math.min(currentTotalPages, pageNum));
  el.readerPageSlider.value = String(currentReaderPage);
  el.readerPageIndicator.textContent = `${currentReaderPage} / ${currentTotalPages}`;

  // Update book progress in storage
  const progressPercent = Math.round((currentReaderPage / currentTotalPages) * 100);
  updateBookProgress(currentActiveBook.id, progressPercent, currentReaderPage);

  // Sync bookmark icon state with storage
  if (currentActiveBook && el.bookmarkIconSvg) {
    const existingBookmark = getNotes().find(n => n.bookId === currentActiveBook.id && Number(n.pageNumber) === currentReaderPage && n.type === 'bookmark');
    isBookmarked = Boolean(existingBookmark);
    el.bookmarkIconSvg.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
  }

  // Retrieve Page Content
  let paragraphs = [];
  let chapterTitle = currentActiveBook.chapter || `SAYFA ${currentReaderPage}`;

  if (currentActiveBook.pageParagraphs && currentActiveBook.pageParagraphs[currentReaderPage]) {
    paragraphs = currentActiveBook.pageParagraphs[currentReaderPage];
    el.readerChapterBadge.textContent = `SAYFA ${currentReaderPage}`;
    el.readerArticleTitle.textContent = currentActiveBook.title;
    el.readerParagraphsContainer.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
  } else if (currentActiveBook.isPdf && currentPdfDoc) {
    // Sayfa henüz analiz edilmediyse kullanıcıya şık bir bekleme kartı gösterip sayfayı ÖNCELİKLİ analiz et!
    el.readerChapterBadge.textContent = `SAYFA ${currentReaderPage}`;
    el.readerArticleTitle.textContent = currentActiveBook.title;
    el.readerParagraphsContainer.innerHTML = `
      <div class="reader-page-analyzing-card">
        <div class="spinner-ring-apple"></div>
        <h4>Sayfa ${currentReaderPage} Analiz Ediliyor...</h4>
        <p>Yapay zeka bu sayfayı öncelikli olarak metne döküyor. Lütfen birkaç saniye bekleyin.</p>
      </div>
    `;

    prioritizePageAnalysis(currentReaderPage);
  } else if (currentActiveBook.content) {
    const rawParagraphs = currentActiveBook.content
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('#') && !p.startsWith('*') && !p.startsWith('BÖLÜM'));

    if (rawParagraphs.length > 0) {
      const idx = (currentReaderPage - 1) % rawParagraphs.length;
      paragraphs = [rawParagraphs[idx]];
      if (rawParagraphs[idx + 1]) paragraphs.push(rawParagraphs[idx + 1]);
    } else {
      paragraphs = [
        "İnsan, yalnızca ekmekle değil, aynı zamanda sevgi, umut ve anlamla da yaşar. Hayatın gerçek değeri, insanın kalbinde taşıdığı iyiliktedir."
      ];
    }
    el.readerChapterBadge.textContent = chapterTitle;
    el.readerArticleTitle.textContent = currentActiveBook.title;
    el.readerParagraphsContainer.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
  }

  // Smooth scroll to top of reading area
  el.readerContentScroll.scrollTop = 0;

  // If Comparison Modal is currently open, synchronize it immediately!
  if (!el.comparisonViewModal.classList.contains('hidden')) {
    updateComparisonPage(currentReaderPage);
  }
}

/* Typography & Theme Adjustments */
function applyReaderTheme(theme) {
  currentReaderTheme = theme;
  el.inAppReaderView.classList.remove('theme-koyu', 'theme-acik', 'theme-sepya');
  el.inAppReaderView.classList.add(`theme-${theme}`);

  // Update theme swatches UI
  document.querySelectorAll('#themeSwatchesRow .theme-swatch-item').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.theme === theme);
  });

  // Sync Night Mode Switch
  if (el.toggleNightMode) {
    el.toggleNightMode.checked = (theme === 'koyu');
  }
}

function applyReaderTypography() {
  // Font Size
  el.readerArticleBody.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl');
  el.readerArticleBody.classList.add(`font-size-${currentReaderFontSize}`);
  document.querySelectorAll('#fontSizeSelector .btn-step').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === currentReaderFontSize);
  });

  // Line Height
  el.readerArticleBody.classList.remove('line-height-tight', 'line-height-standard', 'line-height-wide');
  el.readerArticleBody.classList.add(`line-height-${currentReaderLineHeight}`);
  document.querySelectorAll('#lineHeightSelector .btn-step').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.spacing === currentReaderLineHeight);
  });

  // Font Family
  el.readerArticleBody.classList.remove('font-family-serif', 'font-family-sans', 'font-family-mono');
  el.readerArticleBody.classList.add(`font-family-${currentReaderFont}`);
  const fontNames = { serif: 'Serif', sans: 'Sans-Serif', mono: 'Monospace' };
  el.currentFontLabel.textContent = fontNames[currentReaderFont] || 'Serif';

  // Margin
  el.readerArticleBody.classList.remove('margin-narrow', 'margin-standard', 'margin-wide');
  el.readerArticleBody.classList.add(`margin-${currentReaderMargin}`);
  document.querySelectorAll('#marginSelector .btn-step').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.margin === currentReaderMargin);
  });
}

/* Reader Settings Bottom Sheet Controller (Aᴀ) */
function openSettingsSheet() {
  if (!el.readerSettingsBackdrop) return;
  el.readerSettingsBackdrop.classList.remove('hidden');
  el.btnToggleSettings?.classList.add('active');
  el.btnReaderAppearance?.classList.add('active');
  closeMoreMenu();
  closeReaderSearch();
}

function closeSettingsSheet() {
  if (!el.readerSettingsBackdrop) return;
  el.readerSettingsBackdrop.classList.add('hidden');
  el.btnToggleSettings?.classList.remove('active');
  el.btnReaderAppearance?.classList.remove('active');
}

function toggleSettingsSheet() {
  if (!el.readerSettingsBackdrop) return;
  if (el.readerSettingsBackdrop.classList.contains('hidden')) {
    openSettingsSheet();
  } else {
    closeSettingsSheet();
  }
}

function toggleMoreMenu() {
  el.readerMoreMenu.classList.toggle('hidden');
}

function closeMoreMenu() {
  if (el.readerMoreMenu) el.readerMoreMenu.classList.add('hidden');
}

function toggleSearchBar() {
  el.readerSearchBar.classList.toggle('hidden');
  if (!el.readerSearchBar.classList.contains('hidden')) {
    el.readerSearchInput.focus();
  }
}

function closeReaderSearch() {
  if (el.readerSearchBar) {
    el.readerSearchBar.classList.add('hidden');
    el.readerSearchInput.value = '';
  }
}

function toggleBookmark() {
  if (!currentActiveBook) return;
  const existingBookmark = getNotes().find(n => n.bookId === currentActiveBook.id && Number(n.pageNumber) === currentReaderPage && n.type === 'bookmark');
  if (existingBookmark) {
    deleteNote(existingBookmark.id);
    isBookmarked = false;
    if (el.bookmarkIconSvg) el.bookmarkIconSvg.setAttribute('fill', 'none');
    showToast(`Sayfa ${currentReaderPage} yer imi kaldırıldı`, 'info');
  } else {
    saveNote({
      bookId: currentActiveBook.id,
      bookTitle: currentActiveBook.title,
      bookAuthor: currentActiveBook.author,
      pageNumber: currentReaderPage,
      type: 'bookmark',
      text: `Sayfa ${currentReaderPage} Yer İmi`,
      userNote: ''
    });
    isBookmarked = true;
    if (el.bookmarkIconSvg) el.bookmarkIconSvg.setAttribute('fill', 'currentColor');
    showToast(`Sayfa ${currentReaderPage} yer imlerine eklendi`, 'success');
  }
}

/* ==========================================================================
   Real Book Page Comparison Controller (Karşılaştırma Modu)
   ========================================================================== */
async function openComparisonView() {
  if (!currentActiveBook) return;
  closeMoreMenu();
  closeReaderSearch();
  await updateComparisonPage(currentReaderPage);
  el.comparisonViewModal.classList.remove('hidden');
  showToast(`Sayfa ${currentReaderPage} gerçek kitapla karşılaştırılıyor`, 'info');
}

function closeComparisonView() {
  el.comparisonViewModal.classList.add('hidden');
}

function setComparisonMode(mode) {
  el.btnModeSplit.classList.remove('active');
  el.btnModeOriginal.classList.remove('active');
  el.btnModeDigital.classList.remove('active');

  el.comparisonWorkspace.classList.remove('mode-split', 'mode-original', 'mode-digital');

  if (mode === 'split') {
    el.btnModeSplit.classList.add('active');
    el.comparisonWorkspace.classList.add('mode-split');
  } else if (mode === 'original') {
    el.btnModeOriginal.classList.add('active');
    el.comparisonWorkspace.classList.add('mode-original');
  } else if (mode === 'digital') {
    el.btnModeDigital.classList.add('active');
    el.comparisonWorkspace.classList.add('mode-digital');
  }
}

async function updateComparisonPage(pageNum) {
  pageNum = Math.max(1, Math.min(currentTotalPages, pageNum));
  currentReaderPage = pageNum;
  el.readerPageSlider.value = String(pageNum);
  el.readerPageIndicator.textContent = `${pageNum} / ${currentTotalPages}`;

  if (el.comparePageTitle) el.comparePageTitle.textContent = `Sayfa ${pageNum} Karşılaştırma`;
  if (el.compareBookSub) el.compareBookSub.textContent = currentActiveBook.title;
  if (el.comparePageNumBadge) el.comparePageNumBadge.textContent = `Sayfa ${pageNum} / ${currentTotalPages}`;

  // 1. Digital Text Pane Content
  let paragraphs = [];
  if (currentActiveBook.pageParagraphs && currentActiveBook.pageParagraphs[pageNum]) {
    paragraphs = currentActiveBook.pageParagraphs[pageNum];
  } else if (currentActiveBook.isPdf && currentPdfDoc) {
    paragraphs = [`Sayfa ${pageNum} öncelikli olarak analiz ediliyor. Lütfen bekleyin...`];
    prioritizePageAnalysis(pageNum);
  } else if (currentActiveBook.content) {
    const rawParagraphs = currentActiveBook.content
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('#') && !p.startsWith('*') && !p.startsWith('BÖLÜM'));

    if (rawParagraphs.length > 0) {
      const idx = (pageNum - 1) % rawParagraphs.length;
      paragraphs = [rawParagraphs[idx]];
      if (rawParagraphs[idx + 1]) paragraphs.push(rawParagraphs[idx + 1]);
    } else {
      paragraphs = [
        "İnsan, yalnızca ekmekle değil, aynı zamanda sevgi, umut ve anlamla da yaşar. Hayatın gerçek değeri, insanın kalbinde taşıdığı iyiliktedir."
      ];
    }
  }

  el.compareDigitalContent.innerHTML = `
    <span class="compare-chapter-tag">${currentActiveBook.chapter || 'BÖLÜM 1'}</span>
    <h3>${currentActiveBook.title}</h3>
    ${paragraphs.map(p => `<p>${p}</p>`).join('')}
  `;

  // 2. Real Original Scanned Book Page
  if (currentPdfDoc && pageNum <= currentPdfNumPages) {
    // If a PDF document is currently open
    try {
      el.realBookPageImg.classList.add('hidden');
      el.realBookPageCanvas.classList.remove('hidden');
      const canvas = await renderPdfPageToCanvas(currentPdfDoc, pageNum, 2.0);
      el.realBookPageCanvas.width = canvas.width;
      el.realBookPageCanvas.height = canvas.height;
      const ctx = el.realBookPageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
    } catch (err) {
      console.warn('PDF canvas render hatası:', err);
    }
  } else {
    // Show authentic high-res real scanned book page SVG / Image
    el.realBookPageCanvas.classList.add('hidden');
    el.realBookPageImg.classList.remove('hidden');

    if (currentActiveBook.id === 'book_insan_ne_ile_yasar') {
      if (pageNum === 3) {
        el.realBookPageImg.src = '/real-page-insan-ne-ile-yasar.svg';
      } else {
        el.realBookPageImg.src = '/sample-book.jpg';
      }
    } else {
      el.realBookPageImg.src = currentActiveBook.realPageImage || '/real-page-insan-ne-ile-yasar.svg';
    }
  }

  // Reset zoom
  currentCompareZoom = 1.0;
  applyCompareZoom();
}

function zoomOriginal(delta) {
  if (delta === 0) {
    currentCompareZoom = 1.0;
  } else {
    currentCompareZoom = Math.max(0.7, Math.min(3.0, currentCompareZoom + delta));
  }
  applyCompareZoom();
}

function applyCompareZoom() {
  const target = el.realBookPageCanvas.classList.contains('hidden') ? el.realBookPageImg : el.realBookPageCanvas;
  if (target) {
    target.style.transform = `scale(${currentCompareZoom})`;
  }
}

/* ==========================================================================
   Primary Actions & Conversion Modals Setup
   ========================================================================== */
function setupEventListeners() {
  // 1. Yeni Kitap Ekle
  el.btnNewBookCard.addEventListener('click', () => {
    el.fileInputPdf.click();
  });

  // 2. Metin Çıkarma
  el.btnExtractTextCard.addEventListener('click', () => {
    el.conversionSheetTitle.textContent = 'Metin Çıkarma (PDF)';
    el.fileInputPdf.click();
  });

  // 3. OCR Taraması
  el.btnOcrCard.addEventListener('click', () => {
    el.conversionSheetTitle.textContent = 'Akıllı OCR Taraması';
    el.fileInputPhoto.click();
  });

  // File Inputs
  el.fileInputPdf.addEventListener('change', (e) => handlePdfFiles(e.target.files));
  el.fileInputPhoto.addEventListener('change', (e) => handleImageFiles(e.target.files));

  // Devam Eden Kitap Tıklandığında Okuyucuyu Aç
  el.cardContinueBook.addEventListener('click', () => {
    const current = getCurrentBook();
    if (current) openBookInReader(current);
  });

  // Tümünü Gör
  el.btnViewAllContinue.addEventListener('click', () => {
    switchBottomTab('library');
  });
  el.btnViewAllRecent.addEventListener('click', () => {
    switchBottomTab('library');
  });

  // Profile icon
  el.btnProfile.addEventListener('click', () => {
    const provider = appSettings.activeProvider.toUpperCase();
    showToast(`Aktif Motor: ${provider} (Otomatik .env)`, 'success');
  });

  // Reader Header Action Buttons
  el.btnCloseReader.addEventListener('click', closeReader);
  el.btnReaderBookmark.addEventListener('click', toggleBookmark);
  el.btnReaderCompare.addEventListener('click', openComparisonView);
  if (el.btnReaderAppearance) {
    el.btnReaderAppearance.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsSheet();
    });
  }
  el.btnReaderSearch.addEventListener('click', toggleSearchBar);
  el.btnCloseReaderSearch.addEventListener('click', closeReaderSearch);

  el.btnReaderMore.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMoreMenu();
  });

  // Close more menu on background click
  document.addEventListener('click', (e) => {
    if (el.readerMoreMenu && !el.readerMoreMenu.classList.contains('hidden')) {
      if (!el.readerMoreMenu.contains(e.target) && e.target !== el.btnReaderMore) {
        closeMoreMenu();
      }
    }
  });

  // Popover Items
  if (el.popoverOpenAppearance) {
    el.popoverOpenAppearance.addEventListener('click', () => {
      closeMoreMenu();
      openSettingsSheet();
    });
  }
  el.popoverAddBookmark.addEventListener('click', () => {
    toggleBookmark();
    closeMoreMenu();
  });
  el.popoverAddNote.addEventListener('click', () => {
    closeMoreMenu();
    openAddNoteModal('note');
  });
  el.popoverCopyText.addEventListener('click', async () => {
    closeMoreMenu();
    const text = el.readerParagraphsContainer.innerText || '';
    if (text) {
      await copyToClipboard(text);
      showToast('Sayfa metni kopyalandı', 'success');
    }
  });
  el.popoverShareText.addEventListener('click', () => {
    closeMoreMenu();
    if (navigator.share) {
      navigator.share({
        title: currentActiveBook.title,
        text: `Reawid ile ${currentActiveBook.title} - Sayfa ${currentReaderPage} okuyorum.`
      }).catch(() => {});
    } else {
      showToast('Paylaşım bağlantısı hazırlandı', 'info');
    }
  });
  el.popoverOpenPdf.addEventListener('click', () => {
    closeMoreMenu();
    openComparisonView();
  });

  // Scrubber Controls & Settings Toggle
  if (el.btnToggleSettings) {
    el.btnToggleSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsSheet();
    });
  }
  if (el.btnCloseSettingsPanel) {
    el.btnCloseSettingsPanel.addEventListener('click', closeSettingsSheet);
  }
  if (el.readerSettingsBackdrop) {
    el.readerSettingsBackdrop.addEventListener('click', (e) => {
      if (e.target === el.readerSettingsBackdrop) {
        closeSettingsSheet();
      }
    });
  }

  // Scrubber & Page Slider
  el.readerPageSlider.addEventListener('input', (e) => {
    renderReaderPage(parseInt(e.target.value, 10));
  });
  el.btnReaderPrevPage.addEventListener('click', () => {
    renderReaderPage(currentReaderPage - 1);
  });
  el.btnReaderNextPage.addEventListener('click', () => {
    renderReaderPage(currentReaderPage + 1);
  });

  // Reader Typography Controls (Yazı Boyutu)
  document.querySelectorAll('#fontSizeSelector .btn-step').forEach(btn => {
    btn.addEventListener('click', () => {
      currentReaderFontSize = btn.dataset.size;
      applyReaderTypography();
    });
  });

  // Satır Aralığı
  document.querySelectorAll('#lineHeightSelector .btn-step').forEach(btn => {
    btn.addEventListener('click', () => {
      currentReaderLineHeight = btn.dataset.spacing;
      applyReaderTypography();
    });
  });

  // Yazı Tipi Picker
  el.btnFontPicker.addEventListener('click', () => {
    const fonts = ['serif', 'sans', 'mono'];
    const nextIdx = (fonts.indexOf(currentReaderFont) + 1) % fonts.length;
    currentReaderFont = fonts[nextIdx];
    applyReaderTypography();
  });

  // Tema Swatches
  document.querySelectorAll('#themeSwatchesRow .theme-swatch-item').forEach(btn => {
    btn.addEventListener('click', () => {
      applyReaderTheme(btn.dataset.theme);
    });
  });

  // Kenar Boşlukları
  document.querySelectorAll('#marginSelector .btn-step').forEach(btn => {
    btn.addEventListener('click', () => {
      currentReaderMargin = btn.dataset.margin;
      applyReaderTypography();
    });
  });

  // Gece Modu Switch
  el.toggleNightMode.addEventListener('change', (e) => {
    applyReaderTheme(e.target.checked ? 'koyu' : 'acik');
  });

  // Comparison View Controls
  el.btnCloseComparison.addEventListener('click', closeComparisonView);
  el.btnModeSplit.addEventListener('click', () => setComparisonMode('split'));
  el.btnModeOriginal.addEventListener('click', () => setComparisonMode('original'));
  el.btnModeDigital.addEventListener('click', () => setComparisonMode('digital'));

  el.btnZoomOriginalIn.addEventListener('click', () => zoomOriginal(0.25));
  el.btnZoomOriginalReset.addEventListener('click', () => zoomOriginal(0));
  el.btnZoomOriginalOut.addEventListener('click', () => zoomOriginal(-0.25));

  el.btnCopyCompareText.addEventListener('click', async () => {
    const text = el.compareDigitalContent.innerText || '';
    if (text) {
      await copyToClipboard(text);
      showToast('Dijital metin kopyalandı', 'success');
    }
  });

  el.btnComparePrev.addEventListener('click', () => {
    renderReaderPage(currentReaderPage - 1);
  });
  el.btnCompareNext.addEventListener('click', () => {
    renderReaderPage(currentReaderPage + 1);
  });

  // Conversion Sheet Events
  el.btnCloseConversion.addEventListener('click', closeConversionModal);
  el.btnRotate90.addEventListener('click', handleRotate90);
  el.btnContrastFilter.addEventListener('click', toggleContrastFilter);
  el.btnBinarizeFilter.addEventListener('click', toggleBinarizeFilter);
  el.btnResetFilters.addEventListener('click', resetImageFilters);
  el.selectModel.addEventListener('change', handleModelChange);
  el.btnStartOcr.addEventListener('click', startOcrProcess);
  el.btnPdfBatchOcr.addEventListener('click', startPdfBatchOcr);

  if (el.btnAbortOcr) {
    el.btnAbortOcr.addEventListener('click', abortCurrentOcr);
  }
  if (el.chipRangeAll) {
    el.chipRangeAll.addEventListener('click', () => setPdfBatchRange('all'));
  }
  if (el.chipRangeFirst5) {
    el.chipRangeFirst5.addEventListener('click', () => setPdfBatchRange('first5'));
  }
  if (el.chipRangeSingle) {
    el.chipRangeSingle.addEventListener('click', () => setPdfBatchRange('single'));
  }
  if (el.chipRangeCustom) {
    el.chipRangeCustom.addEventListener('click', () => setPdfBatchRange('custom'));
  }
  if (el.btnApplyCustomRange) {
    el.btnApplyCustomRange.addEventListener('click', applyCustomPdfRange);
  }
  if (el.inputPdfStart) {
    el.inputPdfStart.addEventListener('change', applyCustomPdfRange);
  }
  if (el.inputPdfEnd) {
    el.inputPdfEnd.addEventListener('change', applyCustomPdfRange);
  }

  // Results Actions in Sheet
  el.btnCopyText.addEventListener('click', handleCopyText);
  el.btnSaveToLibrary.addEventListener('click', handleSaveOcrToLibrary);

  // Notes & Settings Page Events
  setupNotesScreenEvents();
  setupSettingsScreenEvents();

  // Kitaplığım (My Library) Search & Filter Events
  if (el.librarySearchInput) {
    el.librarySearchInput.addEventListener('input', (e) => {
      currentLibrarySearchQuery = e.target.value.trim();
      if (el.btnClearLibrarySearch) {
        el.btnClearLibrarySearch.classList.toggle('hidden', !currentLibrarySearchQuery);
      }
      renderLibraryScreen();
    });
  }

  if (el.btnClearLibrarySearch) {
    el.btnClearLibrarySearch.addEventListener('click', () => {
      if (el.librarySearchInput) el.librarySearchInput.value = '';
      currentLibrarySearchQuery = '';
      el.btnClearLibrarySearch.classList.add('hidden');
      renderLibraryScreen();
    });
  }

  if (el.btnLibraryHeaderSearch) {
    el.btnLibraryHeaderSearch.addEventListener('click', () => {
      el.librarySearchInput?.focus();
    });
  }

  if (el.btnLibraryHeaderMore) {
    el.btnLibraryHeaderMore.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLibraryHeaderMenu();
    });
  }

  if (el.btnLibrarySort) {
    el.btnLibrarySort.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLibraryHeaderMenu();
    });
  }

  // Library Sorting Popover
  if (el.popoverLibrarySortDate) {
    el.popoverLibrarySortDate.addEventListener('click', () => {
      currentLibrarySort = 'date';
      closeLibraryHeaderMenu();
      renderLibraryScreen();
      showToast('Son okunana göre sıralandı', 'info');
    });
  }
  if (el.popoverLibrarySortName) {
    el.popoverLibrarySortName.addEventListener('click', () => {
      currentLibrarySort = 'name';
      closeLibraryHeaderMenu();
      renderLibraryScreen();
      showToast('İsme göre (A-Z) sıralandı', 'info');
    });
  }
  if (el.popoverLibrarySortProgress) {
    el.popoverLibrarySortProgress.addEventListener('click', () => {
      currentLibrarySort = 'progress';
      closeLibraryHeaderMenu();
      renderLibraryScreen();
      showToast('İlerlemeye göre sıralandı', 'info');
    });
  }

  // Filter Pills (Tümü | Okunanlar | Okunacaklar | Dönüştürülüyor)
  document.querySelectorAll('#libraryFilterPills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#libraryFilterPills .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentLibraryFilter = pill.dataset.filter || 'all';
      renderLibraryScreen();
    });
  });

  // FAB (+ Yeni Kitap Ekle)
  if (el.btnLibraryFab) {
    el.btnLibraryFab.addEventListener('click', () => {
      el.conversionSheetTitle.textContent = 'Yeni Kitap Ekle';
      el.fileInputPdf.click();
    });
  }

  // Book Card Context Action Sheet Events
  if (el.btnCloseCardActionSheet) {
    el.btnCloseCardActionSheet.addEventListener('click', closeBookCardActionSheet);
  }
  if (el.bookCardActionSheet) {
    el.bookCardActionSheet.addEventListener('click', (e) => {
      if (e.target === el.bookCardActionSheet) {
        closeBookCardActionSheet();
      }
    });
  }

  if (el.sheetBtnOpenReader) {
    el.sheetBtnOpenReader.addEventListener('click', () => {
      const book = getBooks().find(b => b.id === activeCardActionBookId);
      closeBookCardActionSheet();
      if (book) openBookInReader(book);
    });
  }

  if (el.sheetBtnCompare) {
    el.sheetBtnCompare.addEventListener('click', () => {
      const book = getBooks().find(b => b.id === activeCardActionBookId);
      closeBookCardActionSheet();
      if (book) {
        openBookInReader(book);
        openComparisonView();
      }
    });
  }

  if (el.sheetBtnToggleReadStatus) {
    el.sheetBtnToggleReadStatus.addEventListener('click', () => {
      const book = getBooks().find(b => b.id === activeCardActionBookId);
      if (book) {
        const isDone = (book.progress >= 100);
        const newProgress = isDone ? 0 : 100;
        const newPage = isDone ? 0 : book.totalPages;
        book.progress = newProgress;
        book.currentPage = newPage;
        book.status = isDone ? 'okunacaklar' : 'tamamlanan';
        updateBookProgress(book.id, newProgress, newPage);
        saveBook(book);
        renderLibraryScreen();
        renderHomeScreen();
        showToast(isDone ? 'Okunacaklar listesine alındı' : 'Kitap tamamlandı olarak işaretlendi', 'success');
      }
      closeBookCardActionSheet();
    });
  }

  if (el.sheetBtnDeleteBook) {
    el.sheetBtnDeleteBook.addEventListener('click', () => {
      const book = getBooks().find(b => b.id === activeCardActionBookId);
      if (book && confirm(`"${book.title}" kitabını kitaplığınızdan silmek istediğinize emin misiniz?`)) {
        deleteBook(book.id);
        renderLibraryScreen();
        renderHomeScreen();
        showToast('Kitap silindi', 'info');
      }
      closeBookCardActionSheet();
    });
  }

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (el.libraryHeaderMenu && !el.libraryHeaderMenu.classList.contains('hidden')) {
      if (!el.libraryHeaderMenu.contains(e.target) && e.target !== el.btnLibraryHeaderMore && e.target !== el.btnLibrarySort) {
        closeLibraryHeaderMenu();
      }
    }
  });

  // Bottom Navigation Tabs
  el.navHome.addEventListener('click', () => switchBottomTab('home'));
  el.navLibrary.addEventListener('click', () => switchBottomTab('library'));
  el.navNotes.addEventListener('click', () => switchBottomTab('notes'));
  el.navSettings.addEventListener('click', () => switchBottomTab('settings'));
}

function switchBottomTab(tab) {
  [el.navHome, el.navLibrary, el.navNotes, el.navSettings].forEach(t => t && t.classList.remove('active'));

  // Hide all screens
  if (el.homeView) el.homeView.classList.add('hidden');
  if (el.libraryViewScreen) el.libraryViewScreen.classList.add('hidden');
  if (el.notesViewScreen) el.notesViewScreen.classList.add('hidden');
  if (el.settingsViewScreen) el.settingsViewScreen.classList.add('hidden');

  closeConversionModal();
  closeBookCardActionSheet();
  closeLibraryHeaderMenu();
  closeAddNoteModal();

  if (tab === 'home') {
    previousActiveTab = 'home';
    if (el.navHome) el.navHome.classList.add('active');
    if (el.homeView) el.homeView.classList.remove('hidden');
    renderHomeScreen();
  } else if (tab === 'library') {
    previousActiveTab = 'library';
    if (el.navLibrary) el.navLibrary.classList.add('active');
    if (el.libraryViewScreen) el.libraryViewScreen.classList.remove('hidden');
    renderLibraryScreen();
  } else if (tab === 'notes') {
    previousActiveTab = 'notes';
    if (el.navNotes) el.navNotes.classList.add('active');
    if (el.notesViewScreen) el.notesViewScreen.classList.remove('hidden');
    renderNotesScreen();
  } else if (tab === 'settings') {
    previousActiveTab = 'settings';
    if (el.navSettings) el.navSettings.classList.add('active');
    if (el.settingsViewScreen) el.settingsViewScreen.classList.remove('hidden');
    renderSettingsScreen();
  }
}

/* ==========================================================================
   Image & PDF Processing Pipeline
   ========================================================================== */
function abortCurrentOcr() {
  if (abortController) {
    abortController.abort();
    showToast('İşlem durduruluyor...', 'info');
  }
}

function setPdfBatchRange(mode) {
  if (!currentPdfNumPages) return;
  pdfBatchRangeMode = mode;

  // Update chip active classes
  [el.chipRangeAll, el.chipRangeFirst5, el.chipRangeSingle, el.chipRangeCustom].forEach(chip => {
    if (chip) chip.classList.toggle('active', chip.dataset.range === mode);
  });

  if (el.pdfCustomRangeBox) {
    el.pdfCustomRangeBox.classList.toggle('hidden', mode !== 'custom');
  }

  if (mode === 'all') {
    pdfBatchStartPage = 1;
    pdfBatchEndPage = currentPdfNumPages;
  } else if (mode === 'first5') {
    pdfBatchStartPage = 1;
    pdfBatchEndPage = Math.min(5, currentPdfNumPages);
  } else if (mode === 'single') {
    pdfBatchStartPage = selectedPdfPage;
    pdfBatchEndPage = selectedPdfPage;
  } else if (mode === 'custom') {
    applyCustomPdfRange();
    return;
  }

  updatePdfBatchActionButtons();
}

function applyCustomPdfRange() {
  if (!el.inputPdfStart || !el.inputPdfEnd || !currentPdfNumPages) return;
  let start = parseInt(el.inputPdfStart.value, 10) || 1;
  let end = parseInt(el.inputPdfEnd.value, 10) || currentPdfNumPages;

  start = Math.max(1, Math.min(currentPdfNumPages, start));
  end = Math.max(start, Math.min(currentPdfNumPages, end));

  el.inputPdfStart.value = start;
  el.inputPdfEnd.value = end;

  pdfBatchStartPage = start;
  pdfBatchEndPage = end;

  updatePdfBatchActionButtons();
}

function updatePdfBatchActionButtons() {
  const count = Math.max(1, pdfBatchEndPage - pdfBatchStartPage + 1);
  if (el.pdfBatchBtnText) {
    if (pdfBatchRangeMode === 'all') {
      el.pdfBatchBtnText.textContent = `Tüm Sayfaları Analiz Et (${currentPdfNumPages} Sayfa)`;
    } else if (pdfBatchRangeMode === 'first5') {
      el.pdfBatchBtnText.textContent = `İlk ${count} Sayfayı Analiz Et`;
    } else if (pdfBatchRangeMode === 'single') {
      el.pdfBatchBtnText.textContent = `Sayfa ${selectedPdfPage}'i Analiz Et`;
    } else {
      el.pdfBatchBtnText.textContent = `Sayfa ${pdfBatchStartPage}-${pdfBatchEndPage} Analiz Et (${count} Sayfa)`;
    }
  }

  if (el.btnStartOcrText) {
    el.btnStartOcrText.textContent = currentPdfNumPages > 1 
      ? `Yalnızca Sayfa ${selectedPdfPage}` 
      : 'Metne Dönüştür';
  }
}

/* ==========================================================================
   Background & Priority PDF Analysis Engine
   ========================================================================== */
function updateReaderBgOcrStatus(message, isPriority = false, isCompleted = false) {
  if (!el.readerBgOcrPill || !el.readerBgOcrText) return;
  el.readerBgOcrPill.classList.remove('hidden', 'priority-active', 'completed');
  if (isPriority) el.readerBgOcrPill.classList.add('priority-active');
  if (isCompleted) el.readerBgOcrPill.classList.add('completed');
  el.readerBgOcrText.textContent = message;
}

function hideReaderBgOcrStatus() {
  if (el.readerBgOcrPill) el.readerBgOcrPill.classList.add('hidden');
}

async function analyzeSinglePdfPage(pdfDoc, pageNum, signal) {
  try {
    // 1. Önce anlık gömülü metin katmanını dene (10-20ms)
    const fastText = await extractPdfPageText(pdfDoc, pageNum);
    if (fastText && fastText.length > 0) {
      return fastText;
    }

    // 2. Gömülü metin yoksa (taranmış sayfa), Vision AI ile dinamik ve yedeklemeli OCR yap
    const provider = appSettings.activeProvider || 'auto';
    const model = provider === 'groq' ? appSettings.groqModel : (appSettings.openrouterModel || 'auto');

    // Maksimum Türkçe karakter doğruluğu: 2.0x DPI & 0.93 JPEG kalitesi
    // Harf noktaları, çengeller (ç, ğ, ı, ö, ş, ü) ve şapkalı harfler sıkıştırma gürültüsünde kaybolmaz
    const renderScale = appSettings.renderDpi || 2.0;
    const canvas = await renderPdfPageToCanvas(pdfDoc, pageNum, renderScale);
    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.93);

    const pageText = await performOcr({
      imageBase64: pageDataUrl,
      provider,
      groqApiKey: appSettings.groqApiKey,
      openrouterApiKey: appSettings.openrouterApiKey,
      model,
      options: {
        strictTurkish: appSettings.strictTurkish !== false,
        mergeHyphenatedWords: appSettings.mergeHyphenatedWords !== false,
        ignorePageNumbers: appSettings.ignorePageNumbers !== false,
        preserveFormatting: appSettings.preserveFormatting !== false,
        temperature: 0.05
      },
      signal,
      onModelFallback: ({ from, to, reason }) => {
        console.info(`[Dynamic OCR Failover] ${from} -> ${to} (${reason})`);
        updateReaderBgOcrStatus(`${pageNum} / ${currentTotalPages || (currentActiveBook?.totalPages || 1)}`, true);
      }
    });

    const paragraphs = pageText
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('#') && !p.startsWith('*'));

    return paragraphs.length > 0 ? paragraphs : [pageText];
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    console.warn(`Sayfa ${pageNum} analizi sırasında hata:`, err);
    return null;
  }
}

function getNextTargetPage(totalPages, pageParagraphs) {
  // 1. Kullanıcının atladığı veya öncelik kuyruğundaki sayfa
  for (let i = 0; i < priorityPageQueue.length; i++) {
    const candidate = priorityPageQueue[i];
    if (candidate >= 1 && candidate <= totalPages && !pageParagraphs[candidate] && !activeAnalyzingPages.has(candidate)) {
      priorityPageQueue.splice(i, 1);
      return candidate;
    }
  }

  // 2. Kullanıcının şu an okuduğu sayfa henüz analiz edilmemişse
  if (currentReaderPage && !pageParagraphs[currentReaderPage] && !activeAnalyzingPages.has(currentReaderPage)) {
    return currentReaderPage;
  }

  // 3. Kullanıcının hemen önündeki sayfalar (akıcı okuma için sonraki 5 sayfa önden taranır!)
  if (currentReaderPage) {
    for (let offset = 1; offset <= 5; offset++) {
      const nextP = currentReaderPage + offset;
      if (nextP <= totalPages && !pageParagraphs[nextP] && !activeAnalyzingPages.has(nextP)) {
        return nextP;
      }
    }
  }

  // 4. Sıradaki henüz analiz edilmemiş ilk sayfa
  for (let p = 1; p <= totalPages; p++) {
    if (!pageParagraphs[p] && !activeAnalyzingPages.has(p)) {
      return p;
    }
  }

  return null;
}

function prioritizePageAnalysis(pageNum) {
  if (!currentActiveBook || !currentPdfDoc) return;
  if (currentActiveBook.pageParagraphs && currentActiveBook.pageParagraphs[pageNum]) return;

  const total = currentTotalPages || currentPdfDoc.numPages || (currentActiveBook?.totalPages || 1);

  // Zaten o an bir paralel worker tarafından işleniyorsa
  if (activeAnalyzingPages.has(pageNum)) {
    updateReaderBgOcrStatus(`${pageNum} / ${total}`, true);
    return;
  }

  // Öncelik kuyruğunun en başına ekle
  if (!priorityPageQueue.includes(pageNum)) {
    priorityPageQueue.unshift(pageNum);
  }

  // Kullanıcının okumadığı uzak bir sayfayla meşgul olan worker varsa hemen iptal et
  for (const [wId, worker] of activeWorkerControllers.entries()) {
    if (worker.pageNum !== currentReaderPage) {
      worker.controller.abort();
      break;
    }
  }

  // Motor boşta ise başlat
  if (!isBackgroundOcrActive) {
    startBackgroundPdfAnalysis(currentActiveBook, currentPdfDoc);
  } else {
    updateReaderBgOcrStatus(`${pageNum} / ${total}`, true);
  }
}

async function startBackgroundPdfAnalysis(book, pdfDoc) {
  if (!book || !pdfDoc) return;
  if (isBackgroundOcrActive) return;

  isBackgroundOcrActive = true;
  const totalPages = pdfDoc.numPages;
  if (!book.pageParagraphs) book.pageParagraphs = {};

  const PARALLEL_WORKERS = 2; // Çift kanal paralel analiz motoru ile 2-3 kat hız artışı

  const workerPromises = Array.from({ length: PARALLEL_WORKERS }, async (_, workerId) => {
    while (isBackgroundOcrActive) {
      const targetPage = getNextTargetPage(totalPages, book.pageParagraphs);
      if (!targetPage) {
        if (activeAnalyzingPages.size === 0) break;
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      activeAnalyzingPages.add(targetPage);
      const controller = new AbortController();
      activeWorkerControllers.set(workerId, { controller, pageNum: targetPage });

      const isPriority = (targetPage === currentReaderPage);
      updateReaderBgOcrStatus(
        `${targetPage} / ${totalPages}`,
        isPriority
      );

      try {
        const paragraphs = await analyzeSinglePdfPage(pdfDoc, targetPage, controller.signal);

        if (paragraphs && paragraphs.length > 0) {
          book.pageParagraphs[targetPage] = paragraphs;
          updateBookPageParagraphs(book.id, targetPage, paragraphs);

          // Eğer kullanıcı o an bu sayfaya bakıyorsa ekranı anında güncelle!
          if (currentActiveBook && currentActiveBook.id === book.id && currentReaderPage === targetPage) {
            renderReaderPage(targetPage);
          }
        }
      } catch (pageErr) {
        if (pageErr.name === 'AbortError') {
          // Öncelik değişti, döngü yeni sayfayı alacak
        }
      } finally {
        activeAnalyzingPages.delete(targetPage);
        activeWorkerControllers.delete(workerId);
      }

      await new Promise(r => setTimeout(r, 30));
    }
  });

  try {
    await Promise.all(workerPromises);
    updateReaderBgOcrStatus(`${totalPages} / ${totalPages}`, false, true);
    setTimeout(() => hideReaderBgOcrStatus(), 4000);
  } catch (err) {
    console.warn('Arka plan analizi durduruldu:', err);
  } finally {
    isBackgroundOcrActive = false;
    activeAnalyzingPages.clear();
    activeWorkerControllers.clear();
  }
}

async function handlePdfFiles(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Lütfen geçerli bir PDF dosyası seçin.', 'error');
    return;
  }

  // Clear input so selecting the same file again triggers change event
  if (el.fileInputPdf) el.fileInputPdf.value = '';

  try {
    showToast('Kitap açılıyor...', 'info');
    const { numPages, pdfDoc } = await loadPdf(file);
    currentPdfDoc = pdfDoc;
    currentPdfNumPages = numPages;

    const docName = file.name.replace(/\.[^/.]+$/, '');

    // Yeni kitap nesnesi oluştur ve hemen kaydet
    const newBook = {
      id: 'book_' + Date.now(),
      title: docName,
      author: 'Kişisel Belge',
      cover: '/cover-1.jpg',
      totalPages: numPages,
      currentPage: 1,
      progress: 0,
      date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }),
      chapter: '1. Sayfa',
      status: 'okunanlar',
      chapterSubtitle: `1 / ${numPages} sayfa`,
      pageParagraphs: {},
      isPdf: true,
      isCurrent: true
    };

    saveBook(newBook);
    renderHomeScreen();
    renderLibraryScreen();

    // DİREKT OKUYUCUYA GEÇ! Ekteki modal ekranı ASLA gelmeyecek!
    openBookInReader(newBook);
    showToast(`${docName} (${numPages} Sayfa) açıldı. Sayfalar arka planda taranıyor.`, 'success');

    // Arka planda analiz döngüsünü başlat (1. sayfa ve devamı arka planda analiz edilecek)
    startBackgroundPdfAnalysis(newBook, pdfDoc);
  } catch (err) {
    showToast('PDF okunurken hata: ' + err.message, 'error');
  }
}

async function selectPdfPage(pageNum, cardElement) {
  if (!currentPdfDoc) return;
  selectedPdfPage = pageNum;

  document.querySelectorAll('.pdf-page-card').forEach(c => c.classList.remove('selected'));
  if (cardElement) {
    cardElement.classList.add('selected');
  } else {
    const cards = document.querySelectorAll('.pdf-page-card');
    if (cards[pageNum - 1]) cards[pageNum - 1].classList.add('selected');
  }

  if (pdfBatchRangeMode === 'single') {
    setPdfBatchRange('single');
  } else {
    updatePdfBatchActionButtons();
  }

  const canvas = await renderPdfPageToCanvas(currentPdfDoc, pageNum, appSettings.renderDpi || 2.0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  await setPreviewImage(dataUrl);
}

async function handleImageFiles(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    await handlePdfFiles(files);
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Lütfen geçerli bir görsel veya PDF seçin.', 'error');
    return;
  }

  try {
    currentPdfDoc = null;
    currentPdfNumPages = 0;
    currentPdfPagesMap = {};
    const dataUrl = await fileToBase64(file);
    el.conversionSheetTitle.textContent = file.name;
    el.pdfPagesContainer.classList.add('hidden');
    el.btnPdfBatchOcr.classList.add('hidden');
    el.btnStartOcr.classList.remove('btn-secondary-sheet');
    el.btnStartOcr.classList.add('btn-primary-sheet');
    if (el.btnStartOcrText) el.btnStartOcrText.textContent = 'Metne Dönüştür';
    await setPreviewImage(dataUrl);
    openConversionModal();
  } catch (err) {
    showToast('Görsel yüklenemedi: ' + err.message, 'error');
  }
}

async function handleGlobalPaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const dataUrl = await fileToBase64(blob);
      el.conversionSheetTitle.textContent = 'Panodan Yapıştırılan Görsel';
      el.pdfPagesContainer.classList.add('hidden');
      el.btnPdfBatchOcr.classList.add('hidden');
      await setPreviewImage(dataUrl);
      openConversionModal();
      showToast('Görsel aktarıldı!', 'success');
      break;
    }
  }
}

async function setPreviewImage(dataUrl) {
  currentImageRaw = dataUrl;
  currentRotation = 0;
  currentContrast = 1.0;
  isGrayscale = false;
  isBinarized = false;

  await applyImagePipeline();
}

async function applyImagePipeline() {
  if (!currentImageRaw) return;

  const processed = await processImage({
    imageSource: currentImageRaw,
    rotation: currentRotation,
    contrast: currentContrast,
    grayscale: isGrayscale,
    binarize: isBinarized
  });

  currentProcessedImage = processed;
  el.activePreviewImg.src = processed;
}

function handleRotate90() {
  currentRotation = (currentRotation + 90) % 360;
  applyImagePipeline();
}

function toggleContrastFilter() {
  currentContrast = currentContrast === 1.0 ? 1.45 : 1.0;
  isGrayscale = currentContrast > 1.0;
  applyImagePipeline();
}

function toggleBinarizeFilter() {
  isBinarized = !isBinarized;
  applyImagePipeline();
}

function resetImageFilters() {
  currentRotation = 0;
  currentContrast = 1.0;
  isGrayscale = false;
  isBinarized = false;
  applyImagePipeline();
}

function openConversionModal() {
  el.conversionModal.classList.remove('hidden');
}

function closeConversionModal() {
  el.conversionModal.classList.add('hidden');
  el.fileInputPdf.value = '';
  el.fileInputPhoto.value = '';
}

/* ==========================================================================
   OCR AI Execution
   ========================================================================== */
function populateModelSelect() {
  const provider = appSettings.activeProvider || 'auto';
  let models = AVAILABLE_MODELS[provider];
  if (!models || models.length === 0) {
    models = AVAILABLE_MODELS['auto'] || [];
  }
  const currentModel = provider === 'groq' ? appSettings.groqModel : appSettings.openrouterModel;

  if (el.selectModel) {
    el.selectModel.innerHTML = '';
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name}`;
      if (m.id === currentModel || (m.id === 'auto' && (!currentModel || currentModel === 'auto'))) opt.selected = true;
      el.selectModel.appendChild(opt);
    });
  }

  if (el.settingsModelSelect) {
    el.settingsModelSelect.innerHTML = '';
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name}`;
      if (m.id === currentModel || (m.id === 'auto' && (!currentModel || currentModel === 'auto'))) opt.selected = true;
      el.settingsModelSelect.appendChild(opt);
    });
  }
}

function handleModelChange(e) {
  const modelId = e.target.value;
  if (appSettings.activeProvider === 'groq') {
    appSettings.groqModel = modelId;
  } else {
    appSettings.openrouterModel = modelId;
  }
  saveSettings(appSettings);
}

async function startOcrProcess() {
  if (!currentProcessedImage) {
    showToast('Lütfen önce bir doküman yükleyin.', 'error');
    return;
  }

  const provider = appSettings.activeProvider || 'auto';
  const model = provider === 'groq' ? appSettings.groqModel : (appSettings.openrouterModel || 'auto');

  isOcrRunning = true;
  abortController = new AbortController();
  el.btnStartOcr.disabled = true;
  el.scanningLaser.classList.remove('hidden');
  el.processingOverlay.classList.remove('hidden');
  el.processingStatusText.textContent = `Vision AI ile taranıyor...`;

  const startTime = Date.now();

  try {
    const text = await performOcr({
      imageBase64: currentProcessedImage,
      provider,
      groqApiKey: appSettings.groqApiKey,
      openrouterApiKey: appSettings.openrouterApiKey,
      model,
      options: {
        strictTurkish: appSettings.strictTurkish !== false,
        mergeHyphenatedWords: appSettings.mergeHyphenatedWords !== false,
        ignorePageNumbers: appSettings.ignorePageNumbers !== false,
        preserveFormatting: appSettings.preserveFormatting !== false,
        temperature: appSettings.temperature ?? 0.1
      },
      signal: abortController.signal,
      onModelFallback: ({ from, to, reason }) => {
        const fromShort = from.replace(/OpenRouter \(|\)/g, '').replace(/Groq \(|\)/g, '');
        const toShort = to.replace(/OpenRouter \(|\)/g, '').replace(/Groq \(|\)/g, '');
        showToast(`${fromShort} yoğun, ${toShort}'a geçildi`, 'info');
      }
    });

    displayOcrResult(text, Date.now() - startTime);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#ffffff', '#8e8e93', '#2c2c2e']
    });

    showToast('Metin başarıyla çıkarıldı!', 'success');
  } catch (err) {
    if (err.name === 'AbortError') {
      showToast('İşlem iptal edildi.', 'info');
    } else {
      showToast(`Hata: ${err.message}`, 'error');
    }
  } finally {
    isOcrRunning = false;
    abortController = null;
    el.btnStartOcr.disabled = false;
    el.scanningLaser.classList.add('hidden');
    el.processingOverlay.classList.add('hidden');
  }
}

async function startPdfBatchOcr() {
  if (!currentPdfDoc || currentPdfNumPages === 0) return;

  const provider = appSettings.activeProvider || 'auto';
  const model = provider === 'groq' ? appSettings.groqModel : (appSettings.openrouterModel || 'auto');

  const startPage = Math.max(1, Math.min(currentPdfNumPages, pdfBatchStartPage));
  const endPage = Math.max(startPage, Math.min(currentPdfNumPages, pdfBatchEndPage));
  const totalInBatch = endPage - startPage + 1;

  isOcrRunning = true;
  abortController = new AbortController();
  el.btnPdfBatchOcr.disabled = true;
  el.btnStartOcr.disabled = true;
  el.scanningLaser.classList.remove('hidden');
  el.processingOverlay.classList.remove('hidden');

  if (el.ocrProgressBox) {
    el.ocrProgressBox.classList.remove('hidden');
    el.ocrProgressBar.style.width = '0%';
    el.ocrProgressPercent.textContent = '%0';
    el.ocrProgressPages.textContent = `0 / ${totalInBatch} Sayfa`;
  }

  let combinedText = '';
  currentPdfPagesMap = {};
  let processedCount = 0;

  try {
    for (let i = startPage; i <= endPage; i++) {
      if (abortController.signal.aborted) break;

      const currentIdx = i - startPage;
      const pct = Math.round((currentIdx / totalInBatch) * 100);

      if (el.ocrProgressBar) el.ocrProgressBar.style.width = `${pct}%`;
      if (el.ocrProgressPercent) el.ocrProgressPercent.textContent = `%${pct}`;
      if (el.ocrProgressPages) el.ocrProgressPages.textContent = `${currentIdx + 1} / ${totalInBatch} Sayfa`;
      el.processingStatusText.textContent = `Sayfa ${i} / ${currentPdfNumPages} Vision AI ile taranıyor...`;

      // Render page canvas & update preview
      const canvas = await renderPdfPageToCanvas(currentPdfDoc, i, appSettings.renderDpi || 2.0);
      const pageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      await setPreviewImage(pageDataUrl);

      // Perform Vision AI OCR with Dynamic Fallback
      const pageText = await performOcr({
        imageBase64: pageDataUrl,
        provider,
        groqApiKey: appSettings.groqApiKey,
        openrouterApiKey: appSettings.openrouterApiKey,
        model,
        options: {
          strictTurkish: appSettings.strictTurkish !== false,
          mergeHyphenatedWords: appSettings.mergeHyphenatedWords !== false,
          ignorePageNumbers: appSettings.ignorePageNumbers !== false,
          preserveFormatting: appSettings.preserveFormatting !== false,
          temperature: appSettings.temperature ?? 0.1
        },
        signal: abortController.signal,
        onModelFallback: ({ from, to, reason }) => {
          const fromShort = from.replace(/OpenRouter \(|\)/g, '').replace(/Groq \(|\)/g, '');
          const toShort = to.replace(/OpenRouter \(|\)/g, '').replace(/Groq \(|\)/g, '');
          showToast(`Sayfa ${i}: ${fromShort} yoğun, ${toShort}'a geçildi`, 'info');
        }
      });

      // Split into clean paragraphs
      const paragraphs = pageText
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#') && !p.startsWith('*'));

      currentPdfPagesMap[i] = paragraphs.length > 0 ? paragraphs : [pageText];
      combinedText += (combinedText ? '\n\n---\n\n' : '') + `## Sayfa ${i}\n\n` + pageText;
      processedCount++;
    }

    if (el.ocrProgressBar) el.ocrProgressBar.style.width = '100%';
    if (el.ocrProgressPercent) el.ocrProgressPercent.textContent = '%100';
    if (el.ocrProgressPages) el.ocrProgressPages.textContent = `${totalInBatch} / ${totalInBatch} Sayfa`;

    displayOcrResult(combinedText.trim(), processedCount);

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#ffffff', '#8e8e93', '#2c2c2e']
    });

    showToast(`${processedCount} sayfa başarıyla analiz edildi!`, 'success');

    // Otomatik olarak kitaplığa kaydet ve doğrudan okuyucuda aç
    handleSaveOcrToLibrary();
  } catch (err) {
    if (err.name === 'AbortError') {
      if (processedCount > 0) {
        displayOcrResult(combinedText.trim(), processedCount);
        showToast(`İşlem durduruldu. Taranan ${processedCount} sayfa korundu.`, 'info');
      } else {
        showToast('İşlem iptal edildi.', 'info');
      }
    } else {
      showToast('Hata: ' + err.message, 'error');
    }
  } finally {
    isOcrRunning = false;
    abortController = null;
    el.btnPdfBatchOcr.disabled = false;
    el.btnStartOcr.disabled = false;
    el.scanningLaser.classList.add('hidden');
    el.processingOverlay.classList.add('hidden');
    if (el.ocrProgressBox) el.ocrProgressBox.classList.add('hidden');
  }
}

function displayOcrResult(text, pageCount = 1) {
  lastOcrResult = text;
  el.rawTextarea.value = text;
  el.viewFormatted.innerHTML = marked.parse(text);
  el.resultSection.classList.remove('hidden');

  if (el.resultPagesBadge) {
    if (pageCount && pageCount > 1) {
      el.resultPagesBadge.textContent = `${pageCount} Sayfa Analiz Edildi`;
      el.resultPagesBadge.classList.remove('hidden');
    } else {
      el.resultPagesBadge.classList.add('hidden');
    }
  }

  // Also save to history
  saveHistoryItem({
    title: el.conversionSheetTitle.textContent || 'Doküman',
    text,
    thumbnail: currentProcessedImage ? createThumbnail(el.activePreviewImg) : '',
    provider: appSettings.activeProvider,
    model: appSettings.activeProvider === 'groq' ? appSettings.groqModel : appSettings.openrouterModel
  });
}

async function handleCopyText() {
  if (!lastOcrResult) return;
  const ok = await copyToClipboard(lastOcrResult);
  if (ok) showToast('Panoya kopyalandı', 'success');
}

function handleSaveOcrToLibrary() {
  if (!lastOcrResult) return;

  const docName = (el.conversionSheetTitle.textContent || 'Yeni Belge').replace(/\.[^/.]+$/, '');
  
  // Re-index pages sequentially if batch analysis was performed
  const analyzedKeys = Object.keys(currentPdfPagesMap).map(Number).sort((a, b) => a - b);
  let pageParagraphs = {};
  let totalPages = 1;

  if (analyzedKeys.length > 0) {
    analyzedKeys.forEach((origPage, idx) => {
      pageParagraphs[idx + 1] = currentPdfPagesMap[origPage];
    });
    totalPages = analyzedKeys.length;
  }

  const newBook = {
    id: 'book_' + Date.now(),
    title: docName,
    author: 'Kişisel Belge',
    cover: currentProcessedImage ? createThumbnail(el.activePreviewImg) : '/cover-1.jpg',
    totalPages: totalPages,
    currentPage: 1,
    progress: 0,
    date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }),
    content: lastOcrResult,
    pageParagraphs: Object.keys(pageParagraphs).length > 0 ? pageParagraphs : null,
    isPdf: !!currentPdfDoc,
    isCurrent: true
  };

  saveBook(newBook);
  closeConversionModal();
  renderHomeScreen();
  renderLibraryScreen();
  openBookInReader(newBook);
  showToast(`${docName} (${totalPages} Sayfa) kitaplığınıza eklendi!`, 'success');
}

/* ==========================================================================
   Screen Wake Lock Controller (Uninterrupted Reading)
   ========================================================================== */
async function requestWakeLock() {
  if ('wakeLock' in navigator && appSettings.keepScreenAwake) {
    try {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
    } catch (err) {
      console.log('Screen Wake Lock error or not supported:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && el.inAppReaderView && !el.inAppReaderView.classList.contains('hidden')) {
    requestWakeLock();
  }
});

/* ==========================================================================
   Notlarım (Notes, Quotes & Bookmarks) Screen Controller
   ========================================================================== */
function renderNotesScreen() {
  if (!el.notesListContainer) return;
  const allNotes = getNotes();

  // 1. Filter by category
  let filtered = allNotes;
  if (currentNotesFilter && currentNotesFilter !== 'all') {
    filtered = filtered.filter(n => n.type === currentNotesFilter);
  }

  // 2. Filter by search query
  if (currentNotesSearchQuery) {
    const q = currentNotesSearchQuery.toLowerCase();
    filtered = filtered.filter(n =>
      (n.text && n.text.toLowerCase().includes(q)) ||
      (n.userNote && n.userNote.toLowerCase().includes(q)) ||
      (n.bookTitle && n.bookTitle.toLowerCase().includes(q)) ||
      (n.bookAuthor && n.bookAuthor.toLowerCase().includes(q))
    );
  }

  // 3. Update count badge
  if (el.notesCountBadge) {
    el.notesCountBadge.textContent = `${filtered.length} Not`;
  }

  el.notesListContainer.innerHTML = '';

  // 4. Empty State
  if (filtered.length === 0) {
    el.notesListContainer.innerHTML = `
      <div class="notes-empty-state">
        <div class="notes-empty-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <h3 class="notes-empty-title">Henüz Not veya Alıntı Yok</h3>
        <p class="notes-empty-desc">
          ${currentNotesSearchQuery ? 'Aramanızla eşleşen not bulunamadı.' : 'Kitap okurken metin seçerek alıntı yapabilir, sayfa ekleyebilir veya düşüncelerinizi kaydedebilirsiniz.'}
        </p>
        ${!currentNotesSearchQuery ? `
          <button type="button" class="btn-notes-empty-add" id="btnEmptyAddNote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            <span>Yeni Not Ekle</span>
          </button>
        ` : ''}
      </div>
    `;

    const btnEmptyAdd = el.notesListContainer.querySelector('#btnEmptyAddNote');
    if (btnEmptyAdd) {
      btnEmptyAdd.addEventListener('click', () => openAddNoteModal('note'));
    }
    return;
  }

  // 5. Render Notes Cards
  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card-item';

    const typeConfig = {
      quote: { label: 'Alıntı', badgeClass: 'type-quote', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>' },
      note: { label: 'Not', badgeClass: 'type-note', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path></svg>' },
      bookmark: { label: 'Yer İmi', badgeClass: 'type-bookmark', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' }
    }[note.type || 'note'] || { label: 'Not', badgeClass: 'type-note', icon: '' };

    const escape = (str) => {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    let bodyHtml = '';
    if (note.text) {
      bodyHtml += `<blockquote class="note-quote-box">"${escape(note.text)}"</blockquote>`;
    }
    if (note.userNote) {
      bodyHtml += `
        <div class="note-user-comment">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div class="note-comment-text">${escape(note.userNote)}</div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="note-card-header">
        <div class="note-book-tag" title="${escape(note.bookTitle)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span class="note-book-title">${escape(note.bookTitle)}</span>
          <span class="note-page-pill">Sayfa ${note.pageNumber || 1}</span>
        </div>
        <span class="note-type-pill ${typeConfig.badgeClass}">
          ${typeConfig.icon}
          <span>${typeConfig.label}</span>
        </span>
      </div>

      <div class="note-card-content">
        ${bodyHtml}
      </div>

      <div class="note-card-footer">
        <span class="note-date-text">${note.dateFormatted || ''}</span>
        <div class="note-actions-row">
          <button type="button" class="btn-note-action action-open" title="Kitapta Aç">
            <span>Kitapta Aç</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:12px;height:12px;">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button type="button" class="btn-note-action action-icon-only action-copy" title="Kopyala" aria-label="Kopyala">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button type="button" class="btn-note-action action-icon-only action-delete" title="Sil" aria-label="Sil">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.action-open').addEventListener('click', () => {
      const books = getBooks();
      let targetBook = books.find(b => b.id === note.bookId);
      if (!targetBook) {
        targetBook = books[0] || getCurrentBook();
      }
      if (targetBook) {
        openBookInReader(targetBook, note.pageNumber);
      }
    });

    card.querySelector('.action-copy').addEventListener('click', async () => {
      const copyText = [note.text, note.userNote].filter(Boolean).join('\n\n');
      if (copyText) {
        await navigator.clipboard.writeText(copyText);
        showToast('Not panoya kopyalandı', 'success');
      }
    });

    card.querySelector('.action-delete').addEventListener('click', () => {
      deleteNote(note.id);
      showToast('Not silindi', 'info');
      renderNotesScreen();
    });

    el.notesListContainer.appendChild(card);
  });
}

function openAddNoteModal(initialType = 'note') {
  if (!el.addNoteModal) return;
  const book = currentActiveBook || getCurrentBook() || { title: 'Kitap', author: '' };

  if (el.addNoteBookTag) {
    el.addNoteBookTag.textContent = `${book.title} · Sayfa ${currentReaderPage}`;
  }

  // Check highlighted text
  const selectedText = window.getSelection()?.toString().trim() || '';
  if (selectedText) {
    if (el.noteQuotePreviewBox) el.noteQuotePreviewBox.classList.remove('hidden');
    if (el.noteQuotePreviewText) el.noteQuotePreviewText.textContent = selectedText;
    currentNoteModalType = 'quote';
  } else {
    if (el.noteQuotePreviewBox) el.noteQuotePreviewBox.classList.add('hidden');
    if (el.noteQuotePreviewText) el.noteQuotePreviewText.textContent = '';
    currentNoteModalType = initialType;
  }

  if (el.noteModalTypeChips) {
    el.noteModalTypeChips.querySelectorAll('.note-type-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.type === currentNoteModalType);
    });
  }

  if (el.inputUserNote) {
    el.inputUserNote.value = '';
    setTimeout(() => el.inputUserNote.focus(), 150);
  }

  el.addNoteModal.classList.remove('hidden');
}

function closeAddNoteModal() {
  if (el.addNoteModal) el.addNoteModal.classList.add('hidden');
}

function handleSaveNoteSubmit() {
  const book = currentActiveBook || getCurrentBook();
  const quoteText = el.noteQuotePreviewText ? el.noteQuotePreviewText.textContent.trim() : '';
  const userText = el.inputUserNote ? el.inputUserNote.value.trim() : '';

  if (!quoteText && !userText && currentNoteModalType !== 'bookmark') {
    showToast('Lütfen bir not veya alıntı metni girin', 'info');
    return;
  }

  saveNote({
    bookId: book ? book.id : '',
    bookTitle: book ? book.title : 'Not',
    bookAuthor: book ? book.author : '',
    pageNumber: currentReaderPage || 1,
    type: currentNoteModalType || 'note',
    text: quoteText || (currentNoteModalType === 'bookmark' ? `Sayfa ${currentReaderPage} Yer İmi` : ''),
    userNote: userText
  });

  closeAddNoteModal();
  showToast('Not kaydedildi!', 'success');
  if (el.notesViewScreen && !el.notesViewScreen.classList.contains('hidden')) {
    renderNotesScreen();
  }
}

function setupNotesScreenEvents() {
  if (el.btnNotesNewNote) {
    el.btnNotesNewNote.addEventListener('click', () => openAddNoteModal('note'));
  }

  if (el.notesSearchInput) {
    el.notesSearchInput.addEventListener('input', (e) => {
      currentNotesSearchQuery = e.target.value.trim();
      if (el.btnClearNotesSearch) {
        el.btnClearNotesSearch.classList.toggle('hidden', !currentNotesSearchQuery);
      }
      renderNotesScreen();
    });
  }

  if (el.btnClearNotesSearch) {
    el.btnClearNotesSearch.addEventListener('click', () => {
      if (el.notesSearchInput) el.notesSearchInput.value = '';
      currentNotesSearchQuery = '';
      el.btnClearNotesSearch.classList.add('hidden');
      renderNotesScreen();
    });
  }

  if (el.notesFilterPills) {
    el.notesFilterPills.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        el.notesFilterPills.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentNotesFilter = pill.dataset.filter || 'all';
        renderNotesScreen();
      });
    });
  }

  if (el.btnCloseNoteModal) el.btnCloseNoteModal.addEventListener('click', closeAddNoteModal);
  if (el.btnCancelNoteModal) el.btnCancelNoteModal.addEventListener('click', closeAddNoteModal);
  if (el.addNoteModal) {
    el.addNoteModal.addEventListener('click', (e) => {
      if (e.target === el.addNoteModal) closeAddNoteModal();
    });
  }

  if (el.noteModalTypeChips) {
    el.noteModalTypeChips.querySelectorAll('.note-type-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        el.noteModalTypeChips.querySelectorAll('.note-type-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentNoteModalType = chip.dataset.type || 'note';
      });
    });
  }

  if (el.btnSaveNoteSubmit) {
    el.btnSaveNoteSubmit.addEventListener('click', handleSaveNoteSubmit);
  }
}

/* ==========================================================================
   Ayarlar (Settings & Preferences) Screen Controller (Apple iOS Inset Style)
   ========================================================================== */
function renderSettingsScreen() {
  appSettings = getSettings();

  // 1. Theme Selector
  if (el.settingsThemeSelector) {
    el.settingsThemeSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === (appSettings.defaultTheme || 'koyu'));
    });
  }
  if (el.badgeCurrentTheme) {
    const themeNames = { koyu: 'Koyu (OLED)', acik: 'Açık', sepya: 'Sepya' };
    el.badgeCurrentTheme.textContent = themeNames[appSettings.defaultTheme] || 'Koyu (OLED)';
  }

  // 2. Font Selector
  if (el.settingsFontSelector) {
    el.settingsFontSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === (appSettings.defaultFont || 'serif'));
    });
  }

  // 3. Toggles
  if (el.setWakeLock) el.setWakeLock.checked = appSettings.keepScreenAwake !== false;
  if (el.setAutoNightMode) el.setAutoNightMode.checked = appSettings.autoNightMode !== false;
  if (el.setAutoPrefetch) el.setAutoPrefetch.checked = appSettings.autoPrefetch !== false;
  if (el.setMergeHyphens) el.setMergeHyphens.checked = appSettings.mergeHyphenatedWords !== false;
  if (el.setIgnorePageNums) el.setIgnorePageNums.checked = appSettings.ignorePageNumbers !== false;
  if (el.setOfflineCache) el.setOfflineCache.checked = appSettings.offlineCache !== false;

  // 4. TTS Speed Selector
  const currentSpeed = String(appSettings.ttsSpeed || 1.0);
  if (el.settingsTtsSelector) {
    el.settingsTtsSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.speed === currentSpeed);
    });
  }
  if (el.badgeTtsSpeed) {
    el.badgeTtsSpeed.textContent = `${currentSpeed}x`;
  }
}

function setupSettingsScreenEvents() {
  // Theme selector
  if (el.settingsThemeSelector) {
    el.settingsThemeSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        appSettings.defaultTheme = theme;
        currentReaderTheme = theme;
        saveSettings(appSettings);
        applyReaderTheme(theme);
        renderSettingsScreen();
        showToast(`Tema: ${btn.textContent}`, 'success');
      });
    });
  }

  // Font selector
  if (el.settingsFontSelector) {
    el.settingsFontSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const font = btn.dataset.font;
        appSettings.defaultFont = font;
        currentReaderFont = font;
        saveSettings(appSettings);
        applyReaderTypography();
        renderSettingsScreen();
        showToast(`Yazı tipi: ${btn.textContent}`, 'success');
      });
    });
  }

  // Wake lock toggle
  if (el.setWakeLock) {
    el.setWakeLock.addEventListener('change', (e) => {
      appSettings.keepScreenAwake = e.target.checked;
      saveSettings(appSettings);
      if (appSettings.keepScreenAwake) {
        requestWakeLock();
        showToast('Ekran sürekli açık tutulacak', 'success');
      } else {
        releaseWakeLock();
        showToast('Ekran uyanık tutma devre dışı', 'info');
      }
    });
  }

  // Auto night mode
  if (el.setAutoNightMode) {
    el.setAutoNightMode.addEventListener('change', (e) => {
      appSettings.autoNightMode = e.target.checked;
      saveSettings(appSettings);
      showToast(e.target.checked ? 'Otomatik Gece Modu aktif' : 'Otomatik Gece Modu kapatıldı', 'info');
    });
  }

  // Smart prefetch
  if (el.setAutoPrefetch) {
    el.setAutoPrefetch.addEventListener('change', (e) => {
      appSettings.autoPrefetch = e.target.checked;
      saveSettings(appSettings);
      showToast(e.target.checked ? 'Arka planda sayfa yükleme açık' : 'Arka planda yükleme kapalı', 'info');
    });
  }

  // Merge hyphens
  if (el.setMergeHyphens) {
    el.setMergeHyphens.addEventListener('change', (e) => {
      appSettings.mergeHyphenatedWords = e.target.checked;
      saveSettings(appSettings);
    });
  }

  // Ignore page numbers
  if (el.setIgnorePageNums) {
    el.setIgnorePageNums.addEventListener('change', (e) => {
      appSettings.ignorePageNumbers = e.target.checked;
      saveSettings(appSettings);
    });
  }

  // TTS speed
  if (el.settingsTtsSelector) {
    el.settingsTtsSelector.querySelectorAll('.segmented-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = Number(btn.dataset.speed) || 1.0;
        appSettings.ttsSpeed = speed;
        saveSettings(appSettings);
        renderSettingsScreen();
        showToast(`Ses hızı ${speed}x olarak ayarlandı`, 'info');
      });
    });
  }

  // Offline cache
  if (el.setOfflineCache) {
    el.setOfflineCache.addEventListener('change', (e) => {
      appSettings.offlineCache = e.target.checked;
      saveSettings(appSettings);
      showToast(e.target.checked ? 'Çevrimdışı önbellek açık' : 'Çevrimdışı önbellek kapalı', 'info');
    });
  }

  // Export Data
  if (el.btnExportData) {
    el.btnExportData.addEventListener('click', () => {
      const json = exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reawid-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Yedek JSON başarıyla indirildi!', 'success');
    });
  }

  // Import Data
  if (el.btnImportData && el.fileInputBackup) {
    el.btnImportData.addEventListener('click', () => {
      el.fileInputBackup.click();
    });

    el.fileInputBackup.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = importAllData(event.target.result);
        if (res.success) {
          showToast(res.message, 'success');
          renderHomeScreen();
          renderLibraryScreen();
          renderNotesScreen();
          renderSettingsScreen();
        } else {
          showToast(res.message, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // Clear cache
  if (el.btnClearCache) {
    el.btnClearCache.addEventListener('click', () => {
      if (confirm('Geçici oturum ve OCR önbelleği temizlensin mi? (Kayıtlı kitap ve notlarınız silinmez)')) {
        clearAppCache();
        showToast('Geçici önbellek temizlendi.', 'success');
      }
    });
  }
}

/* ==========================================================================
   PWA & System File Integration
   ========================================================================== */
function setupPwa() {
  const CURRENT_CACHE = 'reawid-apple-v21';
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key !== CURRENT_CACHE) {
          caches.delete(key);
        }
      });
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update();
      } catch (err) {
        console.warn('SW register error:', err);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    el.btnPwaInstall.classList.remove('hidden');
  });

  el.btnPwaInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Reawid ana ekrana ekleniyor!', 'success');
    }
    deferredPrompt = null;
    el.btnPwaInstall.classList.add('hidden');
  });
}

function setupFileHandlingLaunchQueue() {
  if ('launchQueue' in window && window.LaunchParams && 'files' in window.LaunchParams.prototype) {
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files || !launchParams.files.length) return;
      try {
        const handle = launchParams.files[0];
        const file = await handle.getFile();
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          await handlePdfFiles([file]);
        } else if (file.type.startsWith('image/')) {
          await handleImageFiles([file]);
        }
      } catch (err) {
        console.warn('LaunchQueue error:', err);
      }
    });
  }
}

/* ==========================================================================
   Toast Notification
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 180ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// Start
init();

// Auto-sync PNG icons from vector SVG in dev
if (import.meta.env.DEV) {
  const syncIcons = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c192 = document.createElement('canvas');
      c192.width = 192; c192.height = 192;
      const ctx192 = c192.getContext('2d');
      ctx192.drawImage(img, 0, 0, 192, 192);

      const c512 = document.createElement('canvas');
      c512.width = 512; c512.height = 512;
      const ctx512 = c512.getContext('2d');
      ctx512.drawImage(img, 0, 0, 512, 512);

      fetch('/api/save-logo-png', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          png192: c192.toDataURL('image/png'),
          png512: c512.toDataURL('image/png')
        })
      }).catch(() => {});
    };
    img.src = '/reawid-logo.svg';
  };
  setTimeout(syncIcons, 400);
}

