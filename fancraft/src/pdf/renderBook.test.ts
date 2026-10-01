import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { paginate } from '../engine/book';
import { withSignatures } from '../engine/signatures';
import type { Warning } from '../model/errors';
import type { Book } from '../model/types';
import { createMeasure, FACES, FONT_FILES, padFont, type FontFaces } from './fonts';
import { renderBook } from './renderBook';

const fonts = Object.fromEntries(
  FACES.map((f) => [f, padFont(new Uint8Array(readFileSync(resolve('node_modules', FONT_FILES[f]))))]),
) as FontFaces;
const measure = createMeasure(fonts);

// PNG 1 × 1 піксель.
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

const book: Book = {
  version: 1,
  meta: { title: 'Книжка', author: 'Авторка', year: '2026' },
  settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 },
  blocks: [
    { id: 't', type: 'toc', title: 'Зміст' },
    {
      id: 'c', type: 'chapter', title: 'День перший', body: [
        { type: 'paragraph', runs: [{ text: 'Звичайний, ' }, { text: 'жирний', b: true }, { text: ', ' }, { text: 'курсив', i: true }, { text: ' і ' }, { text: 'закреслене', s: true }, { text: '. ' + 'Ґанок, їжак, єнот. '.repeat(40) }] },
        { type: 'paragraph', runs: [{ text: 'Акцент жирним', b: true }] },
        { type: 'paragraph', runs: [{ text: 'Ще текст. '.repeat(30) }] },
      ],
    },
    { id: 'p', type: 'plate', asset: 'img/img_001.png', title: 'Причал', caption: 'Ранок.', side: 'auto' },
    { id: 'q', type: 'questions', title: 'Що спитати', items: ['Чому?', 'Навіщо?'], url: 'https://example.com/book.txt', note: '' },
  ],
  template: { titlePage: { qr: null } },
  assets: { 'img/img_001.png': { widthPx: 1, heightPx: 1 } },
};
const files = { 'img/img_001.png': png };

describe('renderBook', () => {
  it('кожна сторінка книжки — сторінка PDF розміру A5 (половина A4)', async () => {
    const pages = paginate(book, measure);
    const pdf = await PDFDocument.load(await renderBook({ pages, settings: book.settings, fonts, files, plan: null }));
    expect(pdf.getPageCount()).toBe(pages.length);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo((148.5 * 72) / 25.4, 3);
    expect(height).toBeCloseTo((210 * 72) / 25.4, 3);
  });

  it('друк у фактичному розмірі: /PrintScaling /None', async () => {
    const pdf = await PDFDocument.load(await renderBook({ pages: paginate(book, measure), settings: book.settings, fonts, files, plan: null }));
    const prefs = pdf.catalog.lookup(PDFName.of('ViewerPreferences'));
    expect(String(prefs)).toContain('/PrintScaling /None');
  });

  it('з планом зошитів — рендериться без помилок', async () => {
    const { pages, plan } = withSignatures(paginate(book, measure), 5);
    const pdf = await PDFDocument.load(await renderBook({ pages, settings: book.settings, fonts, files, plan }));
    expect(pdf.getPageCount()).toBe(plan.reduce((s, n) => s + n * 4, 0));
  });

  it('немає файлу зображення — сторінка без нього й попередження, а не зупинка', async () => {
    const warnings: Warning[] = [];
    const pages = paginate(book, measure);
    const pdf = await PDFDocument.load(await renderBook({ pages, settings: book.settings, fonts, files: {}, plan: null, warnings }));
    expect(pdf.getPageCount()).toBe(pages.length);
    expect(warnings).toEqual([{ code: 'missingImage', path: 'img/img_001.png' }]);
  });
});
