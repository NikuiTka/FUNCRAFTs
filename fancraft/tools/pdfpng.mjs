// Інструмент розробки: node tools/pdfpng.mjs файл.pdf від до масштаб вихід.png — сторінки PDF поруч в одній картинці.
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [file, from = '1', to = from, scale = '1', out = 'pages.png'] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), disableFontFace: true }).promise;
const pages = [];
for (let n = Number(from); n <= Math.min(Number(to), doc.numPages); n++) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: Number(scale) });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  pages.push(canvas);
}
const gap = 12;
const sheet = createCanvas(pages.reduce((w, c) => w + c.width + gap, gap), Math.max(...pages.map((c) => c.height)) + 2 * gap);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#888';
ctx.fillRect(0, 0, sheet.width, sheet.height);
let x = gap;
for (const c of pages) { ctx.drawImage(c, x, gap); x += c.width + gap; }
writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`${out}: ${pages.length} стор.`);
