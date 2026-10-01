import { describe, expect, it } from 'vitest';
import { paginate } from './book';
import type { Block, Book, Measure, Page, Pt } from '../model/types';
import { TITLE_BASE } from './testGrid';

const measure: Measure = (text, face, size) =>
  (text.length * size * (face === 'bold' || face === 'boldItalic' ? 0.6 : 0.5)) as Pt;

const book = (blocks: Block[]): Book => ({
  version: 1,
  meta: { title: 'Книжка', author: '', year: '' },
  settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 },
  blocks,
  template: { titlePage: { qr: null } },
  assets: {},
});

const toc: Block = { id: 'toc', type: 'toc', title: 'Зміст' };
const chapter = (title: string): Block => ({
  id: title || 'c', type: 'chapter', title, body: [{ type: 'paragraph', runs: [{ text: 'Текст.' }] }],
});

const text = (runs: { text: string }[]) => runs.map((r) => r.text).join('');
// Пари «назва → номер» з рядків змісту: номер — рядок align: right у тому ж row.
const entries = (pages: Page[]) =>
  pages.filter((p) => p.kind === 'toc').flatMap((p) =>
    p.lines.filter((l) => l.align === 'right').map((num) => {
      const title = p.lines.find((l) => l.row === num.row && l.align !== 'right')!;
      return [text(title.runs), Number(text(num.runs))];
    }));

describe('зміст', () => {
  it('з правої сторінки; номери — там, де глави справді починаються', () => {
    // титул 1 · порожня 2 · зміст 3 · Перша 4 · Друга 5 · колофон 6
    const pages = paginate(book([toc, chapter('Перша'), chapter('Друга')]), measure);
    expect(pages.map((p) => p.kind)).toEqual(['title', 'blank', 'toc', 'chapter', 'chapter', 'colophon']);
    expect(entries(pages)).toEqual([['Перша', 4], ['Друга', 5]]);
  });

  it('частини — у змісті жирним, з номером своєї сторінки, з порожнім рядком перед ними', () => {
    const part = (title: string): Block => ({ id: title, type: 'part', title, description: '', asset: '' });
    // титул 1 · порожня 2 · зміст 3 · порожня 4 · І 5 · Перша 6 · ІІ 7 · Друга 8
    const pages = paginate(book([toc, part('Частина І'), chapter('Перша'), part('Частина ІІ'), chapter('Друга')]), measure);
    expect(entries(pages)).toEqual([['Частина І', 5], ['Перша', 6], ['Частина ІІ', 7], ['Друга', 8]]);
    const lines = pages.find((p) => p.kind === 'toc')!.lines.filter((l) => l.role === 'body');
    const rowOf = (t: string) => lines.find((l) => text(l.runs) === t)!.row;
    expect(lines.filter((l) => l.runs.some((r) => r.b)).map((l) => text(l.runs))).toEqual(['Частина І', '5', 'Частина ІІ', '7']);
    expect(rowOf('Перша') - rowOf('Частина І')).toBe(1);
    expect(rowOf('Частина ІІ') - rowOf('Перша')).toBe(2);
  });

  it('глави без назви до змісту не йдуть', () => {
    const pages = paginate(book([toc, chapter('Перша'), chapter(''), chapter('Друга')]), measure);
    expect(entries(pages).map(([t]) => t)).toEqual(['Перша', 'Друга']);
  });

  it('назва змісту — як назва глави; колонцифри на першій сторінці немає', () => {
    const [page] = paginate(book([toc, chapter('Перша')]), measure).filter((p) => p.kind === 'toc');
    expect(page.lines[0]).toMatchObject({ role: 'chapterTitle', row: TITLE_BASE });
    expect(page.folio).toBe(false);
  });

  it('довгий зміст на дві сторінки — номери все одно правильні', () => {
    // 40 глав: зміст — 2 сторінки (3 і 4), далі глави підряд: 5, 6, 7, … 44.
    const chapters = Array.from({ length: 40 }, (_, i) => chapter(`Глава ${i + 1}`));
    const pages = paginate(book([toc, ...chapters]), measure);
    expect(pages.filter((p) => p.kind === 'toc')).toHaveLength(2);
    const found = entries(pages);
    expect(found).toHaveLength(40);
    found.forEach(([title, num]) => {
      expect(pages[(num as number) - 1]).toMatchObject({ kind: 'chapter' });
      expect(pages[(num as number) - 1].lines[0].runs[0].text).toBe(title);
    });
  });

  it('зміст після глав — теж правильні номери', () => {
    const pages = paginate(book([chapter('Перша'), toc]), measure);
    expect(entries(pages)).toEqual([['Перша', 2]]);
  });
});
