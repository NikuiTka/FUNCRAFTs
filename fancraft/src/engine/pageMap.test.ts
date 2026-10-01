import { describe, expect, it } from 'vitest';
import { paginate } from './book';
import { chapterLayouts, pagePreviews, sheetSequence } from './pageMap';
import type { Block, Book } from '../model/types';
import { AA_PER_LINE, L, ROWS, SPACE, SPACE_ROWS, TEXT_TOP, TITLE_ROWS, W, WIDE, WIDE_H, WIDE_W, measure } from './testGrid';

// Розміри — з конфігу (testGrid).
const book = (blocks: Block[]): Book => ({
  version: 1,
  meta: { title: '', author: '', year: '' },
  settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 },
  blocks,
  template: { titlePage: { qr: null } },
  assets: {},
});
const layouts = (b: Book) => chapterLayouts(paginate(b, measure), b);
const aa = (words: number) => ({ type: 'paragraph' as const, runs: [{ text: 'аа '.repeat(words).trim() }] });

describe('chapterLayouts', () => {
  it('глава з назвою: зона назви до TEXT_TOP, друга сторінка — з першого абзацу, що не вліз', () => {
    // Однорядкові абзаци через проміжок: на першій сторінці — з TEXT_TOP до низу.
    const step = 1 + SPACE;
    const n1 = Math.floor((ROWS - 1 - TEXT_TOP) / step + 1e-9) + 1;
    const body = Array.from({ length: n1 + 3 }, () => ({ type: 'paragraph' as const, runs: [{ text: 'Раз два три.' }] }));
    const b = book([{ id: 'c', type: 'chapter', title: 'Глава', body }]);
    expect(layouts(b)).toEqual({ c: { first: 2, pages: 2, lead: TEXT_TOP, titleRows: TITLE_ROWS, starts: [
      { number: 3, para: n1, offset: 0, blank: ROWS - 1 - (TEXT_TOP + (n1 - 1) * step) },
    ], holes: [] } });
  });

  it('зображення під назвою глави: по центру під назвою, текст — через рядок під ним', () => {
    const body = [{ type: 'paragraph' as const, runs: [{ text: 'Раз два три.' }] }];
    const b = { ...book([{ id: 'c', type: 'chapter', title: 'Глава', body, asset: 'img/img_001.jpg' }]), assets: { 'img/img_001.jpg': WIDE } };
    const pages = paginate(b, measure);
    const first = pages.find((p) => p.source === 'c')!;
    const text = Math.ceil(TEXT_TOP + WIDE_H / L - 1e-9) + 1;
    expect(first.figure).toMatchObject({ asset: 'img/img_001.jpg' });
    expect(first.figure!.x).toBeCloseTo((W - WIDE_W) / 2, 6);
    expect(first.figure!.y).toBeCloseTo(TEXT_TOP * L, 6);
    expect(first.lines.find((l) => l.para === 0)!.row).toBe(text);
    expect(chapterLayouts(pages, b).c.lead).toBe(text);
  });

  it('абзац посеред сторінки: зміщення — у знаках тексту абзацу, де починається перше слово сторінки', () => {
    // «аа » — 3 знаки; перша сторінка — під місцем назви (порожньої теж), друга — зі слова (ROWS − TEXT_TOP) × AA_PER_LINE.
    const b = book([{ id: 'c', type: 'chapter', title: '', body: [aa(AA_PER_LINE * (ROWS + 3))] }]);
    expect(layouts(b)).toEqual({ c: { first: 2, pages: 2, lead: TEXT_TOP, titleRows: TITLE_ROWS, starts: [{ number: 3, para: 0, offset: 3 * AA_PER_LINE * (ROWS - TEXT_TOP), blank: 0 }], holes: [] } });
  });

  it('рушій лишив порожні рядки внизу — blank', () => {
    // Після першого абзацу й проміжку вільно 2 рядки: другий абзац на 3 лишив би 1 → переходить цілим.
    const first = ROWS - TEXT_TOP - 2 - SPACE_ROWS;
    const b = book([{ id: 'c', type: 'chapter', title: '', body: [aa(AA_PER_LINE * first), aa(AA_PER_LINE * 2 + 1)] }]);
    expect(layouts(b).c.starts).toEqual([{ number: 3, para: 1, offset: 0, blank: ROWS - TEXT_TOP - first }]);
  });

  it('кілька пробілів і накреслення не збивають зміщення', () => {
    const words = Array.from({ length: 760 }, () => 'аа');
    const text = words.join('  ');
    const body = [{ type: 'paragraph' as const, runs: [{ text: text.slice(0, 10) }, { text: text.slice(10), b: true }] }];
    const b = book([{ id: 'c', type: 'chapter', title: '', body }]);
    const start = layouts(b).c.starts[0];
    expect(text.slice(start.offset, start.offset + 2)).toBe('аа');
    expect(text.slice(0, start.offset).trim().split(/\s+/).length).toBeGreaterThan(0);
  });

  it('обтікання: ілюстрація посеред глави — дірка в шматку глави й у розкладці, решта сторінок на місцях', () => {
    const body = Array.from({ length: 60 }, () => ({ type: 'paragraph' as const, runs: [{ text: 'Рядок тексту глави. '.repeat(6) }] }));
    const b = { ...book([
      { id: 'c', type: 'chapter', title: 'Глава', body },
      { id: 'i', type: 'plate', asset: 'img/a.jpg', title: '', caption: '', side: 'auto' },
    ]), assets: { 'img/a.jpg': WIDE } };
    const pages = paginate(b, measure);
    const hole = pages.find((p) => p.source === 'i')!.number;
    const item = sheetSequence(pages).find((s) => s.kind === 'chapter')!;
    expect(item).toMatchObject({ kind: 'chapter', id: 'c', holes: [hole] });
    expect(chapterLayouts(pages, b).c.holes).toEqual([hole]);
    expect(chapterLayouts(pages, b).c.starts.some((s) => s.number === hole + 1)).toBe(true);
  });

  it('полотно книжки: глави — суцільними шматками, решта — окремими сторінками-макетами за номерами', () => {
    const b = book([
      { id: 'p', type: 'part', title: 'Частина', description: '', asset: '' },
      { id: 'c', type: 'chapter', title: 'Глава', body: [{ type: 'paragraph', runs: [{ text: 'Текст. '.repeat(300) }] }] },
      { id: 'i', type: 'plate', asset: '', title: 'Причал', caption: '', side: 'auto' },
      { id: 'q', type: 'questions', title: '', items: ['Чому?'], url: '', note: '' },
    ]);
    const pages = paginate(b, measure);
    // титул 1 · порожня 2 · частина 3 · глава 4 і 6, між ними ілюстрація 5 (під главою — після сторінки з назвою) · питання 7 · колофон 8
    expect(sheetSequence(pages)).toEqual([
      { kind: 'page', number: 1 }, { kind: 'page', number: 2 }, { kind: 'page', number: 3 },
      { kind: 'chapter', id: 'c', first: 4, pages: 3, holes: [5] },
      { kind: 'page', number: 7 }, { kind: 'page', number: 8 },
    ]);
    const previews = pagePreviews(pages, b, measure);
    expect(Object.keys(previews).map(Number)).toEqual([1, 2, 3, 5, 7, 8]);
    expect(previews[3]).toMatchObject({ kind: 'part', source: 'p' });
    expect(previews[2].kind).toBe('blank');
    // Питання без назви: місце під назву.
    expect(previews[7].lines.filter((l) => l.placeholder).map((l) => l.field)).toEqual(['title']);
  });

  it('порожні поля в показі — рядки-місця (placeholder) без тексту; у справжній сторінці їх немає', () => {
    const b = book([{ id: 'i', type: 'plate', asset: '', title: 'Причал', caption: '', side: 'auto' }]);
    const pages = paginate(b, measure);
    const real = pages.find((p) => p.kind === 'plate')!;
    expect(real.lines.map((l) => l.field)).toEqual(['title']);

    const shown = pagePreviews(pages, b, measure)[real.number];
    expect(shown.lines.map((l) => [l.field, l.placeholder ?? false, l.runs.map((r) => r.text).join('')]))
      .toEqual([['title', false, 'Причал'], ['caption', true, '']]);

    // Обкладинка порожньої книжки: місця під автора, назву й опис (рік на обкладинці не друкується), а також під QR.
    const title = pagePreviews(pages, b, measure)[1];
    expect(title.lines.filter((l) => l.placeholder).map((l) => l.field)).toEqual(['author', 'title', 'description']);
    expect(title.qr).toMatchObject({ url: '', placeholder: true });
  });

  it('інші блоки — без розкладки', () => {
    const b = book([{ id: 'p', type: 'part', title: 'Частина', description: '', asset: '' }]);
    expect(layouts(b)).toEqual({});
  });
});
