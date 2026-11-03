# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 37 files · ~91,963 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 520 nodes · 1514 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `45fc1c2c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- test_continuous_ocr_suite.mjs
- Reader Actions & Floating Pill
- PerformanceMonitor
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- tesseractService.js
- package.json
- readerFormatter.js
- Tesseract Engine & Turkish Model
- test_post_ocr_performance_suite.mjs
- performOcr
- setupEventListeners
- storageService.js
- test_audit_verification.mjs
- Document Export & Print Service
- handlePdfFiles
- showToast
- aiService.js
- vite.config.js
- Edge Functions & CORS Proxy
- openBookInReader
- Vercel Deployment Configuration
- supabaseService.js
- setupAccountController
- normalizeHyphensAndText
- tts.js
- getNotes
- updateBookPageParagraphs
- scripts
- vite
- isModelStrictlyFree

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `savePageOcrMemory()` - 23 edges
4. `openBookInReader()` - 22 edges
5. `runProductionStressSuite()` - 21 edges
6. `renderReaderPage()` - 19 edges
7. `handlePdfFiles()` - 19 edges
8. `getBooks()` - 19 edges
9. `runAll100Scenarios()` - 19 edges
10. `setupSettingsScreenEvents()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `runTestSuite()` --calls--> `handler()`  [EXTRACTED]
  tests/test_critical_fixes_suite.mjs → api/tts.js
- `runProductionStressSuite()` --calls--> `disposeCanvas()`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `runProductionStressSuite()` --calls--> `PageRenderLruCache`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `runTestSuite()` --calls--> `createAbortError()`  [EXTRACTED]
  tests/test_critical_fixes_suite.mjs → src/services/tesseractService.js
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.09
Nodes (33): activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), applyCompareZoom(), applyImagePipeline(), appSettings, bookChatHistory (+25 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.09
Nodes (62): handleSendBookChatMessage(), hideChatTypingStatus(), setChatTypingStatus(), askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), clearRetrievalAuditTrail() (+54 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.13
Nodes (12): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), updatePdfBatchActionButtons(), disposeCanvas(), PageRenderLruCache, pdfPageRenderCache, renderPdfPageDirect() (+4 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.25
Nodes (11): createThumbnail(), loadImage(), preprocessImageForOcr(), processImage(), createAbortError(), getOrInitTesseractWorker(), lastWorkerActiveTime, ocrJobQueue (+3 more)

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (19): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, tesseract.js@^7.0.0 (+11 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.22
Nodes (11): mergeAccidentalParagraphSplits(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength() (+3 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.17
Nodes (10): DEFAULT_SETTINGS, case1, case2, case3, case4, case5, case6, case7 (+2 more)

### Community 11 - "performOcr"
Cohesion: 0.31
Nodes (9): displayOcrResult(), startOcrProcess(), startPdfBatchOcr(), buildCandidateList(), callGroqVision(), formatOcrErrorMessage(), isSuspiciousOcrText(), performOcr() (+1 more)

### Community 12 - "setupEventListeners"
Cohesion: 0.11
Nodes (34): abortCurrentOcr(), applyReaderTheme(), applyReaderTypography(), closeBookAiChat(), closeBookCardActionSheet(), closeComparisonView(), closeLibraryHeaderMenu(), closeMoreMenu() (+26 more)

### Community 13 - "storageService.js"
Cohesion: 0.09
Nodes (24): getLastRetrievalAudit(), AVAILABLE_MODELS, clearAllPdfsFromIdb(), clearBookOcrCache(), clearNotes(), deleteBook(), deletePdfFromIdb(), DEPRECATED_GROQ_MODELS (+16 more)

### Community 14 - "test_audit_verification.mjs"
Cohesion: 0.25
Nodes (6): clearOcrAuditTrail(), getOcrAuditTrail(), VISION_CANDIDATE_POOLS, autoList, logs, verifiable

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "handlePdfFiles"
Cohesion: 0.13
Nodes (30): closeAddNoteModal(), closeConversionModal(), closeResetModal(), generateRandomResetCode(), handleGlobalPaste(), handleImageFiles(), handlePdfFiles(), handleSaveNoteSubmit() (+22 more)

### Community 17 - "showToast"
Cohesion: 0.26
Nodes (17): openBookAiChat(), openRsvpReader(), pauseRsvpPlayback(), playSentenceQueue(), renderRsvpWord(), setupTextSelectionPill(), showToast(), startRsvpPlayback() (+9 more)

### Community 18 - "aiService.js"
Cohesion: 0.14
Nodes (11): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, congestedModels, fixSpacedOutLetters(), isKnownTurkishWord(), ocrAuditTrail, retrievalAuditTrail, retrievalCache, segmentCompoundLetters() (+3 more)

### Community 19 - "vite.config.js"
Cohesion: 0.20
Nodes (6): ALLOWED_VOICES, configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 21 - "openBookInReader"
Cohesion: 0.18
Nodes (21): analyzeSinglePdfPage(), formatBookHtml(), getNextTargetPage(), getOrLoadPdfDocument(), hideReaderBgOcrStatus(), openBookInReader(), openComparisonView(), performVisionAiOcr() (+13 more)

### Community 25 - "supabaseService.js"
Cohesion: 0.26
Nodes (10): authListeners, bookToDbRow(), dbRowToBook(), dbRowToNote(), isSupabaseConfigured, noteToDbRow(), supabase, syncAllWithCloud() (+2 more)

### Community 26 - "setupAccountController"
Cohesion: 0.22
Nodes (11): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), updateKeyboardViewport(), getCurrentUser(), signInWithEmail() (+3 more)

### Community 27 - "normalizeHyphensAndText"
Cohesion: 0.36
Nodes (6): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), healTurkishOcrArtifacts(), normalizeHyphensAndText()

### Community 28 - "tts.js"
Cohesion: 0.33
Nodes (6): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), @andresaya/edge-tts@^1.9.1, @andresaya/edge-tts

### Community 29 - "getNotes"
Cohesion: 0.38
Nodes (7): toggleBookmark(), deleteNote(), getNotes(), importAllData(), saveNote(), syncLocalWithCloudDb(), deleteNoteFromCloud()

### Community 30 - "updateBookPageParagraphs"
Cohesion: 0.40
Nodes (6): debouncedSaveBooks(), executeCloudSync(), flushPendingCloudSyncs(), queueBookCloudSync(), updateBookPageParagraphs(), updateBookProgress()

### Community 31 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 32 - "vite"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 33 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09269162210338681 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `normalizeHyphensAndText` to `main.js`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `performOcr`, `storageService.js`, `handlePdfFiles`, `aiService.js`, `openBookInReader`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runProductionStressSuite()` (e.g. with `.has()` and `.set()`) actually correct?**
  _`runProductionStressSuite()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09157509157509157 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._