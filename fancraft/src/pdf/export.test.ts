import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Block, Project } from '../model/types';
import { exportBook, type ExportOptions } from './export';
import { EMOJI_FONT_FILE, FACES, FONT_FILES, padFont, type FontFaces } from './fonts';

const fonts = Object.fromEntries(
  FACES.map((f) => [f, padFont(new Uint8Array(readFileSync(resolve('node_modules', FONT_FILES[f]))))]),
) as FontFaces;

const chapter = (i: number): Block => ({
  id: `c${i}`, type: 'chapter', title: `Глава ${i}`, body: [{ type: 'paragraph', runs: [{ text: 'Текст. '.repeat(50) }] }],
});
const project = (blocks: Block[]): Project => ({
  book: {
    version: 1,
    meta: { title: 'Книжка', author: '', year: '' },
    settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 3 },
    blocks,
    template: { titlePage: { qr: null } },
    assets: {},
  },
  files: {},
});
const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({
  draft: false, mode: 'duplex', reverseBacks: false, rotateBacks: false, splitColor: false, ...o,
});

describe('exportBook', () => {
  it('дуплекс: book.pdf — альбомні аркуші A4, лице й зворот; плюс book.txt', async () => {
    const { files, stats } = await exportBook(project([chapter(1), chapter(2)]), fonts, opts());
    expect(files.map((f) => f.name)).toEqual(['book.pdf', 'book.txt']);
    const pdf = await PDFDocument.load(files[0].bytes);
    expect(pdf.getPageCount()).toBe(stats.sheets * 2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo((297 * 72) / 25.4, 3);
    expect(height).toBeCloseTo((210 * 72) / 25.4, 3);
    expect(new TextDecoder().decode(files[1].bytes)).toContain('# Глава 2');
  });

  it('глава без назви й без тексту — порожнє місце під назву не ламає експорт', async () => {
    const empty: Block = { id: 'e', type: 'chapter', title: '', body: [] };
    const { files } = await exportBook(project([chapter(1), empty]), fonts, opts());
    expect((await PDFDocument.load(files[0].bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it('IBM Plex Mono: пробіли й порожні гліфи в кінці файлу шрифту не ламають експорт', async () => {
    const { files } = await exportBook(project([chapter(1)]), fonts, opts({ assembly: true }));
    expect(files.map((f) => f.name)).toContain('book.pdf');
  });

  it('емодзі друкуються шрифтом Noto Emoji; без емодзі він у PDF не потрапляє', async () => {
    const withEmoji = { ...fonts, emoji: padFont(new Uint8Array(readFileSync(resolve('node_modules', EMOJI_FONT_FILE)))) };
    const fontNames = async (bytes: Uint8Array) => {
      const pdf = await PDFDocument.load(bytes);
      return pdf.context.enumerateIndirectObjects().map(([, o]) => o.toString()).filter((s) => s.includes('/FontFile2')).join(' ');
    };
    const p = project([{ id: 'c', type: 'chapter', title: '❤ Передмова', body: [{ type: 'paragraph', runs: [{ text: 'Текст 👍🏽 і 🇺🇦.' }] }] }]);
    const draft = await exportBook(p, withEmoji, opts({ draft: true }));
    expect(await fontNames(draft.files[0].bytes)).toContain('NotoEmoji');
    const plain = await exportBook(project([chapter(1)]), withEmoji, opts({ draft: true }));
    expect(await fontNames(plain.files[0].bytes)).not.toContain('NotoEmoji');
  });

  it('чернетка: сторінки в порядку читання, без спуску', async () => {
    const { files, stats } = await exportBook(project([chapter(1)]), fonts, opts({ draft: true }));
    expect(files[0].name).toBe('book-draft.pdf');
    expect((await PDFDocument.load(files[0].bytes)).getPageCount()).toBe(stats.pages);
  });

  it('понад 10 зошитів — експорт іде, а книжка отримує попередження', async () => {
    // 130 глав з правих сторінок ≈ 260 сторінок = 22 зошити по 3 аркуші.
    const blocks = Array.from({ length: 130 }, (_, i) => chapter(i + 1));
    const { files, stats, warnings } = await exportBook(project(blocks), fonts, opts());
    expect(files.map((f) => f.name)).toContain('book.pdf');
    expect(warnings).toEqual([{ code: 'tooManySignatures', count: stats.plan.length, limit: 10 }]);
  });

  it('ілюстрація без зображення й відсутній файл фото обкладинки — попередження, файли все одно готові', async () => {
    const p = project([chapter(1), { id: 'p', type: 'plate', asset: '', title: 'Причал', caption: '', side: 'auto' }]);
    // Розміри фото відомі, а самого файлу немає.
    p.book.template.titlePage.photo = 'img/img_001.jpg';
    p.book.assets['img/img_001.jpg'] = { widthPx: 1200, heightPx: 800 };
    const { files, warnings } = await exportBook(p, fonts, opts());
    expect(files.map((f) => f.name)).toContain('book.pdf');
    expect(warnings).toEqual([{ code: 'plateWithoutImage', title: 'Причал' }, { code: 'missingImage', path: 'img/img_001.jpg' }]);
  });
});
