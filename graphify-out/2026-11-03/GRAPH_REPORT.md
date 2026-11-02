# Graph Report - reawid2  (2026-11-03)

## Corpus Check
- 28 files · ~58,716 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .example 1, (none) 1, .webmanifest 1)

## Summary
- 430 nodes · 1108 edges · 25 communities (20 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5feb0bd3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Reader UI & Viewport Controls
- Account & Cloud Storage
- Reader Actions & Floating Pill
- Image Processing & OCR Preprocessing
- PDF Rendering & Document Service
- OCR Quality & Metric Suite
- RSVP Speed Reader Engine
- Project Dependencies & Libraries
- Vision AI & Background OCR
- Tesseract Engine & Turkish Model
- AI Proofreader & Congestion Management
- Vite Build & Edge TTS Plugin
- Book AI Chat Assistant
- OCR Error Correction & Levenshtein Metrics
- Vision Model Fallback Pool
- Document Export & Print Service
- OCR Workflow Orchestrator
- Edge TTS Serverless Function
- NPM Lifecycle Scripts
- Vite Development Tooling
- Edge Functions & CORS Proxy
- OpenRouter Vision Provider
- Vercel Deployment Configuration

## God Nodes (most connected - your core abstractions)
1. `setupEventListeners()` - 78 edges
2. `showToast()` - 28 edges
3. `openBookInReader()` - 20 edges
4. `getBooks()` - 19 edges
5. `renderReaderPage()` - 18 edges
6. `handlePdfFiles()` - 17 edges
7. `renderNotesScreen()` - 17 edges
8. `normalizeHyphensAndText()` - 17 edges
9. `setupSettingsScreenEvents()` - 16 edges
10. `renderHomeScreen()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `hasPaidCandidate` --calls--> `isModelStrictlyFree()`  [EXTRACTED]
  tests/test_ocr_suite.mjs → src/services/aiService.js
- `runSuite()` --calls--> `cleanTextForSpeech()`  [EXTRACTED]
  tests/test_speech_suite.mjs → src/services/speechService.js
- `runSuite()` --calls--> `prefetchSpeech()`  [EXTRACTED]
  tests/test_speech_suite.mjs → src/services/speechService.js
- `renderHomeScreen()` --calls--> `getNotes()`  [EXTRACTED]
  src/main.js → src/services/storageService.js
- `renderHomeScreen()` --calls--> `getCurrentUser()`  [EXTRACTED]
  src/main.js → src/services/supabaseService.js

## Import Cycles
- None detected.

## Communities (25 total, 5 thin omitted)

### Community 0 - "Reader UI & Viewport Controls"
Cohesion: 0.06
Nodes (91): activeAnalyzingPages, activeWorkerControllers, appendChatSystemNote(), applyCompareZoom(), applyImagePipeline(), applyReaderTheme(), applyReaderTypography(), appSettings (+83 more)

### Community 1 - "Account & Cloud Storage"
Cohesion: 0.06
Nodes (48): closeAccountModal(), openAccountModal(), renderAccountUI(), resetKeyboardViewport(), setupAccountController(), toggleBookmark(), updateKeyboardViewport(), AVAILABLE_MODELS (+40 more)

### Community 2 - "Reader Actions & Floating Pill"
Cohesion: 0.11
Nodes (29): abortCurrentOcr(), openBookAiChat(), openRsvpReader(), playSentenceQueue(), setupPwa(), setupTextSelectionPill(), showToast(), stopReaderSpeech() (+21 more)

### Community 3 - "Image Processing & OCR Preprocessing"
Cohesion: 0.09
Nodes (13): displayOcrResult(), createThumbnail(), loadImage(), preprocessImageForOcr(), processImage(), perfMonitor, PerformanceMonitor, saveHistoryItem() (+5 more)

### Community 4 - "PDF Rendering & Document Service"
Cohesion: 0.12
Nodes (13): applyCustomPdfRange(), selectPdfPage(), setPdfBatchRange(), updatePdfBatchActionButtons(), mergeAccidentalParagraphSplits(), disposeCanvas(), extractPdfPageText(), PageRenderLruCache (+5 more)

### Community 5 - "OCR Quality & Metric Suite"
Cohesion: 0.07
Nodes (25): afterCer, afterHealed, afterWer, beforeCer, beforeWer, candidateList, cerCase1, cleanedTurkishChars (+17 more)

### Community 6 - "RSVP Speed Reader Engine"
Cohesion: 0.16
Nodes (19): pauseRsvpPlayback(), renderRsvpWord(), startRsvpPlayback(), scheduleNext(), stepRsvpWords(), toggleRsvpPlayback(), fixSpacedOutLetters(), normalizeHyphensAndText() (+11 more)

### Community 7 - "Project Dependencies & Libraries"
Cohesion: 0.15
Nodes (17): dependencies, canvas-confetti@^1.9.4, lucide@^1.61.0, marked@^18.1.1, pdf-lib@^1.17.1, pdfjs-dist@^6.4.299, @supabase/supabase-js@^2.118.0, name (+9 more)

### Community 8 - "Vision AI & Background OCR"
Cohesion: 0.20
Nodes (18): analyzeSinglePdfPage(), formatBookHtml(), getNextTargetPage(), getOrLoadPdfDocument(), hideReaderBgOcrStatus(), openComparisonView(), performVisionAiOcr(), prioritizePageAnalysis() (+10 more)

### Community 9 - "Tesseract Engine & Turkish Model"
Cohesion: 0.14
Nodes (12): tesseract.js@^7.0.0, tesseract.js, DEFAULT_SETTINGS, case1, case2, case3, case4, case5 (+4 more)

### Community 10 - "AI Proofreader & Congestion Management"
Cohesion: 0.17
Nodes (7): BOOK_OCR_PROOFREADER_SYSTEM_PROMPT, congestedModels, isKnownTurkishWord(), ocrAuditTrail, segmentCompoundLetters(), testApiConnection(), TURKISH_LEXICON

### Community 11 - "Vite Build & Edge TTS Plugin"
Cohesion: 0.22
Nodes (5): configurePreviewServer(), configureServer(), __dirname, __filename, setupTtsMiddleware()

### Community 12 - "Book AI Chat Assistant"
Cohesion: 0.24
Nodes (6): appendChatMessage(), handleSendBookChatMessage(), askBookAi(), extractBookAiAnswer(), prepareBookContext(), mockPages

### Community 13 - "OCR Error Correction & Levenshtein Metrics"
Cohesion: 0.28
Nodes (7): BOOK_OCR_SYSTEM_PROMPT, calculateCer(), calculateLevenshteinDistance(), calculateWer(), clearOcrAuditTrail(), getOcrAuditTrail(), healTurkishOcrArtifacts()

### Community 14 - "Vision Model Fallback Pool"
Cohesion: 0.22
Nodes (7): buildCandidateList(), isModelCongested(), recordOcrAudit(), VISION_CANDIDATE_POOLS, autoList, logs, verifiable

### Community 15 - "Document Export & Print Service"
Cohesion: 0.54
Nodes (7): downloadMarkdown(), downloadTxt(), downloadWordDoc(), escapeHtml(), formatTextToHtml(), printDocument(), triggerDownload()

### Community 16 - "OCR Workflow Orchestrator"
Cohesion: 0.38
Nodes (7): startOcrProcess(), startPdfBatchOcr(), callGroqVision(), formatOcrErrorMessage(), isSuspiciousOcrText(), markModelCongested(), performOcr()

### Community 18 - "NPM Lifecycle Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 19 - "Vite Development Tooling"
Cohesion: 0.67
Nodes (3): devDependencies, vite@^8.3.4, vite

### Community 21 - "OpenRouter Vision Provider"
Cohesion: 0.67
Nodes (3): callOpenRouterVision(), isModelStrictlyFree(), hasPaidCandidate

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeHyphensAndText()` connect `RSVP Speed Reader Engine` to `Reader UI & Viewport Controls`, `Account & Cloud Storage`, `Image Processing & OCR Preprocessing`, `PDF Rendering & Document Service`, `OCR Quality & Metric Suite`, `Vision AI & Background OCR`, `Tesseract Engine & Turkish Model`, `AI Proofreader & Congestion Management`, `OCR Error Correction & Levenshtein Metrics`, `OCR Workflow Orchestrator`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `setupEventListeners()` (e.g. with `abortCurrentOcr()` and `applyCustomPdfRange()`) actually correct?**
  _`setupEventListeners()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Should `Reader UI & Viewport Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.06497849976110846 - nodes in this community are weakly interconnected._
- **Why does `canvas-confetti` connect `Project Dependencies & Libraries` to `Reader UI & Viewport Controls`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Account & Cloud Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.06262626262626263 - nodes in this community are weakly interconnected._
- **Should `Reader Actions & Floating Pill` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._
- **Should `Image Processing & OCR Preprocessing` be split into smaller, more focused modules?**
  _Cohesion score 0.09359605911330049 - nodes in this community are weakly interconnected._