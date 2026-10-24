// Image Pre-processing and Enhancement Service
// Enhances book photos and document scans to maximize OCR accuracy

/**
 * Load image from File or Blob or URL into an HTMLImageElement
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Görsel yüklenemedi'));
    if (typeof src === 'string') {
      img.src = src;
    } else if (src instanceof Blob || src instanceof File) {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Convert a File or Blob to Base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Process image with rotation, contrast, brightness, and grayscale filters
 * Returns a high-res base64 data URL
 */
export async function processImage({
  imageSource, // HTMLImageElement or dataURL
  rotation = 0, // 0, 90, 180, 270
  contrast = 1.0, // 0.5 to 2.5
  brightness = 1.0, // 0.5 to 1.5
  grayscale = false,
  binarize = false, // High contrast black & white document mode
  maxDimension = 2048 // Keep under 2048 for optimal AI vision speed
}) {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Scale down if image is overwhelmingly large (e.g. 48MP phone photo)
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  const isRotated90or270 = rotation % 180 !== 0;

  canvas.width = isRotated90or270 ? height : width;
  canvas.height = isRotated90or270 ? width : height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas bağlamı alınamadı');

  ctx.save();

  // Apply rotation
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();

  // If contrast, brightness, grayscale, or binarize is applied
  if (contrast !== 1.0 || brightness !== 1.0 || grayscale || binarize) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    // Contrast factor
    const cFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Grayscale calculation (luminance)
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (binarize) {
        // High contrast document threshold
        const threshold = 145 * brightness;
        const v = gray > threshold ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      } else if (grayscale) {
        let v = gray * brightness;
        v = cFactor * (v - 128) + 128;
        v = Math.min(255, Math.max(0, v));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      } else {
        // Brightness & contrast in color
        r = cFactor * (r * brightness - 128) + 128;
        g = cFactor * (g * brightness - 128) + 128;
        b = cFactor * (b * brightness - 128) + 128;
        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate a small thumbnail from image or canvas
 */
export function createThumbnail(canvasOrImg, maxEdge = 160) {
  const canvas = document.createElement('canvas');
  let w = canvasOrImg.width || canvasOrImg.naturalWidth;
  let h = canvasOrImg.height || canvasOrImg.naturalHeight;

  if (w > h) {
    h = Math.round((h * maxEdge) / w);
    w = maxEdge;
  } else {
    w = Math.round((w * maxEdge) / h);
    h = maxEdge;
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(canvasOrImg, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}
