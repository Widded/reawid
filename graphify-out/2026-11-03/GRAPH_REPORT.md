# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 34 files · ~85,497 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 490 nodes · 1399 edges · 21 communities (16 shown, 5 thin omitted)
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
- aiService.js
- storageService.js
- performOcr
- Document Export & Print Service
- Edge Functions & CORS Proxy
- startBackgroundPdfAnalysis
- Vercel Deployment Configuration
- test_root_cause_suite.mjs
- isModelStrictlyFree

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 22 edges
4. `runProductionStressSuite()` - 21 edges
5. `renderReaderPage()` - 19 edges
6. `handlePdfFiles()` - 19 edges
7. `savePageOcrMemory()` - 19 edges
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

## Communities (21 total, 5 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.05
Nodes (121): abortCurrentOcr(), activeAnalyzingPages, activeWorkerControllers, applyCompareZoom(), applyImagePipeline(), applyReaderTheme(), applyReaderTypography(), appSettings (+113 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.12
Nodes (45): askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), extractBookAiAnswer(), extractBookOutlineIndex(), extractEvidenceParagraphs(), findCandidatePagesForQuestion() (+37 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.15
Nodes (16): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+8 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.11
Nodes (15): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), startPdfBatchOcr(), updatePdfBatchActionButtons(), mergeAccidentalParagraphSplits(), disposeCanvas(), extractPdfPageText() (+7 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.21
Nodes (13): displayOcrResult(), createThumbnail(), loadImage(), preprocessImageForOcr(), processImage(), saveHistoryItem(), createAbortError(), getOrInitTesseractWorker() (+5 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (38): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), dependencies, @andresaya/edge-tts@^1.9.1, canvas-confetti@^1.9.4, lucide@^1.61.0 (+30 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.26
Nodes (10): applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength(), isDialogueTurn() (+2 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.17
Nodes (11): healTurkishOcrArtifacts(), normalizeHyphensAndText(), case1, case2, case3, case4, case5, case6 (+3 more)

### Community 10 - "aiService.js"
Cohesion: 0.15
Nodes (10): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, congestedModels, fixSpacedOutLetters(), isKnownTurkishWord(), ocrAuditTrail, retrievalCache, segmentCompoundLetters(), testApiConnection() (+2 more)

### Community 13 - "storageService.js"
Cohesion: 0.07
Nodes (50): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), toggleBookmark(), updateKeyboardViewport(), AVAILABLE_MODELS (+42 more)

### Community 14 - "performOcr"
Cohesion: 0.18
Nodes (12): startOcrProcess(), buildCandidateList(), callGroqVision(), formatOcrErrorMessage(), getOcrAuditTrail(), isSuspiciousOcrText(), performOcr(), recordOcrAudit() (+4 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 21 - "startBackgroundPdfAnalysis"
Cohesion: 0.20
Nodes (15): analyzeSinglePdfPage(), appendChatMessage(), appendChatSystemNote(), getNextTargetPage(), handleSendBookChatMessage(), hideChatTypingStatus(), hideReaderBgOcrStatus(), performVisionAiOcr() (+7 more)

### Community 26 - "test_root_cause_suite.mjs"
Cohesion: 0.38
Nodes (5): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail()

### Community 31 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054057715756672536 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `Tesseract Engine & Turkish Model` to `main.js`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `readerFormatter.js`, `aiService.js`, `storageService.js`, `performOcr`, `test_root_cause_suite.mjs`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runProductionStressSuite()` (e.g. with `.has()` and `.set()`) actually correct?**
  _`runProductionStressSuite()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11689070718877849 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._