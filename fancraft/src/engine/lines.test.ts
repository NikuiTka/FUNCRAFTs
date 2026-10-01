import { describe, expect, it } from 'vitest';
import { breakLines, type BreakOptions } from './lines';
import type { Line, Measure, Mm, Pt, Run } from '../model/types';

// Умовна метрика: звичайна й курсивна літера — 0,5 кегля, жирна — 0,6.
const measure: Measure = (text, face, size) =>
  (text.length * size * (face === 'bold' || face === 'boldItalic' ? 0.6 : 0.5)) as Pt;

const mm = (pt: number) => ((pt * 25.4) / 72) as Mm;

// Кегль 10: звичайна літера 5 pt. Смуга 250 pt — рівно 50 літер.
const opts = (o: Partial<BreakOptions> = {}): BreakOptions => ({
  width: mm(250), indent: 0 as Mm, size: 10 as Pt, align: 'justify', role: 'body', ...o,
});

const text = (line: Omit<Line, 'row'>) => line.runs.map((r) => r.text).join('');
const texts = (runs: Run[], o?: Partial<BreakOptions>) => breakLines(runs, opts(o), measure).map(text);

// 15 слів по 9 літер. Рядок: 5 слів = 49 літер ≤ 50, 6 слів = 59 > 50 → 3 рядки по 5 слів.
const words = Array.from({ length: 15 }, (_, i) => `слово${String(i).padStart(4, '0')}`);
const plain: Run[] = [{ text: words.join(' ') }];

describe('breakLines', () => {
  it('рядки заповнюються словами, поки влазять', () => {
    expect(texts(plain)).toEqual([
      words.slice(0, 5).join(' '),
      words.slice(5, 10).join(' '),
      words.slice(10).join(' '),
    ]);
  });

  it('слова не розриваються й не губляться', () => {
    expect(texts(plain).join(' ')).toBe(plain[0].text);
  });

  it('жирний міряється своєю шириною', () => {
    // Жирна літера 6 pt: 4 слова = 4×54 + 3×6 = 234 ≤ 250; 5 слів = 294 > 250.
    const bold: Run[] = [{ text: words.slice(0, 8).join(' '), b: true }];
    expect(texts(bold)).toEqual([words.slice(0, 4).join(' '), words.slice(4, 8).join(' ')]);
  });

  it('накреслення зберігаються, зокрема всередині слова', () => {
    const runs: Run[] = [{ text: 'сло' }, { text: 'во', b: true }, { text: ' далі ' }, { text: 'закреслене', s: true }];
    const [line] = breakLines(runs, opts(), measure);
    expect(line.runs).toEqual([
      { text: 'сло' }, { text: 'во', b: true }, { text: ' далі ' }, { text: 'закреслене', s: true },
    ]);
  });

  it('сусідні фрагменти з однаковим накресленням зливаються', () => {
    const [line] = breakLines([{ text: 'один ', i: true }, { text: 'два', i: true }], opts(), measure);
    expect(line.runs).toEqual([{ text: 'один два', i: true }]);
  });

  it('зайві пробіли стискаються, краї обрізаються', () => {
    expect(texts([{ text: '  один   два ' }, { text: '  три  ' }])).toEqual(['один два три']);
  });

  it('абзацний відступ звужує лише перший рядок', () => {
    // Відступ 25 pt = 5 літер → перший рядок 45 літер: 4 слова (39), 5 (49) не влазять.
    const lines = breakLines(plain, opts({ indent: mm(25) }), measure);
    expect(text(lines[0]).split(' ')).toHaveLength(4);
    expect(lines[0].indent).toBeCloseTo(mm(25), 9);
    expect(text(lines[1]).split(' ')).toHaveLength(5);
    expect(lines[1].indent).toBe(0);
  });

  it('останній рядок вирівняного абзацу — по лівому краю', () => {
    expect(breakLines(plain, opts(), measure).map((l) => l.align)).toEqual(['justify', 'justify', 'left']);
  });

  it('інші вирівнювання не змінюються; роль переходить у рядки', () => {
    const lines = breakLines(plain, opts({ align: 'center', role: 'chapterTitle' }), measure);
    expect(lines.every((l) => l.align === 'center' && l.role === 'chapterTitle')).toBe(true);
  });

  it('задовге слово стоїть сам-один, не губиться', () => {
    const long = 'а'.repeat(60);
    expect(texts([{ text: `перше ${long} останнє` }])).toEqual(['перше', long, 'останнє']);
  });

  it('порожній абзац — жодного рядка', () => {
    expect(breakLines([{ text: '   ' }], opts(), measure)).toEqual([]);
    expect(breakLines([], opts(), measure)).toEqual([]);
  });
});
