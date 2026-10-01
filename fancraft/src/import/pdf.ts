import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { textUnits, type ImportedImage, type Unit } from '../model/chapters';
import { IMAGE_MARK, imageMark, pdfLinesToText } from './pdfText';

// Картинка, що трапляється на стількох сторінках (лого, фон), — оформлення, не ілюстрація.
const REPEATED_IMAGE_PAGES = 3;

// Об'єкт картинки pdf.js: готовий bitmap або сирі пікселі (kind: 1 — 1 біт на піксель, 2 — RGB, 3 — RGBA).
interface PdfImage { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8Array | Uint8ClampedArray; kind?: number }

const objectOf = (page: pdfjs.PDFPageProxy, id: string): Promise<PdfImage | null> =>
  new Promise((resolve) => {
    const objs = id.startsWith('g_') ? page.commonObjs : page.objs;
    try { objs.get(id, (img: PdfImage | null) => resolve(img)); } catch { resolve(null); }
    // Об'єкт так і не прийшов — без картинки, текст імпортується все одно.
    setTimeout(() => resolve(null), 3000);
  });

// Пікселі картинки PDF → PNG. Не вдалося — null (картинку пропускаємо).
async function toPng(img: PdfImage): Promise<ImportedImage | null> {
  const { width, height } = img;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const out = ctx.createImageData(width, height);
    const src = img.data;
    if (img.kind === 3) out.data.set(src.subarray(0, width * height * 4));
    else if (img.kind === 2) {
      for (let i = 0, j = 0; i < width * height; i++, j += 3) out.data.set([src[j], src[j + 1], src[j + 2], 255], i * 4);
    } else if (img.kind === 1) {
      const row = (width + 7) >> 3;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const v = src[y * row + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
        out.data.set([v, v, v, 255], (y * width + x) * 4);
      }
    } else return null;
    ctx.putImageData(out, 0, 0);
  } else return null;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/png' } : null;
}

// Текст PDF рядками по сторінках (pdf.js), далі — прибирання й звичайний шлях .txt. Картинки сторінки —
// після її тексту: у текст ставиться мітка, яку потім заміняє одиниця-картинка. Витягти картинку не
// вдалося — просто без неї.
export async function readPdfUnits(bytes: Uint8Array): Promise<Unit[]> {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  const pages: string[][] = [];
  const found: { page: number; id: string; img: PdfImage }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    try {
      const ops = await page.getOperatorList();
      for (let k = 0; k < ops.fnArray.length; k++) {
        const fn = ops.fnArray[k];
        if (fn === pdfjs.OPS.paintImageXObject) {
          const id = ops.argsArray[k][0] as string;
          const img = await objectOf(page, id);
          if (img) found.push({ page: n, id, img });
        } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
          found.push({ page: n, id: `inline:${n}:${k}`, img: ops.argsArray[k][0] as PdfImage });
        }
      }
    } catch { /* картинки цієї сторінки — ні, текст — так */ }
    pages.push(lines);
  }

  // Оформлення (одна картинка на багатьох сторінках) — геть.
  const onPages = new Map<string, Set<number>>();
  for (const f of found) onPages.set(f.id, (onPages.get(f.id) ?? new Set()).add(f.page));
  const images: ImportedImage[] = [];
  const seen = new Set<string>();
  for (const f of found) {
    if (seen.has(f.id) || onPages.get(f.id)!.size >= REPEATED_IMAGE_PAGES) continue;
    seen.add(f.id);
    const png = await toPng(f.img).catch(() => null);
    if (!png) continue;
    pages[f.page - 1].push(imageMark(images.length));
    images.push(png);
  }
  await task.destroy();

  return textUnits(pdfLinesToText(pages)).map((u) => {
    const m = IMAGE_MARK.exec(u.runs[0]?.text ?? '');
    return m ? { runs: [], image: images[Number(m[1])] } : u;
  });
}
