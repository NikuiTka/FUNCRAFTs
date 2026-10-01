import { SCHEMES } from '../config';
import type { Line, Lines, Measure, Mm, Page, Settings, TocBlock } from '../model/types';
import { chapterPages } from './chapter';
import { geometry } from './geometry';
import { breakLines } from './lines';

const MM_PER_PT = 25.4 / 72;

export interface TocEntry {
  title: string;
  // null — перший прохід, номери ще невідомі.
  page: number | null;
  // Частина книги: жирним і з порожнім рядком перед нею (крім першого рядка змісту).
  part?: boolean;
}

// Сторінки змісту. Місце під номер резервується однакове в обох проходах,
// тож кількість рядків і сторінок змісту від самих номерів не залежить.
export function tocPages(block: TocBlock, entries: TocEntry[], settings: Settings, measure: Measure): Omit<Page, 'number'>[] {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const height = g.textBlock.lines;

  const title = block.title.trim()
    ? chapterPages({ id: block.id, type: 'chapter', title: block.title, body: [] }, settings, measure)[0].lines
    : [];
  const start = title.length ? Math.max(...title.map((l) => l.row)) + 1 + scheme.chapterTitle.spaceAfter : 0;

  const reserve = (measure('0000', 'regular', scheme.body) + measure(' ', 'regular', scheme.body)) * MM_PER_PT;
  const width = (g.textBlock.width - reserve) as Mm;

  const pages: Omit<Page, 'number'>[] = [];
  let lines: Line[] = [...title];
  let row = start;
  const newPage = () => {
    pages.push({ kind: 'toc', folio: !(title.length && pages.length === 0), lines });
    lines = [];
    row = 0;
  };

  for (const entry of entries) {
    const style = entry.part ? { b: true } : {};
    const titleLines = breakLines([{ text: entry.title, ...style }], { width, indent: 0 as Mm, size: scheme.body, align: 'left', role: 'body' }, measure);
    // Порожній рядок перед частиною — лише посеред сторінки, не нагорі.
    if (entry.part && row > (pages.length ? 0 : start)) row++;
    if (row > 0 && row + titleLines.length > height) newPage();
    for (const line of titleLines) lines.push({ ...line, row: (row++) as Lines });
    // Номер — на останньому рядку назви, по правому краю смуги.
    lines.push({ runs: [{ text: entry.page === null ? '' : String(entry.page), ...style }], indent: 0 as Mm, align: 'right', role: 'body', row: (row - 1) as Lines });
  }
  if (lines.length || !pages.length) newPage();
  return pages;
}
