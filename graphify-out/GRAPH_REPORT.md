# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 28 files · ~59,938 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 433 nodes · 1116 edges · 24 communities (18 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9d533bf6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Reader UI & Viewport Controls
- Account & Cloud Storage
- Reader Actions & Floating Pill
- PerformanceMonitor
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- setupEventListeners
- Project Dependencies & Libraries
- readerFormatter.js
- Tesseract Engine & Turkish Model
- AI Proofreader & Congestion Management
- Vite Build & Edge TTS Plugin
- Book AI Chat Assistant
- renderReaderPage
- Vision Model Fallback Pool
- Document Export & Print Service
- OCR Workflow Orchestrator
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
- `renderHomeScreen()` --calls--> `getBooks()`  [EXTRACTED]
  src/main.js → src/services/storageService.js
- `renderHomeScreen()` --calls--> `getNotes()`  [EXTRACTED]
  src/main.js → src/services/storageService.js

## Import Cycles
- None detected.

## Communities (24 total, 6 thin omitted)

### Community 0 - "Reader UI & Viewport Controls"
Cohesion: 0.06
Nodes (59): activeAnalyzingPages, activeWorkerControllers, applyCompareZoom(), applyCustomPdfRange(), applyImagePipeline(), appSettings, bookChatHistory, clearSearchHighlights() (+51 more)

### Community 1 - "Account & Cloud Storage"
Cohesion: 0.08
Nodes (43): renderAccountUI(), toggleBookmark(), AVAILABLE_MODELS, clearAllPdfsFromIdb(), clearNotes(), deleteBook(), deleteNote(), deletePdfFromIdb() (+35 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.14
Nodes (19): closeComparisonView(), audioBlobCache, AVAILABLE_TTS_VOICES, cleanTextForSpeech(), getCacheKey(), getTtsAudioElement(), isTtsSupported(), loadWebVoices() (+11 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.09
Nodes (21): analyzeSinglePdfPage(), performVisionAiOcr(), yieldToMainThread(), healTurkishOcrArtifacts(), mergeAccidentalParagraphSplits(), normalizeHyphensAndText(), disposeCanvas(), extractPdfPageText() (+13 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "setupEventListeners"
Cohesion: 0.08
Nodes (68): abortCurrentOcr(), appendChatSystemNote(), applyReaderTheme(), applyReaderTypography(), closeAddNoteModal(), closeBookAiChat(), closeBookCardActionSheet(), closeConversionModal() (+60 more)

### Community 7 - "Project Dependencies & Libraries"
Cohesion: 0.15
Nodes (17): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, name (+9 more)

### Community 8 - "readerFormatter.js"
Cohesion: 0.23
Nodes (11): formatBookHtml(), applyBionicReading(), calculateOrpIndex(), extractWordsForRsvp(), formatBookHtml(), renderSentencesHtml(), formatInlineQuotes(), getBionicFixationLength() (+3 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.15
Nodes (11): tesseract.js@^7.0.0, tesseract.js, case1, case2, case3, case4, case5, case6 (+3 more)

### Community 10 - "AI Proofreader & Congestion Management"
Cohesion: 0.16
Nodes (8): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, congestedModels, fixSpacedOutLetters(), isKnownTurkishWord(), ocrAuditTrail, segmentCompoundLetters(), testApiConnection(), TURKISH_LEXICON

### Community 11 - "Vite Build & Edge TTS Plugin"
Cohesion: 0.22
Nodes (5): configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 12 - "Book AI Chat Assistant"
Cohesion: 0.24
Nodes (6): appendChatMessage(), handleSendBookChatMessage(), askBookAi(), extractBookAiAnswer(), prepareBookContext(), mockPages

### Community 13 - "renderReaderPage"
Cohesion: 0.25
Nodes (14): getNextTargetPage(), getOrLoadPdfDocument(), hideReaderBgOcrStatus(), openComparisonView(), prioritizePageAnalysis(), renderPageAnalysisError(), renderReaderPage(), setupReaderSwipeNavigation() (+6 more)

### Community 14 - "Vision Model Fallback Pool"
Cohesion: 0.15
Nodes (13): BOOK_OCR_SYSTEM_PROMPT, buildCandidateList(), calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), isModelCongested() (+5 more)

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "OCR Workflow Orchestrator"
Cohesion: 0.25
Nodes (9): startOcrProcess(), callGroqVision(), callOpenRouterVision(), formatOcrErrorMessage(), isModelStrictlyFree(), isSuspiciousOcrText(), markModelCongested(), performOcr() (+1 more)

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
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `Reader UI & Viewport Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.0633879781420765 - nodes in this community are weakly interconnected._
- **Why does `normalizeHyphensAndText()` connect `PDF Rendering & Document Service` to `Reader UI & Viewport Controls`, `Account & Cloud Storage`, `OCR Quality & Metric Suite`, `readerFormatter.js`, `Tesseract Engine & Turkish Model`, `AI Proofreader & Congestion Management`, `renderReaderPage`, `Vision Model Fallback Pool`, `OCR Workflow Orchestrator`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Account & Cloud Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.07510204081632653 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `Project Dependencies & Libraries` to `Reader UI & Viewport Controls`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Reader Actions & Floating Pill` be split into smaller, more focused modules?**
  _Cohesion score 0.14333333333333334 - nodes in this community are weakly interconnected._