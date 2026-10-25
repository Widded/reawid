// PDF Handling and Rendering Service using PDF.js
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { normalizeHyphensAndText } from './aiService.js';

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
    let text = '';

    for (const item of textContent.items) {
      if (!item.str) continue;
      if (lastY !== null) {
        const deltaY = Math.abs(item.transform[5] - lastY);
        if (deltaY > 18) {
          text += '\n\n';
        } else if (deltaY > 5) {
          text += '\n';
        }
      }
      text += item.str + ' ';
      lastY = item.transform[5];
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

      const paragraphs = clean
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      if (paragraphs.length > 0) return paragraphs;
      return [clean];
    }
  } catch (err) {
    console.warn(`Sayfa ${pageNumber} metin katmanı okunamadı:`, err);
  }
  return null;
}
