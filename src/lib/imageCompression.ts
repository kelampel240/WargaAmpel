export interface CompressedImageResult {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

const SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxTargetBytes?: number } = {}
): Promise<CompressedImageResult> {
  if (!SUPPORTED_IMAGE_MIMES.has((file.type || '').toLowerCase()) && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    throw new Error('Format file harus berupa gambar JPG, PNG, atau WebP.');
  }

  const maxWidth = options.maxWidth ?? 1400;
  const maxHeight = options.maxHeight ?? 1050;
  const initialQuality = options.quality ?? 0.82;
  const maxTargetBytes = options.maxTargetBytes ?? 420 * 1024;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error('Gagal membaca gambar dari perangkat.'));
      imageEl.src = objectUrl;
    });

    const ratio = Math.min(1, maxWidth / (img.naturalWidth || maxWidth), maxHeight / (img.naturalHeight || maxHeight));
    const targetW = Math.max(1, Math.round((img.naturalWidth || maxWidth) * ratio));
    const targetH = Math.max(1, Math.round((img.naturalHeight || maxHeight) * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser tidak mendukung kompresi gambar.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Export sebagai JPEG agar kompatibel penuh dengan Google Drive & thumbnail GAS
    const mimeType = 'image/jpeg';
    let quality = initialQuality;
    let dataUrl = canvas.toDataURL(mimeType, quality);
    let compressedBytes = estimateBase64Bytes(dataUrl);

    while (compressedBytes > maxTargetBytes && quality > 0.45) {
      quality = Math.max(0.45, quality - 0.1);
      dataUrl = canvas.toDataURL(mimeType, quality);
      compressedBytes = estimateBase64Bytes(dataUrl);
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '_') || 'beranda_foto';

    return {
      fileName: `${baseName}.jpg`,
      mimeType,
      dataUrl,
      originalBytes: file.size,
      compressedBytes,
      width: targetW,
      height: targetH,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function estimateBase64Bytes(dataUrl: string): number {
  const idx = dataUrl.indexOf(',');
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}
