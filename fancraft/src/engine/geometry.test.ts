import { describe, expect, it } from 'vitest';
import { LEADING_RATIO, MARGIN_RATIO, SCHEMES, SHEETS } from '../config';
import { geometry } from './geometry';
import type { Settings } from '../model/types';

const settings = (s: Partial<Settings> = {}): Settings => ({
  sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5, ...s,
});

const MM_PER_PT = 25.4 / 72;

describe('geometry', () => {
  for (const sheet of ['A3', 'A4', 'A5'] as const) {
    describe(`аркуш ${sheet}`, () => {
      const g = geometry(settings({ sheet }));
      const page = { width: SHEETS[sheet].width / 2, height: SHEETS[sheet].height };

      it('сторінка — половина аркуша', () => {
        expect(g.page.width).toBeCloseTo(page.width, 6);
        expect(g.page.height).toBeCloseTo(page.height, 6);
      });

      it('поля — MARGIN_RATIO ширини сторінки з усіх боків; смуга — решта', () => {
        const m = page.width * MARGIN_RATIO;
        expect(g.margin).toBeCloseTo(m, 6);
        expect(g.textBlock.width).toBeCloseTo(page.width - 2 * m, 6);
        expect(g.textBlock.height).toBeCloseTo(page.height - 2 * m, 6);
      });

      it('рядків — скільки цілих кроків інтерліньяжу влазить у смугу, і не більше', () => {
        const step = g.leading * MM_PER_PT;
        expect(g.textBlock.lines * step).toBeLessThanOrEqual(g.textBlock.height + 1e-9);
        expect((g.textBlock.lines + 1) * step).toBeGreaterThan(g.textBlock.height);
      });
    });
  }

  it('інтерліньяж — LEADING_RATIO × кегль основного тексту', () => {
    expect(geometry(settings()).leading).toBeCloseTo(SCHEMES.medium.body * LEADING_RATIO, 6);
  });

  it('схема не залежить від формату: той самий кегль на A3 і на A5', () => {
    expect(geometry(settings({ sheet: 'A3' })).leading).toBe(geometry(settings({ sheet: 'A5' })).leading);
  });

  it('менший кегль — більше рядків на тій самій сторінці', () => {
    const lines = (scheme: Settings['scheme']) => geometry(settings({ scheme })).textBlock.lines;
    expect(lines('small')).toBeGreaterThan(lines('medium'));
    expect(lines('medium')).toBeGreaterThan(lines('large'));
  });
});
