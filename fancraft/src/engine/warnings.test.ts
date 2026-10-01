import { describe, expect, it } from 'vitest';
import type { Book } from '../model/types';
import { bookWarnings } from './warnings';

const book = (blocks: Book['blocks'] = [], assets: Book['assets'] = {}) => ({ blocks, assets }) as unknown as Book;

describe('bookWarnings', () => {
  it('до 8 зошитів — тихо; 8–10 — попередження; понад 10 — сильніше', () => {
    expect(bookWarnings(book(), Array(7).fill(5))).toEqual([]);
    expect(bookWarnings(book(), Array(8).fill(5))).toEqual([{ code: 'manySignatures', count: 8, limit: 10 }]);
    expect(bookWarnings(book(), Array(10).fill(5))).toEqual([{ code: 'manySignatures', count: 10, limit: 10 }]);
    expect(bookWarnings(book(), Array(11).fill(5))).toEqual([{ code: 'tooManySignatures', count: 11, limit: 10 }]);
  });

  it('ілюстрація без зображення або без його розмірів', () => {
    const plates: Book['blocks'] = [
      { id: 'a', type: 'plate', asset: '', title: ' Причал ', caption: '', side: 'auto' },
      { id: 'b', type: 'plate', asset: 'img/img_001.jpg', title: '', caption: '', side: 'auto' },
      { id: 'c', type: 'plate', asset: 'img/img_002.jpg', title: 'Є', caption: '', side: 'auto' },
    ];
    expect(bookWarnings(book(plates, { 'img/img_002.jpg': { widthPx: 10, heightPx: 10 } }), [5])).toEqual([
      { code: 'plateWithoutImage', title: 'Причал' },
      { code: 'plateWithoutImage', title: '' },
    ]);
  });
});
