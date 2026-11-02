// Smart Book Typography & Dialogue Formatting Engine for ReaWid
// Extracts, normalizes and formats book paragraphs with authentic novel typography.

import {
  normalizeHyphensAndText,
  fixSpacedOutLetters,
  mergeAccidentalParagraphSplits
} from './aiService.js';

/**
 * Heuristic Quality & Coherence Check for OCR output
 * Checks whether the text is genuine readable Turkish or degraded gibberish/symbols
 */
export function isOcrOutputCoherent(text, confidence = 0) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  if (confidence && confidence < 50) return false;

  // Count Turkish letters vs noise/symbols
  const letters = (trimmed.match(/[\p{L}\p{N}]/gu) || []).length;
  const letterRatio = letters / trimmed.length;
  if (letterRatio < 0.65) return false;

  // Check vowel ratio (in Turkish words, vowels comprise ~30-45% of letters; <20% indicates broken symbols)
  const vowels = (trimmed.match(/[aeıioöuüAEIİOÖUÜ]/gu) || []).length;
  const vowelRatio = vowels / Math.max(1, letters);
  if (vowelRatio < 0.20 || vowelRatio > 0.65) return false;

  return true;
}

/**
 * Escapes HTML characters safely for reader view
 */
export function escapeBookHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight inline quotes inside narrative: "..." or &quot;...&quot; or “...”
 */
