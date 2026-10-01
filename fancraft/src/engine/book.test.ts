import { describe, expect, it } from 'vitest';
import { paginate } from './book';
import type { Block, Book, Measure, Pt } from '../model/types';

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

// Глава на одну сторінку.
const chapter = (title: string): Block => ({
  id: title || 'c', type: 'chapter', title, body: [{ type: 'paragraph', runs: [{ text: 'Короткий текст.' }] }],
});
const blank = (count: number, side: 'auto' | 'recto' | 'verso' = 'auto', title = ''): Block => ({
  id: 't', type: 'tabula_rasa', title, count, side,
});

const kinds = (blocks: Block[]) => paginate(book(blocks), measure).map((p) => p.kind);

describe('paginate', () => {
  it('порожня книжка — титул і колофон', () => {
    const pages = paginate(book([]), measure);
    expect(pages.map((p) => [p.number, p.kind, p.folio])).toEqual([[1, 'title', false], [2, 'colophon', false]]);
  });

  it('«Для нотаток» — одна розлінована сторінка: лінії з рядка під місцем назви', () => {
    const notes: Block = { id: 'n', type: 'tabula_rasa', title: 'Для нотаток', count: 1, side: 'auto', ruled: true };
    const page = paginate(book([notes]), measure).find((p) => p.source === 'n')!;
    expect(page.kind).toBe('tabula_rasa');
    expect(page.ruled).toBeGreaterThan(0);
    expect(paginate(book([blank(1)]), measure).find((p) => p.source === 't')!.ruled).toBeUndefined();
  });

  it('копірайт необов\'язковий: немає — без нього; front — с. 2 (зворот титулу); back і старі .book — остання', () => {
    const at = (copyright?: Book['copyright']) => paginate({ ...book([chapter('Перша')]), ...(copyright && { copyright }) }, measure).map((p) => p.kind);
    expect(at('none')).toEqual(['title', 'chapter']);
    expect(at('front')).toEqual(['title', 'colophon', 'chapter']);
    expect(at('back')).toEqual(['title', 'chapter', 'colophon']);
    expect(at()).toEqual(['title', 'chapter', 'colophon']);
  });

  it('глава — з наступної сторінки, лівої чи правої, без порожньої перед нею', () => {
    // Титул — с. 1 (права); глава — одразу на с. 2 (ліва).
    expect(kinds([chapter('Перша')])).toEqual(['title', 'chapter', 'colophon']);
  });

  it('глави підряд — кожна з наступної сторінки', () => {
    expect(kinds([chapter('Перша'), chapter('Друга')])).toEqual(['title', 'chapter', 'chapter', 'colophon']);
  });

  it('глава без назви — теж з наступної сторінки', () => {
    expect(kinds([chapter('Перша'), chapter('')])).toEqual(['title', 'chapter', 'chapter', 'colophon']);
  });

  it('порожня глава без назви не зникає — лишається сторінка з місцем під назву', () => {
    const empty: Block = { id: 'e', type: 'chapter', title: '', body: [] };
    expect(kinds([chapter('Перша'), empty]).filter((k) => k === 'chapter')).toHaveLength(2);
  });

  it('сторінки блоків знають свій блок; вставлені порожні — ні', () => {
    const pages = paginate(book([chapter('Перша'), blank(2)]), measure);
    expect(pages.map((p) => p.source)).toEqual([undefined, 'Перша', 't', 't', undefined]);
  });

  it('номери йдуть поспіль і рахують усі сторінки', () => {
    const pages = paginate(book([chapter('Перша'), blank(2), chapter('Друга')]), measure);
    expect(pages.map((p) => p.number)).toEqual(pages.map((_, i) => i + 1));
  });

  describe('plate', () => {
    const plate = (side: 'auto' | 'recto' | 'verso'): Block => ({
      id: 'p', type: 'plate', asset: 'img/img_001.jpg', title: '', caption: '', side,
    });
    const withImage = (blocks: Block[]) =>
      paginate({ ...book(blocks), assets: { 'img/img_001.jpg': { widthPx: 1200, heightPx: 800 } } }, measure);

    it('рівно одна сторінка без колонцифри, із зображенням', () => {
      const pages = withImage([plate('auto')]).filter((p) => p.kind === 'plate');
      expect(pages).toHaveLength(1);
      expect(pages[0].folio).toBe(false);
      expect(pages[0].figure?.asset).toBe('img/img_001.jpg');
    });

    it('ілюстрація під главою — розворот з її першою сторінкою: глава з с. 2 (ліва)', () => {
      const kindsOf = (side: 'auto' | 'recto' | 'verso') => withImage([chapter('Глава'), plate(side)]).map((p) => p.kind);
      // найближча й «праворуч»: назва на с. 2, ілюстрація на с. 3; «ліворуч»: ілюстрація на с. 2, назва на с. 3.
      expect(kindsOf('auto')).toEqual(['title', 'chapter', 'plate', 'colophon']);
      expect(kindsOf('recto')).toEqual(['title', 'chapter', 'plate', 'colophon']);
      expect(kindsOf('verso')).toEqual(['title', 'plate', 'chapter', 'colophon']);
    });

    it('розворот не складається — порожня перед ним: глава з правої, ілюстрація «праворуч»', () => {
      const part: Block = { id: 'P', type: 'part', title: 'Частина', description: '', asset: '' };
      // частина с. 3 → глава з с. 4 (ліва): «праворуч» складається без порожньої.
      expect(withImage([part, chapter('Глава'), plate('recto')]).map((p) => p.kind)).toEqual(['title', 'blank', 'part', 'chapter', 'plate', 'colophon']);
      // глава з с. 2 → ще одна глава з с. 3 (права): «праворуч» — порожня с. 3, назва с. 4, ілюстрація с. 5.
      const two = withImage([chapter('Перша'), { ...chapter('Друга'), id: 'Друга' }, plate('recto')]).map((p) => p.kind);
      expect(two).toEqual(['title', 'chapter', 'blank', 'chapter', 'plate', 'colophon']);
    });

    it('довга глава, найближча: ілюстрація одразу після сторінки з назвою, глава продовжується далі', () => {
      const long: Block = { id: 'L', type: 'chapter', title: 'Довга', body: Array.from({ length: 60 }, () => ({ type: 'paragraph' as const, runs: [{ text: 'Рядок тексту глави. '.repeat(6) }] })) };
      const pages = withImage([long, { ...plate('auto'), id: 'p' }]);
      const own = pages.filter((p) => p.source === 'L').map((p) => p.number);
      const at = pages.find((p) => p.kind === 'plate')!.number;
      expect(at).toBe(own[0] + 1);
      expect(own[1]).toBe(at + 1);
    });

    it('ілюстрація не під главою (під частиною) — на найближчій сторінці, бік не діє', () => {
      const part: Block = { id: 'P', type: 'part', title: 'Частина', description: '', asset: '' };
      expect(withImage([part, { ...plate('recto'), id: 'p' }]).map((p) => p.kind)).toEqual(['title', 'blank', 'part', 'plate', 'colophon']);
    });
  });

  it('частина книги — одна права сторінка без колонцифри; глава після неї — з наступної сторінки', () => {
    const part: Block = { id: 'p1', type: 'part', title: 'Частина перша', description: '', asset: '' };
    // титул 1 · Вступ 2 · частина 3 (права) · Перша 4 · колофон 5
    const pages = paginate(book([chapter('Вступ'), part, chapter('Перша')]), measure);
    expect(pages.map((p) => [p.kind, p.folio, p.source ?? null])).toEqual([
      ['title', false, null], ['chapter', false, 'Вступ'], ['part', false, 'p1'], ['chapter', false, 'Перша'], ['colophon', false, null],
    ]);
  });

  it('питання — з нової сторінки, без порожньої перед ними', () => {
    const q: Block = { id: 'q', type: 'questions', title: 'Що спитати', items: ['Чому?'], url: 'https://x', note: '' };
    const pages = paginate(book([chapter('Глава'), q]), measure);
    expect(pages.map((p) => p.kind)).toEqual(['title', 'chapter', 'questions', 'colophon']);
    expect(pages[2].qr?.url).toBe('https://x');
  });

  describe('tabula_rasa', () => {
    it('count сторінок без колонцифри; назва лише на першій', () => {
      const pages = paginate(book([blank(3, 'auto', 'Для нотаток')]), measure);
      const tr = pages.filter((p) => p.kind === 'tabula_rasa');
      expect(tr).toHaveLength(3);
      expect(tr.every((p) => !p.folio)).toBe(true);
      expect(tr.map((p) => p.lines.length)).toEqual([1, 0, 0]);
      expect(tr[0].lines[0].runs[0].text).toBe('Для нотаток');
    });

    it('side: recto — з правої, verso — з лівої, auto — одразу', () => {
      // Після титулу (с. 1) наступна — с. 2, ліва.
      expect(kinds([blank(1, 'verso')])).toEqual(['title', 'tabula_rasa', 'colophon']);
      expect(kinds([blank(1, 'recto')])).toEqual(['title', 'blank', 'tabula_rasa', 'colophon']);
      expect(kinds([blank(1, 'auto')])).toEqual(['title', 'tabula_rasa', 'colophon']);
    });

    it('вставлені й навмисні порожні сторінки розрізняються', () => {
      const pages = paginate(book([blank(2, 'recto'), chapter('Глава')]), measure);
      // title(1) blank(2) tr(3) tr(4) chapter(5)
      expect(pages.filter((p) => p.kind === 'blank')).toHaveLength(1);
      expect(pages.filter((p) => p.kind === 'tabula_rasa')).toHaveLength(2);
    });
  });
});
