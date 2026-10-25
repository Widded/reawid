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
  syncLocalWithCloudDb,
  resetAllAppData,
  savePdfToIdb,
  getPdfFromIdb,
  generateBookCoverSvg,
  AVAILABLE_MODELS
} from './services/storageService.js';

import {
  isSupabaseConfigured,
  getCurrentUser,
  subscribeAuth,
  signUpWithEmail,
  signInWithEmail,
  signOutUser
} from './services/supabaseService.js';

import {
  performOcr,
  testApiConnection,
  normalizeHyphensAndText
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
let currentReaderPage = 1;
let currentTotalPages = 1;
let currentReaderTheme = 'koyu';
let currentReaderFontSize = 'xl'; // 'sm' | 'md' | 'lg' | 'xl'
let currentReaderLineHeight = 'standard'; // 'tight' | 'standard' | 'wide'
let currentReaderFont = 'serif'; // 'serif' | 'sans' | 'mono'
let currentReaderMargin = 'standard'; // 'narrow' | 'standard' | 'wide'
let currentCompareZoom = 1.0;
let isCompareSpeaking = false;
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
  storageUsageProgressFill: document.getElementById('storageUsageProgressFill'),

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
  toggleBookDialogueFormat: document.getElementById('toggleBookDialogueFormat'),

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
  compareOriginalEmpty: document.getElementById('compareOriginalEmpty'),
  compareOriginalEmptyTitle: document.getElementById('compareOriginalEmptyTitle'),
  compareOriginalEmptyDesc: document.getElementById('compareOriginalEmptyDesc'),
  btnZoomOriginalIn: document.getElementById('btnZoomOriginalIn'),
  btnZoomOriginalReset: document.getElementById('btnZoomOriginalReset'),
  btnZoomOriginalOut: document.getElementById('btnZoomOriginalOut'),
  btnFitOriginal: document.getElementById('btnFitOriginal'),
  btnSpeakCompareText: document.getElementById('btnSpeakCompareText'),
  compareSpeakLabel: document.getElementById('compareSpeakLabel'),
  btnCopyCompareText: document.getElementById('btnCopyCompareText'),
  compareDigitalContent: document.getElementById('compareDigitalContent'),
  comparisonSplitHandle: document.getElementById('comparisonSplitHandle'),
  comparePageSlider: document.getElementById('comparePageSlider'),
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
  setDialogueFormatting: document.getElementById('setDialogueFormatting'),
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

  // Supabase Cloud & Account Elements
  accountModal: document.getElementById('accountModal'),
  btnCloseAccountModal: document.getElementById('btnCloseAccountModal'),
  btnSettingsOpenAccount: document.getElementById('btnSettingsOpenAccount'),
  settingsAccountAvatar: document.getElementById('settingsAccountAvatar'),
  settingsAccountName: document.getElementById('settingsAccountName'),
  settingsAccountStatus: document.getElementById('settingsAccountStatus'),
  accountLoggedInView: document.getElementById('accountLoggedInView'),
  accountAuthView: document.getElementById('accountAuthView'),
  accountUserAvatar: document.getElementById('accountUserAvatar'),
  accountUserEmail: document.getElementById('accountUserEmail'),
  accountStatBooks: document.getElementById('accountStatBooks'),
  accountStatNotes: document.getElementById('accountStatNotes'),
  btnAccountSyncNow: document.getElementById('btnAccountSyncNow'),
  syncSpinnerIcon: document.getElementById('syncSpinnerIcon'),
  btnAccountSignOut: document.getElementById('btnAccountSignOut'),
  tabSignIn: document.getElementById('tabSignIn'),
  tabSignUp: document.getElementById('tabSignUp'),
  formSupabaseAuth: document.getElementById('formSupabaseAuth'),
  authInputEmail: document.getElementById('authInputEmail'),
  authInputPassword: document.getElementById('authInputPassword'),
  authErrorMsg: document.getElementById('authErrorMsg'),
  btnAuthSubmit: document.getElementById('btnAuthSubmit'),

  // Reset All Data Modal Elements
  btnOpenResetModal: document.getElementById('btnOpenResetModal'),
  resetDataModal: document.getElementById('resetDataModal'),
  btnCloseResetModal: document.getElementById('btnCloseResetModal'),
  btnCancelResetModal: document.getElementById('btnCancelResetModal'),
  resetChallengeCode: document.getElementById('resetChallengeCode'),
  btnRefreshResetCode: document.getElementById('btnRefreshResetCode'),
  inputResetCodeConfirm: document.getElementById('inputResetCodeConfirm'),
  resetCodeHint: document.getElementById('resetCodeHint'),
  btnConfirmResetSubmit: document.getElementById('btnConfirmResetSubmit'),

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
  try { setupAccountController(); } catch (e) { console.error('setupAccountController error:', e); }
  try { setupResetDataController(); } catch (e) { console.error('setupResetDataController error:', e); }
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
    el.cardContinueBook.innerHTML = `
      <img src="${(currentBook.cover && !currentBook.cover.includes('/cover-1.jpg')) ? currentBook.cover : generateBookCoverSvg(currentBook.title, currentBook.author)}" alt="Devam Eden Kitap Kapağı" class="book-cover-thumb" id="currentBookCover">
      <div class="continue-info">
        <h3 class="continue-book-title" id="currentBookTitle">${currentBook.title}</h3>
        <p class="continue-book-author" id="currentBookAuthor">${currentBook.author || ''}</p>
        <div class="continue-progress-row">
          <div class="progress-track">
            <div class="progress-fill" id="currentBookProgressFill" style="width: ${currentBook.progress || 0}%;"></div>
          </div>
          <span class="progress-percent" id="currentBookProgressLabel">%${currentBook.progress || 0}</span>
        </div>
      </div>
      <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    el.cardContinueBook.onclick = () => {
      openBookInReader(currentBook);
    };
  } else {
    el.cardContinueBook.innerHTML = `
      <div class="empty-continue-card">
        <div class="empty-continue-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
        <div class="empty-continue-text">
          <h3 class="empty-continue-title">Henüz Bir Kitap Yok</h3>
          <p class="empty-continue-subtitle">PDF yükleyerek veya taratarak okumaya başlayın.</p>
        </div>
        <div class="empty-continue-btn-badge">
          <span>Kitap Ekle</span>
        </div>
      </div>
    `;
    el.cardContinueBook.onclick = () => {
      if (el.btnNewBookCard) el.btnNewBookCard.click();
    };
  }

  // 2. Render Son Kitaplar
  const allBooks = getBooks();
  el.recentBooksList.innerHTML = '';

  if (allBooks.length === 0) {
    el.recentBooksList.innerHTML = `
      <div class="home-empty-books-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-books-icon">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
        <span class="empty-books-title">Kitaplığınız Boş</span>
        <span class="empty-books-desc">Eklediğiniz tüm kitaplar ve sayfalar burada listelenir.</span>
      </div>
    `;
  } else {
    const recentBooks = allBooks.slice(0, 3);
    recentBooks.forEach((book, index) => {
      const row = document.createElement('div');
      row.className = 'book-row-item';
      row.innerHTML = `
        <img src="${(book.cover && !book.cover.includes('/cover-1.jpg')) ? book.cover : generateBookCoverSvg(book.title, book.author)}" alt="${book.title}" class="book-row-cover">
        <div class="book-row-info">
          <h4 class="book-row-title">${book.title}</h4>
          <p class="book-row-author">${book.author || ''}</p>
          <span class="book-row-meta">${book.date || 'Bugün'} · ${book.totalPages || 1} sayfa</span>
        </div>
        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;

      row.addEventListener('click', () => {
        openBookInReader(book);
      });

      el.recentBooksList.appendChild(row);

      if (index < recentBooks.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'book-row-divider';
        el.recentBooksList.appendChild(divider);
      }
    });
  }

  // Calculate storage based on books, paragraphs & notes and user login state
  const user = getCurrentUser ? getCurrentUser() : null;
  const allNotes = getNotes ? getNotes() : [];
  const booksChars = (localStorage.getItem('reawid_books_v2') || '').length;
  const notesChars = (localStorage.getItem('reawid_notes_v2') || '').length;
  const rawMb = (booksChars + notesChars) / (1024 * 1024);
  const totalItems = allBooks.length + allNotes.length;
  const usedMb = totalItems === 0 ? 0 : Number((rawMb + (allBooks.length * 0.25) + (allNotes.length * 0.04)).toFixed(1));

  if (user) {
    // Authenticated: Actually synced to Cloud
    const quotaMb = 500;
    const percent = Math.min(100, Math.max(usedMb > 0 ? 1 : 0, (usedMb / quotaMb) * 100));
    if (el.storageUsageText) {
      el.storageUsageText.textContent = `${usedMb} MB / ${quotaMb} MB (Bulut Alanı)`;
    }
    if (el.storageUsageProgressFill) {
      el.storageUsageProgressFill.style.width = `${percent.toFixed(1)}%`;
      el.storageUsageProgressFill.style.background = 'linear-gradient(90deg, #0a84ff, #5e5ce6)';
    }
  } else {
    // Not logged in: 100% Local Device Storage
    if (el.storageUsageText) {
      if (allBooks.length === 0) {
        el.storageUsageText.textContent = '0 MB · Yalnızca Bu Cihazda';
      } else {
        el.storageUsageText.textContent = `${usedMb} MB (Yalnızca Bu Cihazda) · Eşitlemek İçin Giriş Yapın`;
      }
    }
    if (el.storageUsageProgressFill) {
      const localBudgetMb = 50;
      const localPercent = Math.min(100, Math.max(usedMb > 0 ? 2 : 0, (usedMb / localBudgetMb) * 100));
      el.storageUsageProgressFill.style.width = `${localPercent.toFixed(1)}%`;
      el.storageUsageProgressFill.style.background = 'rgba(255, 255, 255, 0.25)';
    }
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
        <p style="font-size: 14px; margin: 0; color: #ffffff; font-weight: 500;">${currentLibrarySearchQuery ? 'Aramanızla Eşleşen Kitap Bulunamadı' : 'Kitaplığınızda Henüz Kitap Yok'}</p>
        <p style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">${currentLibrarySearchQuery ? 'Farklı bir arama terimi deneyin.' : 'Ana sayfadan "Yeni Kitap Ekle" butonu ile ilk kitabınızı ekleyin.'}</p>
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
      <img src="${(book.cover && !book.cover.includes('/cover-1.jpg')) ? book.cover : generateBookCoverSvg(book.title, book.author)}" alt="${book.title} Kapağı" class="library-book-cover" loading="lazy">
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
    currentReaderPage = book.currentPage || 1;
  }

  // Restore PDF document from IndexedDB if available and not yet loaded in memory
  if (book.isPdf && !currentPdfDoc) {
    getPdfFromIdb(book.id).then(async (cachedBlob) => {
      if (cachedBlob) {
        try {
          const { numPages, pdfDoc } = await loadPdf(cachedBlob);
          currentPdfDoc = pdfDoc;
          currentPdfNumPages = numPages;
          if (currentActiveBook && currentActiveBook.id === book.id) {
            renderReaderPage(currentReaderPage);
            if (el.comparisonViewModal && !el.comparisonViewModal.classList.contains('hidden')) {
              updateComparisonPage(currentReaderPage);
            }
          }
        } catch (err) {
          console.warn('PDF IndexedDB restore warning:', err);
        }
      }
    }).catch(() => {});
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

/* ==========================================================================
   Smart Book Typography & Dialogue Formatting Engine
   ========================================================================== */
function escapeBookHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineQuotes(escapedText) {
  if (!escapedText) return '';
  // Highlight inline quotes inside narrative: "..." or &quot;...&quot; or “...”
  return escapedText
    .replace(/(?:&quot;|"|“)([^&"\n]+?)(?:&quot;|"|”)/g, '<span class="reader-inline-quote">“$1”</span>');
}

/**
 * Checks if a string is a genuine dialogue turn.
 * True dialogue starts with em-dash (—, –, ―) or hyphen with space (- ),
 * strictly followed by an UPPERCASE letter, quotation mark, or number.
 * Lowercase continuation (e.g. "-den dolayı" or "-miş gibi") is NEVER dialogue.
 */
function isDialogueTurn(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  // Starts with em/en dash followed by capital letter, quote, or number
  if (/^[—–―]\s*([A-ZÇĞİÖŞÜ0-9"“«])/.test(s)) return true;
  // Starts with hyphen followed by space and capital letter, quote, or number
  if (/^-\s+([A-ZÇĞİÖŞÜ0-9"“«])/.test(s)) return true;
  // Starts with quotation mark followed by dialogue text
  if (/^[“"«][A-ZÇĞİÖŞÜ0-9—–]/.test(s)) return true;
  return false;
}

/**
 * Formats book paragraphs and dialogs with authentic novel typography.
 * - Merges end-of-line hyphens (matbaa heceleme çizgisi) so words are whole.
 * - Never confuses end-of-line hyphens or lowercase continuations with dialogue dashes.
 * - Groups wrapped lines into full narrative paragraphs.
 * - Formats genuine dialogues with em-dashes and hanging indents.
 */
function formatBookHtml(paragraphsOrText, options = {}) {
  const isEnabled = options.enabled !== false;
  const shouldMergeHyphens = options.mergeHyphens !== false &&
    (typeof appSettings !== 'undefined' ? appSettings.mergeHyphenatedWords !== false : true);

  if (!paragraphsOrText) return '';

  let rawList = [];
  if (Array.isArray(paragraphsOrText)) {
    rawList = paragraphsOrText;
  } else if (typeof paragraphsOrText === 'string') {
    rawList = paragraphsOrText.split(/\r?\n\n+/);
  } else {
    return '';
  }

  // Pre-process: merge end-of-line hyphens across blocks
  if (shouldMergeHyphens) {
    rawList = rawList.map(p => (typeof p === 'string' ? normalizeHyphensAndText(p) : p));
  }

  // If disabled, render plain paragraphs without novel styling
  if (!isEnabled) {
    return rawList
      .map(p => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .map(p => `<p class="reader-paragraph">${escapeBookHtml(p)}</p>`)
      .join('');
  }

  // 1. Smart Paragraph & Dialogue Segmenter
  const segmentedParagraphs = [];

  for (const block of rawList) {
    if (!block || typeof block !== 'string') continue;
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Split on explicit line breaks within the block
    const rawLines = trimmedBlock.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) continue;

    let currentSegment = '';
    let currentIsDialogue = false;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lineIsDialogue = isDialogueTurn(line);

      if (currentSegment === '') {
        currentSegment = line;
        currentIsDialogue = lineIsDialogue;
      } else {
        if (lineIsDialogue) {
          // New speaker dialogue turn starts! Flush previous segment
          segmentedParagraphs.push(currentSegment);
          currentSegment = line;
          currentIsDialogue = true;
        } else if (currentIsDialogue) {
          // Current segment is dialogue.
          // If previous dialogue line ended with sentence punctuation (.!?…) and this line starts with a capital letter,
          // then the dialogue turn finished and a new narrative paragraph begins!
          const prevEndsSentence = /[.!?…]["”»]?$/.test(currentSegment);
          const nextStartsWithCap = /^[A-ZÇĞİÖŞÜ]/.test(line);

          if (prevEndsSentence && nextStartsWithCap) {
            segmentedParagraphs.push(currentSegment);
            currentSegment = line;
            currentIsDialogue = false;
          } else {
            // Continuation of speech wrapped across lines
            currentSegment += ' ' + line;
          }
        } else {
          // Previous segment is narrative. Current line is also narrative.
          // In book pages/PDFs, sentences within the same paragraph wrap across lines.
          currentSegment += ' ' + line;
        }
      }
    }

    if (currentSegment) {
      segmentedParagraphs.push(currentSegment);
    }
  }

  // 2. Mid-sentence dialogue splitting:
  // When a narrative sentence completes (.!?…) and is followed on the same line
  // by a genuine dialogue dash (— or - ) + Capital letter:
  // e.g. "Yaşlı adam duraksadı. — Artık vakit geldi, dedi fısıltıyla."
  const finalSegments = [];
  for (const seg of segmentedParagraphs) {
    const parts = seg.split(/(?<=[.!?…]["”»]?)\s+(?=[—–―]\s*[A-ZÇĞİÖŞÜ0-9"“«]|-\s+[A-ZÇĞİÖŞÜ0-9"“«])/);
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart) finalSegments.push(trimmedPart);
    }
  }

  if (finalSegments.length === 0) {
    return '';
  }

  // 3. Render each segment with authentic typography
  return finalSegments.map(p => {
    const isDashDialogue = isDialogueTurn(p) && (/^[—–―]/.test(p) || /^-\s+/.test(p));
    const isQuoteDialogue = isDialogueTurn(p) && /^[“"«]/.test(p);

    if (isDashDialogue) {
      // Strip leading dash & space cleanly
      const speechBody = p.replace(/^[—–―]\s*|^-\s+/, '').trim();
      const formattedBody = formatInlineQuotes(escapeBookHtml(speechBody));
      return `<p class="reader-paragraph reader-dialogue"><span class="dialogue-dash" aria-hidden="true">—</span><span class="dialogue-text">${formattedBody}</span></p>`;
    }

    if (isQuoteDialogue) {
      const formattedBody = formatInlineQuotes(escapeBookHtml(p));
      return `<p class="reader-paragraph reader-dialogue reader-quote-speech">${formattedBody}</p>`;
    }

    // Standard narrative prose
    const formattedBody = formatInlineQuotes(escapeBookHtml(p));
    return `<p class="reader-paragraph reader-narrative">${formattedBody}</p>`;
  }).join('');
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
    el.readerParagraphsContainer.innerHTML = formatBookHtml(paragraphs, {
      enabled: appSettings.smartDialogueFormatting !== false
    });
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
        "Bu kitapta henüz okunabilir metin katmanı bulunmuyor. Sayfaları analiz etmek için lütfen Dönüştürücü'yü kullanın."
      ];
    }
    el.readerChapterBadge.textContent = chapterTitle;
    el.readerArticleTitle.textContent = currentActiveBook.title;
    el.readerParagraphsContainer.innerHTML = formatBookHtml(paragraphs, {
      enabled: appSettings.smartDialogueFormatting !== false
    });
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
  if (el.toggleBookDialogueFormat) {
    el.toggleBookDialogueFormat.checked = (appSettings.smartDialogueFormatting !== false);
  }
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

  // If PDF book and not loaded in memory yet, attempt restore from IndexedDB
  if (currentActiveBook.isPdf && !currentPdfDoc) {
    try {
      const cachedBlob = await getPdfFromIdb(currentActiveBook.id);
      if (cachedBlob) {
        const { numPages, pdfDoc } = await loadPdf(cachedBlob);
        currentPdfDoc = pdfDoc;
        currentPdfNumPages = numPages;
      }
    } catch (err) {
      console.warn('PDF restore for comparison warning:', err);
    }
  }

  el.comparisonViewModal.classList.remove('hidden');
  await updateComparisonPage(currentReaderPage);
  showToast(`Sayfa ${currentReaderPage} karşılaştırma stüdyosunda açıldı`, 'info');
}

function closeComparisonView() {
  stopSpeech();
  if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
  if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');
  el.comparisonViewModal.classList.add('hidden');
}

function setComparisonMode(mode) {
  if (el.btnModeSplit) el.btnModeSplit.classList.remove('active');
  if (el.btnModeOriginal) el.btnModeOriginal.classList.remove('active');
  if (el.btnModeDigital) el.btnModeDigital.classList.remove('active');

  if (el.comparisonWorkspace) {
    el.comparisonWorkspace.classList.remove('mode-split', 'mode-original', 'mode-digital');
  }

  if (mode === 'split') {
    if (el.btnModeSplit) el.btnModeSplit.classList.add('active');
    if (el.comparisonWorkspace) el.comparisonWorkspace.classList.add('mode-split');
  } else if (mode === 'original') {
    if (el.btnModeOriginal) el.btnModeOriginal.classList.add('active');
    if (el.comparisonWorkspace) el.comparisonWorkspace.classList.add('mode-original');
  } else if (mode === 'digital') {
    if (el.btnModeDigital) el.btnModeDigital.classList.add('active');
    if (el.comparisonWorkspace) el.comparisonWorkspace.classList.add('mode-digital');
  }
}

async function updateComparisonPage(pageNum) {
  if (!currentActiveBook) return;

  pageNum = Math.max(1, Math.min(currentTotalPages, Number(pageNum) || 1));
  currentReaderPage = pageNum;

  // Sync reader slider and indicator behind the modal
  if (el.readerPageSlider) el.readerPageSlider.value = String(pageNum);
  if (el.readerPageIndicator) el.readerPageIndicator.textContent = `${pageNum} / ${currentTotalPages}`;

  // Update comparison studio UI headers & badge
  if (el.comparePageTitle) el.comparePageTitle.textContent = `Sayfa ${pageNum} Karşılaştırma`;
  if (el.compareBookSub) el.compareBookSub.textContent = currentActiveBook.title;
  if (el.comparePageNumBadge) el.comparePageNumBadge.textContent = `Sayfa ${pageNum} / ${currentTotalPages}`;
  if (el.comparePageSlider) {
    el.comparePageSlider.min = '1';
    el.comparePageSlider.max = String(currentTotalPages);
    el.comparePageSlider.value = String(pageNum);
  }

  if (el.btnComparePrev) el.btnComparePrev.disabled = (pageNum <= 1);
  if (el.btnCompareNext) el.btnCompareNext.disabled = (pageNum >= currentTotalPages);

  // Stop previous speech if any
  stopSpeech();
  if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
  if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');

  // 1. Dijital Metin Bölümü (Digital Text Pane)
  let paragraphs = [];
  let isAnalyzing = false;

  if (currentActiveBook.pageParagraphs && currentActiveBook.pageParagraphs[pageNum]) {
    paragraphs = currentActiveBook.pageParagraphs[pageNum];
  } else if (currentActiveBook.isPdf && currentPdfDoc) {
    isAnalyzing = true;
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
    }
  }

  if (isAnalyzing) {
    el.compareDigitalContent.innerHTML = `
      <div class="reader-page-analyzing-card">
        <div class="analyzing-spinner"></div>
        <h4>Sayfa ${pageNum} Metni Çözümleniyor</h4>
        <p>Orijinal sayfa metni arka planda taranıp dijital formata dönüştürülüyor.</p>
      </div>
    `;
  } else if (paragraphs.length > 0) {
    el.compareDigitalContent.innerHTML = `
      <span class="compare-chapter-tag">${currentActiveBook.chapter || `BÖLÜM ${pageNum}`}</span>
      <h3>${currentActiveBook.title}</h3>
      ${formatBookHtml(paragraphs, { enabled: appSettings.smartDialogueFormatting !== false })}
    `;
  } else {
    el.compareDigitalContent.innerHTML = `
      <div class="compare-empty-viewport">
        <div class="compare-empty-icon-ring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="4 7 4 4 20 4 20 7"></polyline>
            <line x1="9" y1="20" x2="15" y2="20"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
        </div>
        <h4>Dijital Metin Bulunmuyor</h4>
        <p>Bu sayfa için henüz transkript metni oluşturulmamış.</p>
      </div>
    `;
  }

  // 2. Orijinal Kitap Sayfası (Original Scanned Book Page)
  if (currentPdfDoc && pageNum <= currentPdfNumPages) {
    try {
      if (el.compareOriginalEmpty) el.compareOriginalEmpty.classList.add('hidden');
      el.realBookPageImg.classList.add('hidden');
      el.realBookPageCanvas.classList.remove('hidden');

      const canvas = await renderPdfPageToCanvas(currentPdfDoc, pageNum, 2.0);
      el.realBookPageCanvas.width = canvas.width;
      el.realBookPageCanvas.height = canvas.height;
      const ctx = el.realBookPageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
    } catch (err) {
      console.warn('PDF canvas render hatası:', err);
      el.realBookPageCanvas.classList.add('hidden');
      if (el.compareOriginalEmpty) {
        el.compareOriginalEmpty.classList.remove('hidden');
        if (el.compareOriginalEmptyTitle) el.compareOriginalEmptyTitle.textContent = 'Sayfa Yüklenemedi';
        if (el.compareOriginalEmptyDesc) el.compareOriginalEmptyDesc.textContent = 'PDF sayfasının görüntüsü alınırken bir sorun oluştu.';
      }
    }
  } else if (currentActiveBook.pageImages && currentActiveBook.pageImages[pageNum]) {
    el.realBookPageCanvas.classList.add('hidden');
    if (el.compareOriginalEmpty) el.compareOriginalEmpty.classList.add('hidden');
    el.realBookPageImg.classList.remove('hidden');
    el.realBookPageImg.src = currentActiveBook.pageImages[pageNum];
  } else if (currentActiveBook.realPageImage) {
    el.realBookPageCanvas.classList.add('hidden');
    if (el.compareOriginalEmpty) el.compareOriginalEmpty.classList.add('hidden');
    el.realBookPageImg.classList.remove('hidden');
    el.realBookPageImg.src = currentActiveBook.realPageImage;
  } else {
    // Sayfa görseli bulunmuyor - şık ve bilgilendirici empty state
    el.realBookPageCanvas.classList.add('hidden');
    el.realBookPageImg.classList.add('hidden');
    if (el.compareOriginalEmpty) {
      el.compareOriginalEmpty.classList.remove('hidden');
      if (el.compareOriginalEmptyTitle) el.compareOriginalEmptyTitle.textContent = 'Orijinal Sayfa Görüntüsü Yok';
      if (el.compareOriginalEmptyDesc) el.compareOriginalEmptyDesc.textContent = currentActiveBook.isPdf
        ? 'Bu PDF sayfasının görüntüsü henüz hazır değil veya dosya önbellekte bulunamadı.'
        : 'Bu eser doğrudan dijital metin olarak kaydedildiği için fiziksel taranmış sayfası bulunmuyor.';
    }
  }

  // Reset zoom & scroll position
  currentCompareZoom = 1.0;
  applyCompareZoom();
  const originalViewport = document.getElementById('originalPageViewport');
  if (originalViewport) originalViewport.scrollTop = 0;
  const digitalViewport = document.getElementById('digitalTextViewport');
  if (digitalViewport) digitalViewport.scrollTop = 0;
}

function zoomOriginal(delta) {
  if (delta === 0) {
    currentCompareZoom = 1.0;
  } else {
    currentCompareZoom = Math.max(0.5, Math.min(3.5, Math.round((currentCompareZoom + delta) * 100) / 100));
  }
  applyCompareZoom();
}

function applyCompareZoom() {
  const target = !el.realBookPageCanvas.classList.contains('hidden') ? el.realBookPageCanvas : el.realBookPageImg;
  if (target) {
    target.style.transform = `scale(${currentCompareZoom})`;
    target.style.transformOrigin = 'top center';
    target.style.transition = 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)';
  }
  if (el.btnZoomOriginalReset) {
    el.btnZoomOriginalReset.textContent = `${Math.round(currentCompareZoom * 100)}%`;
  }
}

function toggleCompareSpeech() {
  if (isSpeaking()) {
    stopSpeech();
    if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
    if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');
    return;
  }

  const textToRead = (el.compareDigitalContent ? el.compareDigitalContent.innerText : '').trim();
  if (!textToRead) {
    showToast('Seslendirilecek dijital metin bulunamadı', 'warning');
    return;
  }

  if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Durdur';
  if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.add('speaking');

  try {
    speakText(textToRead, {
      rate: appSettings.ttsSpeed || 1.0,
      onEnd: () => {
        if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
        if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');
      },
      onError: () => {
        if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
        if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');
      }
    });
  } catch (err) {
    showToast(err.message || 'Sesli okuma başlatılamadı', 'error');
    if (el.compareSpeakLabel) el.compareSpeakLabel.textContent = 'Sesli Dinle';
    if (el.btnSpeakCompareText) el.btnSpeakCompareText.classList.remove('speaking');
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

  // Profile icon & Storage Card (Open Account Modal)
  if (el.btnProfile) {
    el.btnProfile.addEventListener('click', () => {
      openAccountModal();
    });
  }

  if (el.cardStorageUsage) {
    el.cardStorageUsage.addEventListener('click', () => {
      openAccountModal();
    });
  }

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

  // Kitap & Diyalog Düzeni Switch
  if (el.toggleBookDialogueFormat) {
    el.toggleBookDialogueFormat.checked = (appSettings.smartDialogueFormatting !== false);
    el.toggleBookDialogueFormat.addEventListener('change', (e) => {
      appSettings.smartDialogueFormatting = e.target.checked;
      saveSettings(appSettings);
      if (el.setDialogueFormatting) el.setDialogueFormatting.checked = e.target.checked;
      renderReaderPage(currentReaderPage);
      showToast(e.target.checked ? 'Diyalog ve kitap düzeni açıldı' : 'Diyalog düzeni kapatıldı', 'info');
    });
  }

  // Comparison Studio 10/10 View Controls
  if (el.btnCloseComparison) el.btnCloseComparison.addEventListener('click', closeComparisonView);
  if (el.btnModeSplit) el.btnModeSplit.addEventListener('click', () => setComparisonMode('split'));
  if (el.btnModeOriginal) el.btnModeOriginal.addEventListener('click', () => setComparisonMode('original'));
  if (el.btnModeDigital) el.btnModeDigital.addEventListener('click', () => setComparisonMode('digital'));

  if (el.btnZoomOriginalIn) el.btnZoomOriginalIn.addEventListener('click', () => zoomOriginal(0.25));
  if (el.btnZoomOriginalReset) el.btnZoomOriginalReset.addEventListener('click', () => zoomOriginal(0));
  if (el.btnZoomOriginalOut) el.btnZoomOriginalOut.addEventListener('click', () => zoomOriginal(-0.25));
  if (el.btnFitOriginal) el.btnFitOriginal.addEventListener('click', () => { currentCompareZoom = 1.0; applyCompareZoom(); });

  if (el.btnSpeakCompareText) el.btnSpeakCompareText.addEventListener('click', toggleCompareSpeech);

  if (el.btnCopyCompareText) {
    el.btnCopyCompareText.addEventListener('click', async () => {
      const text = el.compareDigitalContent ? (el.compareDigitalContent.innerText || '').trim() : '';
      if (text) {
        await copyToClipboard(text);
        showToast('Dijital metin panoya kopyalandı', 'success');
      } else {
        showToast('Kopyalanacak metin bulunamadı', 'warning');
      }
    });
  }

  if (el.comparePageSlider) {
    el.comparePageSlider.addEventListener('input', (e) => {
      const page = parseInt(e.target.value, 10);
      if (page && page !== currentReaderPage) {
        updateComparisonPage(page);
        renderReaderPage(page);
      }
    });
  }

  if (el.btnComparePrev) {
    el.btnComparePrev.addEventListener('click', () => {
      if (currentReaderPage > 1) {
        const prev = currentReaderPage - 1;
        updateComparisonPage(prev);
        renderReaderPage(prev);
      }
    });
  }

  if (el.btnCompareNext) {
    el.btnCompareNext.addEventListener('click', () => {
      if (currentReaderPage < currentTotalPages) {
        const next = currentReaderPage + 1;
        updateComparisonPage(next);
        renderReaderPage(next);
      }
    });
  }

  // Keyboard navigation for Reader and Comparison Studio
  window.addEventListener('keydown', (e) => {
    const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    if (isTyping) return;

    if (el.comparisonViewModal && !el.comparisonViewModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeComparisonView();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentReaderPage > 1) {
          const prev = currentReaderPage - 1;
          updateComparisonPage(prev);
          renderReaderPage(prev);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentReaderPage < currentTotalPages) {
          const next = currentReaderPage + 1;
          updateComparisonPage(next);
          renderReaderPage(next);
        }
      }
    }
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

// Cryptographic PDF fingerprint generator (SHA-256 hash of header & structure)
async function generatePdfFingerprint(file) {
  try {
    const slice = file.slice(0, 32768);
    const buffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
    return `pdf_${file.size}_${hashHex}`;
  } catch (_) {
    return `pdf_${file.size}_${file.name.toLowerCase()}`;
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
    showToast('Kitap kontrol ediliyor...', 'info');
    const { numPages, pdfDoc } = await loadPdf(file);
    currentPdfDoc = pdfDoc;
    currentPdfNumPages = numPages;

    const docName = file.name.replace(/\.[^/.]+$/, '');
    const fingerprint = await generatePdfFingerprint(file);

    // 1. Kitaplıkta aynı PDF daha önceden kayıtlı mı kontrol et!
    const allBooks = getBooks();
    const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '');
    const normalizedName = normalize(docName);

    const existingBook = allBooks.find(b => {
      // Kriter 1: Parmak izi (SHA-256 hash) birebir eşleşiyor mu?
      if (b.pdfFingerprint && b.pdfFingerprint === fingerprint) return true;
      // Kriter 2: Dosya boyutu ve toplam sayfa sayısı eşleşiyor mu?
      if (b.fileSize && b.fileSize === file.size && b.totalPages === numPages) return true;
      // Kriter 3: İsim ve toplam sayfa sayısı eşleşiyor mu?
      if (normalize(b.title) === normalizedName && b.totalPages === numPages) return true;
      return false;
    });

    if (existingBook) {
      // PDF dosyasını IndexedDB önbelleğinde tazele
      await savePdfToIdb(existingBook.id, file);

      // Eğer eski kitapta parmak izi eksikse güncelle
      if (!existingBook.pdfFingerprint || !existingBook.fileSize) {
        existingBook.pdfFingerprint = fingerprint;
        existingBook.fileSize = file.size;
        saveBook(existingBook);
      }

      setCurrentBook(existingBook.id);
      renderHomeScreen();
      renderLibraryScreen();

      openBookInReader(existingBook);
      const progress = existingBook.progress || 0;
      const page = existingBook.currentPage || 1;
      showToast(`Bu kitap zaten kitaplığınızda var! Kaldığınız yerden (%${progress}, Sayfa ${page}) devam ediliyor.`, 'success');

      // Taranmamış sayfalar varsa arka plan analizini sürdür
      startBackgroundPdfAnalysis(existingBook, pdfDoc);
      return;
    }

    // Gerçek 1. sayfa önizlemesi oluştur (yoksa estetik SVG üret)
    let coverThumb = '';
    try {
      const page1Canvas = await renderPdfPageToCanvas(pdfDoc, 1, 0.45);
      coverThumb = page1Canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      coverThumb = generateBookCoverSvg(docName, 'PDF Belgesi');
    }

    // Yeni kitap nesnesi oluştur ve hemen kaydet
    const newBook = {
      id: 'book_' + Date.now(),
      title: docName,
      author: 'Kişisel Belge',
      cover: coverThumb || generateBookCoverSvg(docName, 'PDF Belgesi'),
      totalPages: numPages,
      currentPage: 1,
      progress: 0,
      fileSize: file.size,
      pdfFingerprint: fingerprint,
      date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }),
      chapter: '1. Sayfa',
      status: 'okunanlar',
      chapterSubtitle: `1 / ${numPages} sayfa`,
      pageParagraphs: {},
      isPdf: true,
      isCurrent: true
    };

    saveBook(newBook);
    await savePdfToIdb(newBook.id, file);
    renderHomeScreen();
    renderLibraryScreen();

    // DİREKT OKUYUCUYA GEÇ!
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
    cover: currentProcessedImage ? createThumbnail(el.activePreviewImg) : generateBookCoverSvg(docName, 'Kişisel Belge'),
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
  if (el.setDialogueFormatting) el.setDialogueFormatting.checked = appSettings.smartDialogueFormatting !== false;
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

  // Smart Dialogue Formatting
  if (el.setDialogueFormatting) {
    el.setDialogueFormatting.addEventListener('change', (e) => {
      appSettings.smartDialogueFormatting = e.target.checked;
      saveSettings(appSettings);
      if (el.toggleBookDialogueFormat) el.toggleBookDialogueFormat.checked = e.target.checked;
      if (!el.inAppReaderView.classList.contains('hidden') && currentReaderPage) {
        renderReaderPage(currentReaderPage);
      }
      showToast(e.target.checked ? 'Diyalog ve kitap düzeni açıldı' : 'Diyalog düzeni kapatıldı', 'info');
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
    el.btnClearCache.addEventListener('click', async () => {
      if (confirm('Tüm cihaz önbelleği, geçici OCR verileri ve servis önbelleği temizlensin mi? (Kayıtlı kitap ve notlarınız silinmez)')) {
        clearAppCache();
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (let reg of regs) {
            await reg.update();
          }
        }
        showToast('Tüm önbellek başarıyla temizlendi!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    });
  }
}

/* ==========================================================================
   PWA & System File Integration
   ========================================================================== */
function setupPwa() {
  const CURRENT_CACHE = 'reawid-cloud-v25';
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

/* ==========================================================================
   Supabase Account & Cloud Sync Controller
   ========================================================================== */
let currentAuthMode = 'signin'; // 'signin' | 'signup'

function openAccountModal() {
  if (!el.accountModal) return;
  renderAccountUI();
  el.accountModal.classList.remove('hidden');
}

function closeAccountModal() {
  if (!el.accountModal) return;
  el.accountModal.classList.add('hidden');
  if (el.authErrorMsg) el.authErrorMsg.classList.add('hidden');
}

function renderAccountUI() {
  const user = getCurrentUser();
  const allBooks = getBooks();
  const allNotes = getNotes ? getNotes() : [];

  // Settings screen profile banner
  if (el.settingsAccountName) {
    if (user) {
      el.settingsAccountName.textContent = user.email || 'Giriş Yapıldı';
      if (el.settingsAccountStatus) el.settingsAccountStatus.textContent = '🟢 Bulut Eşitlemesi Aktif';
      if (el.settingsAccountAvatar) {
        const initial = (user.email || 'R')[0].toUpperCase();
        el.settingsAccountAvatar.innerHTML = `<span>${initial}</span>`;
      }
    } else {
      el.settingsAccountName.textContent = 'Hesap & Senkronizasyon';
      if (el.settingsAccountStatus) el.settingsAccountStatus.textContent = 'Kaldığınız yerden devam etmek için giriş yapın';
      if (el.settingsAccountAvatar) {
        el.settingsAccountAvatar.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        `;
      }
    }
  }

  // Account Modal UI
  if (user) {
    if (el.accountLoggedInView) el.accountLoggedInView.classList.remove('hidden');
    if (el.accountAuthView) el.accountAuthView.classList.add('hidden');

    if (el.accountUserEmail) el.accountUserEmail.textContent = user.email;
    if (el.accountUserAvatar) el.accountUserAvatar.textContent = (user.email || 'R')[0].toUpperCase();
    if (el.accountStatBooks) el.accountStatBooks.textContent = allBooks.length;
    if (el.accountStatNotes) el.accountStatNotes.textContent = allNotes.length;
  } else {
    if (el.accountLoggedInView) el.accountLoggedInView.classList.add('hidden');
    if (el.accountAuthView) el.accountAuthView.classList.remove('hidden');
  }
}

function setupAccountController() {
  // Open / Close modal
  if (el.btnProfile) {
    el.btnProfile.addEventListener('click', openAccountModal);
  }
  if (el.btnSettingsOpenAccount) {
    el.btnSettingsOpenAccount.addEventListener('click', openAccountModal);
  }
  if (el.btnCloseAccountModal) {
    el.btnCloseAccountModal.addEventListener('click', closeAccountModal);
  }
  if (el.accountModal) {
    el.accountModal.addEventListener('click', (e) => {
      if (e.target === el.accountModal) closeAccountModal();
    });
  }

  // Auth tabs (Giriş Yap / Kayıt Ol)
  if (el.tabSignIn && el.tabSignUp) {
    el.tabSignIn.addEventListener('click', () => {
      currentAuthMode = 'signin';
      el.tabSignIn.classList.add('active');
      el.tabSignUp.classList.remove('active');
      if (el.btnAuthSubmit) {
        const span = el.btnAuthSubmit.querySelector('span') || el.btnAuthSubmit;
        span.textContent = 'Giriş Yap';
      }
      if (el.authErrorMsg) el.authErrorMsg.classList.add('hidden');
    });

    el.tabSignUp.addEventListener('click', () => {
      currentAuthMode = 'signup';
      el.tabSignUp.classList.add('active');
      el.tabSignIn.classList.remove('active');
      if (el.btnAuthSubmit) {
        const span = el.btnAuthSubmit.querySelector('span') || el.btnAuthSubmit;
        span.textContent = 'Kayıt Ol';
      }
      if (el.authErrorMsg) el.authErrorMsg.classList.add('hidden');
    });
  }

  // Form Submit (Supabase Auth)
  if (el.formSupabaseAuth) {
    el.formSupabaseAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = el.authInputEmail?.value?.trim();
      const password = el.authInputPassword?.value;
      if (!email || !password) return;

      if (el.authErrorMsg) el.authErrorMsg.classList.add('hidden');
      if (el.btnAuthSubmit) {
        el.btnAuthSubmit.disabled = true;
        const span = el.btnAuthSubmit.querySelector('span') || el.btnAuthSubmit;
        span.textContent = 'İşleniyor...';
      }

      try {
        if (currentAuthMode === 'signin') {
          const { data, error } = await signInWithEmail(email, password);
          if (error) throw error;
          showToast('Hesaba başarıyla giriş yapıldı!', 'success');
        } else {
          const { data, error } = await signUpWithEmail(email, password);
          if (error) throw error;
          showToast('Hesap başarıyla oluşturuldu!', 'success');
        }

        // Trigger bi-directional sync
        showToast('Kitaplarınız ve notlarınız bulut ile senkronize ediliyor...', 'info');
        await syncLocalWithCloudDb();
        renderHomeScreen();
        renderLibraryScreen();
        renderNotesScreen();
        renderAccountUI();
        closeAccountModal();
      } catch (err) {
        console.error('Auth error:', err);
        if (el.authErrorMsg) {
          el.authErrorMsg.textContent = err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.';
          el.authErrorMsg.classList.remove('hidden');
        }
      } finally {
        if (el.btnAuthSubmit) {
          el.btnAuthSubmit.disabled = false;
          const span = el.btnAuthSubmit.querySelector('span') || el.btnAuthSubmit;
          span.textContent = currentAuthMode === 'signin' ? 'Giriş Yap' : 'Kayıt Ol';
        }
      }
    });
  }

  // Manual Sync Now Button
  if (el.btnAccountSyncNow) {
    el.btnAccountSyncNow.addEventListener('click', async () => {
      if (el.syncSpinnerIcon) el.syncSpinnerIcon.classList.add('spinning');
      el.btnAccountSyncNow.disabled = true;
      try {
        const res = await syncLocalWithCloudDb();
        if (res.synced) {
          showToast('Tüm kitap ve notlarınız bulutla senkronize edildi!', 'success');
          renderHomeScreen();
          renderLibraryScreen();
          renderNotesScreen();
          renderAccountUI();
        } else {
          showToast(res.reason || 'Senkronizasyon tamamlandı.', 'info');
        }
      } catch (err) {
        showToast('Eşitleme hatası: ' + err.message, 'error');
      } finally {
        if (el.syncSpinnerIcon) el.syncSpinnerIcon.classList.remove('spinning');
        el.btnAccountSyncNow.disabled = false;
      }
    });
  }

  // Sign Out Button
  if (el.btnAccountSignOut) {
    el.btnAccountSignOut.addEventListener('click', async () => {
      if (confirm('Hesaptan çıkış yapmak istediğinize emin misiniz?')) {
        await signOutUser();
        showToast('Hesaptan çıkış yapıldı.', 'info');
        renderAccountUI();
        renderHomeScreen();
        renderLibraryScreen();
        renderNotesScreen();
      }
    });
  }

  // Initial account UI render & subscription
  renderAccountUI();
  subscribeAuth(() => {
    renderAccountUI();
    renderHomeScreen();
    renderLibraryScreen();
    renderNotesScreen();
  });
}

/* ==========================================================================
   Reset All Data Controller (Destructive Data Wipe with Security Code)
   ========================================================================== */
let currentResetSecurityCode = '';

function generateRandomResetCode() {
  // Generate random lowercase letters between 15 and 20 characters (average 17-18)
  const alphabet = 'abcdefghjkmnpqrstuvwxyz'; // clean lowercase letters (avoiding ambiguous l/i/o)
  const length = 15 + Math.floor(Math.random() * 6); // 15, 16, 17, 18, 19, or 20 characters
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  currentResetSecurityCode = code;

  if (el.resetChallengeCode) {
    el.resetChallengeCode.textContent = currentResetSecurityCode;
  }
  if (el.inputResetCodeConfirm) {
    el.inputResetCodeConfirm.value = '';
  }
  if (el.resetCodeHint) {
    el.resetCodeHint.textContent = `Kod eşleştiğinde silme butonu aktifleşir (${currentResetSecurityCode.length} harf).`;
    el.resetCodeHint.classList.remove('valid');
  }
  if (el.btnConfirmResetSubmit) {
    el.btnConfirmResetSubmit.disabled = true;
  }
}

function openResetModal() {
  if (!el.resetDataModal) return;
  generateRandomResetCode();
  el.resetDataModal.classList.remove('hidden');
  setTimeout(() => {
    if (el.inputResetCodeConfirm) {
      el.inputResetCodeConfirm.focus();
    }
  }, 150);
}

function closeResetModal() {
  if (!el.resetDataModal) return;
  el.resetDataModal.classList.add('hidden');
  if (el.inputResetCodeConfirm) {
    el.inputResetCodeConfirm.value = '';
  }
  if (el.btnConfirmResetSubmit) {
    el.btnConfirmResetSubmit.disabled = true;
  }
}

function setupResetDataController() {
  if (el.btnOpenResetModal) {
    el.btnOpenResetModal.addEventListener('click', openResetModal);
  }

  if (el.btnCloseResetModal) {
    el.btnCloseResetModal.addEventListener('click', closeResetModal);
  }

  if (el.btnCancelResetModal) {
    el.btnCancelResetModal.addEventListener('click', closeResetModal);
  }

  if (el.resetDataModal) {
    el.resetDataModal.addEventListener('click', (e) => {
      if (e.target === el.resetDataModal) {
        closeResetModal();
      }
    });
  }

  if (el.btnRefreshResetCode) {
    el.btnRefreshResetCode.addEventListener('click', () => {
      generateRandomResetCode();
      if (el.inputResetCodeConfirm) {
        el.inputResetCodeConfirm.focus();
      }
    });
  }

  if (el.inputResetCodeConfirm) {
    el.inputResetCodeConfirm.addEventListener('input', () => {
      const inputVal = el.inputResetCodeConfirm.value.trim().toLowerCase();
      if (inputVal === currentResetSecurityCode) {
        if (el.btnConfirmResetSubmit) el.btnConfirmResetSubmit.disabled = false;
        if (el.resetCodeHint) {
          el.resetCodeHint.textContent = '✓ Güvenlik kodu doğrulandı. Silmek için aşağıdaki butona basın.';
          el.resetCodeHint.classList.add('valid');
        }
      } else {
        if (el.btnConfirmResetSubmit) el.btnConfirmResetSubmit.disabled = true;
        if (el.resetCodeHint) {
          if (inputVal.length >= currentResetSecurityCode.length) {
            el.resetCodeHint.textContent = '✕ Hatalı kod girdiniz. Lütfen tekrar kontrol edin.';
            el.resetCodeHint.classList.remove('valid');
          } else if (inputVal.length > 0) {
            el.resetCodeHint.textContent = `Yazılan: ${inputVal.length} / ${currentResetSecurityCode.length} harf`;
            el.resetCodeHint.classList.remove('valid');
          } else {
            el.resetCodeHint.textContent = `Kod eşleştiğinde silme butonu aktifleşir (${currentResetSecurityCode.length} harf).`;
            el.resetCodeHint.classList.remove('valid');
          }
        }
      }
    });

    el.inputResetCodeConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (el.btnConfirmResetSubmit && !el.btnConfirmResetSubmit.disabled) {
          el.btnConfirmResetSubmit.click();
        }
      }
    });
  }

  if (el.btnConfirmResetSubmit) {
    el.btnConfirmResetSubmit.addEventListener('click', async () => {
      const inputVal = el.inputResetCodeConfirm ? el.inputResetCodeConfirm.value.trim().toLowerCase() : '';
      if (inputVal !== currentResetSecurityCode) {
        showToast('Lütfen ekrandaki güvenlik kodunu doğru girin', 'error');
        return;
      }

      el.btnConfirmResetSubmit.disabled = true;
      const span = el.btnConfirmResetSubmit.querySelector('span') || el.btnConfirmResetSubmit;
      const origText = span.textContent;
      span.textContent = 'Tüm Veriler Siliniyor...';

      try {
        const res = await resetAllAppData();
        if (!res.success) {
          throw res.error || new Error('Silme işlemi tamamlanamadı');
        }

        closeResetModal();
        showToast('Tüm kitaplık, ilerlemeler ve notlar kalıcı olarak silindi!', 'success');

        // Close reader if open
        if (typeof closeReader === 'function' && el.readerScreen && !el.readerScreen.classList.contains('hidden')) {
          closeReader();
        }

        // Re-render UI screens
        renderHomeScreen();
        renderLibraryScreen();
        if (typeof renderNotesScreen === 'function') renderNotesScreen();
        if (typeof renderSettingsScreen === 'function') renderSettingsScreen();
        if (typeof renderAccountUI === 'function') renderAccountUI();

        // Switch back to Home screen
        switchBottomTab('home');
      } catch (err) {
        console.error('Reset all data error:', err);
        showToast('Veriler silinirken hata oluştu: ' + (err.message || err), 'error');
      } finally {
        span.textContent = origText;
      }
    });
  }
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

