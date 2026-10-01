import { IMAGE_JPEG_QUALITY, IMAGE_MAX_WIDTH_PX } from '../config';
import { AppError } from '../model/errors';

export interface ImportedImage {
  bytes: Uint8Array;
  ext: 'jpg' | 'png';
  widthPx: number;
  heightPx: number;
}

// Єдина обробка зображень: ширші за IMAGE_MAX_WIDTH_PX зменшуються (JPEG, якість з конфігу).
// JPEG і PNG у межах ширини кладуться байт у байт. Інші формати PDF не приймає — їх перекодовуємо в JPEG.
export async function importImage(file: File): Promise<ImportedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const native = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : null;

  if (native && width <= IMAGE_MAX_WIDTH_PX) {
    bitmap.close();
    return { bytes: new Uint8Array(await file.arrayBuffer()), ext: native, widthPx: width, heightPx: height };
  }

  const scale = Math.min(1, IMAGE_MAX_WIDTH_PX / width);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError({ code: 'imageResize' }))), 'image/jpeg', IMAGE_JPEG_QUALITY));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'jpg', widthPx: w, heightPx: h };
}
