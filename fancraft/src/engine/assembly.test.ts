import { describe, expect, it } from 'vitest';
import { assemblyLines } from './assembly';
import type { BookStats } from './stats';
import type { Settings } from '../model/types';

const settings: Settings = { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 };
const stats: BookStats = { pages: 40, sheets: 10, colorSheets: 1, plan: [5, 5], blanks: 4, intentionalBlanks: 2, free: 2 };

describe('assemblyLines', () => {
  it('формат, аркуші, повні зошити з папером, римські позначки й сторінки', () => {
    expect(assemblyLines(stats, settings, [7], 'uk')).toEqual([
      'Складальний аркуш',
      '',
      'Аркуш A4, книжка A5, двобічний друк, 100 %',
      '40 сторінок на 10 аркушах: 9 Ч/Б + 1 кольоровий',
      '2 зошити по 5 аркушів, папір 60–70 г/м²',
      '',
      'Зошит I — аркуші I · I … I · V, сторінки 1–20',
      'Зошит II — аркуші II · I … II · V, сторінки 21–40',
      '',
      'Кольорові аркуші: II · II',
      '',
      'Аркуші кожного зошита вкладаються один в одний за римськими позначками внизу правої сторінки.',
    ]);
  });

  it('англійською; без кольорових аркушів — без рядка про них', () => {
    const lines = assemblyLines({ ...stats, colorSheets: 0, plan: [3], pages: 12, sheets: 3 }, { ...settings, sheetsPerSignature: 3 }, [], 'en');
    expect(lines[0]).toBe('Assembly sheet');
    expect(lines).toContain('1 signature of 3 sheets, paper 90+ g/m²');
    expect(lines.some((l) => l.startsWith('Colour'))).toBe(false);
    expect(lines).toContain('Signature I — sheets I · I … I · III, pages 1–12');
  });
});
