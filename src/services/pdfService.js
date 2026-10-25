// PDF Handling and Rendering Service using PDF.js
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { normalizeHyphensAndText, mergeAccidentalParagraphSplits } from './aiService.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Load PDF document from a File or ArrayBuffer
 */
export async function loadPdf(fileOrBuffer) {
  let data;
  if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    data = await fileOrBuffer.arrayBuffer();
  } else {
    data = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true
  });

  const pdfDoc = await loadingTask.promise;
  return {
    numPages: pdfDoc.numPages,
    pdfDoc
  };
}

/**
 * Render a single PDF page onto an HTML5 canvas at high DPI
 */
export async function renderPdfPageToCanvas(pdfDoc, pageNumber, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;
  return canvas;
}

/**
 * Render PDF page directly to base64 JPEG
 */
export async function renderPdfPageToBase64(pdfDoc, pageNumber, scale = 2.0) {
  const canvas = await renderPdfPageToCanvas(pdfDoc, pageNumber, scale);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate lightweight page thumbnails for PDF page selector
 */
export async function renderPdfThumbnails(pdfDoc, onThumbnailReady) {
  const numPages = pdfDoc.numPages;
  for (let i = 1; i <= numPages; i++) {
    const canvas = await renderPdfPageToCanvas(pdfDoc, i, 0.4);
    const thumbData = canvas.toDataURL('image/jpeg', 0.7);
    if (onThumbnailReady) {
      onThumbnailReady({ pageNum: i, thumbnail: thumbData, totalPages: numPages });
    }
  }
}

/**
 * Fast extract embedded text content from a PDF page (10-20ms)
 */
export async function extractPdfPageText(pdfDoc, pageNumber) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let lastY = null;
    let lastX = null;
    let lastWidth = 0;
    let text = '';

    for (const item of textContent.items) {
      if (!item.str) continue;
      const currentX = item.transform ? item.transform[4] : null;
      const currentY = item.transform ? item.transform[5] : null;
      const itemWidth = item.width || 0;

      if (lastY !== null && currentY !== null) {
        const deltaY = Math.abs(currentY - lastY);
        const fontSize = Math.max(9, Math.abs(item.height || (item.transform ? item.transform[3] : 12)));

        if (deltaY > Math.max(26, fontSize * 1.85)) {
          // Gerçek paragraf boşluğu
          if (!text.endsWith('\n\n')) text += '\n\n';
        } else if (deltaY > 3.5) {
          // Aynı paragraf içi satır sonu
          if (!text.endsWith('\n')) text += '\n';
        } else if (lastX !== null && currentX !== null) {
          // Aynı satır: Öğeler arasındaki yatay mesafeyi hesapla
          const gap = currentX - (lastX + lastWidth);
          const fontSize = Math.max(9, Math.abs(item.height || (item.transform ? item.transform[3] : 12)));
          const avgCharWidth = itemWidth > 0 ? (itemWidth / Math.max(1, item.str.length)) : (fontSize * 0.45);

          // İki bitişik öğe tek harf ise (ayrık glif dizilimi) veya ek glifi ise, kelime boşluğu için net aralık gerekir
          const isSingleCharTransition = (item.str.trim().length === 1 && text.trim().slice(-1).length === 1);
          const isSuffixGlyph = /^(z|n|m|k|t|nı|ni|nu|nü|nda|nde|ndan|nden|yor|yordu|nlık|nlik|nluk|nlük|lık|lik|luk|lük|sız|siz|suz|süz)$/i.test(item.str.trim());
          const minWordGap = (isSingleCharTransition || isSuffixGlyph)
            ? Math.max(5.2, fontSize * 0.44)
            : Math.max(3.6, Math.min(fontSize * 0.30, avgCharWidth * 0.52));

          if (gap >= minWordGap && !text.endsWith(' ') && !item.str.startsWith(' ')) {
            text += ' ';
          }
        }
      }

      text += item.str;
      lastX = currentX;
      lastY = currentY;
      lastWidth = itemWidth;
    }

    let clean = text.trim();
    if (clean.length > 25) {
      // Satır sonu kesme ve heceleme tirelerini birleştir
      clean = normalizeHyphensAndText(clean);

      // Türkçe Karakter Bütünlüğü Kontrolü:
      // Taranmış PDF'lerin arka planında eski/hatalı OCR katmanları ("degil", "icin", "oldugu", "birkac")
      // bulunabilir. Eğer Türkçe kelimeler olmasına rağmen özel Türkçe harfler (ç, ğ, ı, ö, ş, ü) yoksa,
      // bu hatalı katmanı reddet ve yüksek kaliteli Vision AI OCR'a yönlendir!
      const turkishKeywordRegex = /\b(degil|icin|cunku|oldugu|birkac|simdi|sey|kucuk|buyuk|hicbir|yagmur|dogru|goster|sag|dusun|kitap|yazik|yapil|gore|birlikte)\b/i;
      const turkishSpecificCount = (clean.match(/[çğışöüÇĞİÖŞÜ]/g) || []).length;

      if (turkishKeywordRegex.test(clean) && turkishSpecificCount < 2) {
        console.warn(`[PDF Engine] Sayfa ${pageNumber} gömülü metninde Türkçe karakter kaybı tespit edildi (eski/bozuk OCR katmanı). Vision AI ile taranıyor.`);
        return null;
      }

      const rawParagraphs = clean
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      const paragraphs = mergeAccidentalParagraphSplits(rawParagraphs);
      if (paragraphs.length > 0) return paragraphs;
      return [clean];
    }
  } catch (err) {
    console.warn(`Sayfa ${pageNumber} metin katmanı okunamadı:`, err);
  }
  return null;
}
