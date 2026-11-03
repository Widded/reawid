# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 28 files · ~61,581 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 438 nodes · 1130 edges · 23 communities (17 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `19187d34`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Reader UI & Viewport Controls
- Account & Cloud Storage
- Reader Actions & Floating Pill
- PerformanceMonitor
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- main.js
- Project Dependencies & Libraries
- readerFormatter.js
- Tesseract Engine & Turkish Model
- AI Proofreader & Congestion Management
- Vite Build & Edge TTS Plugin
- Book AI Chat Assistant
- test_root_cause_suite.mjs
- Document Export & Print Service
- isModelStrictlyFree
- Edge TTS Serverless Function
- NPM Lifecycle Scripts
- Vite Development Tooling
- Edge Functions & CORS Proxy
- Vercel Deployment Configuration

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
- `closeReader()` --calls--> `terminateTesseractWorker()`  [EXTRACTED]
  src/main.js → src/services/tesseractService.js
- `formatBookHtml()` --calls--> `formatBookHtml()`  [EXTRACTED]
  src/main.js → src/services/readerFormatter.js

## Import Cycles
- None detected.

## Communities (23 total, 6 thin omitted)

### Community 0 - "Reader UI & Viewport Controls"
Cohesion: 0.08
Nodes (61): abortCurrentOcr(), applyCompareZoom(), clearSearchHighlights(), closeBookAiChat(), closeBookCardActionSheet(), closeComparisonView(), closeConversionModal(), closeLibraryHeaderMenu() (+53 more)

### Community 1 - "Account & Cloud Storage"
Cohesion: 0.06
Nodes (73): applyReaderTheme(), applyReaderTypography(), closeAddNoteModal(), generatePdfFingerprint(), handleModelChange(), handlePdfFiles(), handleSaveNoteSubmit(), handleSaveOcrToLibrary() (+65 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.15
Nodes (16): audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices(), prefetchSpeech() (+8 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.11
Nodes (14): startPdfBatchOcr(), disposeCanvas(), PageRenderLruCache, pdfPageRenderCache, renderPdfPageDirect(), renderPdfPageToBase64(), renderPdfPageToCanvas(), renderPdfThumbnails() (+6 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "main.js"
Cohesion: 0.07
Nodes (55): activeAnalyzingPages, activeWorkerControllers, analyzeSinglePdfPage(), applyCustomPdfRange(), applyImagePipeline(), appSettings, bookChatHistory, closeAccountModal() (+47 more)

### Community 7 - "Project Dependencies & Libraries"
Cohesion: 0.15
Nodes (17): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, name (+9 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.19
Nodes (15): fixSpacedOutLetters(), mergeAccidentalParagraphSplits(), normalizeHyphensAndText(), extractPdfPageText(), applyBionicReading(), calculateOrpIndex(), escapeBookHtml(), extractWordsForRsvp() (+7 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.15
Nodes (11): tesseract.js@^7.0.0, tesseract.js, case1, case2, case3, case4, case5, case6 (+3 more)

### Community 10 - "AI Proofreader & Congestion Management"
Cohesion: 0.13
Nodes (16): startOcrProcess(), BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, buildCandidateList(), callGroqVision(), congestedModels, formatOcrErrorMessage(), isKnownTurkishWord(), isModelCongested() (+8 more)

### Community 11 - "Vite Build & Edge TTS Plugin"
Cohesion: 0.22
Nodes (5): configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 12 - "Book AI Chat Assistant"
Cohesion: 0.19
Nodes (11): appendChatMessage(), appendChatSystemNote(), handleSendBookChatMessage(), scrollBookChatToBottom(), askBookAi(), extractBookAiAnswer(), extractBookOutlineIndex(), extractEvidenceParagraphs() (+3 more)

### Community 14 - "test_root_cause_suite.mjs"
Cohesion: 0.16
Nodes (12): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), healTurkishOcrArtifacts(), recordOcrAudit() (+4 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "isModelStrictlyFree"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

### Community 18 - "NPM Lifecycle Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 19 - "Vite Development Tooling"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PerformanceMonitor` connect `PerformanceMonitor` to `PDF Rendering & Document Service`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `Reader UI & Viewport Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.07868852459016394 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `readerFormatter.js` to `Reader UI & Viewport Controls`, `Account & Cloud Storage`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `main.js`, `Tesseract Engine & Turkish Model`, `AI Proofreader & Congestion Management`, `test_root_cause_suite.mjs`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Account & Cloud Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.0560126582278481 - nodes in this community are weakly interconnected._
- **Why does `marked` connect `Project Dependencies & Libraries` to `main.js`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `PDF Rendering & Document Service` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._