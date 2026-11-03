# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 38 files · ~94,090 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 525 nodes · 1529 edges · 28 communities (23 shown, 5 thin omitted)
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
- init
- startOcrProcess
- setupEventListeners
- storageService.js
- test_audit_verification.mjs
- Document Export & Print Service
- openBookInReader
- showToast
- renderReaderPage
- goToSearchMatch
- Edge Functions & CORS Proxy
- handleSendBookChatMessage
- Vercel Deployment Configuration
- renderNotesScreen
- normalizeHyphensAndText
- isModelStrictlyFree

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `savePageOcrMemory()` - 23 edges
4. `openBookInReader()` - 22 edges
5. `getBooks()` - 21 edges
6. `runProductionStressSuite()` - 21 edges
7. `renderReaderPage()` - 19 edges
8. `handlePdfFiles()` - 19 edges
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

## Communities (28 total, 5 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.09
Nodes (38): activeAnalyzingPages, activeWorkerControllers, applyReaderTheme(), applyReaderTypography(), appSettings, bookChatHistory, closeAccountModal(), closeResetModal() (+30 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.08
Nodes (68): askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), clearRetrievalAuditTrail(), congestedModels, detectPrintedPageNumber(), extractBookAiAnswer() (+60 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.11
Nodes (15): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), startPdfBatchOcr(), updatePdfBatchActionButtons(), mergeAccidentalParagraphSplits(), disposeCanvas(), extractPdfPageText() (+7 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (26): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1 (+18 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.28
Nodes (10): loadImage(), preprocessImageForOcr(), processImage(), createAbortError(), getOrInitTesseractWorker(), lastWorkerActiveTime, ocrJobQueue, performTesseractOcr() (+2 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (38): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), dependencies, @andresaya/edge-tts@^1.9.1, canvas-confetti@^1.9.4, lucide@^1.61.0 (+30 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.26
Nodes (10): applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength(), isDialogueTurn() (+2 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.17
Nodes (10): DEFAULT_SETTINGS, case1, case2, case3, case4, case5, case6, case7 (+2 more)

### Community 10 - "init"
Cohesion: 0.24
Nodes (11): handleGlobalPaste(), handleImageFiles(), init(), openConversionModal(), populateModelSelect(), preventPwaZooming(), setPreviewImage(), setupFileHandlingLaunchQueue() (+3 more)

### Community 11 - "startOcrProcess"
Cohesion: 0.40
Nodes (5): displayOcrResult(), startOcrProcess(), formatOcrErrorMessage(), createThumbnail(), saveHistoryItem()

### Community 12 - "setupEventListeners"
Cohesion: 0.12
Nodes (27): abortCurrentOcr(), applyCompareZoom(), applyImagePipeline(), closeBookAiChat(), closeMoreMenu(), closeReader(), closeReaderSearch(), closeRsvpReader() (+19 more)

### Community 13 - "storageService.js"
Cohesion: 0.05
Nodes (51): setupAccountController(), toggleBookmark(), AVAILABLE_MODELS, clearAllPdfsFromIdb(), clearBookOcrCache(), clearNotes(), cloneBooks(), debouncedSaveBooks() (+43 more)

### Community 14 - "test_audit_verification.mjs"
Cohesion: 0.18
Nodes (11): buildCandidateList(), callGroqVision(), clearOcrAuditTrail(), getOcrAuditTrail(), isSuspiciousOcrText(), performOcr(), recordOcrAudit(), VISION_CANDIDATE_POOLS (+3 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "openBookInReader"
Cohesion: 0.28
Nodes (16): closeBookCardActionSheet(), closeConversionModal(), closeLibraryHeaderMenu(), handlePdfFiles(), handleSaveOcrToLibrary(), openBookCardActionSheet(), openBookInReader(), renderHomeScreen() (+8 more)

### Community 17 - "showToast"
Cohesion: 0.24
Nodes (18): closeComparisonView(), openBookAiChat(), openRsvpReader(), pauseRsvpPlayback(), playSentenceQueue(), renderRsvpWord(), setupTextSelectionPill(), showToast() (+10 more)

### Community 18 - "renderReaderPage"
Cohesion: 0.33
Nodes (10): formatBookHtml(), getOrLoadPdfDocument(), openComparisonView(), prioritizePageAnalysis(), renderPageAnalysisError(), renderReaderPage(), setupReaderSwipeNavigation(), updateComparisonPage() (+2 more)

### Community 19 - "goToSearchMatch"
Cohesion: 0.38
Nodes (7): clearSearchHighlights(), executeReaderSearch(), goToSearchMatch(), highlightCurrentPageMatches(), nextSearchMatch(), prevSearchMatch(), toggleSearchBar()

### Community 21 - "handleSendBookChatMessage"
Cohesion: 0.20
Nodes (15): analyzeSinglePdfPage(), appendChatMessage(), appendChatSystemNote(), getNextTargetPage(), handleSendBookChatMessage(), hideChatTypingStatus(), hideReaderBgOcrStatus(), performVisionAiOcr() (+7 more)

### Community 25 - "renderNotesScreen"
Cohesion: 0.67
Nodes (6): closeAddNoteModal(), handleSaveNoteSubmit(), openAddNoteModal(), renderNotesScreen(), setupNotesScreenEvents(), getCurrentBook()

### Community 27 - "normalizeHyphensAndText"
Cohesion: 0.33
Nodes (7): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), fixSpacedOutLetters(), healTurkishOcrArtifacts(), normalizeHyphensAndText()

### Community 33 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09446693657219973 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `normalizeHyphensAndText` to `main.js`, `test_continuous_ocr_suite.mjs`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `storageService.js`, `test_audit_verification.mjs`, `openBookInReader`, `renderReaderPage`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07890704800817161 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `PDF Rendering & Document Service` be split into smaller, more focused modules?**
  _Cohesion score 0.11494252873563218 - nodes in this community are weakly interconnected._