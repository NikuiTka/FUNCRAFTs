import { describe, expect, it } from 'vitest';
import { chapterPages } from './chapter';
import type { ChapterBlock, Page, Para } from '../model/types';
import { ROWS, SPACE, SPACE_ROWS, TEXT_TOP, TITLE_BASE, measure, para, settings } from './testGrid';

// Розміри — з конфігу (testGrid): para(n) — абзац рівно на n рядків.
const chapter = (title: string, body: Para[]): ChapterBlock => ({ id: 'c', type: 'chapter', title, body });
const pages = (title: string, body: Para[]) => chapterPages(chapter(title, body), settings, measure);

const rows = (p: Omit<Page, 'number'>) => p.lines.map((l) => l.row);
const text = (p: Omit<Page, 'number'>[]) =>
  p.flatMap((pg) => pg.lines.filter((l) => l.role === 'body').map((l) => l.runs.map((r) => r.text).join(''))).join(' ');
const bodyOf = (p: Omit<Page, 'number'>) => p.lines.filter((l) => l.role === 'body');
const bodyRows = (p: Omit<Page, 'number'>) => bodyOf(p).map((l) => l.row);
// Скільки рядків треба заповнити на першій сторінці (під місцем назви), щоб після проміжку лишилося рівно free рядків.
const fillFor = (free: number) => ROWS - TEXT_TOP - free - SPACE_ROWS;

describe('chapterPages', () => {
  it('глава з назвою: назва з пропуском spaceBefore, після неї spaceAfter; між абзацами — проміжок', () => {
    const [first] = pages('День перший', [para(2), para(2), para(2)]);
    expect(first.lines[0]).toMatchObject({ role: 'chapterTitle', row: TITLE_BASE, align: 'center' });
    const T = TEXT_TOP;
    expect(rows(first).slice(1)).toEqual([T, T + 1, T + 2 + SPACE, T + 3 + SPACE, T + 4 + 2 * SPACE, T + 5 + 2 * SPACE]);
  });

  it('колонцифра: немає на першій сторінці глави з назвою, є на решті', () => {
    const p = pages('Назва', Array.from({ length: ROWS }, () => para(2)));
    expect(p.length).toBeGreaterThan(1);
    expect(p[0].folio).toBe(false);
    expect(p.slice(1).every((pg) => pg.folio)).toBe(true);
    expect(p.every((pg) => pg.kind === 'chapter')).toBe(true);
  });

  it('глава без назви: місце під назву є (порожній рядок назви), текст — під ним, як із назвою', () => {
    const [first] = pages('', [para(2)]);
    expect(first.lines[0]).toMatchObject({ role: 'chapterTitle', field: 'title', row: TITLE_BASE, runs: [{ text: '' }] });
    expect(bodyRows(first)).toEqual([TEXT_TOP, TEXT_TOP + 1]);
    expect(first.folio).toBe(false);
  });

  it('абзацний відступ — у всіх абзацах, крім першого; назва глави — жирна', () => {
    const [first] = pages('Назва', [para(1), para(1), para(1)]);
    const indents = first.lines.filter((l) => l.role === 'body').map((l) => l.indent > 0);
    expect(indents).toEqual([false, true, true]);
    expect(first.lines[0].runs).toEqual([{ text: 'Назва', b: true }]);
  });

  it('сторінка заповнюється до низу, абзац переходить на наступну', () => {
    // Після проміжку вільно 5 рядків (або трохи більше, якщо проміжок дробовий) — туди лягає частина абзацу на 8.
    const first = fillFor(5);
    const k = Math.floor(ROWS - TEXT_TOP - first - SPACE + 1e-9);
    const p = pages('', [para(first), para(8)]);
    expect(p).toHaveLength(2);
    expect(bodyOf(p[0])).toHaveLength(first + k);
    expect(Math.max(...rows(p[0]))).toBeLessThanOrEqual(ROWS - 1);
    expect(rows(p[1])).toEqual(Array.from({ length: 8 - k }, (_, i) => i));
  });

  it('проміжок між абзацами нагорі сторінки не ставиться', () => {
    const p = pages('', [para(ROWS - TEXT_TOP), para(2)]);
    expect(Math.max(...rows(p[0]))).toBe(ROWS - 1);
    expect(rows(p[1])).toEqual([0, 1]);
  });

  it('один рядок абзацу внизу сторінки не лишається — сторінка закінчується раніше', () => {
    // Вільно 2 рядки: абзац на 3 лишив би 1 на наступній → переходить цілим.
    const first = fillFor(2);
    const p = pages('', [para(first), para(3)]);
    expect(bodyOf(p[0])).toHaveLength(first);
    expect(p[1].lines).toHaveLength(3);
  });

  it('один рядок абзацу вгорі сторінки не лишається — розрив на рядок раніше', () => {
    // Вільно 3 рядки, абзац на 4: 3 + 1 — висячий рядок → 2 + 2.
    const first = fillFor(3);
    const p = pages('', [para(first), para(4)]);
    expect(bodyOf(p[0])).toHaveLength(first + 2);
    expect(p[1].lines).toHaveLength(2);
  });

  it('двохрядковий абзац не ділиться 1 + 1', () => {
    const first = fillFor(1);
    const p = pages('', [para(first), para(2)]);
    expect(bodyOf(p[0])).toHaveLength(first);
    expect(p[1].lines).toHaveLength(2);
  });

  it('жоден рядок не виходить за смугу, текст не губиться', () => {
    const body = [para(7), para(12), para(1), para(ROWS + 5), para(2), para(5)];
    const p = pages('Назва', body);
    for (const pg of p) for (const l of pg.lines) expect(l.row).toBeLessThan(ROWS);
    const expected = body.filter((b) => b.type === 'paragraph').map((b) => b.runs[0].text).join(' ');
    expect(text(p)).toBe(expected);
  });

  it('порожня глава без назви не зникає — одна сторінка з місцем під назву; з назвою — теж одна', () => {
    const empty = pages('', []);
    expect(empty).toHaveLength(1);
    expect(empty[0].lines).toEqual([expect.objectContaining({ role: 'chapterTitle', field: 'title', runs: [{ text: '' }] })]);
    expect(pages('Назва', [])).toHaveLength(1);
  });
});
