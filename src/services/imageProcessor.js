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

/**
 * Professional OCR Preprocessor for Faint Text, Uneven Illumination & Low Contrast Pages
 * Features:
 * 1. Fast Integral-Image Adaptive Thresholding (Bradley-Roth algorithm)
 * 2. Percentile-based Auto-Levels & Contrast Stretching (eliminates background gray/shadows)
 * 3. Fallback High-Contrast Grayscale mode for two-pass OCR
 * Runs in ~15-40ms on standard 2K book canvas.
 */
export async function preprocessImageForOcr(imageSource, options = {}) {
  // If running in Node.js test environment without DOM document, return input safely
  if (typeof document === 'undefined') return imageSource;

  const mode = options.mode || 'adaptive_threshold'; // 'adaptive_threshold' | 'contrast_stretch'
  const windowRatio = options.windowRatio || 35; // Local neighborhood width divisor
  const deltaPercent = options.deltaPercent ?? 0.12; // Threshold offset factor (12% darker than local mean)

  let img;
  if (typeof imageSource === 'string') {
    img = await loadImage(imageSource);
  } else {
    img = imageSource;
  }

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) return imageSource;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return imageSource;

  ctx.drawImage(img, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const pixelCount = width * height;

  // 1. Grayscale & Histogram calculation
  const grays = new Uint8ClampedArray(pixelCount);
  const histogram = new Uint32Array(256);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const g = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    grays[j] = g;
    histogram[g]++;
  }

  // 2. Auto-Levels (Percentile-based Dynamic Contrast Stretching)
  // Maps 2nd percentile (darkest ink) to 0 and 98th percentile (lightest paper) to 255
  const lowThresholdCount = (pixelCount * 0.02) | 0;
  const highThresholdCount = (pixelCount * 0.98) | 0;

  let acc = 0;
  let minGray = 0;
  let maxGray = 255;

  for (let k = 0; k < 256; k++) {
    acc += histogram[k];
    if (acc >= lowThresholdCount && minGray === 0) {
      minGray = k;
    }
    if (acc >= highThresholdCount) {
      maxGray = k;
      break;
    }
  }

  if (maxGray <= minGray) {
    minGray = 0;
    maxGray = 255;
  }

  const range = maxGray - minGray;
  const scale = 255 / range;

  for (let j = 0; j < pixelCount; j++) {
    const val = grays[j];
    if (val <= minGray) {
      grays[j] = 0;
    } else if (val >= maxGray) {
      grays[j] = 255;
    } else {
      grays[j] = ((val - minGray) * scale) | 0;
    }
  }

  // If contrast-stretched grayscale mode is requested
  if (mode === 'contrast_stretch') {
    for (let j = 0, i = 0; j < pixelCount; j++, i += 4) {
      const v = grays[j];
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // 3. Fast Integral Image for Bradley-Roth Local Adaptive Thresholding
  const intW = width + 1;
  const intImg = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const yOffset = y * width;
    const intYOffset = (y + 1) * intW;
    const prevIntYOffset = y * intW;

    for (let x = 0; x < width; x++) {
      rowSum += grays[yOffset + x];
      intImg[intYOffset + (x + 1)] = intImg[prevIntYOffset + (x + 1)] + rowSum;
    }
  }

  // 4. Adaptive Thresholding Application
  const S = Math.max(12, Math.round(width / windowRatio));
  const sHalf = S >> 1;
  const T = 1 - deltaPercent;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - sHalf);
    const y2 = Math.min(height, y + sHalf);
    const yOffset = y * width;
    const intY1 = y1 * intW;
    const intY2 = y2 * intW;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - sHalf);
      const x2 = Math.min(width, x + sHalf);

      const count = (x2 - x1) * (y2 - y1);
      const sum = intImg[intY2 + x2] - intImg[intY1 + x2] - intImg[intY2 + x1] + intImg[intY1 + x1];
      const localMean = sum / count;

      const pixelIdx = yOffset + x;
      const pixelVal = grays[pixelIdx];

      // Pixel is ink if it is at least deltaPercent darker than local background
      const isInk = (pixelVal <= localMean * T);
      const v = isInk ? 0 : 255;

      const dataIdx = pixelIdx * 4;
      data[dataIdx] = v;
      data[dataIdx + 1] = v;
      data[dataIdx + 2] = v;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
