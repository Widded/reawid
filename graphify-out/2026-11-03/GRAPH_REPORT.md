# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 29 files · ~69,243 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 446 nodes · 1149 edges · 28 communities (22 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `050c8cf5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Reader UI & Viewport Controls
- storageService.js
- Reader Actions & Floating Pill
- PerformanceMonitor
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- normalizeHyphensAndText
- Project Dependencies & Libraries
- readerFormatter.js
- Tesseract Engine & Turkish Model
- AI Proofreader & Congestion Management
- Vite Build & Edge TTS Plugin
- Book AI Chat Assistant
- supabaseService.js
- test_root_cause_suite.mjs
- Document Export & Print Service
- setupSettingsScreenEvents
- Edge TTS Serverless Function
- NPM Lifecycle Scripts
- Vite Development Tooling
- Edge Functions & CORS Proxy
- openBookInReader
- Vercel Deployment Configuration
- renderNotesScreen
- performOcr
- setupResetDataController

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 78 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 20 edges
4. `getBooks()` - 19 edges
5. `renderReaderPage()` - 18 edges
6. `setupSettingsScreenEvents()` - 18 edges
7. `handlePdfFiles()` - 17 edges
8. `renderNotesScreen()` - 17 edges
9. `normalizeHyphensAndText()` - 17 edges
10. `renderHomeScreen()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js
- `runSuite()` --calls--> `cleanTextForSpeech()`  [EXTRACTED]
  tests/test_speech_suite.mjs → src/services/speechService.js
- `runSuite()` --calls--> `prefetchSpeech()`  [EXTRACTED]
  tests/test_speech_suite.mjs → src/services/speechService.js
- `getOrLoadPdfDocument()` --calls--> `loadPdf()`  [EXTRACTED]
  src/main.js → src/services/pdfService.js
- `getOrLoadPdfDocument()` --calls--> `getPdfFromIdb()`  [EXTRACTED]
  src/main.js → src/services/storageService.js

## Import Cycles
- None detected.

## Communities (28 total, 6 thin omitted)

### Community 0 - "Reader UI & Viewport Controls"
Cohesion: 0.06
Nodes (90): abortCurrentOcr(), activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), applyCompareZoom(), applyImagePipeline(), appSettings (+82 more)

### Community 1 - "storageService.js"
Cohesion: 0.11
Nodes (19): AVAILABLE_MODELS, clearAllPdfsFromIdb(), clearNotes(), deleteBook(), deletePdfFromIdb(), DEPRECATED_GROQ_MODELS, DEPRECATED_OR_MODELS, ENV_ACTIVE_PROVIDER (+11 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.08
Nodes (24): analyzeSinglePdfPage(), applyCustomPdfRange(), getNextTargetPage(), hideReaderBgOcrStatus(), performVisionAiOcr(), selectPdfPage(), setPdfBatchRange(), startBackgroundPdfAnalysis() (+16 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (28): callOpenRouterVision(), isModelStrictlyFree(), afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList (+20 more)

### Community 6 - "normalizeHyphensAndText"
Cohesion: 0.25
Nodes (11): healTurkishOcrArtifacts(), normalizeHyphensAndText(), createThumbnail(), loadImage(), preprocessImageForOcr(), processImage(), getOrInitTesseractWorker(), lastWorkerActiveTime (+3 more)

### Community 7 - "Project Dependencies & Libraries"
Cohesion: 0.15
Nodes (17): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, name (+9 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.24
Nodes (11): fixSpacedOutLetters(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength() (+3 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.14
Nodes (12): tesseract.js@^7.0.0, tesseract.js, DEFAULT_SETTINGS, case1, case2, case3, case4, case5 (+4 more)

### Community 10 - "AI Proofreader & Congestion Management"
Cohesion: 0.14
Nodes (9): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, congestedModels, isKnownTurkishWord(), ocrAuditTrail, retrievalCache, segmentCompoundLetters(), testApiConnection(), TURKISH_LEXICON (+1 more)

### Community 11 - "Vite Build & Edge TTS Plugin"
Cohesion: 0.22
Nodes (5): configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 12 - "Book AI Chat Assistant"
Cohesion: 0.18
Nodes (12): askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), extractBookAiAnswer(), extractBookOutlineIndex(), extractEvidenceParagraphs(), multiStageBookRetrieval(), prepareBookContext() (+4 more)

### Community 13 - "supabaseService.js"
Cohesion: 0.14
Nodes (19): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), updateKeyboardViewport(), authListeners, bookToDbRow() (+11 more)

### Community 14 - "test_root_cause_suite.mjs"
Cohesion: 0.15
Nodes (13): BOOK_OCR_SYSTEM_PROMPT, buildCandidateList(), calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), isModelCongested() (+5 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "setupSettingsScreenEvents"
Cohesion: 0.17
Nodes (16): applyReaderTheme(), applyReaderTypography(), closeSettingsSubpage(), handleModelChange(), openSettingsSubpage(), releaseWakeLock(), renderSettingsScreen(), requestWakeLock() (+8 more)

### Community 18 - "NPM Lifecycle Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 19 - "Vite Development Tooling"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 21 - "openBookInReader"
Cohesion: 0.28
Nodes (15): generatePdfFingerprint(), handlePdfFiles(), handleSaveOcrToLibrary(), openBookCardActionSheet(), openBookInReader(), renderHomeScreen(), renderLibraryScreen(), generateBookCoverSvg() (+7 more)

### Community 25 - "renderNotesScreen"
Cohesion: 0.35
Nodes (11): closeAddNoteModal(), handleSaveNoteSubmit(), openAddNoteModal(), renderNotesScreen(), setupNotesScreenEvents(), toggleBookmark(), deleteNote(), getCurrentBook() (+3 more)

### Community 26 - "performOcr"
Cohesion: 0.31
Nodes (9): displayOcrResult(), startOcrProcess(), startPdfBatchOcr(), callGroqVision(), formatOcrErrorMessage(), isSuspiciousOcrText(), markModelCongested(), performOcr() (+1 more)

### Community 27 - "setupResetDataController"
Cohesion: 0.67
Nodes (4): closeResetModal(), generateRandomResetCode(), openResetModal(), setupResetDataController()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `Reader UI & Viewport Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.06446886446886448 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `normalizeHyphensAndText` to `Reader UI & Viewport Controls`, `storageService.js`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `AI Proofreader & Congestion Management`, `test_root_cause_suite.mjs`, `openBookInReader`, `performOcr`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `storageService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11231884057971014 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `Project Dependencies & Libraries` to `Reader UI & Viewport Controls`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `PDF Rendering & Document Service` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._