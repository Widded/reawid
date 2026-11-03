# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 33 files · ~82,446 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 476 nodes · 1351 edges · 32 communities (26 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `40ee979d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- test_continuous_ocr_suite.mjs
- Reader Actions & Floating Pill
- PerformanceMonitor
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- setupSettingsScreenEvents
- package.json
- readerFormatter.js
- Tesseract Engine & Turkish Model
- performOcr
- setupEventListeners
- vite.config.js
- storageService.js
- test_root_cause_suite.mjs
- Document Export & Print Service
- setupResetDataController
- showToast
- renderRsvpWord
- goToSearchMatch
- Edge Functions & CORS Proxy
- startBackgroundPdfAnalysis
- Vercel Deployment Configuration
- renderReaderPage
- test_root_cause_suite.mjs
- @andresaya/edge-tts
- scripts
- vite
- setupComparisonStudioInteractions
- isModelStrictlyFree

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 22 edges
4. `runProductionStressSuite()` - 21 edges
5. `renderReaderPage()` - 19 edges
6. `handlePdfFiles()` - 19 edges
7. `getBooks()` - 19 edges
8. `runAll100Scenarios()` - 19 edges
9. `setupSettingsScreenEvents()` - 18 edges
10. `renderNotesScreen()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `runProductionStressSuite()` --calls--> `disposeCanvas()`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `runProductionStressSuite()` --calls--> `PageRenderLruCache`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js
- `runAll100Scenarios()` --calls--> `markModelCongested()`  [EXTRACTED]
  tests/test_continuous_ocr_suite.mjs → src/services/aiService.js
- `runProductionStressSuite()` --calls--> `markModelCongested()`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/aiService.js

## Import Cycles
- None detected.

## Communities (32 total, 6 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.08
Nodes (42): activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), applyCustomPdfRange(), applyImagePipeline(), appSettings, bookChatHistory (+34 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.11
Nodes (47): handleSendBookChatMessage(), askBookAi(), assessOcrCoverage(), buildCandidateList(), buildParagraphMetadataIndex(), clearCongestionMap(), congestedModels, extractBookAiAnswer() (+39 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.09
Nodes (21): startPdfBatchOcr(), healTurkishOcrArtifacts(), mergeAccidentalParagraphSplits(), normalizeHyphensAndText(), loadImage(), preprocessImageForOcr(), processImage(), disposeCanvas() (+13 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (26): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1 (+18 more)

### Community 6 - "setupSettingsScreenEvents"
Cohesion: 0.21
Nodes (14): applyReaderTheme(), applyReaderTypography(), closeSettingsSubpage(), handleModelChange(), openSettingsSubpage(), renderSettingsScreen(), requestWakeLock(), setupSettingsScreenEvents() (+6 more)

### Community 7 - "package.json"
Cohesion: 0.15
Nodes (17): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, name (+9 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.20
Nodes (13): fixSpacedOutLetters(), isKnownTurkishWord(), segmentCompoundLetters(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml() (+5 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.14
Nodes (12): tesseract.js@^7.0.0, tesseract.js, DEFAULT_SETTINGS, case1, case2, case3, case4, case5 (+4 more)

### Community 10 - "performOcr"
Cohesion: 0.40
Nodes (6): startOcrProcess(), callGroqVision(), formatOcrErrorMessage(), isSuspiciousOcrText(), performOcr(), recordOcrAudit()

### Community 11 - "setupEventListeners"
Cohesion: 0.15
Nodes (23): abortCurrentOcr(), closeBookAiChat(), closeBookCardActionSheet(), closeComparisonView(), closeConversionModal(), closeLibraryHeaderMenu(), closeReader(), closeReaderSearch() (+15 more)

### Community 12 - "vite.config.js"
Cohesion: 0.22
Nodes (5): configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 13 - "storageService.js"
Cohesion: 0.06
Nodes (62): closeAddNoteModal(), handlePdfFiles(), handleSaveNoteSubmit(), handleSaveOcrToLibrary(), openAccountModal(), openAddNoteModal(), openBookCardActionSheet(), openBookInReader() (+54 more)

### Community 14 - "test_root_cause_suite.mjs"
Cohesion: 0.25
Nodes (6): clearOcrAuditTrail(), getOcrAuditTrail(), VISION_CANDIDATE_POOLS, autoList, logs, verifiable

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "setupResetDataController"
Cohesion: 0.67
Nodes (4): closeResetModal(), generateRandomResetCode(), openResetModal(), setupResetDataController()

### Community 17 - "showToast"
Cohesion: 0.35
Nodes (13): closeMoreMenu(), openBookAiChat(), openRsvpReader(), playSentenceQueue(), setupTextSelectionPill(), showToast(), stopReaderSpeech(), toggleCompareSpeech() (+5 more)

### Community 18 - "renderRsvpWord"
Cohesion: 0.38
Nodes (7): closeRsvpReader(), pauseRsvpPlayback(), renderRsvpWord(), startRsvpPlayback(), scheduleNext(), stepRsvpWords(), toggleRsvpPlayback()

### Community 19 - "goToSearchMatch"
Cohesion: 0.38
Nodes (7): clearSearchHighlights(), executeReaderSearch(), goToSearchMatch(), highlightCurrentPageMatches(), nextSearchMatch(), prevSearchMatch(), toggleSearchBar()

### Community 21 - "startBackgroundPdfAnalysis"
Cohesion: 0.36
Nodes (9): analyzeSinglePdfPage(), getNextTargetPage(), hideReaderBgOcrStatus(), performVisionAiOcr(), startBackgroundPdfAnalysis(), stopBackgroundOcrQueue(), updateReaderBgOcrStatus(), yieldToMainThread() (+1 more)

### Community 25 - "renderReaderPage"
Cohesion: 0.39
Nodes (9): formatBookHtml(), getOrLoadPdfDocument(), openComparisonView(), prioritizePageAnalysis(), renderPageAnalysisError(), renderReaderPage(), updateComparisonPage(), loadPdf() (+1 more)

### Community 26 - "test_root_cause_suite.mjs"
Cohesion: 0.47
Nodes (4): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer()

### Community 28 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 29 - "vite"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 30 - "setupComparisonStudioInteractions"
Cohesion: 1.00
Nodes (3): applyCompareZoom(), setupComparisonStudioInteractions(), zoomOriginal()

### Community 31 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07751937984496124 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `PDF Rendering & Document Service` to `main.js`, `test_continuous_ocr_suite.mjs`, `OCR Quality & Metric Suite`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `performOcr`, `storageService.js`, `renderReaderPage`, `test_root_cause_suite.mjs`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runProductionStressSuite()` (e.g. with `.has()` and `.set()`) actually correct?**
  _`runProductionStressSuite()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10946589106292967 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._