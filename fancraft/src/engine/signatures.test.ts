import { describe, expect, it } from 'vitest';
import { roman, sheetMark, signaturePlan, withSignatures } from './signatures';
import type { Page } from '../model/types';

describe('signaturePlan', () => {
  it('зошити завжди повні: 106 сторінок по 5 аркушів — 6 зошитів по 5', () => {
    expect(signaturePlan(106, 5)).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('по 4 і по 3 аркуші', () => {
    expect(signaturePlan(108, 4)).toEqual(Array(7).fill(4));
    expect(signaturePlan(108, 3)).toEqual(Array(9).fill(3));
  });

  it('тонка книжка — один повний зошит', () => {
    expect(signaturePlan(10, 5)).toEqual([5]);
    expect(signaturePlan(20, 5)).toEqual([5]);
    expect(signaturePlan(21, 5)).toEqual([5, 5]);
    expect(signaturePlan(0, 5)).toEqual([]);
  });
});

describe('roman', () => {
  it('1–12', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(roman))
      .toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']);
  });
});

describe('sheetMark', () => {
  // [5, 3]: зошит I — сторінки 1–20, зошит II — 21–32.
  const plan = [5, 3];

  it('непарні сторінки першої половини зошита', () => {
    expect([1, 3, 5, 7, 9].map((p) => sheetMark(p, plan))).toEqual(
      [1, 2, 3, 4, 5].map((sheet) => ({ signature: 1, sheet })));
    expect([21, 23, 25].map((p) => sheetMark(p, plan))).toEqual(
      [1, 2, 3].map((sheet) => ({ signature: 2, sheet })));
  });

  it('парні й друга половина зошита — без позначки', () => {
    for (const p of [2, 10, 11, 19, 20, 22, 27, 32, 33]) expect(sheetMark(p, plan)).toBeNull();
  });
});

describe('withSignatures', () => {
  const page = (kind: Page['kind'], number: number): Page => ({ kind, number, folio: false, lines: [] });

  it('вільні сторінки — перед колофоном, колофон лишається останнім', () => {
    // 4 сторінки → повний зошит на 3 аркуші = 12: 8 вільних перед колофоном.
    const pages = [page('title', 1), page('blank', 2), page('chapter', 3), page('colophon', 4)];
    const result = withSignatures(pages, 3);
    expect(result.plan).toEqual([3]);
    expect(result.free).toBe(8);
    expect(result.pages.map((p) => p.kind)).toEqual(['title', 'blank', 'chapter', ...Array(8).fill('blank'), 'colophon']);
    expect(result.pages.map((p) => p.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('вже кратна кількість — без змін і без вільних', () => {
    const pages = Array.from({ length: 20 }, (_, i) => page(i === 19 ? 'colophon' : 'chapter', i + 1));
    const result = withSignatures(pages, 5);
    expect(result.pages).toHaveLength(20);
    expect(result.free).toBe(0);
  });
});
