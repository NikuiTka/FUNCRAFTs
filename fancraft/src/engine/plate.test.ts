import { describe, expect, it } from 'vitest';
import { CAPTION_MIN_WIDTH_RATIO } from '../config';
import { platePage } from './plate';
import type { Asset, PlateBlock, Pt } from '../model/types';
import { H, L, PLATE_MIN_DPI, PLATE_OPTICAL_RAISE, ROWS, W, WIDE, WIDE_H, WIDE_W, measure, settings } from './testGrid';

const MM_PER_PT = 25.4 / 72;
const RAISE = PLATE_OPTICAL_RAISE * H;
// Ширина в мм, у яку зображення розтягується найбільше (PLATE_MIN_DPI).
const printable = (px: number) => (px / PLATE_MIN_DPI) * 25.4;

const plate = (title = '', caption = ''): PlateBlock => ({
  id: 'p', type: 'plate', asset: 'img/img_001.jpg', title, caption, side: 'auto',
});
const px = (widthPx: number, heightPx: number): Asset => ({ widthPx, heightPx });

describe('platePage', () => {
  it('велике зображення вписується в ширину смуги й стоїть трохи вище центру', () => {
    const page = platePage(plate(), WIDE, settings, measure);
    expect(page).toMatchObject({ kind: 'plate', folio: false, lines: [] });
    expect(page.figure!.width).toBeCloseTo(WIDE_W, 6);
    expect(page.figure!.height).toBeCloseTo(WIDE_H, 6);
    expect(page.figure!.x).toBeCloseTo((W - WIDE_W) / 2, 6);
    expect(page.figure!.y).toBeCloseTo((H - WIDE_H) / 2 - RAISE, 6);
    expect(page.figure!.asset).toBe('img/img_001.jpg');
  });

  it('мале зображення — не більше, ніж дозволяє PLATE_MIN_DPI, і по центру', () => {
    const { figure } = platePage(plate(), px(300, 200), settings, measure);
    const w = printable(300);
    expect(figure!.width).toBeCloseTo(w, 6);
    expect(figure!.height).toBeCloseTo(w * 2 / 3, 6);
    expect(figure!.x).toBeCloseTo((W - w) / 2, 6);
    expect(figure!.y).toBeCloseTo((H - w * 2 / 3) / 2 - RAISE, 6);
  });

  it('високе зображення впирається у висоту смуги, не виходить за верх', () => {
    const { figure } = platePage(plate(), px(1000, 3000), settings, measure);
    expect(figure!.height).toBeCloseTo(H, 6);
    expect(figure!.width).toBeCloseTo(H / 3, 6);
    expect(figure!.y).toBe(0);
  });

  it('підпис: рядок проміжку після зображення, заголовок жирний, опис курсивом', () => {
    // Композиція: зображення + рядок проміжку + 2 рядки підпису; підпис — з першого вільного рядка під зображенням + 1.
    const page = platePage(plate('Причал', 'Ранок, туман.'), WIDE, settings, measure);
    const y = (H - (WIDE_H + 3 * L)) / 2 - RAISE;
    expect(page.figure!.y).toBeCloseTo(y, 6);
    const first = Math.ceil((y + WIDE_H) / L - 1e-9) + 1;
    expect(page.lines.map((l) => [l.row, l.role])).toEqual([[first, 'captionTitle'], [first + 1, 'caption']]);
    expect(page.lines[0].runs).toEqual([{ text: 'Причал', b: true }]);
    expect(page.lines[1].runs).toEqual([{ text: 'Ранок, туман.', i: true }]);
    expect(page.lines.every((l) => l.align === 'left')).toBe(true);
  });

  it('підпис вирівняний по лівому краю зображення й не вужчий за частку смуги', () => {
    const long = Array.from({ length: 30 }, () => 'слово').join(' ');
    const page = platePage(plate('', long), px(300, 200), settings, measure);
    const image = printable(300) / MM_PER_PT;
    const width = Math.max(printable(300), W * CAPTION_MIN_WIDTH_RATIO) / MM_PER_PT;
    expect(page.lines.length).toBeGreaterThan(1);
    for (const line of page.lines) {
      expect(line.indent).toBeCloseTo(page.figure!.x, 6);
      expect(measure(line.runs.map((r) => r.text).join(''), 'italic', 9 as Pt)).toBeLessThanOrEqual(width);
    }
    // Рядки ширші за саме зображення — підпис тримає частку смуги.
    expect(Math.max(...page.lines.map((l) => measure(l.runs[0].text, 'italic', 9 as Pt)))).toBeGreaterThan(image);
  });

  it('не влазить — зменшується зображення, а не текст', () => {
    // Під підпис на 2 рядки — 4 рядки (проміжок, підпис, запас); решта — зображенню.
    const page = platePage(plate('Назва', 'Опис.'), px(1000, 3000), settings, measure);
    expect(page.figure!.height).toBeCloseTo((ROWS - 4) * L, 6);
    expect(page.lines.map((l) => l.row)).toEqual([ROWS - 3, ROWS - 2]);
  });

  it('порожні заголовок і опис підпису в PDF не виводяться — ні рядків, ні місця під них', () => {
    const empty = platePage(plate('', ''), WIDE, settings, measure);
    expect(empty.lines).toEqual([]);
    const spaces = platePage(plate('  ', ' '), WIDE, settings, measure);
    expect(spaces.lines).toEqual([]);
    expect(spaces.figure).toEqual(empty.figure);
  });

  it('зображення ще не вибране — сторінка з підписом, без рамки зображення', () => {
    const page = platePage(plate('Назва', 'Опис.'), undefined, settings, measure);
    expect(page.kind).toBe('plate');
    expect(page.figure).toBeUndefined();
    expect(page.lines.map((l) => l.role)).toEqual(['captionTitle', 'caption']);
  });
});
