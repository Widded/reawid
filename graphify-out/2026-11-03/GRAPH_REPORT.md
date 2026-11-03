# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 35 files · ~88,421 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 503 nodes · 1459 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71133773`
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
- vite.config.js
- startPdfBatchOcr
- scripts
- storageService.js
- performOcr
- Document Export & Print Service
- vite
- Edge Functions & CORS Proxy
- startBackgroundPdfAnalysis
- Vercel Deployment Configuration
- test_root_cause_suite.mjs
- isModelStrictlyFree

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 22 edges
4. `savePageOcrMemory()` - 22 edges
5. `runProductionStressSuite()` - 21 edges
6. `renderReaderPage()` - 19 edges
7. `handlePdfFiles()` - 19 edges
8. `getBooks()` - 19 edges
9. `runAll100Scenarios()` - 19 edges
10. `setupSettingsScreenEvents()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `runProductionStressSuite()` --calls--> `disposeCanvas()`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `runProductionStressSuite()` --calls--> `PageRenderLruCache`  [EXTRACTED]
  tests/test_production_stress_suite.mjs → src/services/pdfService.js
- `runTestSuite()` --calls--> `createAbortError()`  [EXTRACTED]
  tests/test_critical_fixes_suite.mjs → src/services/tesseractService.js
- `runTestSuite()` --calls--> `handler()`  [EXTRACTED]
  tests/test_critical_fixes_suite.mjs → api/tts.js
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js

## Import Cycles
- None detected.

## Communities (24 total, 5 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.05
Nodes (120): abortCurrentOcr(), activeAnalyzingPages, activeWorkerControllers, applyCompareZoom(), applyImagePipeline(), applyReaderTheme(), applyReaderTypography(), appSettings (+112 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.07
Nodes (69): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap() (+61 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.12
Nodes (14): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), updatePdfBatchActionButtons(), mergeAccidentalParagraphSplits(), disposeCanvas(), extractPdfPageText(), PageRenderLruCache (+6 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (26): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1 (+18 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.28
Nodes (10): loadImage(), preprocessImageForOcr(), processImage(), createAbortError(), getOrInitTesseractWorker(), lastWorkerActiveTime, ocrJobQueue, performTesseractOcr() (+2 more)

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (19): dependencies, @andresaya/edge-tts@^1.9.1, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0 (+11 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.26
Nodes (10): applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength(), isDialogueTurn() (+2 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.14
Nodes (12): tesseract.js@^7.0.0, tesseract.js, DEFAULT_SETTINGS, case1, case2, case3, case4, case5 (+4 more)

### Community 10 - "vite.config.js"
Cohesion: 0.20
Nodes (6): ALLOWED_VOICES, configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 11 - "startPdfBatchOcr"
Cohesion: 0.40
Nodes (6): displayOcrResult(), startOcrProcess(), startPdfBatchOcr(), formatOcrErrorMessage(), createThumbnail(), saveHistoryItem()

### Community 12 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 13 - "storageService.js"
Cohesion: 0.07
Nodes (51): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), toggleBookmark(), updateKeyboardViewport(), AVAILABLE_MODELS (+43 more)

### Community 14 - "performOcr"
Cohesion: 0.22
Nodes (9): buildCandidateList(), callGroqVision(), isSuspiciousOcrText(), performOcr(), recordOcrAudit(), VISION_CANDIDATE_POOLS, autoList, logs (+1 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "vite"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 21 - "startBackgroundPdfAnalysis"
Cohesion: 0.20
Nodes (15): analyzeSinglePdfPage(), appendChatMessage(), appendChatSystemNote(), getNextTargetPage(), handleSendBookChatMessage(), hideChatTypingStatus(), hideReaderBgOcrStatus(), performVisionAiOcr() (+7 more)

### Community 26 - "test_root_cause_suite.mjs"
Cohesion: 0.25
Nodes (9): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), fixSpacedOutLetters(), getOcrAuditTrail(), healTurkishOcrArtifacts() (+1 more)

### Community 31 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `test_root_cause_suite.mjs` to `main.js`, `test_continuous_ocr_suite.mjs`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `storageService.js`, `performOcr`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runProductionStressSuite()` (e.g. with `.has()` and `.set()`) actually correct?**
  _`runProductionStressSuite()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07340823970037454 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._