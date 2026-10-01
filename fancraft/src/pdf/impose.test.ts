import { describe, expect, it } from 'vitest';
import { bookletOrder } from './impose';

// Кожна пара — один бік аркуша: [ліва смуга, права смуга].
// Номери сторінок з 1; null — порожня смуга. План — аркушів у кожному зошиті.
describe('bookletOrder', () => {
  it('20 сторінок, один зошит на 5 аркушів', () => {
    expect(bookletOrder(20, [5])).toEqual([
      [20, 1], [2, 19], // аркуш 1: лице, зворот
      [18, 3], [4, 17],
      [16, 5], [6, 15],
      [14, 7], [8, 13],
      [12, 9], [10, 11], // серединний аркуш
    ]);
  });

  it('кожна сторінка рівно один раз', () => {
    const pages = bookletOrder(64, [4, 4, 4, 4]).flat().sort((a, b) => a! - b!);
    expect(pages).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it('сторінок менше, ніж місць у плані, — решта порожні', () => {
    expect(bookletOrder(18, [5]).slice(0, 3)).toEqual([[null, 1], [2, null], [18, 3]]);
  });

  it('два зошити по 4 аркуші', () => {
    const order = bookletOrder(32, [4, 4]);
    expect(order).toHaveLength(16);
    expect(order.slice(0, 2)).toEqual([[16, 1], [2, 15]]);
    expect(order.slice(8, 10)).toEqual([[32, 17], [18, 31]]);
  });

  it('останній зошит меншого розміру', () => {
    // 32 = 20 + 12: другий зошит — 3 аркуші на сторінки 21–32.
    expect(bookletOrder(32, [5, 3]).slice(10, 12)).toEqual([[32, 21], [22, 31]]);
  });

  it('сторінок більше, ніж місць у плані, — помилка', () => {
    expect(() => bookletOrder(24, [5])).toThrow();
  });
});
