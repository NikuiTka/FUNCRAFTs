import { describe, expect, it } from 'vitest';
import { missingGlyphs } from './layoutBook';

// Умовне покриття: є лише кирилиця, латиниця й розділові знаки.
const covers = (cp: number) => cp < 0x2000 && cp !== 0x3a9;

describe('missingGlyphs', () => {
  it('знаки, яких немає в шрифтах, — кожен один раз; пробіли й невидимі при емодзі не рахуються', () => {
    expect(missingGlyphs('Ω — Привіт, світ ⇒ Ω 中文 ️‍', covers)).toEqual(['Ω', '—', '⇒', '中', '文']);
  });

  it('усе є — порожньо', () => {
    expect(missingGlyphs('Звичайний текст.', covers)).toEqual([]);
  });
});
