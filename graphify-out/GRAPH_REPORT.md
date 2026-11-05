# Graph Report - reawid2  (2026-11-04)

## Corpus Check
- 40 files · ~98,409 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 535 nodes · 1553 edges · 31 communities (24 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a705c7b4`
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
- aiService.js
- Tesseract Engine & Turkish Model
- supabaseService.js
- performOcr
- setupAccountController
- storageService.js
- test_audit_verification.mjs
- Document Export & Print Service
- getNotes
- vite.config.js
- getBooks
- tts.js
- Edge Functions & CORS Proxy
- Vercel Deployment Configuration
- test_real_harry_potter_semantic_suite.mjs
- test_post_ocr_performance_suite.mjs
- normalizeHyphensAndText
- scripts
- vite
- test_ocr_hydration_and_persistence_suite.mjs
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

## Communities (31 total, 7 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.05
Nodes (129): abortCurrentOcr(), activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), applyCompareZoom(), applyImagePipeline(), applyReaderTheme() (+121 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.09
Nodes (64): handleSendBookChatMessage(), hideChatTypingStatus(), setChatTypingStatus(), askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), clearRetrievalAuditTrail() (+56 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.16
Nodes (15): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+7 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.07
Nodes (30): analyzeSinglePdfPage(), applyCustomPdfRange(), performVisionAiOcr(), selectPdfPage(), setPdfBatchRange(), updatePdfBatchActionButtons(), yieldToMainThread(), fixSpacedOutLetters() (+22 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.28
Nodes (10): loadImage(), preprocessImageForOcr(), processImage(), createAbortError(), getOrInitTesseractWorker(), lastWorkerActiveTime, ocrJobQueue, performTesseractOcr() (+2 more)

### Community 7 - "package.json"
Cohesion: 0.14
Nodes (19): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, tesseract.js@^7.0.0 (+11 more)

### Community 8 - "aiService.js"
Cohesion: 0.11
Nodes (14): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, COMMON_NARRATIVE_ACTION_STEMS, congestedModels, getLastRetrievalAudit(), isKnownTurkishWord(), NARRATIVE_CONCEPT_MAP, ocrAuditTrail, questionUnderstandingCache (+6 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.17
Nodes (10): DEFAULT_SETTINGS, case1, case2, case3, case4, case5, case6, case7 (+2 more)

### Community 10 - "supabaseService.js"
Cohesion: 0.26
Nodes (10): authListeners, bookToDbRow(), dbRowToBook(), dbRowToNote(), isSupabaseConfigured, noteToDbRow(), supabase, syncAllWithCloud() (+2 more)

### Community 11 - "performOcr"
Cohesion: 0.27
Nodes (10): displayOcrResult(), startOcrProcess(), startPdfBatchOcr(), callGroqVision(), formatOcrErrorMessage(), isSuspiciousOcrText(), performOcr(), recordOcrAudit() (+2 more)

### Community 12 - "setupAccountController"
Cohesion: 0.22
Nodes (11): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), updateKeyboardViewport(), getCurrentUser(), signInWithEmail() (+3 more)

### Community 13 - "storageService.js"
Cohesion: 0.10
Nodes (24): AVAILABLE_MODELS, clearAllPdfsFromIdb(), clearBookOcrCache(), clearNotes(), deleteBook(), deletePdfFromIdb(), DEPRECATED_GROQ_MODELS, DEPRECATED_OR_MODELS (+16 more)

### Community 14 - "test_audit_verification.mjs"
Cohesion: 0.29
Nodes (5): buildCandidateList(), VISION_CANDIDATE_POOLS, autoList, logs, verifiable

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "getNotes"
Cohesion: 0.60
Nodes (5): toggleBookmark(), deleteNote(), getNotes(), saveNote(), deleteNoteFromCloud()

### Community 17 - "vite.config.js"
Cohesion: 0.24
Nodes (6): ALLOWED_VOICES, configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 18 - "getBooks"
Cohesion: 0.33
Nodes (9): cloneBooks(), debouncedSaveBooks(), getBookById(), getBooks(), mergeBooksState(), queueBookCloudSync(), syncLocalWithCloudDb(), updateBookPageParagraphs() (+1 more)

### Community 19 - "tts.js"
Cohesion: 0.33
Nodes (6): ALLOWED_VOICES, handler(), ipRateLimits, isRateLimited(), @andresaya/edge-tts@^1.9.1, @andresaya/edge-tts

### Community 25 - "test_real_harry_potter_semantic_suite.mjs"
Cohesion: 0.33
Nodes (3): data, loadingTask, realPagesTextMap

### Community 27 - "normalizeHyphensAndText"
Cohesion: 0.28
Nodes (7): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), healTurkishOcrArtifacts()

### Community 28 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 29 - "vite"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 33 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05068574836016696 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `PDF Rendering & Document Service` to `main.js`, `OCR Quality & Metric Suite`, `tesseractService.js`, `aiService.js`, `Tesseract Engine & Turkish Model`, `performOcr`, `storageService.js`, `getBooks`, `normalizeHyphensAndText`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08858024691358024 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `PDF Rendering & Document Service` be split into smaller, more focused modules?**
  _Cohesion score 0.07428571428571429 - nodes in this community are weakly interconnected._