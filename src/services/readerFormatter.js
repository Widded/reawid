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
 * Formats book paragraphs and dialogs with authentic novel typography.
 * - Merges end-of-line hyphens (matbaa heceleme çizgisi) so words are whole.
 * - Never confuses end-of-line hyphens or lowercase continuations with dialogue dashes.
 * - Groups wrapped lines into full narrative paragraphs.
 * - Formats genuine dialogues with em-dashes and hanging indents.
 */
export function formatBookHtml(paragraphsOrText, options = {}, appSettings = {}) {
  const isEnabled = options.enabled !== false;
  const shouldMergeHyphens = options.mergeHyphens !== false &&
    (appSettings.mergeHyphenatedWords !== false);

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

  // If disabled, render plain paragraphs without novel styling
  if (!isEnabled) {
    return rawList
      .map(p => (typeof p === 'string' ? fixSpacedOutLetters(p).trim() : ''))
      .filter(Boolean)
      .map(p => `<p class="reader-paragraph">${escapeBookHtml(p)}</p>`)
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

  // 3. Render each segment with authentic typography
  return finalSegments.map(rawP => {
    const p = fixSpacedOutLetters(rawP);
    const isDashDialogue = isDialogueTurn(p) && (/^[—–―]/.test(p) || /^-\s+/.test(p));
    const isQuoteDialogue = isDialogueTurn(p) && /^[“"«]/.test(p);

    if (isDashDialogue) {
      // Strip leading dash & space cleanly
      const speechBody = p.replace(/^[—–―]\s*|^-\s+/, '').trim();
      const formattedBody = formatInlineQuotes(escapeBookHtml(speechBody));
      return `<p class="reader-paragraph reader-dialogue"><span class="dialogue-dash" aria-hidden="true">—</span><span class="dialogue-text">${formattedBody}</span></p>`;
    }

    if (isQuoteDialogue) {
      const formattedBody = formatInlineQuotes(escapeBookHtml(p));
      return `<p class="reader-paragraph reader-dialogue reader-quote-speech">${formattedBody}</p>`;
    }

    // Standard narrative prose
    const formattedBody = formatInlineQuotes(escapeBookHtml(p));
    return `<p class="reader-paragraph reader-narrative">${formattedBody}</p>`;
  }).join('');
}
