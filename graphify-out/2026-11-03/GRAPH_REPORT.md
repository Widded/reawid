# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 32 files · ~78,982 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 471 nodes · 1298 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
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
- tesseractService.js
- package.json
- readerFormatter.js
- Tesseract Engine & Turkish Model
- AI Proofreader & Congestion Management
- setupEventListeners
- init
- storageService.js
- test_root_cause_suite.mjs
- Document Export & Print Service
- renderNotesScreen
- showToast
- closeReader
- goToSearchMatch
- Edge Functions & CORS Proxy
- openBookInReader
- Vercel Deployment Configuration
- imageProcessor.js

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 79 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 22 edges
4. `renderReaderPage()` - 19 edges
5. `handlePdfFiles()` - 19 edges
6. `getBooks()` - 19 edges
7. `runAll100Scenarios()` - 19 edges
8. `setupSettingsScreenEvents()` - 18 edges
9. `renderNotesScreen()` - 17 edges
10. `normalizeHyphensAndText()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js
- `runAll100Scenarios()` --calls--> `markModelCongested()`  [EXTRACTED]
  tests/test_continuous_ocr_suite.mjs → src/services/aiService.js
- `runAll100Scenarios()` --calls--> `isModelCongested()`  [EXTRACTED]
  tests/test_continuous_ocr_suite.mjs → src/services/aiService.js
- `runAll100Scenarios()` --calls--> `clearCongestionMap()`  [EXTRACTED]
  tests/test_continuous_ocr_suite.mjs → src/services/aiService.js
- `runAll100Scenarios()` --calls--> `findCandidatePagesForQuestion()`  [EXTRACTED]
  tests/test_continuous_ocr_suite.mjs → src/services/aiService.js

## Import Cycles
- None detected.

## Communities (26 total, 5 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.10
Nodes (25): activeAnalyzingPages, activeWorkerControllers, appendChatMessage(), appendChatSystemNote(), appSettings, bookChatHistory, closeAccountModal(), closeSettingsSubpage() (+17 more)

### Community 1 - "test_continuous_ocr_suite.mjs"
Cohesion: 0.12
Nodes (38): handleSendBookChatMessage(), askBookAi(), assessOcrCoverage(), buildParagraphMetadataIndex(), clearCongestionMap(), extractBookAiAnswer(), extractBookOutlineIndex(), extractEvidenceParagraphs() (+30 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.15
Nodes (19): toggleCompareSpeech(), audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices() (+11 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.14
Nodes (9): startPdfBatchOcr(), disposeCanvas(), PageRenderLruCache, pdfPageRenderCache, renderPdfPageDirect(), renderPdfPageToBase64(), renderPdfPageToCanvas(), renderPdfThumbnails() (+1 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "tesseractService.js"
Cohesion: 0.39
Nodes (6): tesseract.js, getOrInitTesseractWorker(), lastWorkerActiveTime, performTesseractOcr(), resetIdleTimer(), terminateTesseractWorker()

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, @andresaya/edge-tts@^1.9.1, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0 (+24 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.21
Nodes (12): fixSpacedOutLetters(), mergeAccidentalParagraphSplits(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes() (+4 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.16
Nodes (12): healTurkishOcrArtifacts(), normalizeHyphensAndText(), extractPdfPageText(), case1, case2, case3, case4, case5 (+4 more)

### Community 10 - "AI Proofreader & Congestion Management"
Cohesion: 0.12
Nodes (18): startOcrProcess(), BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, buildCandidateList(), callGroqVision(), callOpenRouterVision(), congestedModels, formatOcrErrorMessage(), isKnownTurkishWord() (+10 more)

### Community 11 - "setupEventListeners"
Cohesion: 0.14
Nodes (19): abortCurrentOcr(), applyCompareZoom(), applyImagePipeline(), closeBookAiChat(), handleCopyText(), handleRotate90(), resetImageFilters(), setComparisonMode() (+11 more)

### Community 12 - "init"
Cohesion: 0.20
Nodes (14): applyCustomPdfRange(), handleGlobalPaste(), handleImageFiles(), init(), openConversionModal(), populateModelSelect(), preventPwaZooming(), selectPdfPage() (+6 more)

### Community 13 - "storageService.js"
Cohesion: 0.06
Nodes (66): applyReaderTheme(), applyReaderTypography(), handleModelChange(), handlePdfFiles(), handleSaveOcrToLibrary(), openAccountModal(), openBookCardActionSheet(), openBookInReader() (+58 more)

### Community 14 - "test_root_cause_suite.mjs"
Cohesion: 0.17
Nodes (11): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), recordOcrAudit(), VISION_CANDIDATE_POOLS (+3 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "renderNotesScreen"
Cohesion: 0.23
Nodes (14): closeAddNoteModal(), closeBookCardActionSheet(), closeConversionModal(), closeLibraryHeaderMenu(), closeResetModal(), generateRandomResetCode(), handleSaveNoteSubmit(), openAddNoteModal() (+6 more)

### Community 17 - "showToast"
Cohesion: 0.30
Nodes (14): openBookAiChat(), openRsvpReader(), pauseRsvpPlayback(), playSentenceQueue(), renderRsvpWord(), setupTextSelectionPill(), showToast(), startRsvpPlayback() (+6 more)

### Community 18 - "closeReader"
Cohesion: 0.25
Nodes (11): closeComparisonView(), closeMoreMenu(), closeReader(), closeReaderSearch(), closeRsvpReader(), closeSettingsSheet(), openSettingsSheet(), releaseWakeLock() (+3 more)

### Community 19 - "goToSearchMatch"
Cohesion: 0.38
Nodes (7): clearSearchHighlights(), executeReaderSearch(), goToSearchMatch(), highlightCurrentPageMatches(), nextSearchMatch(), prevSearchMatch(), toggleSearchBar()

### Community 21 - "openBookInReader"
Cohesion: 0.20
Nodes (18): analyzeSinglePdfPage(), formatBookHtml(), getNextTargetPage(), getOrLoadPdfDocument(), hideReaderBgOcrStatus(), openComparisonView(), performVisionAiOcr(), prioritizePageAnalysis() (+10 more)

### Community 25 - "imageProcessor.js"
Cohesion: 0.83
Nodes (3): loadImage(), preprocessImageForOcr(), processImage()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09846153846153846 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `Tesseract Engine & Turkish Model` to `main.js`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `tesseractService.js`, `readerFormatter.js`, `AI Proofreader & Congestion Management`, `storageService.js`, `test_root_cause_suite.mjs`, `openBookInReader`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `test_continuous_ocr_suite.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12395929694727105 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Reader Actions & Floating Pill` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._