export function formatInlineQuotes(escapedText) {
  if (!escapedText) return '';
  return escapedText
    .replace(/(?:&quot;|"|“)([^&"\n]+?)(?:&quot;|"|”)/g, '<span class="reader-inline-quote">“$1”</span>');
}

/**
 * Checks if a string is a genuine dialogue turn.
 * True dialogue starts with em-dash (—, –, ―) or hyphen with space (- ),
 * strictly followed by an UPPERCASE letter, quotation mark, or number.
 * Lowercase continuation (e.g. "-den dolayı" or "-miş gibi") is NEVER dialogue.
 */
export function isDialogueTurn(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  // Starts with em/en dash followed by capital letter, quote, or number
  if (/^[—–―]\s*([A-ZÇĞİÖŞÜ0-9"“«])/.test(s)) return true;
  // Starts with hyphen followed by space and capital letter, quote, or number
  if (/^-\s+([A-ZÇĞİÖŞÜ0-9"“«])/.test(s)) return true;
  // Starts with quotation mark followed by dialogue text
  if (/^[“"«][A-ZÇĞİÖŞÜ0-9—–]/.test(s)) return true;
  return false;
}

/**
 * Splits Turkish book prose into sentences while preserving ellipsis (... / …),
 * abbreviations (Dr., Prof., vs., vb.), and terminal quotes.
 */
export function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];
  // 1. Temporarily protect common abbreviations
  let s = text.replace(/\b(Dr|Prof|Av|vs|vb|bkz|sf)\.\s+/gi, '$1__TEMP_DOT_SPACE__');

  // 2. Split on sentence boundaries:
  // After terminal punctuation (. ! ? ... …) optionally followed by closing quote,
  // then whitespace, followed by Capital letter, opening quote, dialogue dash, or number.
  const parts = s.split(/(?<=[.!?…]["”»]?|(?:\.\.\.)["”»]?)\s+(?=[A-ZÇĞİÖŞÜ"“«—–\d])/u);

  return parts
    .map(p => p.replace(/__TEMP_DOT_SPACE__/g, '. ').trim())
    .filter(Boolean);
}

/**
 * Calculates fixation point length for Bionic Reading
 */
export function getBionicFixationLength(len) {
  if (len <= 1) return 1;
  if (len <= 2) return 1;
  if (len <= 4) return 2;
  if (len <= 6) return 3;
  if (len <= 8) return 4;
  return Math.ceil(len * 0.45);
}

/**
 * Formats text with Bionic Reading (bolding initial letters of words)
 * Safely preserves HTML entities, tags, quotes, and punctuation.
 */
export function applyBionicReading(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return '';
  return htmlText.replace(/(<[^>]+>|&[a-zA-Z0-9#]+;)|([\p{L}\p{N}]+)/gu, (match, tagOrEntity, word) => {
    if (tagOrEntity) return tagOrEntity;
    const fixLen = getBionicFixationLength(word.length);
    const head = word.slice(0, fixLen);
    const tail = word.slice(fixLen);
    return `<b class="bionic-fix">${head}</b>${tail}`;
  });
}

/**
 * Calculates Optimal Recognition Point (ORP) index for RSVP speed reading.
 * Pinpoints the letter where the human eye naturally anchors when scanning words.
 */
export function calculateOrpIndex(word) {
  if (!word || typeof word !== 'string') return 0;
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/**
 * Decomposes a word token into { left, orp, right } parts for centered RSVP alignment.
 */
export function splitWordForRsvp(token) {
  if (!token || typeof token !== 'string') return { left: '', orp: '', right: '' };

  const leadMatch = token.match(/^([—–―"“«(]*\s*)(.*)$/);
  const leading = leadMatch ? leadMatch[1] : '';
  const rest = leadMatch ? leadMatch[2] : token;

  const trailMatch = rest.match(/^(.*?)([.,!?;:…"”»)]*)$/);
  const core = trailMatch ? trailMatch[1] : rest;
  const trailing = trailMatch ? trailMatch[2] : '';

  if (!core) {
    return { left: leading, orp: '', right: trailing };
  }

  const orpIdx = calculateOrpIndex(core);
  const left = leading + core.slice(0, orpIdx);
  const orp = core.charAt(orpIdx);
  const right = core.slice(orpIdx + 1) + trailing;

  return { left, orp, right };
}

/**
 * Extracts clean word tokens from book text for RSVP speed reading.
 * Attaches dialogue dashes to subsequent speech and cleans headers.
 */
export function extractWordsForRsvp(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text
    .replace(/^\s*\d+\s*[|•-]\s*.*$/gm, '')
    .trim();

  const raw = cleaned.split(/\s+/).filter(Boolean);
  const words = [];

  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (/^[—–―-]$/.test(w) && i + 1 < raw.length) {
      i++;
      words.push(`${w} ${raw[i]}`);
    } else {
      words.push(w);
    }
  }

  return words;
}

/**
 * Formats book paragraphs and dialogs with authentic novel typography.
 * - Merges end-of-line hyphens (matbaa heceleme çizgisi) so words are whole.
 * - Never confuses end-of-line hyphens or lowercase continuations with dialogue dashes.
 * - Groups wrapped lines into full narrative paragraphs.
 * - Formats genuine dialogues with em-dashes and hanging indents.
 * - Wraps every sentence in a clickable .reader-sentence target for tap-to-read TTS.
 * - Supports Bionic Reading (Biyonik Okuma) fixation point highlighting.
 */
export function formatBookHtml(paragraphsOrText, options = {}, appSettings = {}) {
  const isEnabled = options.enabled !== false;
  const shouldMergeHyphens = options.mergeHyphens !== false &&
    (appSettings.mergeHyphenatedWords !== false);
  const isBionic = Boolean(options.bionicReading ?? appSettings.bionicReading);

  if (!paragraphsOrText) return '';

  let rawList = [];
  if (Array.isArray(paragraphsOrText)) {
    rawList = paragraphsOrText;
  } else if (typeof paragraphsOrText === 'string') {
    rawList = paragraphsOrText.split(/\r?\n\n+/);
  } else {
    return '';
  }

  // Pre-process 1: ALWAYS heal spaced letters and normalize hyphens across blocks
  rawList = rawList.map(p => (typeof p === 'string' ? normalizeHyphensAndText(p, { mergeHyphens: shouldMergeHyphens }) : p));

  // Pre-process 2: Reconstruct accidental paragraph breaks caused by line heights or wrapped hyphens
  rawList = mergeAccidentalParagraphSplits(rawList);

  let sentenceCounter = 0;

  function renderSentencesHtml(rawParagraphText) {
    const sentences = splitIntoSentences(rawParagraphText);
    if (sentences.length === 0) return '';
    return sentences.map(sentence => {
      const idx = sentenceCounter++;
      let formatted = formatInlineQuotes(escapeBookHtml(sentence));
      if (isBionic) {
        formatted = applyBionicReading(formatted);
      }
      return `<span class="reader-sentence" data-sentence-idx="${idx}">${formatted}</span>`;
    }).join(' ');
  }

  // If disabled, render plain paragraphs without novel styling
  if (!isEnabled) {
    return rawList
      .map(p => (typeof p === 'string' ? fixSpacedOutLetters(p).trim() : ''))
      .filter(Boolean)
      .map(p => `<p class="reader-paragraph">${renderSentencesHtml(p)}</p>`)
      .join('');
  }

  // 1. Smart Paragraph & Dialogue Segmenter
  const segmentedParagraphs = [];

  for (const block of rawList) {
    if (!block || typeof block !== 'string') continue;
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Split on explicit line breaks within the block
    const rawLines = trimmedBlock.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) continue;

    let currentSegment = '';
    let currentIsDialogue = false;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lineIsDialogue = isDialogueTurn(line);

      if (currentSegment === '') {
        currentSegment = line;
        currentIsDialogue = lineIsDialogue;
      } else {
        // Line-end hyphen check
        const hyphenMatch = currentSegment.match(/([a-zçğıöşüA-ZÇĞİÖŞÜ0-9]+)(['’]?)[-–—]$/u);
        if (hyphenMatch) {
          const baseWord = hyphenMatch[1];
          const apostrophe = hyphenMatch[2] || '';
          const prefix = currentSegment.slice(0, hyphenMatch.index);
          const nextWordMatch = line.match(/^([a-zçğıöşüA-ZÇĞİÖŞÜ0-9']+)(.*)$/su);
          if (nextWordMatch) {
            const nextWord = nextWordMatch[1];
            const rest = nextWordMatch[2];
            if (/^[a-zçğıöşü]/u.test(nextWord)) {
              currentSegment = `${prefix}${baseWord}${apostrophe}${nextWord}${rest}`;
              continue;
            } else {
              currentSegment = `${prefix}${baseWord}${apostrophe}-${nextWord}${rest}`;
              continue;
            }
          }
        }

        if (lineIsDialogue) {
          // New speaker dialogue turn starts! Flush previous segment
          segmentedParagraphs.push(currentSegment);
          currentSegment = line;
          currentIsDialogue = true;
        } else if (currentIsDialogue) {
          const prevEndsSentence = /[.!?…]["”»]?$/.test(currentSegment.trim());
          const nextStartsWithCap = /^[A-ZÇĞİÖŞÜ]/.test(line);

          if (prevEndsSentence && nextStartsWithCap) {
            segmentedParagraphs.push(currentSegment);
            currentSegment = line;
            currentIsDialogue = false;
          } else {
            // Continuation of speech wrapped across lines
            currentSegment += ' ' + line;
          }
        } else {
          // Previous segment is narrative. Current line is also narrative.
          // In book pages/PDFs, sentences within the same paragraph wrap across lines.
          currentSegment += ' ' + line;
        }
      }
    }

    if (currentSegment) {
      segmentedParagraphs.push(currentSegment);
    }
  }

  // Clean and merge any remaining accidental splits
  const cleanSegmented = mergeAccidentalParagraphSplits(segmentedParagraphs);

  // 2. Mid-sentence dialogue splitting:
  // When a narrative sentence completes (.!?…) and is followed on the same line
  // by a genuine dialogue dash (— or - ) + Capital letter:
  // e.g. "Yaşlı adam duraksadı. — Artık vakit geldi, dedi fısıltıyla."
  const finalSegments = [];
  for (const seg of cleanSegmented) {
    const parts = seg.split(/(?<=[.!?…]["”»]?)\s+(?=[—–―]\s*[A-ZÇĞİÖŞÜ0-9"“«]|-\s+[A-ZÇĞİÖŞÜ0-9"“«])/);
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart) finalSegments.push(trimmedPart);
    }
  }

  if (finalSegments.length === 0) {
    return '';
  }

  // 3. Render each segment with authentic typography and sentence targets
  return finalSegments.map(rawP => {
    const p = fixSpacedOutLetters(rawP);
    const isDashDialogue = isDialogueTurn(p) && (/^[—–―]/.test(p) || /^-\s+/.test(p));
    const isQuoteDialogue = isDialogueTurn(p) && /^[“"«]/.test(p);

    if (isDashDialogue) {
      // Strip leading dash & space cleanly
      const speechBody = p.replace(/^[—–―]\s*|^-\s+/, '').trim();
      const formattedBody = renderSentencesHtml(speechBody);
      return `<p class="reader-paragraph reader-dialogue"><span class="dialogue-dash" aria-hidden="true">—</span><span class="dialogue-text">${formattedBody}</span></p>`;
    }

    if (isQuoteDialogue) {
      const formattedBody = renderSentencesHtml(p);
      return `<p class="reader-paragraph reader-dialogue reader-quote-speech">${formattedBody}</p>`;
    }

    // Standard narrative prose
    const formattedBody = renderSentencesHtml(p);
    return `<p class="reader-paragraph reader-narrative">${formattedBody}</p>`;
  }).join('');
}
