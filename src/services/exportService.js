// Export and Sharing Service
// Guarantees proper UTF-8 encoding without any Turkish character corruption

export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Kopyalama hatası:', err);
    return false;
  }
}

/**
 * Download text as TXT with UTF-8 BOM to prevent Notepad Turkish character corruption
 */
export function downloadTxt(text, filename = 'reawid_metin.txt') {
  if (!text) return;
  // Prepend \uFEFF BOM for guaranteed UTF-8 reading on Windows
  const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, filename);
}

/**
 * Download text as Markdown file (.md)
 */
export function downloadMarkdown(text, filename = 'reawid_belge.md') {
  if (!text) return;
  const blob = new Blob(['\uFEFF' + text], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename);
}

/**
 * Download as Microsoft Word compatible .doc
 */
export function downloadWordDoc(text, title = 'ReaWid OCR Belgesi', filename = 'reawid_dokuman.doc') {
  if (!text) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #111827; }
        h1 { font-size: 18pt; color: #1e1b4b; }
        h2 { font-size: 14pt; color: #312e81; }
        p { margin-bottom: 10pt; }
      </style>
    </head>
    <body>
      ${formatTextToHtml(text)}
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8' });
  triggerDownload(blob, filename);
}

/**
 * Print or Save as PDF
 */
export function printDocument(text, title = 'ReaWid OCR Belgesi') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
          color: #111827;
          line-height: 1.7;
          font-size: 12pt;
        }
        h1, h2, h3 { color: #1e1b4b; }
        p { margin-bottom: 1em; }
        @media print {
          body { max-width: 100%; margin: 0; padding: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <h2>${escapeHtml(title)}</h2>
      <hr style="border:0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <div>${formatTextToHtml(text)}</div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTextToHtml(text) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('# ')) {
      return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
    }
    if (trimmed.startsWith('## ')) {
      return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
    }
    return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}
