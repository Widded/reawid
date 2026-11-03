# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 36 files · ~90,482 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 517 nodes · 1492 edges · 20 communities (14 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cdd67f09`
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
- startPdfBatchOcr
- storageService.js
- performOcr
- Document Export & Print Service
- Edge Functions & CORS Proxy
- startBackgroundPdfAnalysis
- Vercel Deployment Configuration

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 22 edges
4. `savePageOcrMemory()` - 21 edges
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

## Communities (20 total, 6 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.05
Nodes (128): abortCurrentOcr(), activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), applyCompareZoom(), applyImagePipeline(), applyReaderTheme() (+120 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.08
Nodes (64): askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), clearRetrievalAuditTrail(), congestedModels, detectPrintedPageNumber(), extractBookAiAnswer() (+56 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.15
Nodes (16): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+8 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.13
Nodes (13): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), startPdfBatchOcr(), updatePdfBatchActionButtons(), disposeCanvas(), PageRenderLruCache, pdfPageRenderCache (+5 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (29): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, callOpenRouterVision(), isModelStrictlyFree(), afterCer, afterHealed, afterWer, beforeCer, beforeWer (+21 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.28
Nodes (10): loadImage(), preprocessImageForOcr(), processImage(), createAbortError(), getOrInitTesseractWorker(), lastWorkerActiveTime, ocrJobQueue, performTesseractOcr() (+2 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (38): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), dependencies, @andresaya/edge-tts@^1.9.1, canvas-confetti@^1.9.4, lucide@^1.61.0 (+30 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.19
Nodes (14): fixSpacedOutLetters(), mergeAccidentalParagraphSplits(), normalizeHyphensAndText(), extractPdfPageText(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml() (+6 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.17
Nodes (10): healTurkishOcrArtifacts(), case1, case2, case3, case4, case5, case6, case7 (+2 more)

### Community 11 - "startPdfBatchOcr"
Cohesion: 0.40
Nodes (5): displayOcrResult(), startOcrProcess(), formatOcrErrorMessage(), createThumbnail(), saveHistoryItem()

### Community 13 - "storageService.js"
Cohesion: 0.06
Nodes (56): openAccountModal(), renderAccountUI(), setupAccountController(), toggleBookmark(), updateKeyboardViewport(), getLastRetrievalAudit(), AVAILABLE_MODELS, clearAllPdfsFromIdb() (+48 more)

### Community 14 - "performOcr"
Cohesion: 0.15
Nodes (15): BOOK_OCR_SYSTEM_PROMPT, buildCandidateList(), calculateCer(), calculateLevenshteinDistance(), calculateWer(), callGroqVision(), clearOcrAuditTrail(), getOcrAuditTrail() (+7 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 21 - "startBackgroundPdfAnalysis"
Cohesion: 0.26
Nodes (12): analyzeSinglePdfPage(), getNextTargetPage(), handleSendBookChatMessage(), hideChatTypingStatus(), hideReaderBgOcrStatus(), performVisionAiOcr(), setChatTypingStatus(), startBackgroundPdfAnalysis() (+4 more)

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.050993217054263566 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `readerFormatter.js` to `main.js`, `test_continuous_ocr_suite.mjs`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `Tesseract Engine & Turkish Model`, `storageService.js`, `performOcr`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runProductionStressSuite()` (e.g. with `.has()` and `.set()`) actually correct?**
  _`runProductionStressSuite()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08175559380378658 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._